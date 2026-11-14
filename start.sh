#!/bin/bash
# start.sh - Boots Next.js on Railway for ledgerchat.org / www.ledgerchat.org
set -e

# Secrets are never defaulted to values written in this public repository: anyone could
# forge sessions with them. A missing secret gets a random value for this boot only
# (sessions end on restart) and a loud warning. Set them in Railway to make them stable.
secret_or_random() {
  name="$1"
  eval "current=\${$name:-}"
  if [ -z "$current" ]; then
    echo "[start.sh] WARNING: $name is not set. Using a random value for this boot only. Set $name in Railway." >&2
    export "$name=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
  fi
}
for v in ENCLAVE_PIN_PEPPER ENCLAVE_PIN_SECRET NEXTAUTH_SECRET JWT_SECRET ENCRYPTION_KEY; do
  secret_or_random "$v"
done
export NEXTAUTH_URL="${NEXTAUTH_URL:-https://ledgerchat.org}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://ledgerchat.org}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/humanity_ledger?schema=public}"
# prisma/schema.prisma uses DATABASE_URL_UNPOOLED as directUrl (migrations). Railway Postgres has no pooler,
# so the same URL is correct when only DATABASE_URL is set; a localhost default here made migrations fail.
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
export TREASURY_WALLET_ADDRESS="${TREASURY_WALLET_ADDRESS:-0x0000000000000000000000000000000000000000}"

if echo "$DATABASE_URL" | grep -q "localhost"; then
  echo "[start.sh] WARNING: DATABASE_URL points at localhost: communities, settings and invites will fail. Set DATABASE_URL to the Postgres service in Railway." >&2
fi

# Run pre-deploy migration check if database is configured
if [ -f scripts/railway-pre-deploy.js ]; then
  # A migration the script cannot resolve safely is logged as FATAL and left untouched (it never
  # deletes or forces anything). The server still starts, as it did up to #80: stopping the boot
  # here failed the healthcheck of every deploy from #81 to #87 and kept the site on old code.
  # /api/health reports the database state, so a schema problem stays visible.
  node scripts/railway-pre-deploy.js || echo "[start.sh] WARNING: pre-deploy migrations did not complete; see the [pre-deploy] lines above."
fi

# Railway Public Networking default for ledgerchat.org is port 8080, but respects $PORT if set.
APP_PORT="${PORT:-8080}"

echo "[start.sh] Booting Ledger Network - ledgerchat.org / www.ledgerchat.org"
echo "[start.sh] NODE_ENV=${NODE_ENV:-production}"
echo "[start.sh] Binding Next.js server to port ${APP_PORT} on 0.0.0.0..."

exec npx next start -p "${APP_PORT}" -H "0.0.0.0"
