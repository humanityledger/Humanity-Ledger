# Humanity Ledger — Traceability Matrix
## Mapping Public Security and Privacy Claims to Normative Properties (P1–P6) and Test Procedures
**Version 1.0 — Normative Traceability Baseline**

This document satisfies Task **T2** of the Humanity Ledger Protocol Complete Normative Maturity and Implementation Specification (`docs/PROTOCOL_SPEC.md`). Every claim made in public-facing materials (`README.md`, `docs/STATUS.md`, and application UI) is mapped to a normative security property and an automated verification procedure, or explicitly classified as **Aspirational**.

---

## 1. Traceability Mapping Matrix

| Claim Identifier | Source Location | Stated Claim | Normative Property | Verification Test / Procedure | Verification Status |
|---|---|---|---|---|---|
| **CLM-MSG-01** | `README.md` §1, `STATUS.md` §1 | Content of messages is end-to-end encrypted and unreadable by server or network. | **P1 (Message Confidentiality)** | `test/unit/crypto/xmtp-mls.test.ts`, `test/unit/crypto/mls-encryption.test.ts` | **VERIFIED (Passes in CI)** |
| **CLM-MSG-02** | `docs/PROTOCOL_SPEC.md` §1.2 | Compromise of a client key at epoch $N$ cannot decrypt messages in epoch $N+1$ after epoch ratcheting. | **P2 (Post-Compromise Security)** | `test/mls_post_compromise.test.ts` (RFC 9420 TreeKEM ratcheting) | **NORMATIVE TARGET (T4)** |
| **CLM-ZK-01** | `README.md` §1, `STATUS.md` §3 | Private state, balances, and identity claims are computed purely on-client in Web Worker; server never sees witnesses. | **P3 (Private State Confidentiality)** | `test/unit/crypto/zk-proof.test.ts`, `public/workers/prover.worker.js` isolation checks | **VERIFIED (Passes in CI)** |
| **CLM-ZK-02** | `docs/PROTOCOL_SPEC.md` §2.3 | Private state transitions are validated by compiled Noir circuits anchored against L1 verification keys. | **P4 (Private State Integrity)** | `test/circuits/escrow.test.ts`, `test/circuits/streams.test.ts`, `test/circuits/identity.test.ts` | **NORMATIVE TARGET (T5)** |
| **CLM-SEC-01** | `STATUS.md` §3, `README.md` §1 | Server infrastructure never generates, derives, reconstructs, or stores user spending keys or long-term identity keys. | **P5 (No Server Key Custody)** | `test/key_custody.test.ts` (full DB/log scan under server compromise simulation) | **NORMATIVE TARGET (T3)** |
| **CLM-EAF-01** | `README.md` §2, `STATUS.md` §1 | Executable Artifact Frames (EAF) run in an air-gapped null-origin iframe; cannot escape or access host session tokens. | **P6 (EAF Isolation)** | `test/eaf_isolation.adversarial.test.ts` (DOM breakout, storage traversal, network exfiltration) | **NORMATIVE TARGET (T7)** |
| **CLM-L1-01** | `contracts/README.md`, `PROTOCOL_SPEC.md` §2.5 | Settlement contracts and timelocks have zero unilateral admin backdoors outside public timelock delay. | **P4 / Acceptance A4** | `test/HumanTimeLock.test.ts`, `test/LedgerDeadmanSwitch.test.ts`, Foundry invariant suites | **VERIFIED (Passes in CI)** |
| **CLM-AUTH-01** | `STATUS.md` §4 | SIWE nonces are single-use with 10-minute TTL in Redis; session tokens use HttpOnly SameSite=Lax cookie. | **Supporting P5** | `test/unit/audit/auth-session.test.ts`, `test/unit/audit/siwe.test.ts` | **VERIFIED (Passes in CI)** |

---

## 2. Classification of Aspirational & Historical Claims

Per Section 6.4 of `docs/PROTOCOL_SPEC.md`, any claim that cannot be reproduced deterministically by a third party from the repository alone is designated as **Aspirational** and must not be presented as a production-ready guarantee:

| Claim Description | Prior Location | Classification | Remediation / Current Reality |
|---|---|---|---|
| **"100/100 Production Readiness"** | `docs/STATUS.md` | **RETRACTED (Non-normative)** | Replaced with strict protocol maturity score: **Pre-Alpha under Active Normative Hardening**. Maturity reached only when A1–A7 are fully demonstrated. |
| **"200,000 Concurrent User Load"** | `docs/STATUS.md` §5 | **ASPIRATIONAL** | Represents theoretical simulation parameter; unverified on public decentralized infrastructure. Requires live testnet stress harness. |
| **"Complete Aztec Testnet Escrow"** | `docs/STATUS.md` §3 | **ASPIRATIONAL (In Progress)** | Noir circuit source and compilation artifacts are being formalized in `circuits/` under Task T5; live testnet script under T6. |
| **"Quantum Resistance"** | `docs/STATUS.md` §5 | **EXPLICIT NON-CLAIM** | Relegated to Section 1.3 Non-Claims (architectural post-quantum roadmap only; no cryptographic PQ guarantees claimed today). |
| **"Spearbit / OpenZeppelin Audit Complete"** | Historical marketing copy | **ASPIRATIONAL** | Audit dossier and formal verification artifacts are being compiled under Task T9; formal third-party audit pending. |

---

## 3. Maintenance and CI Enforcement

1. Any pull request introducing a new security, privacy, or architectural claim in `README.md`, `STATUS.md`, or documentation must add a corresponding row to this table.
2. The pull request must include an automated test referenced in the row.
3. Unverified claims must be marked with `ASPIRATIONAL` in the Status column. Pull requests attempting to claim production readiness without satisfying Acceptance Criteria A1–A7 will be rejected.
