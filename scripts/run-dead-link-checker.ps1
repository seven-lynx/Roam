# run-dead-link-checker.ps1
# Auto-restarts check-dead-urls.mjs on crash, resuming from checkpoint each time.
# Usage: .\run-dead-link-checker.ps1 [extra args]
#   .\run-dead-link-checker.ps1 --concurrency 50
#   .\run-dead-link-checker.ps1 --concurrency 50 --commit

$ScriptPath = Join-Path $PSScriptRoot "check-dead-urls.mjs"
$ExtraArgs  = $args

$attempt = 0

while ($true) {
    $attempt++
    $progress = "unknown"
    $progressFile = Join-Path $PSScriptRoot ".cache\dead-links-progress.json"
    if (Test-Path $progressFile) {
        try {
            $json = Get-Content $progressFile -Raw | ConvertFrom-Json
            $progress = "{0:N0}" -f $json.checkedCount
        } catch {}
    }

    Write-Host ""
    Write-Host "=== Attempt $attempt  (checkpoint: $progress URLs checked) ===" -ForegroundColor Cyan
    Write-Host (Get-Date -Format "yyyy-MM-dd HH:mm:ss") -ForegroundColor Gray
    Write-Host ""

    $nodeArgs = @("--max-old-space-size=4096", $ScriptPath) + $ExtraArgs
    & node @nodeArgs
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "=== Completed successfully ===" -ForegroundColor Green
        break
    }

    Write-Host ""
    Write-Host "=== Exited with code $exitCode - restarting in 5s... ===" -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}
