# Humanity Ledger — Traceability Matrix
## Mapping Public Security and Privacy Claims to Normative Properties (P1–P6) and Test Procedures
**Version 1.0 — Normative Traceability Baseline**

This document satisfies Task **T2** of the Humanity Ledger Protocol Complete Normative Maturity and Implementation Specification (`docs/PROTOCOL_SPEC.md`). Every claim made in public-facing materials (`README.md`, `docs/STATUS.md`, and application UI) and every Acceptance Criterion (**A1–A7**) is mapped to a normative security property, an automated verification procedure, and the commit hash at which it was verified. Any claim without an automated test is explicitly designated as **ASPIRATIONAL**.

---

## 1. Acceptance Criteria Verification Matrix (A1–A7)

| Criterion Identifier | Stated Protocol Guarantee | Verification Test / Procedure | Last verified commit | Verification Status |
|---|---|---|---|---|
| **A1** | Private state end-to-end on Aztec testnet via client PXE (non-simulated proving) | `scripts/aztec-pxe-e2e.ts`, `test/aztec_e2e_no_simulation.test.ts` | `fb557b6c` | **VERIFIED** |
| **A2** | Messaging properties P1 & P2 for direct messages | Provided by XMTP v3 (MLS). `test/mls_post_compromise.test.ts` only models a key schedule inside the test | — | **DELEGATED (XMTP)** |
| **A3** | EAF isolation P6 (Isolated sandbox frame, zero exfiltration) | `test/eaf_isolation.adversarial.test.ts` | `3536d09e` | **VERIFIED** |
| **A4** | L1 settlement contracts (Zero unilateral backdoor, enforced timelocks) | `test/contracts_invariants.test.ts`, `test/HumanTimeLock.test.ts` | `3536d09e` | **VERIFIED** |
| **A5** | Key custody P5 (Zero user spending or identity keys in server state) | `test/key_custody.test.ts` | `3536d09e` | **VERIFIED** |
| **A6** | Reproducible audit dossier (RISK-01 to RISK-05 formal treatments) | `docs/AUDIT_DOSSIER.md`, `test/property_fuzz.test.ts` | `fb557b6c` | **VERIFIED** |
| **A7** | Public claims alignment (Zero unearned claims, automated consistency CI) | `docs/TRACEABILITY_MATRIX.md`, `scripts/check-traceability.ts` | `fb557b6c` | **VERIFIED** |

---

## 2. Public Security Claims Mapping Matrix

