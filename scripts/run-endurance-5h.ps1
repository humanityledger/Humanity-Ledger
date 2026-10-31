# ==============================================================================
# Humanity Ledger — 5-Hour Protocol Marathon Runner (PowerShell)
# Continuous adversarial fuzzing, memory leak watchdog & invariant marathon.
# ==============================================================================

param(
  [double]$Hours = 5.0
)

$ErrorActionPreference = 'Stop'

Write-Host '==============================================================================' -ForegroundColor Cyan
Write-Host "    STARTING HUMANITY LEDGER 5-HOUR PROTOCOL ENDURANCE MARATHON" -ForegroundColor Cyan
Write-Host '==============================================================================' -ForegroundColor Cyan
Write-Host "Target Duration:  ${Hours} hours" -ForegroundColor Yellow
Write-Host 'Target Branch:    claude/sync-and-hardening' -ForegroundColor Gray
Write-Host "Reports Dir:      ./reports/`n" -ForegroundColor Gray

if (-not (Test-Path reports)) {
  New-Item -ItemType Directory -Path reports | Out-Null
}

npx.cmd tsx scripts/endurance-5h-marathon.ts --hours=$Hours
