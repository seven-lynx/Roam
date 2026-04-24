# Generates all required icon sizes from roam_logo.png
# Run from repo root: .\scripts\resize-icons.ps1

Add-Type -AssemblyName System.Drawing

$src = Join-Path $PSScriptRoot "..\roam_logo.png"
$srcImg = [System.Drawing.Image]::FromFile((Resolve-Path $src))

$targets = @(
    # Web / favicon
    @{ size = 16;   dest = "web\public\icon-16.png" },
    @{ size = 32;   dest = "web\public\icon-32.png" },
    @{ size = 180;  dest = "web\public\apple-touch-icon.png" },
    @{ size = 512;  dest = "web\public\icon-512.png" },
    # Extension (Chrome + Firefox)
    @{ size = 16;   dest = "extension\icons\icon-16.png" },
    @{ size = 32;   dest = "extension\icons\icon-32.png" },
    @{ size = 48;   dest = "extension\icons\icon-48.png" },
    @{ size = 128;  dest = "extension\icons\icon-128.png" },
    # Android / Play Store
    @{ size = 48;   dest = "android\res\icon-48.png" },
    @{ size = 72;   dest = "android\res\icon-72.png" },
    @{ size = 96;   dest = "android\res\icon-96.png" },
    @{ size = 144;  dest = "android\res\icon-144.png" },
    @{ size = 192;  dest = "android\res\icon-192.png" },
    @{ size = 512;  dest = "android\res\icon-512.png" }
)

foreach ($t in $targets) {
    $destPath = Join-Path $PSScriptRoot "..\$($t.dest)"
    $destDir  = Split-Path $destPath
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

    $bmp = New-Object System.Drawing.Bitmap($t.size, $t.size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($srcImg, 0, 0, $t.size, $t.size)
    $g.Dispose()
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "OK $($t.size)x$($t.size) -> $($t.dest)"
}

$srcImg.Dispose()
Write-Host ""
Write-Host "Done. Next: copy web\public\icon-32.png to web\public\favicon.ico"
