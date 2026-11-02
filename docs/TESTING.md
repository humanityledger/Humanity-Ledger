# Humanity Ledger — Protocol Testing Architecture & Invariant Verification Specification

**Document Reference:** HL-TEST-SPEC-2026.1  
**Target Audience:** Core developers, external security auditors, protocol contributors  
**Version:** 1.1  
**Date:** 2 November 2026  
**Canonical Commit:** `c8ecf97d`

---

## 1. Testing Philosophy & Verification Model

Humanity Ledger enforces an **invariant-driven verification model** across its monorepo packages.
Every architectural claim, zero-knowledge circuit constraint, and smart contract permission boundary
is mapped to automated test suites that run synchronously on every local commit and pull request.

### Core Testing Pillars
1. **Mathematical Invariants ($\mathcal{P}_1$–$\mathcal{P}_6$)**: Verified by deterministic unit and negative boundary tests.
2. **Non-Simulated Proving (A1)**: CI tripwires fail immediately if synthetic mock proofs, random field elements (`Fr.random`), or fake nullifiers are detected in production test paths.
3. **High-Capacity Property Fuzzing (T12)**: 60,000 iterations exploring edge cases across fund conservation, signature parsing, constant-time comparison, memory zeroization, and sandbox payload ceilings.
4. **L1 Settlement Invariants (A4)**: Automated EVM Cancun execution proving absence of administrative drain routes, timelock bypasses, or identity hijacking.
5. **Pre-Commit Enforcement**: The pre-commit hook executes the full 1,076-test Vitest battery (~22–25 seconds) before any commit can be created.

---

## 2. Test Suite Topology & Directory Organization

```
test/
├── circuits/                       # Noir circuit negative-constraint test suites (11 tests)
│   ├── escrow_constraints.test.ts  # Escrow amount ceilings, timeouts, and nullifier binding
│   ├── streams_invariants.test.ts  # Monotonic accrual, deposit cap, and withdrawal bounds
│   └── identity_merkle.test.ts     # Merkle path integrity and jurisdiction screening
├── contracts_invariants.test.ts    # L1 Solidity invariant tests (43 Hardhat tests)
├── key_custody.test.ts             # Server compromise simulation (zero private keys stored)
├── mls_post_compromise.test.ts     # RFC 9420 TreeKEM PCS and forward secrecy verification
├── eaf_isolation.adversarial.test.ts # EAF client sandbox breakout and payload bounds tests
├── property_fuzz.test.ts           # 60,000-iteration randomized fuzzing harness
├── aztec_e2e_no_simulation.test.ts # Non-simulated proving CI guard assertions
├── fortification.test.ts           # 300-item system defense checklist tests
└── unit/                           # Granular unit test suites (auth, crypto, session, store)
```

---

## 3. Test Execution Reference

### Full Test Battery (1,076 Vitest Tests)
```bash
npm run test:run
```

### L1 Smart Contract Invariant Battery (43 Hardhat Tests)
```bash
npm run test:contracts
```

### High-Capacity Property Fuzzing (60,000 Iterations)
```bash
npx vitest run test/property_fuzz.test.ts
```

### Comprehensive Massive Battery (Tests + L1 Bytecode + Traceability)
```bash
npm run test:massive
```

### Traceability Matrix Consistency Check
```bash
npm run check:traceability
```

### Forbidden Pattern & Code Hygiene Scan
```bash
node scripts/forbidden-patterns.mjs
```

---

## 4. Acceptance Criteria Verification Matrix

| Criterion | Target Property | Verification Suite | Automated Status |
|---|---|---|---|
| **A1** | Aztec Private State Transitions & Non-Simulated Proving | `test/aztec_e2e_no_simulation.test.ts` | **VERIFIED** |
| **A2** | RFC 9420 MLS Messaging & Post-Compromise Security | `test/mls_post_compromise.test.ts` | **VERIFIED** |
| **A3** | Ephemeral Application Framework (EAF) Sandbox Containment | `test/eaf_isolation.adversarial.test.ts` | **VERIFIED** |
| **A4** | L1 Smart Contract Invariants & Anti-Backdoor Protections | `test/contracts_invariants.test.ts` | **VERIFIED** |
| **A5** | Non-Custodial Key Architecture & Memory Hygiene | `test/key_custody.test.ts` | **VERIFIED** |
| **A6** | Property-Based & High-Capacity Fuzzing (60,000 iters) | `test/property_fuzz.test.ts` | **VERIFIED** |
| **A7** | Single Source of Truth & Traceability Alignment | `scripts/check-traceability.ts` | **VERIFIED** |

---

## 5. Pre-Commit and Continuous Integration Gates

1. **Pre-Commit Hook**: Configured in `.husky/pre-commit` or `.git/hooks/pre-commit`. Any commit failing unit tests or compilation is aborted. Bypassing with `--no-verify` is prohibited by engineering guidelines.
2. **Continuous Integration**: Every PR triggers GitHub Actions workflows executing:
   - TypeScript strict compilation (`tsc --noEmit`)
   - Forbidden security pattern scanner
   - Full Vitest unit and integration test suite
   - L1 Hardhat contract invariant test suite
   - Traceability matrix consistency check
   - npm dependency security audit (`npm audit`)
