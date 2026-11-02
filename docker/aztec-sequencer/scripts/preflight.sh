#!/usr/bin/env bash
# Preflight for an Aztec v6 sequencer host. Read-only: it sends no
# transactions and never prints a private key.
#
#   cd docker/aztec-sequencer && ./scripts/preflight.sh
#
# Exit code: 0 all good, 1 something must be fixed before `docker compose up`.
set -uo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-.env}"
FAIL=0; WARN=0
ok()   { printf '  \033[32mok\033[0m    %s\n' "$*"; }
warn() { printf '  \033[33mwarn\033[0m  %s\n' "$*"; WARN=$((WARN+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; FAIL=$((FAIL+1)); }
need() { command -v "$1" >/dev/null 2>&1 || { echo "missing tool: $1"; exit 1; }; }
need curl; need jq

[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE. Copy aztec-sequencer.env.example to .env first."; exit 1; }
set -a; # shellcheck disable=SC1090
. "$ENV_FILE"; set +a

rpc() { # url method params-json
  curl -s -m 15 -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$2\",\"params\":$3}" "$1"
}

echo "== Network"
case "${AZTEC_NETWORK:-}" in
  mainnet) CHAIN_HEX=0x1;       REGISTRY=0x35b22e09Ee0390539439E24f06Da43D83f90e298; ROLLUP=0xe37a2663cc9c119ba41572c40fab0bbb23a5402f ;;
  testnet) CHAIN_HEX=0xaa36a7;  REGISTRY=0xA0BFb1B494FB49041e5c6e8c2C1BE09cD171c6Ba; ROLLUP=0x1f435a7f2da358caf887a470faeee7d5d5f4efba ;;
  *) bad "AZTEC_NETWORK must be mainnet or testnet (got '${AZTEC_NETWORK:-}')"; CHAIN_HEX=""; REGISTRY=""; ROLLUP="" ;;
esac
[ -n "$CHAIN_HEX" ] && ok "network $AZTEC_NETWORK"
grep -q 'azteclabs/aztec:6.0.0' docker-compose.yml && ok "image azteclabs/aztec:6.0.0" || bad "docker-compose.yml does not use azteclabs/aztec:6.0.0"
[ -z "${ROLLUP_VERSION:-}" ] && ok "ROLLUP_VERSION unset (follows the canonical rollup)" || bad "unset ROLLUP_VERSION: pinning it makes v6 fail at startup"

