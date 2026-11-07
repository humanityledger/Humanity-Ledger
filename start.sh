#!/bin/bash
# A-018: start.sh - Boots Next.js on Railway for ledgerchat.org
set -e

# Railway Public Networking default for ledgerchat.org is port 8080, but respects $PORT if set.
APP_PORT="${PORT:-8080}"

echo "[start.sh] Booting Ledger Network - ledgerchat.org / www.ledgerchat.org"
echo "[start.sh] NODE_ENV=${NODE_ENV:-production}"
echo "[start.sh] Binding Next.js server to port ${APP_PORT} on 0.0.0.0..."

exec npx next start -p "${APP_PORT}" -H "0.0.0.0"
