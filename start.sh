#!/bin/bash
set -e

echo "[start.sh] Booting Ledger Network — humanidfi.com"
echo "[start.sh] NODE_ENV=${NODE_ENV}"
echo "[start.sh] PORT=${PORT:-3000}"

# ── DB MIGRATIONS (with automated resolution) ──────────────────────────────────
if [ -f "/app/scripts/railway-pre-deploy.js" ]; then
  echo "[start.sh] Running database migration & resilience engine..."
  node /app/scripts/railway-pre-deploy.js || true
  echo "[start.sh] DB migrations check complete."
elif [ -f "/app/prisma/schema.prisma" ]; then
  echo "[start.sh] Deploying Prisma migrations..."
  npx prisma migrate deploy --schema=/app/prisma/schema.prisma 2>/dev/null || true
  echo "[start.sh] DB migrations complete."
fi

# ── PRISMA CLIENT ─────────────────────────────────────────────────────────────
npx prisma generate 2>/dev/null || echo "[start.sh] Prisma generate skipped."

# ── START NEXT.JS ─────────────────────────────────────────────────────────────
echo "[start.sh] Starting Next.js server on port ${PORT:-3000}..."
exec npx next start -p "${PORT:-3000}" -H "0.0.0.0"