| Claim Identifier | Source Location | Stated Claim | Normative Property | Verification Test / Procedure | Last verified commit | Verification Status |
|---|---|---|---|---|---|---|
| **CLM-MSG-01** | `README.md` § 1, `STATUS.md` § 1 | Direct messages are end-to-end encrypted by XMTP (MLS) and unreadable by our server. Community posts are NOT: they are stored readable (see CLM-MSG-COMMUNITY). | **P1 (Message Confidentiality)** | XMTP browser SDK 5.2.0; `lib/xmtp/client.ts` sends direct messages only over MLS | — | **DELEGATED (XMTP)** |
| **CLM-MSG-02** | `docs/PROTOCOL_SPEC.md` § 1.2 | Post-compromise security for direct messages after an MLS epoch change. | **P2 (Post-Compromise Security)** | Provided by XMTP (OpenMLS); our test models the key schedule only | — | **DELEGATED (XMTP)** |
| **CLM-MSG-COMMUNITY** | `docs/communities/MLS_MIGRATION.md` | Community posts are end-to-end encrypted and unreadable by our server. | **P1** | Not implemented: posts are stored readable in PostgreSQL (task R-17) | — | **ASPIRATIONAL** |
| **CLM-ZK-01** | `README.md` § 1, `STATUS.md` § 1 | Private payment proofs are computed in the user's browser by the Aztec SDK (embedded PXE); the server never receives witnesses or spending keys. The standalone Noir circuits have a Web Worker prover, real in tests only and not wired into any screen. | **P3 (Private State Confidentiality)** | `lib/aztec/wallet/client.ts` (EmbeddedWallet in the browser), `test/zk/browser-prover.test.ts` (no Node built-ins, pinned VK, real proof) | `7b17f2df` | **VERIFIED (wallet on testnet); browser prover real in tests only** |
| **CLM-ZK-02** | `docs/PROTOCOL_SPEC.md` § 2.3 | The standalone Noir circuits enforce their stated constraints, and their committed artifacts are the compiled source with pinned VKs. An on-chain VK registry contract exists and is tested (`contracts/ZKVerificationKeyRegistry.sol`) but is not deployed. | **P4 (Private State Integrity)** | `test/circuits/`, `test/zk/`, `scripts/zk/check-artifacts.mjs`, `.github/workflows/aztec-ci.yml`, `test/ZKVerificationKeyRegistry.test.ts` | `e39d83d5` | **VERIFIED (v1, single actions); known issues ZK-01..ZK-07** |
| **CLM-ZK-V2** | `docs/zk/V2_CIRCUITS.md` | v2 circuits close G2, G3, G5 and ZK-01..ZK-05 when the verifier stores and checks the state described there. | **P4** | `nargo test` in `circuits/*_v2` (CI workflow "Noir circuits") | `e39d83d5` | **IN PROGRESS (no deployed verifier)** |
| **CLM-AZ-01** | `docs/zk/AZTEC_CONTRACTS_REVIEW.md` | The aztec-nr contracts settle each escrow once, refund only after the deadline, keep concurrent escrows and streams isolated, cap stream withdrawals at the accrued amount, and let only the issuer change identity roots. | **P4** | TXE tests in `contracts/aztec/{escrow,streams,identity}/src/test.nr` (workflow "Aztec contracts", 49 tests); escrow claim, refund and stream withdrawal on testnet (workflow "Aztec escrow e2e (testnet)", `scripts/aztec/e2e-escrow-testnet.mts`); deployment record checked by `test/unit/aztec/deployments-registry.test.ts` and `test/live/aztec-deployments.live.test.ts` | `d5662f39` | **VERIFIED in TXE and on testnet (escrow, streams incl. sender cancel, identity claim)** |
| **CLM-SEC-01** | `STATUS.md` § 3, `README.md` § 1 | Server infrastructure never generates, derives, reconstructs, or stores user spending keys or long-term identity keys. | **P5 (No Server Key Custody)** | `test/key_custody.test.ts` (full DB/log scan under server compromise simulation) | `3536d09e` | **VERIFIED (Passes in CI)** |
| **CLM-EAF-01** | `README.md` § 2, `STATUS.md` § 1 | Executable Artifact Frames (EAF) run in an isolated null-origin iframe; cannot escape or access host session tokens. | **P6 (EAF Isolation)** | `test/eaf_isolation.adversarial.test.ts` (DOM breakout, storage traversal, network exfiltration) | `3536d09e` | **VERIFIED (Passes in CI)** |
| **CLM-L1-01** | `contracts/README.md`, `PROTOCOL_SPEC.md` § 2.5 | Settlement contracts and timelocks have zero unilateral admin backdoors outside public timelock delay. | **P4 / Acceptance A4** | `test/contracts_invariants.test.ts`, `test/HumanTimeLock.test.ts`, `test/LedgerDeadmanSwitch.test.ts` | `3536d09e` | **VERIFIED (Passes in CI)** |
| **CLM-AUTH-01** | `STATUS.md` § 1 | SIWE nonces are single-use (MAC-sealed cookie with 10-minute TTL; use recorded in memory and with Redis SET NX); session tokens are HttpOnly SameSite=Lax cookies. | **Supporting P5** | `test/auth/siwe-routes.test.ts` (real `/api/siwe/nonce` and `/api/siwe/verify` handlers, real signatures, replay and forged-cookie cases), `test/auth/siwe.test.ts` | `61196b0d` | **VERIFIED (Passes in CI)** |
| **CLM-FORT-01** | `docs/FORTIFICATION_CHECKLIST.md`, `PROTOCOL_SPEC.md` § 9 | 300 concrete hardening items against sophisticated threat actors (Lazarus Group / APTs) across 9 security domains. | **P1–P6 Comprehensive** | `test/fortification.test.ts`, `test/lazarus_adversarial_deep.test.ts` (14 adversarial deep vector checks) | `8554f3eb` | **VERIFIED (Passes in CI)** |

---

## 3. Classification of Aspirational & Historical Claims

Per Section 6.4 of `docs/PROTOCOL_SPEC.md`, any claim that cannot be reproduced deterministically by a third party from the repository alone is designated as **Aspirational** and must not be presented as a production-ready guarantee:

| Claim Description | Prior Location | Classification | Remediation / Current Reality |
|---|---|---|---|
| **"100/100 Production Readiness"** | `docs/STATUS.md` | **RETRACTED (Non-normative)** | Replaced with strict protocol maturity score: **Testnet Stage 1 Audit Ready**. |
| **"200,000 Concurrent User Load"** | `docs/STATUS.md` § 5 | **ASPIRATIONAL** | Represents theoretical simulation parameter; unverified on public decentralized infrastructure. Requires live testnet stress harness. |
| **"Quantum Resistance"** | `docs/STATUS.md` § 5 | **EXPLICIT NON-CLAIM** | Relegated to Section 1.3 Non-Claims (architectural post-quantum roadmap only; no cryptographic PQ guarantees claimed today). |
| **"Production Noir circuits" / "closes the gap at 100%"** | `docs/AZTEC_FOUNDATION_DOSSIER.md`, forum post (3 Nov 2026) | **RETRACTED** | Circuits are experimental; see `docs/zk/MASTER_PROMPT.md`. |
| **"Spearbit / OpenZeppelin Audit Complete"** | Historical marketing copy | **ASPIRATIONAL** | Audit dossier and formal verification artifacts are compiled in `docs/AUDIT_DOSSIER.md`; formal external third-party audit pending. |

---

## 4. Maintenance and CI Enforcement

1. Any pull request introducing a new security, privacy, or architectural claim in `README.md`, `STATUS.md`, or documentation must add a corresponding row to this table.
2. The pull request must include an automated test referenced in the row.
3. Unverified claims must be marked with `ASPIRATIONAL` in the Status column. Pull requests attempting to claim production readiness without satisfying Acceptance Criteria A1–A7 will be rejected by `scripts/check-traceability.ts`.
