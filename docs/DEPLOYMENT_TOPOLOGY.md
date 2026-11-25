# Humanity Ledger — Deployment Topology & Degradation Paths
**Version 1.0 — 2026-10-31**  
**Authority**: Directive Section 4.4

---

## 1. Current Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────────────────────────────┐ │
│  │ Aztec PXE    │  │  Next.js App (ledgerchat.org)         │ │
│  │ EmbeddedWallet│  │  ┌──────────────────────────────┐   │ │
│  │ (client-only)│  │  │ EAF Sandbox (iframe)         │   │ │
│  │ UltraHonk    │  │  │ connect-src: 'none'          │   │ │
│  │ proof gen    │  │  └──────────────────────────────┘   │ │
│  └──────┬───────┘  └────────────────┬─────────────────────┘ │
│         │                           │                        │
└─────────┼───────────────────────────┼────────────────────────┘
          │ ZK Proofs (HTTPS)         │ App Requests (HTTPS)
          ▼                           ▼
┌─────────────────────┐  ┌────────────────────────────────────┐
│  Aztec Testnet RPC  │  │  Railway (Next.js App Server)      │
│  aztec-testnet.drpc │  │  ┌──────────────┬───────────────┐  │
│  .org               │  │  │ PostgreSQL   │ Redis Cache   │  │
│  (fallback: Aztec   │  │  │ (Read Replicas)│ (Rate Limit)│  │
│  Labs official RPC) │  │  └──────────────┴───────────────┘  │
└─────────────────────┘  └────────────────────────────────────┘
          │                           │
          │                           │ Auth / Identity
          │                           ▼
          │                 ┌───────────────────┐
          │                 │  Clerk Auth       │
          │                 │  (Auth provider)  │
          │                 └───────────────────┘
          │
          │ Messaging (MLS/XMTP)
          ▼
