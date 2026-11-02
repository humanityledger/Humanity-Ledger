# HUMANITY LEDGER — SYSTEM INVENTORY
**Phase 0 — System Discovery**
**Date:** 20 August 2026
**Status:** COMPLETE

---

## EXECUTIVE SUMMARY

Humanity Ledger is a **Next.js 15 full-stack web application** deployed on Railway, functioning as:
1. A **blockchain intelligence and ledger-tracking platform** (primary production capability)
2. A **multi-app hub** with aspirational Mini-App architecture
3. A **ZK/Aztec integration layer** that is partially implemented and partially simulated

The application is **significantly more complex than its documentation describes**, and **significantly less ZK-live than its documentation claims**.

---

## REPOSITORY ROOT TOPOLOGY

| Directory | Purpose | Status |
|---|---|---|
| `app/` | Next.js App Router — routes, pages, API | LIVE |
| `components/` | React UI components (~600+ files) | LIVE |
| `lib/` | Shared library — engines, services, utilities | MIXED |
| `hooks/` | React hooks (78 files) | LIVE |
| `workers/` | Background workers (6 files) | PARTIAL |
| `services/` | Service layer (4 dirs, 2 files) | PARTIAL |
| `contracts/` | Solidity smart contracts | NOT DEPLOYED (see below) |
| `circuits/` | Single Noir membership circuit | NOT CONNECTED |
| `noir-projects/` | 19 Noir circuit directories | NOT CONNECTED |
| `prisma/` | PostgreSQL schema (84 models) | LIVE |
| `neo4j/` | Graph schema (schema.cypher only) | SCHEMA ONLY — not confirmed live |
| `subgraph/` | The Graph subgraph (placeholder addresses) | NOT DEPLOYED |
| `graphql/` | GraphQL schema | UNKNOWN STATUS |
| `scripts/` | Utility and backfill scripts | DEV TOOLS |
| `tests/` + `test/` | Test files (40+ files across multiple dirs) | PARTIAL |
| `ignition/` | Hardhat Ignition — no deployed_addresses.json | NOT DEPLOYED |
| `k8s/` | Kubernetes config | UNUSED (deployed on Railway) |
| `docker/` | Docker configs | PARTIAL |
| `.github/workflows/` | CI/CD pipelines (5 workflows) | ACTIVE |
| `android/` + `ios/` | Capacitor mobile apps | PARTIAL |
| `src/` | Legacy/Vite source (exists alongside app/) | LEGACY — CONFUSION RISK |
| `pages/` | Legacy Next.js pages/ dir (exists alongside app/) | LEGACY — CONFUSION RISK |
| `models/` | Additional model definitions | DUPLICATION RISK |

