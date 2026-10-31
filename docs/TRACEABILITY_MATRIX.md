# Humanity Ledger — Traceability Matrix
## Mapping Public Security and Privacy Claims to Normative Properties (P1–P6) and Test Procedures
**Version 1.0 — Normative Traceability Baseline**

This document satisfies Task **T2** of the Humanity Ledger Protocol Complete Normative Maturity and Implementation Specification (`docs/PROTOCOL_SPEC.md`). Every claim made in public-facing materials (`README.md`, `docs/STATUS.md`, and application UI) and every Acceptance Criterion (**A1–A7**) is mapped to a normative security property, an automated verification procedure, and the commit hash at which it was verified. Any claim without an automated test is explicitly designated as **ASPIRATIONAL**.

---

## 1. Acceptance Criteria Verification Matrix (A1–A7)

| Criterion Identifier | Stated Protocol Guarantee | Verification Test / Procedure | Last verified commit | Verification Status |
|---|---|---|---|---|
| **A1** | Private state end-to-end on Aztec testnet via client PXE (zero simulation) | `scripts/aztec-pxe-e2e.ts`, `test/aztec_e2e_no_simulation.test.ts` | `fb557b6c` | **VERIFIED** |
| **A2** | Messaging properties P1 & P2 (RFC 9420 TreeKEM epoch ratcheting & PCS) | `test/mls_post_compromise.test.ts`, `npm run test:crypto` | `3536d09e` | **VERIFIED** |
| **A3** | EAF isolation P6 (Air-gapped sandbox frame, zero exfiltration) | `test/eaf_isolation.adversarial.test.ts` | `3536d09e` | **VERIFIED** |
| **A4** | L1 settlement contracts (Zero unilateral backdoor, enforced timelocks) | `test/contracts_invariants.test.ts`, `test/HumanTimeLock.test.ts` | `3536d09e` | **VERIFIED** |
| **A5** | Key custody P5 (Zero user spending or identity keys in server state) | `test/key_custody.test.ts` | `3536d09e` | **VERIFIED** |
| **A6** | Reproducible audit dossier (RISK-01 to RISK-05 formal treatments) | `docs/AUDIT_DOSSIER.md`, `test/property_fuzz.test.ts` | `fb557b6c` | **VERIFIED** |
| **A7** | Public claims alignment (Zero unearned claims, automated consistency CI) | `docs/TRACEABILITY_MATRIX.md`, `scripts/check-traceability.ts` | `fb557b6c` | **VERIFIED** |

---

## 2. Public Security Claims Mapping Matrix

| Claim Identifier | Source Location | Stated Claim | Normative Property | Verification Test / Procedure | Last verified commit | Verification Status |
|---|---|---|---|---|---|---|
| **CLM-MSG-01** | `README.md` § 1, `STATUS.md` § 1 | Content of messages is end-to-end encrypted and unreadable by server or network. | **P1 (Message Confidentiality)** | `test/unit/crypto/xmtp-mls.test.ts`, `test/unit/crypto/mls-encryption.test.ts` | `3536d09e` | **VERIFIED (Passes in CI)** |
| **CLM-MSG-02** | `docs/PROTOCOL_SPEC.md` § 1.2 | Compromise of a client key at epoch $N$ cannot decrypt messages in epoch $N+1$ after epoch ratcheting. | **P2 (Post-Compromise Security)** | `test/mls_post_compromise.test.ts` (RFC 9420 TreeKEM ratcheting) | `3536d09e` | **VERIFIED (Passes in CI)** |
| **CLM-ZK-01** | `README.md` § 1, `STATUS.md` § 3 | Private state, balances, and identity claims are computed purely on-client in Web Worker; server never sees witnesses. | **P3 (Private State Confidentiality)** | `test/unit/crypto/zk-proof.test.ts`, `public/workers/prover.worker.js` isolation checks | `3536d09e` | **VERIFIED (Passes in CI)** |
| **CLM-ZK-02** | `docs/PROTOCOL_SPEC.md` § 2.3 | Private state transitions are validated by compiled Noir circuits anchored against L1 verification keys. | **P4 (Private State Integrity)** | `test/circuits/escrow.test.ts`, `test/circuits/streams.test.ts`, `test/circuits/identity.test.ts` | `fb557b6c` | **VERIFIED (Passes in CI)** |
| **CLM-SEC-01** | `STATUS.md` § 3, `README.md` § 1 | Server infrastructure never generates, derives, reconstructs, or stores user spending keys or long-term identity keys. | **P5 (No Server Key Custody)** | `test/key_custody.test.ts` (full DB/log scan under server compromise simulation) | `3536d09e` | **VERIFIED (Passes in CI)** |
| **CLM-EAF-01** | `README.md` § 2, `STATUS.md` § 1 | Executable Artifact Frames (EAF) run in an air-gapped null-origin iframe; cannot escape or access host session tokens. | **P6 (EAF Isolation)** | `test/eaf_isolation.adversarial.test.ts` (DOM breakout, storage traversal, network exfiltration) | `3536d09e` | **VERIFIED (Passes in CI)** |
| **CLM-L1-01** | `contracts/README.md`, `PROTOCOL_SPEC.md` § 2.5 | Settlement contracts and timelocks have zero unilateral admin backdoors outside public timelock delay. | **P4 / Acceptance A4** | `test/contracts_invariants.test.ts`, `test/HumanTimeLock.test.ts`, `test/LedgerDeadmanSwitch.test.ts` | `3536d09e` | **VERIFIED (Passes in CI)** |
| **CLM-AUTH-01** | `STATUS.md` § 4 | SIWE nonces are single-use with 10-minute TTL in Redis; session tokens use HttpOnly SameSite=Lax cookie. | **Supporting P5** | `test/unit/audit/auth-session.test.ts`, `test/unit/audit/siwe.test.ts` | `3536d09e` | **VERIFIED (Passes in CI)** |

---

## 3. Classification of Aspirational & Historical Claims

Per Section 6.4 of `docs/PROTOCOL_SPEC.md`, any claim that cannot be reproduced deterministically by a third party from the repository alone is designated as **Aspirational** and must not be presented as a production-ready guarantee:

| Claim Description | Prior Location | Classification | Remediation / Current Reality |
|---|---|---|---|
| **"100/100 Production Readiness"** | `docs/STATUS.md` | **RETRACTED (Non-normative)** | Replaced with strict protocol maturity score: **Testnet Stage 1 Audit Ready**. |
| **"200,000 Concurrent User Load"** | `docs/STATUS.md` § 5 | **ASPIRATIONAL** | Represents theoretical simulation parameter; unverified on public decentralized infrastructure. Requires live testnet stress harness. |
| **"Quantum Resistance"** | `docs/STATUS.md` § 5 | **EXPLICIT NON-CLAIM** | Relegated to Section 1.3 Non-Claims (architectural post-quantum roadmap only; no cryptographic PQ guarantees claimed today). |
| **"Spearbit / OpenZeppelin Audit Complete"** | Historical marketing copy | **ASPIRATIONAL** | Audit dossier and formal verification artifacts are compiled in `docs/AUDIT_DOSSIER.md`; formal external third-party audit pending. |

---

## 4. Maintenance and CI Enforcement

1. Any pull request introducing a new security, privacy, or architectural claim in `README.md`, `STATUS.md`, or documentation must add a corresponding row to this table.
2. The pull request must include an automated test referenced in the row.
3. Unverified claims must be marked with `ASPIRATIONAL` in the Status column. Pull requests attempting to claim production readiness without satisfying Acceptance Criteria A1–A7 will be rejected by `scripts/check-traceability.ts`.
