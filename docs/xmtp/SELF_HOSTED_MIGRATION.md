# Moving Ledger Chat to its own XMTP backend

Status: 24 November 2026. M0 decided (staging on Railway, `xmtp.ledgerchat.org`, users move only on stable releases). M1 staging deployed, waiting for DNS and the app's JWKS. M2 in code, with keys set on the app. No user is on our backend.

## 1. Why

- **The network we use is closing.** XMTP announced on 22 Oct 2026 that it becomes a self-operated open-source stack, and that the network hosted by XMTP Labs shuts down in early 2027. Ledger Chat sends every direct message over that network today (browser SDK 5.2.0, env `production`).
- **We would depend on no one.** With our own backend, message routing, retention, limits and uptime are ours. Anyone can still audit them, because the backend and the SDKs are open source.
- **The current client already has delivery problems.** Since 18 Nov 2026, Chrome on the desktop retries publishes until `publish_gave_up`, while Safari on phones mostly publishes (Railway delivery log). #262 adds the fork diagnosis. The migration replaces that client; it is not a fix for today.

## 2. The decision: run XMTP's open-source backend, do not write our own protocol

We do not write our own messaging protocol or our own MLS. Group key agreement, forward secrecy and post-compromise security are hard to get right, and a fresh implementation would need years of review. XMTP now publishes the whole stack for exactly this kind of use:
- one Rust binary, `ghcr.io/xmtp/backend`, with PostgreSQL;
- SDKs for web, mobile, server and agents.

Running that backend gives us independence and keeps the cryptography we already rely on.

What "our own XMTP" means here:
- the backend runs on infrastructure we choose, with our domain and our Postgres;
- only signed-in Ledger Chat users can reach it (JWTs our server signs, section 4);
- the version is pinned, upgrades follow our own runbook, and we keep the backups;
- the code is unchanged upstream XMTP, so external review of XMTP still applies to us.

## 3. What changes, stated plainly

| Topic | Today (Labs network, SDK 5.2.0) | Our backend (SDK 8) |
|---|---|---|
| Who runs the server | XMTP Labs | Humanity Ledger |
| Who can connect | Anyone with an XMTP client | Signed-in Ledger Chat users (JWT checked against our JWKS) |
| Reaching people on other XMTP apps | Yes | **No.** Self-hosted networks do not interconnect, and everyone in a conversation must use the same deployment |
| Existing conversations | Active | **Read-only after import.** Imported conversations can be read but cannot send or receive. New conversations are created on our network |
| Contacts | Already connected | Each contact must sign in to Ledger Chat on the new network before you can message them there |
| Local message database | Encrypted with our device key (`lib/xmtp/device-key-vault.ts`) | **Not encrypted by the SDK.** SDK 8 rejects `storage.encryptionKey` (section 6, R3) |
| Identity | Ethereum wallet | Ethereum wallet, plus optional passkey and handle identities |
| Usernames | Our server's registry | XMTP handles (`name#1234`) can replace or back our registry (phase M4) |
| Installations | 10 per inbox | 10 per inbox by default (`[mls] max_installations_per_inbox`) |
| Versions | Stable 5.2.0 | **Release candidate** `8.0.0-rc4`, for both backend and SDK |

Browser SDK 7 is skipped. XMTP says it uses an earlier backend API and must not be used with the self-hosted backend. We go straight from 5.2.0 to 8.

## 4. Architecture

```
browser (Ledger Chat, @xmtp/browser-sdk 8)
   │  gRPC-Web over HTTPS, Authorization: Bearer <10-minute ES256 JWT>
   ▼
TLS load balancer (passes gRPC-Web unbuffered, CORS preflight, headers, gRPC trailers)
   ▼
xmtp backend :5050 (private)   ── metrics :9464 (private)
   ▼
PostgreSQL 17 (sslmode=verify-full, backups)

Ledger Chat server:
  POST /api/xmtp/token  → credential for the signed-in wallet (SIWE session)
  GET  /api/xmtp/jwks   → public key the backend uses ([auth] jwks_url)
```

**In code since 24 Nov 2026, off until configured:**
- `lib/xmtp/backend.ts` picks the network per build: Labs by default, ours only with `NEXT_PUBLIC_XMTP_SELF_HOSTED=true` and an https origin in `NEXT_PUBLIC_XMTP_BACKEND_URL`.
- `lib/xmtp/backend-token.ts`, `app/api/xmtp/token` and `app/api/xmtp/jwks` sign and publish ES256 credentials with:
  - issuer `https://ledgerchat.org`, audience `xmtp-backend` and scope `xmtp`;
  - `sub` set to an HMAC of the wallet, so the backend never learns the wallet;
  - a lifetime of 10 minutes, with rate limiting on the issuing route.
- `infra/xmtp-backend/config.toml` and its README hold the backend configuration and the secrets each part needs.
- Tests are in `test/unit/xmtp/self-hosted.test.ts`.

**Hosting.** XMTP lists Railway as development only for this backend, because its HTTP edge does not carry native gRPC. Staging can run there. Production goes on Fly.io, AWS ECS (Fargate) or Kubernetes, all documented by XMTP. Stefan chooses.

## 5. Phases

Each phase is a pull request (or several), with tests in CI, and ends with an update to this file. Nothing reaches users until M6.