### Critical Root-Level Junk Files (hygiene issue)
Files that should not exist at repo root:
- `temp.js` (462KB — likely a build artifact or dump)
- `temp.html`, `aztecscan.html`, `test_html.html`
- `address` (a stray git commit message stored as a file)
- `Extractor.exe`, `Extractor.cs` (C# binary in a JS project)
- Multiple `.txt` commit message files (`commit_airdrop.txt`, `commit_auth.txt`, etc.)
- `f.endsWith('.tsx')`, `k.includes('PXE')` — stray shell/JS expression files
- `console.error(e.message.slice(0`, `t.address`, etc. — shell fragments as files
- `tsc_out.txt`, `build_out.txt`, `diff_identity.txt` (99KB, 738KB dev artifacts)
- Multiple stray HTML files (`ledger_network_terminal_presentation.html`, etc.)

---

## DATA LAYER INVENTORY

### PostgreSQL via Prisma (CONFIRMED LIVE)
**84 models** defined in `prisma/schema.prisma`. Key categories:

**Identity & Auth:**
- `User`, `AuthUser`, `Session`, `SiweNonce`, `KYCRecord`, `VerificationCode`
- `ZkNullifier` (ZK nullifier tracking — server-side only, not on-chain)
- `SocialVerification`, `LoginGeoEvent`

**Assets & Finance:**
- `Transaction`, `BlockchainTransaction`, `ExchangeBalance`, `ExchangePosition`
- `TimeLockVault`, `DeadMansSwitch`, `Guardian`, `PrivacyDonation`
- `AIRebalancerPlan`, `VirtualCard`, `AirdropClaim`, `QdTransaction`

**Intelligence:**
- `LedgerActivity`, `GlobalLedgerEvent`, `AlertRule`, `IntelItem`
- `OnChainEntity`, `EntityLabel`, `NeuralAgentConfig`

**Platform:**
- `ProductPassport`, `ProvenanceEvent` (Studio)
- `ForumCategory`, `ForumTopic`, `ForumPost`, `ForumLike`, `ForumNotification`
- `Article`, `NewsArticle`, `Course`, `Lesson`, `UserProgress`
- `MarketProposal`, `ProposalVote`
- `AztecQuest`, `QuestClaim`, `SovereignNode`
- `GamificationRecord`, `AuditLog`, `SystemAuditLog`, `UserSessionLog`
- `BRCStandard`, `GoldRegistryAudit`
- `WalletAnalytics`, `UserMetrics`, `UserPrivacyProfile`
- `CosmicEntity` (Cosmic Forge feature)

**Classification:** PostgreSQL = **Canonical source of truth** for all user, identity, and application state.

---

### Neo4j (SCHEMA ONLY — NOT CONFIRMED LIVE)
- `neo4j/schema.cypher` defines nodes: Person, Company, Token, Wallet, Sector, Ecosystem
- Contains hardcoded sample data (Vitalik's wallet address)
- Vector index config for 1536-dimension embeddings
- **No confirmation Neo4j is actively connected in production** — `lib/neo4j.ts` exists but connection status unknown
- **Classification: UNKNOWN — likely PARTIAL or DEMO**

---

### Redis (CONFIRMED LIVE — via Upstash)
- Used by BullMQ workers (CosmicForgeWorker, SyndicateDaemon, indexer.ts)
- Used for real-time pub/sub (ledger events, mempool streams)
- `lib/redis/` directory exists
- **Classification: Cache + Ephemeral state**

---

### MongoDB (REFERENCED — status uncertain)
- `lib/mongodb.ts` exists (1.5KB)
- Referenced in `package.json` via `mongoose`
- **No clear Prisma model for MongoDB** — likely for news/events
- **Classification: UNKNOWN — possibly PARTIAL**

---

## BLOCKCHAIN / NETWORK INVENTORY

### Networks configured in `hardhat.config.js`
| Network | Chain ID | RPC | Status |
|---|---|---|---|
| Base Mainnet | 8453 | mainnet.base.org | CONFIGURED |
| Base Sepolia | 84532 | base-sepolia.infura | CONFIGURED |
| Optimism Mainnet | 10 | mainnet.optimism.io | CONFIGURED |
| Optimism Sepolia | 11155420 | sepolia.optimism.io | CONFIGURED |
| World Chain | 480 | worldchain-mainnet | CONFIGURED |
| Polygon Mainnet | 137 | polygon-rpc.com | CONFIGURED |
| Polygon Amoy | 80002 | rpc-amoy.polygon | CONFIGURED |

**No `ignition/deployments/` JSON files found** = **ZERO VERIFIED DEPLOYMENTS** via Hardhat Ignition.

### Aztec Network
- `lib/aztec-zk-engine.ts` references `AZTEC_ROLLUP_ABI` and addresses:
  - `ROLLUP_PROCESSOR: "0xFF1F2B4ADb9dF6FC8eAFecDcbF96A2B351680455"` — labeled "historical deployment" of **Aztec Connect** (DEPRECATED protocol, not Aztec v5)
  - `PLONK_VERIFIER: "0x1F28e4e4b8e2d5e02b7Dd3Fcf9E0EEdd44Ab3B29"` — also historical
- CI workflow references `aztec-cli@0.67.0` / sandbox `0.67.0` and `aztec/pxe@v5.testnet`
- **The `@aztec/aztec.js`, `@aztec/pxe`, `@aztec/accounts`, `@aztec/wallets` packages are installed**
- **Status: The Aztec SDK is installed. Aztec testnet endpoint is referenced. No confirmed mainnet Aztec deployment exists. Addresses in code reference deprecated Aztec Connect, not current Aztec v5.**

### External RPC Providers Referenced
- Alchemy (gRPC, HTTP, WebSocket) — primary
- GetBlock WebSocket (in `workers/indexer.ts`)
- Public fallback RPCs (llamarpc, cloudflare, publicnode, ankr, 1rpc)
- Infura (Base Sepolia)

---

## SMART CONTRACT INVENTORY

### Root contracts/
| Contract | Purpose | Compiler | Tests | Deployed | Address | Status |
|---|---|---|---|---|---|---|
| `AegisCircuitBreaker.sol` | Emergency circuit breaker | Solidity | Unknown | NO | NONE | NOT DEPLOYED |
| `AztecOracleL1.sol` | L1 Oracle for Aztec bridge | Solidity | Unknown | NO | NONE | NOT DEPLOYED |
| `SystemForumAnchor.sol` | On-chain forum anchoring | Solidity | Unknown | NO | NONE | NOT DEPLOYED |
| `SystemReputationSBT.sol` | Soulbound reputation token | Solidity | Unknown | NO | NONE | NOT DEPLOYED |
| `LedgerKnowledgeGraph.sol` | On-chain knowledge graph | Solidity | Unknown | NO | NONE | NOT DEPLOYED |
| `LedgerPass.sol` | Ledger membership pass | Solidity | Unknown | NO | NONE | NOT DEPLOYED |
| `LedgerValidator.sol` | Validator contract | Solidity | Unknown | NO | NONE | NOT DEPLOYED |

### contracts/quantum/
| Contract | Purpose | Status |
|---|---|---|
| `CoreAirdrop.sol` | QDS token airdrop | NOT DEPLOYED |
| `CoreDots.sol` | Dots system | NOT DEPLOYED |
| `CoreLedger.sol` | Core ledger | NOT DEPLOYED |
| `CoreMiner.sol` | Mining mechanism | NOT DEPLOYED |

### contracts/civilization/
| Contract | Purpose | Status |
|---|---|---|
| `DeadMansSwitch.sol` | Dead man's switch | NOT DEPLOYED |
| `HumanTimeLock.sol` | Time lock vault | NOT DEPLOYED |
| `endgame/` | Unknown | NOT DEPLOYED |
| `governance/` | Governance | NOT DEPLOYED |
| `tokenomics/` | Tokenomics | NOT DEPLOYED |
| `zk/` | ZK contracts | NOT DEPLOYED |

**FINDING: Zero smart contracts are deployed on any network. The PRODUCTION_READINESS.md itself explicitly acknowledges this as a gap.**

---

## ZK INVENTORY

### circuits/ (root)
- Single circuit: `circuits/src/main.nr`
- Purpose: **ZK Membership Proof** — proves user owns a key in a Merkle tree without revealing identity
- Proof system: **Noir / Barretenberg (implied)**
- Private inputs: `secret_key`, `nullifier_secret`, `hash_path`, `index`
- Public inputs: `root`, `nullifier_hash`
- Has a basic `#[test]` that only checks `pub_key != 0` (not a real test)
- **NOT connected to any API route or frontend component**
- **Status: STUB — NOT PRODUCTION CONNECTED**

### noir-projects/circuits/ (19 directories)
| Circuit Name | Purpose Implied |
|---|---|
| `analytics-query-proof` | Privacy-preserving analytics |
| `chat-message-encryption` | Encrypted chat |
| `cross-chain-aggregation` | Cross-chain ZK proofs |
| `forum-zk-auth` | Anonymous forum auth |
| `hardware-acceleration-proving` | GPU proving |
| `humanity_ledger` | Core HL circuit |
| `mint-private-license` | Private license minting |
| `mint_private_license` | Duplicate of above |
| `post-quantum-resistance` | PQC |
| `private-order-routing` | DEX privacy |
| `private-portfolio-balance` | Private balance |
| `qr-scanner-verification` | QR ZK verify |
| `qr_session_sync` | QR session |
| `recursive-proof-aggregator` | Proof aggregation |
| `sentient-sub-network` | Unknown |
| `ledger-alert-verification` | Ledger alert ZK |
| `ledger_chat` | Chat ZK |
| `zk-dna-biometrics` | Biometric ZK |
| `zkml-ledger-scoring` | ML-based ledger scoring |

- **None of these circuits are confirmed compiled, deployed, or connected to production**
- The CI workflow (`.github/workflows/aztec-ci.yml`) only runs on branch `aztec-integration-v1` — not `main`

### ZK API Routes (app/api/zk/)
- `/api/zk/prove` — Exists, uses **HMAC-SHA256** to simulate proof generation (NOT real ZK proving)
- `/api/zk/verify` — Exists, validates HMAC signatures (NOT real ZK verification)
- `/api/zk/witness` — Exists
- `/api/zk/compile` — Exists
- `/api/zk/avs` — Exists
- `/api/zk/verify-identity` — Exists

**CRITICAL FINDING: `app/api/zk/prove/route.ts` generates proofs by computing SHA-256 hashes and HMAC signatures, then returns them labeled as "UltraHonk/Barretenberg" proofs. This is a simulation/mock, not real ZK proving.**

### lib/snark.ts
- Imports `groth16` from `snarkjs`
- References circuit files at `/circuits/universalAttestation.wasm` and `/circuits/universalAttestation.zkey`
- These files **do not exist in the repository**
- Has explicit fallback: `proof = new Uint8Array([0x0])` when files are missing
- **Status: SILENT MOCK IN PRODUCTION**

---

## WORKER INVENTORY

| Worker | Input | Network | Processor | Storage | Reorg | Failure | Status |
|---|---|---|---|---|---|---|---|
| `humanity-indexer.ts` | ETH Mainnet blocks | Ethereum | Block polling | Prisma/PostgreSQL | None documented | None documented | PARTIAL |
| `humanity-pruner.ts` | Postgres records | N/A | 7-day retention | PostgreSQL | N/A | None documented | PARTIAL |
| `indexer.ts` | ETH+Base blocks via WebSocket | Ethereum, Base | neuralSegregator | Redis | None | None documented | PARTIAL |
| `sentimentEngine.ts` | News text | N/A | Grok API (xAI) | Prisma | N/A | None | PARTIAL |
| `syndicateDaemon.ts` | Redis anomaly queue | N/A | BullMQ | Substack/X/Telegram | N/A | None | PARTIAL |
| `cosmic-forge-worker.ts` | Forge queue | N/A | BullMQ / Redis | Prisma | N/A | Feature-flagged | PARTIAL |

**Workers are standalone TypeScript files. None have documented reorg handling, replay mechanisms, or monitoring. They are not run by the main Next.js process — ecosystem.config.json or PM2 is required.**

---

## SUBGRAPH INVENTORY

`subgraph/subgraph.yaml` references:
- `ZapContract` on Optimism: address `0x1234567890123456789012345678901234567890` — **placeholder, not real**
- `MarketGovernance` on Optimism: address `0x0987654321...` — **placeholder, not real**
- **Status: NOT DEPLOYED — placeholder subgraph**

---

## IDENTITY SYSTEMS INVENTORY (Duplication Map)

The platform has **multiple parallel identity systems**:

| System | Location | Model | Status |
|---|---|---|---|
| SIWE (Sign-In with Ethereum) | `lib/auth/session.ts`, `hooks/useSIWE.ts` | Wallet address + JWT | LIVE |
| NextAuth | `app/api/auth/[...nextauth]` | Email/OAuth sessions | LIVE |
| Sovereign Identity | `lib/aztec-zk-engine.ts`, `app/api/aztec/identity-status` | Aztec account address | PARTIAL |
| ZK Nullifier | `prisma/schema.prisma > ZkNullifier` | Server-side nullifier tracking | PARTIAL |
| KYC / Sumsub | `app/api/auth/kyc-*`, `lib/auth/sumsub-provider.ts` | Identity verification | PARTIAL |
| Biometric / WebAuthn | `lib/auth/webauthn-config.ts`, `lib/biometrics/` | Passkeys | PARTIAL |
| WorldID | `lib/worldid.ts`, `@worldcoin/idkit` | World ID verification | PARTIAL |
| QR Cross-Device Handshake | `app/api/auth/qr-*` (10 endpoints) | Session bridge | LIVE |
| Email OTP | `app/api/auth/send-code`, `verify-code` | Email verification | LIVE |
| Golden Ticket | `lib/auth/golden-ticket-verify.ts` | Access control | LIVE |

**GAP: No unified identity primitive. Each Mini-App may use a different auth path.**

---

## TEST INVENTORY

| Test File | Type | Coverage | Status |
|---|---|---|---|
| `test/AnalyticsService.test.ts` | Unit | Analytics | EXISTS |
| `test/aztec-mainnet.test.ts` | Integration | Aztec connection | EXISTS |
| `test/HumanTimeLock.test.ts` | Contract | HumanTimeLock.sol | EXISTS |
| `test/portfolio-onchain.test.ts` | Integration | Portfolio | EXISTS |
| `test/qd-economy.security.test.ts` | Security | QD token economy | EXISTS |
| `test/qd-stress.test.ts` | Load | QD token | EXISTS |
| `test/ledger_chat_audit.test.ts` | Audit | Ledger Chat | EXISTS |
| `test/LedgerDeadmanSwitch.test.ts` | Unit | Dead Man's Switch | EXISTS |
| `test/unit/crypto/eip191-verify.test.ts` | Unit | EIP-191 signing | EXISTS |
| `test/unit/resilience/circuit-breaker.test.ts` | Unit | Circuit breaker | EXISTS |
| `test/unit/intelligence/zscore-engine.property.test.ts` | Property | Z-Score engine | EXISTS |
| `test/unit/audit/provenance-studio.test.ts` | Unit | Provenance | EXISTS |
| `test/chaos/fault-injection.test.ts` | Chaos | Fault injection | EXISTS |
| `test/chaos/infrastructure.chaos.test.ts` | Chaos | Infrastructure | EXISTS |
| `tests/aztec-fuzzing.ts` | Fuzzing | Aztec | EXISTS |
| `test/forensic_verification.ts` | Forensic | Verification | EXISTS |
| `test/smoke_test.ts` | Smoke | General | EXISTS |

**No confirmed CI test runner configuration for `main` branch executes these tests automatically. The `production-pipeline.yml` does NOT run `npm test`. TypeScript type-check is `continue-on-error: true`.**

---

## API SURFACE (416 routes total)

Categories identified:
- **Auth** (~20 routes): SIWE, email, QR, KYC, session management
- **Aztec** (~12 routes): balance, transfer, airdrop, identity, deploy
- **Wallet** (~25 routes): send, swap, history, deadman, timelock, rebalance, recovery
- **Ledger Intelligence** (~15 routes): alerts, stream, multi-chain, mempool, SSE
- **Forum** (~20 routes): topics, posts, likes, notifications, telemetry
- **Governance** (~3 routes): proposals, propose, vote
- **ZK** (~6 routes): prove, verify, witness, compile, avs
- **Admin** (~12 routes): seed, purge, sync, security events
- **User** (~12 routes): profile, settings, sessions, portfolio, pnl
- **Markets** (~unknown): market data
- **AI** (~3 routes): analyze, concierge, forensic
- **Chat** (~12 routes): send, sync, stream, contacts, queue
- **Webhooks** (~5 routes): Alchemy, Stripe, Sumsub, MoonPay
- **Cron** (~3 routes): deposits, indexer, supply-alerts
- **Dev/Test** (~5 routes): testpxe, deploy

---

## CI/CD INVENTORY

| Workflow | Trigger | Jobs | Gate? |
|---|---|---|---|
| `production-pipeline.yml` | push/PR to main | lint, tsc (continue-on-error), prisma validate, hardhat compile, slither | NO — TypeScript errors don't block |
| `security.yml` | push/PR/daily | npm audit (blocks on HIGH/CRITICAL), SBOM, SLSA provenance | YES — audit blocks |
| `aztec-ci.yml` | push/PR to `aztec-integration-v1` | compile circuits, aztec sandbox | NOT on main |
| `system-core.yml` | Unknown | Unknown | Unknown |
| `generator-generic-ossf-slsa3-publish.yml` | release | SLSA provenance | YES |

**FINDING: No automated test execution in `main` CI pipeline. TypeScript errors are non-blocking. Security audit runs separately. Aztec CI only runs on a separate branch.**

---

## DOCUMENTATION INVENTORY

| Document | Claims | Contradiction? | Status |
|---|---|---|---|
| `README.md` | "L2 ZK-rollup ecosystem settled on Aztec" | No Aztec mainnet deployment exists | CONTRADICTORY |
| `MASTER_ARCHITECTURE.md` | "Full system blueprint" | Dated 14/08/2026 — already partially stale | CONTRADICTORY |
| `PRODUCTION_READINESS.md` | Lists contracts as NOT deployed | Matches reality | ACCURATE |
| `LEDGER_NETWORK_WHITEPAPER.md` | Describes Ledger Chat + Aztec PXE signaling | No confirmed PXE connection | PARTIALLY CONTRADICTORY |
| `DEPLOYMENT.md` | Railway deployment | Matches reality | ACCURATE |
| `SECURITY.md` | Security policy | Needs review | UNKNOWN |
| `system_capabilities.md` | Lists capabilities | Not verified against code | UNVERIFIED |
| `architecture.mmd` | Mermaid architecture diagram | Exists | UNVERIFIED |
| `app/architecture/page.tsx` | Public architecture page | Just rewritten (20 Aug 2026) | UPDATED |
| `CHANGELOG.md` | Recent changes | Informational | ACCURATE |

**Root-level documentation proliferation (22+ .md files) violates Principle #7 (One Concept = One Document).**

---

## DEPENDENCY INVENTORY — CRITICAL FLAGS

| Package | Category | Risk |
|---|---|---|
| `@aztec/aztec.js`, `@aztec/pxe`, etc. | Aztec SDK | Pre-release / heavy — version compatibility critical |
| `snarkjs` | ZK proving | Referenced but circuit files missing — silent mock |
| `@noir-lang/noir_js`, `@noir-lang/backend_barretenberg` | Noir proving | Installed, circuits not connected |
| `@worldcoin/idkit` | Identity | External dependency on World |
| `@xmtp/browser-sdk` | Messaging | Dependency on XMTP network |
| `@ledgerhq/hw-app-eth`, `@ledgerhq/hw-transport-webhid` | Hardware wallet | WebHID — browser-only |
| `@bsv/sdk` | Bitcoin SV | BSV support — scope question |
| `@solana/web3.js` | Solana | Solana support — scope question |
| `libp2p` + plugins | P2P | Complex peer networking |
| `hardhat` in `dependencies` (not `devDependencies`) | Build tool | Should be devDependency |
| `@gnosis.pm/conditional-tokens-*` | Prediction markets | Gnosis PM integration |
| `@flashbots/ethers-provider-bundle` | MEV | Flashbots integration |
| `permissionless` | ERC-4337 | Account abstraction |
| `mongoose` | MongoDB ODM | MongoDB is unclear status |
| `peerjs` | WebRTC | P2P video/voice |
| GitHub reports **176 vulnerabilities** (3 critical, 76 high) | Security | UNRESOLVED |


