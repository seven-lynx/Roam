$ErrorActionPreference = 'SilentlyContinue'
Write-Output '=== winget ==='
$wa = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\winget.exe'
if (Test-Path $wa) { Write-Output $wa } else { Write-Output 'winget not found in WindowsApps' }
$wgcmd = (Get-Command winget -ErrorAction SilentlyContinue).Source
Write-Output ('winget on PATH: ' + $wgcmd)

Write-Output ''
Write-Output '=== choco ==='
Write-Output ((Get-Command choco -ErrorAction SilentlyContinue).Source)

Write-Output ''
Write-Output '=== scoop ==='
Write-Output ((Get-Command scoop -ErrorAction SilentlyContinue).Source)