| Phase | What | Done when | Who |
|---|---|---|---|
| **M0** | Decisions: host, domain, Postgres provider, budget, the date we leave the Labs network | **Decided 24 Nov 2026:** staging on Railway with its own Postgres; `xmtp.ledgerchat.org`; users move only once stable releases exist. Still open: the production host (Fly.io, AWS or Kubernetes) and the budget | Stefan |
| **M1** | Staging backend: image pinned by digest, Postgres 17+, `config.toml`, TLS, private metrics, health check | **Deployed 24 Nov 2026** (`infra/xmtp-backend/README.md`). The config validates; startup waits on the app's JWKS (the app must redeploy with its new keys) and on the DNS records for `xmtp.ledgerchat.org`. Remaining: `grpc-health-probe` green, `GetConfiguration` answering with `org.ledgerchat.xmtp.staging`, and the image pinned by digest | Stefan (DNS, redeploy); Claude |
| **M2** | Backend authentication | **Done in code (24 Nov).** Remaining: generate the keys and set `XMTP_JWKS_URL` | Stefan sets the secrets |
| **M3** | SDK 8 client behind the build flag. Covers: the signer (`identity`, `kind`, `sign`); `Client.create({ backend, storage, credentials })` with credential refresh from `/api/xmtp/token`; `createDm`; send and publish; streams with `onConnectionStateChange`; consent records; errors by `details.code`, never by text; one tab at a time | Two installations on staging pass: send, read, restart, stream recovery, multi-tab notice, and a 1,000-message soak | Claude |
| **M4** | Identity and usernames. Decide between XMTP handles and our registry, map one to the other, keep G7 (the Aztec address binding) on the new inbox ids | The username lookup and the G7 binding tests run against staging | Claude, with Stefan deciding |
| **M5** | Attachments (`[attachments]`, an S3 bucket, zero retention by default) and push (`[push]`). Calls, payments cards, receipts and community MLS groups re-tested on the new network | Each feature has its own two-installation test | Claude |
| **M6** | Moving users. A dated, announced cutover: history is archived with the old SDK (`prepareMigrationArchive`) and imported read-only, contacts are offered "reconnect" in one tap, and the old client stops sending | A dry run with real test accounts, then the cutover. Rollback means staying on the Labs network until it closes | Stefan sets the date |
| **M7** | Operations: Prometheus alerts, a Postgres backup before every deploy, the upgrade runbook (there is no in-place upgrade path yet; a schema change can need a fresh database), `server.min_libxmtp_version`, an incident page | The runbook has been rehearsed once on staging | Stefan and Claude |

**Gate before M6:**
- the backend and the SDK are stable releases, not release candidates;
- M3 to M5 are green on staging;
- an external reviewer has read the new client code and the token routes;
- this page, `docs/privacy/DATA_INVENTORY.md` and the in-app security pages say what changed.

## 6. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Release candidates. An `rc` backend or SDK can change its schema or API | Pin by digest, stay on staging until stable, and back up Postgres before each upgrade |
| R2 | No in-place upgrade path. A schema change can need a fresh database | Do not move users (M6) until XMTP documents upgrades, and rehearse the upgrade in M7 |
| R3 | The SDK 8 browser database is not encrypted | Raise it with XMTP. Until then, state it in `DATA_INVENTORY.md` and the security pages, keep our own metadata encrypted (`lib/chat/indexeddb.ts`), and offer the app lock. Never claim encryption at rest for the XMTP store |
| R4 | No interoperability. People on other XMTP apps cannot reach us | Say so before the cutover; it is the price of independence |
| R5 | Losing active conversations. Imported history is read-only | Reconnect in one tap (M6) and keep the archive on the device |
| R6 | We become the operator: uptime, abuse, backups, legal requests | M7 runbook, rate limits, access only for signed-in users, and retention set to 90 days |
| R7 | Delivery bugs move with us | The diagnosis from #262 tells us whether today's failures are MLS forks; M3 tests stream recovery and forks on two installations |
| R8 | The token as a weak point | Short lifetime, ES256, a pseudonymous subject, rate limiting, and the JWKS serves the public key only. A token does not prove group membership: MLS does |

## 7. Timeline

The Labs network closes in early 2027 and XMTP has not given an exact date. Working back from it:
- M0 to M2: now;
- M3 to M5: December;
- M6: as soon as stable releases exist and the gate holds, and before the closing date.

If stable releases are late, staging stays ready and the cutover waits. We do not move users onto release candidates.

## 8. Sources

- [XMTP: migrate to a self-hosted backend](https://xmtp.org/get-started/migrate-to-self-hosted/)
- [XMTP: Browser SDK upgrade guide](https://xmtp.org/get-started/migrate-to-self-hosted/browser-sdk-upgrade-guide/)
- [XMTP: run the backend](https://xmtp.org/get-started/run-the-backend/)
- [XMTP: deployment overview](https://xmtp.org/deploy/overview/)
- [XMTP: abridged developer docs](https://xmtp.org/llms-small.txt)
- [KuCoin / ChainCatcher: the Labs network shuts down in early 2027](https://www.kucoin.com/news/flash/xmtp-to-transition-to-self-hosted-open-source-stack-labs-network-to-shut-down-in-early-2027)