echo "== Ethereum execution (ETHEREUM_HOSTS)"
FIRST_HOST=""
IFS=',' read -ra HOSTS <<< "${ETHEREUM_HOSTS:-}"
[ ${#HOSTS[@]} -gt 0 ] || bad "ETHEREUM_HOSTS is empty"
for h in "${HOSTS[@]}"; do
  h="$(echo "$h" | xargs)"; [ -z "$h" ] && continue
  cid="$(rpc "$h" eth_chainId '[]' | jq -r '.result // empty')"
  if [ "$cid" = "$CHAIN_HEX" ]; then ok "$h chain $cid"; [ -z "$FIRST_HOST" ] && FIRST_HOST="$h"
  else bad "$h answered chain '${cid:-nothing}', expected $CHAIN_HEX"; fi
  syncing="$(rpc "$h" eth_syncing '[]' | jq -r '.result')"
  [ "$syncing" = "false" ] && ok "$h synced" || warn "$h reports syncing=$syncing"
done

echo "== Trace support (ETHEREUM_DEBUG_HOSTS)"
DEBUG_HOST="$(echo "${ETHEREUM_DEBUG_HOSTS:-}" | cut -d, -f1 | xargs)"; [ -z "$DEBUG_HOST" ] && DEBUG_HOST="$FIRST_HOST"
if [ -n "$DEBUG_HOST" ]; then
  TX="$(rpc "$DEBUG_HOST" eth_getBlockByNumber '["latest", false]' | jq -r '.result.transactions[0] // empty')"
  if [ -z "$TX" ]; then warn "could not find a recent transaction to test tracing"
  else
    d="$(rpc "$DEBUG_HOST" debug_traceTransaction "[\"$TX\", {\"tracer\":\"callTracer\"}]" | jq -r 'if .error then "err:" + (.error.message|tostring) else "ok" end')"
    t="$(rpc "$DEBUG_HOST" trace_transaction "[\"$TX\"]" | jq -r 'if .error then "err:" + (.error.message|tostring) else "ok" end')"
    if [ "$d" = "ok" ] || [ "$t" = "ok" ]; then ok "trace support on $DEBUG_HOST (debug: $d, trace: $t)"
    elif [ "${ETHEREUM_ALLOW_NO_DEBUG_HOSTS:-false}" = "true" ]; then warn "no trace support, ETHEREUM_ALLOW_NO_DEBUG_HOSTS=true: the node may stall"
    else bad "no debug_traceTransaction or trace_transaction on $DEBUG_HOST (debug: $d, trace: $t)"; fi
  fi
fi

echo "== Canonical rollup"
if [ -n "$FIRST_HOST" ] && [ -n "$REGISTRY" ]; then
  canon="$(rpc "$FIRST_HOST" eth_call "[{\"to\":\"$REGISTRY\",\"data\":\"0x971b0e6b\"},\"latest\"]" | jq -r '.result // empty')"
  canon="0x${canon: -40}"
  [ "$(echo "$canon" | tr 'A-F' 'a-f')" = "$ROLLUP" ] && ok "Registry points to the v6 rollup $ROLLUP" \
    || warn "Registry points to $canon, not $ROLLUP: a new rollup may be live, check announce.aztec.network"
fi

echo "== Ethereum consensus (L1_CONSENSUS_HOST_URLS)"
IFS=',' read -ra BEACONS <<< "${L1_CONSENSUS_HOST_URLS:-}"
[ ${#BEACONS[@]} -gt 0 ] || bad "L1_CONSENSUS_HOST_URLS is empty"
for b in "${BEACONS[@]}"; do
  b="$(echo "$b" | xargs)"; [ -z "$b" ] && continue
  s="$(curl -s -m 15 "${b%/}/eth/v1/node/syncing" | jq -r '.data.is_syncing // empty')"
  [ "$s" = "false" ] && ok "$b synced" || bad "$b: beacon API not reachable or syncing (is_syncing=${s:-?})"
done

echo "== Keys (KEY_STORE_DIRECTORY=${KEY_STORE_DIRECTORY:-})"
KD="${KEY_STORE_DIRECTORY:-./keys}"
if [ ! -d "$KD" ]; then bad "$KD does not exist"
else
  if ls "$KD"/*staker_output*.json >/dev/null 2>&1; then bad "$KD contains staker output files; move them out or the node will not start"; fi
  n=0
  for f in "$KD"/*.json; do
    [ -f "$f" ] || continue; n=$((n+1))
    jq -e '.schemaVersion == 1 and (.validators | length) > 0' "$f" >/dev/null 2>&1 \
      && ok "$(basename "$f"): $(jq '.validators | length' "$f") validator(s)" || bad "$(basename "$f") is not a v1 keystore"
    jq -e '[.validators[].attester | (.eth|type=="string") and (.bls|type=="string")] | all' "$f" >/dev/null 2>&1 \
      || bad "$(basename "$f"): every validator needs attester.eth and attester.bls"
    perm="$(stat -c '%a' "$f" 2>/dev/null || echo '')"
    case "$perm" in 600|400) ok "$(basename "$f") permissions $perm" ;; "") ;; *) warn "$(basename "$f") permissions $perm, use chmod 600" ;; esac
  done
  [ $n -gt 0 ] || bad "no keystore .json in $KD (create one with: aztec validator-keys new)"
fi

echo "== Networking"
PUB="$(curl -s -m 10 ipv4.icanhazip.com | tr -d '[:space:]')"
[ -n "${P2P_IP:-}" ] || bad "P2P_IP is empty"
[ -n "$PUB" ] && [ "$PUB" = "${P2P_IP:-}" ] && ok "P2P_IP matches this host ($PUB)" || warn "P2P_IP=${P2P_IP:-} but this host looks like ${PUB:-unknown}"
[ "${AZTEC_ADMIN_PORT:-8880}" != "${AZTEC_PORT:-8080}" ] && ok "admin port separate from API port" || bad "AZTEC_ADMIN_PORT must differ from AZTEC_PORT"
if command -v ss >/dev/null; then
  ss -ltnu 2>/dev/null | grep -q ":${P2P_PORT:-40400} " && warn "port ${P2P_PORT:-40400} already in use on this host (another node?)" || ok "port ${P2P_PORT:-40400} free"
fi
echo "     From another machine, check: nc -vz ${P2P_IP:-<ip>} ${P2P_PORT:-40400}  and  nc -vu ${P2P_IP:-<ip>} ${P2P_PORT:-40400}"

echo "== Hardware (docs minimum: 8 cores, 8 GB RAM, 1 TB NVMe)"
cores="$(nproc 2>/dev/null || echo 0)"; [ "$cores" -ge 8 ] && ok "$cores CPU threads" || warn "$cores CPU threads"
mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"; [ "$mem_kb" -ge 7800000 ] && ok "$((mem_kb/1024/1024)) GB RAM" || warn "$((mem_kb/1024/1024)) GB RAM"
mkdir -p "${DATA_DIRECTORY:-./data}"
free_gb="$(df -BG --output=avail "${DATA_DIRECTORY:-./data}" 2>/dev/null | tail -1 | tr -dc '0-9')"
[ "${free_gb:-0}" -ge 900 ] && ok "${free_gb} GB free for data" || warn "${free_gb:-?} GB free for data"
[ -z "$(ls -A "${DATA_DIRECTORY:-./data}" 2>/dev/null)" ] && ok "data directory is empty (fresh v6 state)" || warn "data directory is not empty: v6 needs a new, empty one if this came from v5"

echo "== Docker"
command -v docker >/dev/null && ok "$(docker --version)" || bad "docker not installed"
docker compose version >/dev/null 2>&1 && ok "docker compose v2" || bad "docker compose v2 not available"

echo
echo "Result: $FAIL to fix, $WARN warnings."
[ $FAIL -eq 0 ]
