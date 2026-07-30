# sync-public.ps1 — Filter and push a clean copy of main to the public repo
# 
# Architecture: Private repo is the source of truth. This script creates a
# filtered branch (stripping internal tooling like scripts/, docs/) and pushes
# it to the public remote while keeping the public history clean.
#
# Usage: .\sync-public.ps1
#   - Run from the private repo root after pushing to origin (private)
#   - Requires: git access to both remotes, PowerShell

$ErrorActionPreference = "Stop"

$privateRemote = "origin"
$publicRemote  = "private"   # name of the public remote in private repo
$filterBranch  = "public-mirror"
$targetBranch  = "main"

# Paths to exclude from public repo (internal tooling / proprietary)
$excludePaths = @(
    "scripts/",
    "docs/",
    ".github/skills/"
)

Write-Host "=== sync-public ===" -ForegroundColor Cyan
Write-Host ""

# 1. Ensure we're on main and up to date
$currentBranch = git branch --show-current
if ($currentBranch -ne $targetBranch) {
    Write-Host "[ERROR] Must be on '$targetBranch' branch. Current: $currentBranch" -ForegroundColor Red
    exit 1
}

Write-Host "[1/4] Fetching remotes..." -ForegroundColor Gray
git fetch $privateRemote $targetBranch
git fetch $publicRemote $targetBranch

# 2. Create orphan branch from private main
Write-Host "[2/4] Creating filtered branch from $privateRemote/$targetBranch..." -ForegroundColor Gray

# Remove old filter branch if it exists
git branch -D $filterBranch 2>$null

# Create orphan from the private main commit
$privateCommit = git rev-parse "$privateRemote/$targetBranch"
git checkout --orphan $filterBranch $privateCommit

# 3. Remove proprietary paths from the index
Write-Host "[3/4] Stripping internal files..." -ForegroundColor Gray

foreach ($path in $excludePaths) {
    if (Test-Path $path) {
        git rm -r --cached --quiet $path 2>$null
        Write-Host "  Removed: $path" -ForegroundColor DarkGray
    }
}

# Commit the filtered tree
git commit -m "sync: filtered public mirror" --quiet

# 4. Force-push to public remote
Write-Host "[4/4] Pushing to public remote ($publicRemote)..." -ForegroundColor Gray
git push $publicRemote "${filterBranch}:${targetBranch}" --force

# Cleanup: return to main and remove filter branch
git checkout $targetBranch
git branch -D $filterBranch

Write-Host ""
Write-Host "Done. Private and public remotes are now in sync." -ForegroundColor Green