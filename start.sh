#!/bin/bash
# A-018: start.sh — Only starts Next.js. Migrations are handled in pre-deploy, not here.
set -e

echo "[start.sh] Booting Ledger Network — humanidfi.com"
echo "[start.sh] NODE_ENV=${NODE_ENV}"
echo "[start.sh] PORT=${PORT:-3000}"

# ── START NEXT.JS ─────────────────────────────────────────────────────────────
echo "[start.sh] Starting Next.js server on port ${PORT:-3000}..."
exec npx next start -p "${PORT:-3000}" -H "0.0.0.0"
