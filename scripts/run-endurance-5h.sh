#!/usr/bin/env bash
# ==============================================================================
# Humanity Ledger — 5-Hour Protocol Marathon Runner (Bash / Linux / macOS / WSL)
# Continuous adversarial fuzzing, memory leak watchdog & invariant marathon.
# ==============================================================================

DURATION_HOURS="${1:-5}"

echo "=============================================================================="
echo "    STARTING HUMANITY LEDGER 5-HOUR PROTOCOL ENDURANCE MARATHON"
echo "=============================================================================="
echo "Target Duration:  ${DURATION_HOURS} hours"
echo "Target Branch:    claude/sync-and-hardening"
echo "Reports Dir:      ./reports/"
echo ""

# Ensure reports directory exists
mkdir -p reports

# Execute marathon
npx tsx scripts/endurance-5h-marathon.ts --hours="${DURATION_HOURS}"
