# =============================================================================
#  push.ps1 - Commit + push nhanh mot phan viec da hoan thanh (RULE #1 trong CLAUDE.md)
# =============================================================================
#  Cach dung:
#     pwsh -File scripts/push.ps1 "feat: them buc nhay lo xo"
#
#  Script se:
#     [1] Kiem tra co thay doi khong (khong co thi dung lai)
#     [2] Chay `npm run build` de chac chan code khong hong
#     [3] git add -A  ->  git commit  ->  git push
# =============================================================================

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message,

    # Bo qua buoc build (chi dung khi commit tai lieu thuan tuy)
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

# --- [1] Co gi de commit khong? ---------------------------------------------
if (-not (git status --porcelain)) {
    Write-Host "[push.ps1] Khong co thay doi nao. Dung lai." -ForegroundColor Yellow
    exit 0
}

# --- [2] Cong tac kiem tra: build phai xanh truoc khi push -------------------
if (-not $SkipBuild) {
    Write-Host "[push.ps1] Dang chay npm run build..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[push.ps1] BUILD HONG -> KHONG PUSH. Sua loi roi chay lai." -ForegroundColor Red
        exit 1
    }
    Write-Host "[push.ps1] Build OK." -ForegroundColor Green
}

# --- [3] Commit + push ------------------------------------------------------
$full = "$Message`n`nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git add -A
git commit -m $full
if ($LASTEXITCODE -ne 0) { Write-Host "[push.ps1] Commit that bai." -ForegroundColor Red; exit 1 }

git push
if ($LASTEXITCODE -ne 0) { Write-Host "[push.ps1] Push that bai." -ForegroundColor Red; exit 1 }

Write-Host "[push.ps1] Da push len GitHub: $Message" -ForegroundColor Green