┌─────────────────────┐
│  XMTP Network       │
│  (XMTP Labs nodes)  │
└─────────────────────┘
```

### Component Inventory

| Component | Provider | Region | SLA |
|---|---|---|---|
| Next.js App Server | Railway | US-West | 99.9% (Railway SLA) |
| PostgreSQL (primary) | Railway Managed | US-West | 99.9% |
| PostgreSQL (read replica ×2) | Railway Managed | US-West | 99.9% |
| Redis | Railway Redis | US-West | 99.9% |
| Aztec Node (primary) | drpc.org testnet | Global CDN | Best-effort testnet |
| Aztec Node (fallback) | Run by Aztec Labs | Global | Best-effort testnet |
| XMTP Nodes | XMTP Labs | Global | 99.5% (XMTP SLA) |
| Auth | Clerk | Global CDN | 99.99% |
| L1 Contracts | Ethereum Mainnet | Global | 99.99%+ |

---

## 2. Degradation Modes

### Mode 1: Aztec Network Unavailable

**Trigger**: `aztec-testnet.drpc.org` and fallback RPC both unreachable for > 60 seconds.

| Action | User Experience |
|---|---|
| ZK proof submission blocked | Banner: "ZK features temporarily unavailable. Your data is safe client-side." |
| Read-only mode activated | Users can view balances and message history |
| Client retains witnesses | No private state loss |
| `LedgerDeadmanSwitch` assessment | Protocol lead evaluates if freeze is warranted |

**Recovery**: Automatic on Aztec RPC restoration; no user action required.

### Mode 2: XMTP Network Degraded

**Trigger**: XMTP SDK returns persistent errors for > 30 seconds.

| Action | User Experience |
|---|---|
| Outbound messages queued client-side | Banner: "Messages are queued. Delivery resumes when network recovers." |
| Inbound message polling suspended | Last-known message state shown |
| MLS epoch advances paused | No PCS during outage; resumes on recovery |

**Recovery**: Automatic on XMTP restoration; queued messages retransmitted.

### Mode 3: Railway App Server Unavailable

**Trigger**: All Railway instances fail health check.

| Action | Fallback |
|---|---|
| CDN-cached static pages served | Cloudflare cache serves last-known good HTML |
| API endpoints unavailable | `503 Service Unavailable` |
| Client-side ZK still functional | User can generate proofs locally; cannot submit until server recovers |

**Recovery**: Railway auto-restart; typically < 2 minutes.

### Mode 4: PostgreSQL Primary Unavailable

**Trigger**: Primary PostgreSQL instance fails health check.

| Action | Fallback |
|---|---|
| Read replicas continue serving read queries | Read-only mode |
| Write operations blocked | Users see "Temporarily read-only" banner |
| Railway managed failover | Automatic promotion of replica to primary (< 30s) |

---

## 3. Multi-Region Roadmap (Post-Mainnet)

| Phase | Regions | Trigger |
|---|---|---|
| Phase 1 (current) | US-West only | Development / testnet |
| Phase 2 | US-West + EU-West | At 10,000 active users |
| Phase 3 | US-West + EU-West + AP-South | At 100,000 active users |

**Multi-region considerations**:
- XMTP is already globally distributed
- PostgreSQL sharding by region for data residency compliance
- Aztec RPC: select regionally-closest endpoint
- Clerk: already global CDN

---

## 4. Disaster Recovery

| Scenario | RTO | RPO | Procedure |
|---|---|---|---|
| App server crash | < 2 min | 0 (stateless) | Railway auto-restart |
| Database corruption | < 30 min | < 5 min | Restore from Railway automated backup |
| Private key leak (server) | N/A | N/A | No server-side private keys exist |
| L1 contract exploit | < 1 hour | 0 (blockchain) | `LedgerDeadmanSwitch` activation |
| Full Railway outage | < 4 hours | < 5 min | Re-deploy to alternative provider (Vercel/Fly.io) |

**RTO** = Recovery Time Objective | **RPO** = Recovery Point Objective

---

## 5. Health Check Endpoints

| Endpoint | Checks |
|---|---|
| `GET /api/health` | App server up, DB connection, Redis connection |
| `GET /api/health/aztec` | Aztec RPC reachable, batch call succeeds |
| `GET /api/health/deep` | Full dependency check: DB, Redis, Aztec, XMTP ping |

---

## 6. Monitoring Integration

See `docs/OBSERVABILITY.md` for the full metrics list. Critical deployment health metrics:

- `hl_active_connections` > 8,000 → scale-out trigger
- `hl_http_errors_total{status="5xx"}` > 1% → alert
- `pg_stat_activity_count` > 90 → connection pool alert

---

## 7. 3M+ MAU Production Architecture & Environment Variables

To sustain **3,000,000+ MAU / 300k–1M concurrent sessions** without overloading Railway web pods, PostgreSQL, or Redis:

| Layer | Scaling Control | Key Env Vars |
|---|---|---|
| **Object Storage (up to 32 GiB files, avatars, story media)** | Direct S3v4 presigned PUT/GET URLs via Cloudflare R2 + Redis hourly upload quota | `R2_ENDPOINT` (or `R2_ACCOUNT_ID`), `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CHAT_UPLOAD_QUOTA_BYTES_PER_HOUR` |
| **PostgreSQL + Read Replicas** | PgBouncer pool limit per pod + dedicated read replica (`prismaRead`) + B-tree prefix search indexes + batch retention cleanup | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_READ_URL`, `PRISMA_CONNECTION_LIMIT` |
| **Multi-Replica Rate Limits & Shared State** | Bounded L1 Edge LRU + Upstash Edge REST + L2 Redis ZSET/Lua + shared Cloudflare TURN credential cache (`calls:cf_ice_cache:v1`) | `REDIS_URL`, `REDIS_REQUIRED_IN_CLUSTER`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `GEOBLOCK_RESTRICTED_COUNTRIES` |
| **SSE Multiplexing & Dedicated Gateway** | Single pod-level Redis subscriber + shared `XREAD` loop + 10s Redis catch-up cache; optional dedicated SSE gateway origin | `MAX_CONCURRENT_SSE`, `NEXT_PUBLIC_SSE_GATEWAY_URL` |
| **Aztec RPC Relay & XMTP Self-Hosted** | Multi-upstream circuit breaker + single-flight public RPC coalescing/caching; CDN-cached JWKS + stateless `/api/xmtp/token` | `AZTEC_NODE_RELAY_UPSTREAMS`, `NEXT_PUBLIC_XMTP_SELF_HOSTED`, `NEXT_PUBLIC_XMTP_BACKEND_URL`, `XMTP_BACKEND_JWT_PRIVATE_JWK`, `XMTP_BACKEND_SUB_PEPPER` |
| **CDN & Build Mode** | Immutable 1-year `Cache-Control` for `/_next/static`, `/globe`, `/fonts`, and `.wasm`; optional standalone output for workerless web pods | `NEXT_OUTPUT_STANDALONE` |

---

## 8. Scheduled Maintenance Worker

Run `node scripts/db-maintenance.mjs` as a cron job (e.g., hourly via Railway Cron) rather than blocking user API requests with inline `DELETE` queries. It prunes expired `SiweNonce`, old `PendingChatMessage`, expired `Story`/`StatusMedia`/`StatusUpdate` rows, and stale `LoginGeoEvent` records in small bounded batches (`500` rows per batch).
