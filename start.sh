#!/bin/bash
set -e

echo "[start.sh] Booting Ledger Network — humanidfi.com"
echo "[start.sh] NODE_ENV=${NODE_ENV}"
echo "[start.sh] PORT=${PORT:-3000}"

# ── DB MIGRATIONS (with retry) ────────────────────────────────────────────────
# Retry up to 10 times with 5s delay to handle Railway DB cold-start latency.
if [ -f "/app/prisma/schema.prisma" ]; then
  echo "[start.sh] Deploying Prisma migrations..."
  MAX_RETRIES=10
  RETRY=0
  until npx prisma migrate deploy --schema=/app/prisma/schema.prisma 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
      echo "[start.sh] WARNING: DB migration deploy failed after ${MAX_RETRIES} retries — starting anyway."
      break
    fi
    echo "[start.sh] DB not ready, retry ${RETRY}/${MAX_RETRIES} in 5s..."
    sleep 5
  done
  echo "[start.sh] DB migrations complete."
fi

# ── PRISMA CLIENT ─────────────────────────────────────────────────────────────
npx prisma generate 2>/dev/null || echo "[start.sh] Prisma generate skipped."

# ── START NEXT.JS ─────────────────────────────────────────────────────────────
echo "[start.sh] Starting Next.js server on port ${PORT:-3000}..."
exec npx next start -p "${PORT:-3000}" -H "0.0.0.0"
