# Generates all required icon sizes
# roam_logo2.png -> web app + extension
# roam_logo.png  -> Android
# Run from repo root: .\scripts\resize-icons.ps1

Add-Type -AssemblyName System.Drawing

$logo2 = [System.Drawing.Image]::FromFile((Resolve-Path (Join-Path $PSScriptRoot "..\assets\roam_logo2.png")))
$logo1 = [System.Drawing.Image]::FromFile((Resolve-Path (Join-Path $PSScriptRoot "..\assets\roam_logo.png")))

$targets = @(
    # Web / favicon  (roam_logo2)
    @{ size = 16;   dest = "web\public\icon-16.png";          src = $logo2 },
    @{ size = 32;   dest = "web\public\icon-32.png";          src = $logo2 },
    @{ size = 180;  dest = "web\public\apple-touch-icon.png"; src = $logo2 },
    @{ size = 512;  dest = "web\public\icon-512.png";         src = $logo2 },
    # Extension — roam_logo2, tight-cropped to content bounds (no whitespace)
    # Content at (30,88)-(448,431) = 419w x 344h; square = 344x344 centered horizontally → x=67,y=88
    @{ size = 16;   dest = "extension\icons\icon-16.png";     src = $logo2; crop = @(67,88,344,344) },
    @{ size = 32;   dest = "extension\icons\icon-32.png";     src = $logo2; crop = @(67,88,344,344) },
    @{ size = 48;   dest = "extension\icons\icon-48.png";     src = $logo2; crop = @(67,88,344,344) },
    @{ size = 128;  dest = "extension\icons\icon-128.png";    src = $logo2; crop = @(67,88,344,344) },
    # Android / Play Store  (roam_logo — do not change)
    @{ size = 48;   dest = "android\res\icon-48.png";         src = $logo1 },
    @{ size = 72;   dest = "android\res\icon-72.png";         src = $logo1 },
    @{ size = 96;   dest = "android\res\icon-96.png";         src = $logo1 },
    @{ size = 144;  dest = "android\res\icon-144.png";        src = $logo1 },
    @{ size = 192;  dest = "android\res\icon-192.png";        src = $logo1 },
    @{ size = 512;  dest = "android\res\icon-512.png";        src = $logo1 }
)

foreach ($t in $targets) {
    $destPath = Join-Path $PSScriptRoot "..\$($t.dest)"
    $destDir  = Split-Path $destPath
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

    $bmp = New-Object System.Drawing.Bitmap($t.size, $t.size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    if ($t.crop) {
        $srcRect  = New-Object System.Drawing.Rectangle($t.crop[0], $t.crop[1], $t.crop[2], $t.crop[3])
        $destRect = New-Object System.Drawing.Rectangle(0, 0, $t.size, $t.size)
        $g.DrawImage($t.src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    } else {
        $g.DrawImage($t.src, 0, 0, $t.size, $t.size)
    }
    $g.Dispose()
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "OK $($t.size)x$($t.size) -> $($t.dest)"
}

$logo2.Dispose()
$logo1.Dispose()
Write-Host ""
Write-Host "Done. Next: copy web\public\icon-32.png to web\public\favicon.ico"
