# CONSOLIDATION PLAN & ARCHITECTURAL CONTRADICTIONS
**Phase 0 — Final Synthesis**
**Date:** 20 August 2026

---

## 1. ARCHITECTURAL CONTRADICTION MAP

| Claim | Source | Implementation | Conflict | Severity | Recommended Resolution |
|---|---|---|---|---|---|
| "Zero-Knowledge by Default... settled on Aztec" | `README.md` | `app/api/zk/prove/route.ts` uses HMAC-SHA256 to simulate proofs. No Aztec L2 deployment exists. | System claims cryptographic privacy but uses symmetric server signatures. | **CRITICAL** | Remove false claims from UI. Disable HMAC mock. Wait for actual Aztec v5 deployment. |
| "Decentralized Registry... on-chain" | `Studio Provenance` | `ProductPassport` stored exclusively in PostgreSQL. | Assets are completely centralized in the SQL database. | **HIGH** | Update UI to state "Indexed/Local" until `LedgerKnowledgeGraph.sol` is deployed. |
| "E2E Encrypted P2P Chat" | `LedgerChat` | Uses XMTP (which is E2E), but identity binding relies on a mocked ZK proof. | Identity is not verifiable via ZK as claimed. | **HIGH** | Use standard SIWE for XMTP identity until ZK circuits are compiled and verified. |
| "Neo4j Graph Database" | Architecture Map | Only `schema.cypher` exists. No live data flows to Neo4j. | Claiming a knowledge graph that isn't running. | **MEDIUM** | Remove Neo4j claims or implement the sync worker. |

---

## 2. DUPLICATION AUDIT

1. **Identity & Auth:**
   - *Duplication:* `NextAuth`, custom JWT (`session.ts`), SIWE (`hooks/useSIWE.ts`), and Sovereign Identity (`aztec-zk-engine.ts`) all exist in parallel.
   - *Resolution:* Consolidate entirely on SIWE + JWT for Web2/Web3 hybrid auth. Archive Sovereign Identity until Aztec v5 is mainnet ready.
2. **Database Access:**
   - *Duplication:* `lib/prisma.ts` and direct `new PrismaClient()` instantiations scattered in API routes and workers.
   - *Resolution:* Enforce singleton pattern via `lib/prisma.ts` across the codebase to prevent connection exhaustion.
3. **Documentation:**
   - *Duplication:* `MASTER_ARCHITECTURE.md`, `README.md`, `system_capabilities.md`, `app/architecture/page.tsx`.
   - *Resolution:* Archive `MASTER_ARCHITECTURE.md` and `system_capabilities.md`. Make `app/architecture/page.tsx` the single source of truth for public architecture, and `docs/README.md` for internal.

---

## 3. DOCUMENTATION CONSOLIDATION PLAN

| Document | Action | Reason |
|---|---|---|
| `README.md` | **REWRITE** | Remove claims of active ZK/Aztec deployments. Focus on intelligence & hub features. |
| `MASTER_ARCHITECTURE.md` | **ARCHIVE** | Contradicts reality. Move to `docs/ADR/historical/`. |
| `LEDGER_NETWORK_WHITEPAPER.md`| **KEEP** | Mark as "Vision / Future State". |
| `PRODUCTION_READINESS.md` | **MERGE** | Merge into `docs/STATUS.md`. |
| `DATABASE_FIX.md` | **DELETE** | Obsolete dev note. |
| `ADMIN_SETUP.md` | **KEEP** | Move to `docs/OPERATIONS.md`. |

---

## 4. PROPOSED IMPLEMENTATION ORDER (The 2027 Roadmap)

### P0 — Security & Production Blockers (Target: Immediate)
- Eradicate the "Silent Mock" in `api/zk/prove/route.ts`. If ZK isn't ready, the UI must say "Simulated" or fail closed.
- Rotate the compromised GetBlock WebSocket keys found in `workers/indexer.ts`.
- Fix the 176 NPM vulnerabilities (bump dependencies).
- Clean up root-level junk files (`temp.js`, `.txt` dumps).

### P1 — Architecture Contradictions & Source of Truth (Target: September)
- Execute the Documentation Consolidation Plan.
- Standardize the `PrismaClient` singleton.
- Clearly label in the UI what is PostgreSQL-backed vs. Blockchain-backed.

### P2 — Shared Domain Primitives (Target: October)
- Consolidate identity to SIWE + JWT.
- Define the `MiniApp` metadata standard (Manifests instead of hardcoded Hub tabs).

### P3 — Blockchain Anchoring (Target: November)
- Deploy `SystemForumAnchor.sol` and `LedgerKnowledgeGraph.sol` to Base or Optimism to back up the SQL claims.
- Wire the frontend to read from these deployed contracts.

### P4 — True ZK Integration (Target: December / 2027)
- Await Aztec v5 stability.
- Compile Noir circuits (`target/Verifier.sol`).
- Replace HMAC mocks with real Barretenberg verifications.

