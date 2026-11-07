#!/bin/bash
# start.sh - Boots Next.js on Railway for ledgerchat.org / www.ledgerchat.org
set -e

# Default environment variables for standalone zero-database deployment
export ENCLAVE_PIN_PEPPER="${ENCLAVE_PIN_PEPPER:-whale_enclave_argon2id_pepper_2026_prod_secret}"
export ENCLAVE_PIN_SECRET="${ENCLAVE_PIN_SECRET:-whale_enclave_hmac_secret_2026_change_in_prod}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-ledgerchat_org_prod_nextauth_secret_0123456789}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-https://ledgerchat.org}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://ledgerchat.org}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/humanity_ledger?schema=public}"
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-postgresql://postgres:postgres@localhost:5432/humanity_ledger?schema=public}"
export TREASURY_WALLET_ADDRESS="${TREASURY_WALLET_ADDRESS:-0x0000000000000000000000000000000000000000}"

# Run pre-deploy migration check if database is configured
if [ -f scripts/railway-pre-deploy.js ]; then
  node scripts/railway-pre-deploy.js || true
fi

# Railway Public Networking default for ledgerchat.org is port 8080, but respects $PORT if set.
APP_PORT="${PORT:-8080}"

echo "[start.sh] Booting Ledger Network - ledgerchat.org / www.ledgerchat.org"
echo "[start.sh] NODE_ENV=${NODE_ENV:-production}"
echo "[start.sh] Binding Next.js server to port ${APP_PORT} on 0.0.0.0..."

exec npx next start -p "${APP_PORT}" -H "0.0.0.0"
