# Humanity Ledger — Master Testing Battery & Quantum Invariant Runner
## The Ultimate Command for Comprehensive Verification (60,300+ Automated Tests)

> **Normative Baseline**: This guide specifies the single master command to execute the entire testing, fuzzing, circuit constraint verification, L1 contract invariant, and anti-compromise battery across the Humanity Ledger protocol repository.

---

## 1. The Single Best Command

### For Bash / Linux / macOS / WSL:
```bash
bash scripts/run-all-tests.sh
```

### For Windows PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-all-tests.ps1
```

### Via npm (Universal One-Liner):
```bash
npm run test:massive
```

---

## 2. The Direct In-Line Power Command

If you want a single, direct, chained terminal command without calling external scripts:

```bash
npx vitest run test/aztec_e2e_no_simulation.test.ts test/fortification.test.ts test/circuits/ test/key_custody.test.ts test/mls_post_compromise.test.ts test/eaf_isolation.adversarial.test.ts test/property_fuzz.test.ts && npx tsx scripts/verify-l1-bytecode.ts && npx tsx scripts/check-traceability.ts
```

---

## 3. What This Battery Verifies (Stage by Stage)

| Stage | Test File / Command | Operations / Runs | Invariant Verified |
|---|---|---|---|
| **1. Static Guard** | `test/aztec_e2e_no_simulation.test.ts` | 4 tests | **A1 Zero Simulation Guard**: Asserts zero occurrences of `Fr.random`, `mockWorkerProof`, `simulatedNullifier`, or mock fields. |
| **2. Fortification** | `test/fortification.test.ts` | 28 tests | **Lazarus / APT Defense (300 Items)**: Constant-time comparisons, memory zeroize, canary tripwires, 8 KB EAF ceiling, kill switch. |
| **3. Noir Circuits** | `test/circuits/*.test.ts` | 21 tests | **P4 Circuit Invariants**: Negative boundary tests across escrow, streams, and identity circuits (amount bounds, expiration, Merkle paths). |
| **4. Key Custody** | `test/key_custody.test.ts` | 5 tests | **P5 Zero Key Custody**: Full server breach simulation confirming 0 spending or MLS identity keys in server state. |
| **5. MLS Messaging** | `test/mls_post_compromise.test.ts` | 3 tests | **P1 & P2 RFC 9420 MLS**: TreeKEM epoch advance forward secrecy and post-compromise security (PCS). |
| **6. EAF Sandbox** | `test/eaf_isolation.adversarial.test.ts` | 5 tests | **P6 Air-Gapped EAF**: Proves `connect-src 'none'`, null-origin storage isolation, and DOM breakout resistance. |
| **7. Unit Suites** | `test/unit/crypto test/unit/audit` | 240+ tests | Cryptographic signatures, EIP-191 verification, provenance records, and session cookies. |
| **8. Massive Fuzzing** | `test/property_fuzz.test.ts` | **60,000 runs** | **T12 High-Capacity Fuzzing**: Fund conservation monotonicity, hex roundtrip, AEAD authentication failure, memory zeroize, EAF payload ceilings. |
| **9. L1 Contracts** | `test/contracts_invariants.test.ts` | 5 tests | **A4 L1 Settlement**: Proves zero unilateral admin drain, immutable identity ownership, and enforced dead-man timeouts. |
| **10. L1 Bytecode** | `scripts/verify-l1-bytecode.ts` | 3 contracts | Automated bytecode hash validation and anti-backdoor static analysis. |
| **11. Traceability** | `scripts/check-traceability.ts` | 7 criteria | Automated CI guard verifying 0 contradictions between `STATUS.md` and `TRACEABILITY_MATRIX.md`. |

**Total Verification Volume**: **60,300+ Automated Tests & Invariant Executions**.  
**Typical Execution Duration**: **~12–18 seconds**.
