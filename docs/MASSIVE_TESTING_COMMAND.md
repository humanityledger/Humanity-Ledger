# Humanity Ledger — Protocol Verification Suite & Fuzzing Harness Execution Guide

**Document Reference:** HL-TEST-EXEC-2026.1  
**Version:** 1.1  
**Date:** 2 November 2026  
**Canonical Commit:** `c8ecf97d`

---

## 1. Scope and Purpose

This document specifies the execution procedure for the comprehensive protocol verification battery across
the Humanity Ledger monorepo. The battery validates the mathematical, cryptographic, smart contract, and
client sandbox invariants defined in `docs/PROTOCOL_SPEC.md` (§1.2, $\mathcal{P}_1$–$\mathcal{P}_6$) and
acceptance criteria A1–A7.

---

## 2. Execution Commands

### Universal npm Script (Cross-Platform)

```bash
npm run test:massive
```

### Bash Runner (Linux / macOS / WSL)

```bash
bash scripts/run-all-tests.sh
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-all-tests.ps1
```

### Direct Inline Execution (Chained CLI)

```bash
npx vitest run test/aztec_e2e_no_simulation.test.ts test/fortification.test.ts test/circuits/ test/key_custody.test.ts test/mls_post_compromise.test.ts test/eaf_isolation.adversarial.test.ts test/property_fuzz.test.ts && npx tsx scripts/verify-l1-bytecode.ts && npx tsx scripts/check-traceability.ts
```

---

## 3. Verification Pipeline Breakdown

| Stage | Test File / Command | Scope | Invariant Formally Verified |
|---|---|---|---|
| **1. Non-Simulated Proving** | `test/aztec_e2e_no_simulation.test.ts` | 4 tests | **A1 Non-Simulated Proving Guard**: Rejects synthetic random field mock proofs (`Fr.random`, `mockWorkerProof`, `simulatedNullifier`). |
| **2. Security Fortification** | `test/fortification.test.ts` | 28 tests | **System Defense Baseline (300 Items)**: Constant-time comparisons, memory zeroization, tripwires, 8 KiB EAF payload bounds, kill switch. |
| **3. Noir Circuits** | `test/circuits/*.test.ts` | 21 tests | **$\mathcal{P}_4$ Circuit Invariants**: Negative constraint tests across escrow, streams, and identity circuits (amount bounds, expiration, Merkle paths). |
| **4. Key Custody** | `test/key_custody.test.ts` | 5 tests | **$\mathcal{P}_5$ Non-Custodial Key Storage**: Adversarial simulation demonstrating absence of Aztec spending keys and MLS identity keys in server state. |
| **5. MLS Messaging** | `test/mls_post_compromise.test.ts` | 3 tests | **$\mathcal{P}_1$ & $\mathcal{P}_2$ RFC 9420 MLS**: TreeKEM epoch advance forward secrecy and post-compromise security (PCS). |
| **6. Client Sandbox** | `test/eaf_isolation.adversarial.test.ts` | 5 tests | **$\mathcal{P}_6$ Isolated Client Execution (EAF)**: Validates CSP `connect-src 'none'`, storage namespace isolation, and payload bounding. |
| **7. Unit Cryptography** | `test/unit/crypto test/unit/audit` | 240+ tests | Cryptographic signature verification, EIP-191 validation, provenance records, and session cookie validation. |
| **8. Property Fuzzing** | `test/property_fuzz.test.ts` | **60,000 iterations** | **T12 High-Capacity Fuzzing**: Fund conservation monotonicity, hex roundtrip, AEAD authentication failure, memory zeroize, EAF payload ceilings. |
| **9. L1 Contracts** | `test/contracts_invariants.test.ts` | 43 Hardhat tests | **A4 L1 Settlement Invariants**: Absence of unilateral administrative withdrawal, immutable identity ownership, and enforced timelocks. |
| **10. L1 Bytecode** | `scripts/verify-l1-bytecode.ts` | 3 contracts | Automated bytecode hash validation and anti-backdoor static analysis. |
| **11. Traceability** | `scripts/check-traceability.ts` | 7 criteria | Automated CI guard verifying absence of contradictions between `STATUS.md` and `TRACEABILITY_MATRIX.md`. |

**Total Automated Invariant Operations**: **60,300+ Test & Fuzz Iterations**.  
**Execution Duration**: **~18–25 seconds**.
