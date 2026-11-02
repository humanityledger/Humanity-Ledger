# Humanity Ledger — Protocol Infrastructure & Deployment Specification

**Document Reference:** HL-OPS-DEPLOY-2026.1  
**Target Environment:** Testnet Stage 1 / Node Infrastructure  
**Version:** 1.1  
**Date:** 2 November 2026

---

## 1. Overview and Architecture

Humanity Ledger is deployed as a modular client-server system with client-side Zero-Knowledge proof computation
and non-custodial key isolation. The production deployment stack consists of:

1. **Application Layer**: Next.js 15 App Router running on Node.js 20+ runtime with strict COOP/COEP isolation headers.
2. **State Store**: PostgreSQL (managed via Prisma ORM) with connection pooling via PgBouncer.
3. **Cache & Rate Limiting**: Redis (Upstash or dedicated instance) enforcing sliding-window rate limits and single-use SIWE nonces.
4. **Decentralized Messaging**: XMTP network integration via client-side MLS SDK (RFC 9420).
5. **Real-Time Calling Infrastructure**: LiveKit SFU server paired with dedicated Coturn TURN relays (`iceTransportPolicy: relay`).
6. **Aztec L2 Connectivity**: RPC endpoint to an active Aztec Network sequencer/node (`AZTEC_NODE_URL`).
7. **Ethereum L1 Anchor**: Execution and consensus RPC connections to Base Sepolia (or Ethereum Mainnet).

---

## 2. Environment Variables & Secret Configuration

The protocol enforces fail-closed validation on startup (`lib/env.ts` and `lib/cronAuth.ts`). If any required
cryptographic secret is absent or shorter than 16 characters, the process exits with code 1.

```bash
# Core Application & Domains
NODE_ENV="production"
NEXT_PUBLIC_SITE_URL="https://your-domain.com"
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your_walletconnect_project_id"

# Database & Cache
DATABASE_URL="postgresql://user:password@pg-host:5432/humanity_ledger?sslmode=require"
REDIS_URL="redis://default:password@redis-host:6379"

# Cryptographic Authentication & Sessions (Minimum 32 bytes recommended)
JWT_SECRET="<32-byte-hex-string>"
JWT_EDDSA_PRIVATE_JWK="<json-web-key>"
JWT_EDDSA_PUBLIC_JWK="<json-web-key>"
ENCLAVE_PIN_PEPPER="<32-byte-hex-string>"

# Internal Service & Daemon Authorization (Fail-Closed, >= 16 chars)
CRON_SECRET="<32-byte-hex-string>"
INTERNAL_INGEST_KEY="<32-byte-hex-string>"
PRIVATE_VAULT_SECRET="<32-byte-hex-string>"
ADMIN_SECRET="<32-byte-hex-string>"
PULSE_SECRET="<32-byte-hex-string>"

# Aztec Network L2 Integration
NEXT_PUBLIC_ZK_MODE="testnet"
AZTEC_NODE_URL="http://your-aztec-node:8080"
AZTEC_L1_RPC_URL="https://sepolia.base.org"

# LiveKit & Calling Infrastructure
LIVEKIT_API_KEY="<livekit-api-key>"
LIVEKIT_API_SECRET="<livekit-api-secret>"
NEXT_PUBLIC_LIVEKIT_WS_URL="wss://your-livekit-host.com"
NEXT_PUBLIC_TURN_URLS="turn:turn.your-domain.com:3478"
NEXT_PUBLIC_TURN_USERNAME="turn-user"
NEXT_PUBLIC_TURN_CREDENTIAL="turn-password"
```

---

## 3. Step-by-Step Deployment Procedure

### Step 1: Preflight Verification
Prior to deploying any release artifact, verify that all CI and cryptographic checks pass cleanly:
```bash
npm run check:traceability
npm run check:patterns
npm run test:run
npm run test:contracts
npm audit
```

### Step 2: Database Migration
Execute versioned Prisma migrations against the target database:
```bash
npx prisma migrate deploy
```
> [!WARNING]
> Never use `prisma db push` in production environments. All schema migrations must be versioned and committed under `prisma/migrations/`.

### Step 3: Container Build & Service Execution
Using the project `Dockerfile` or container builder:
```bash
docker build -t humanity-ledger:latest .
docker run -d \
  -p 3000:3000 \
  --env-file .env.production \
  --name humanity-ledger-app \
  humanity-ledger:latest
```

---

## 4. Operational Health Checks

Verify operational integrity post-deployment:

```bash
# 1. Application Health
curl -s https://your-domain.com/api/health

# 2. Aztec Sequencer Integration Status
curl -s -H "Authorization: Bearer $INTERNAL_INGEST_KEY" \
  https://your-domain.com/api/aztec/sequencer/health

# 3. Database Connection Verification
curl -s https://your-domain.com/api/db/health
```

---

## 5. Security & Secret Rotation Protocol

1. **Monthly Rotation**: Rotate `JWT_SECRET` and EdDSA signing keys monthly. Old tokens are invalidated at the Edge.
2. **Immediate Rotation on Incident**: If any internal key is suspected of disclosure, execute the emergency rotation procedure in `docs/runbooks/secrets.md`.
3. **Audited Log Retention**: Ensure all API logs are piped through `lib/logger.ts` for automated PII and key scrubbing before storage.
