# External Noir Circuit and Smart Contract Audit Scope Specification

**Document Reference:** HL-AUDIT-SCOPE-2026.1  
**Status:** ENGAGEMENT PREPARATION SPECIFICATION  
**Date:** 2 November 2026

---

## 1. Scope of Audit Engagement

### 1.1 Noir Circuits (`circuits/`)
- **`circuits/escrow`**: Conditional escrow releases governed by authorized witness (`authwit`) cryptographic signatures, balance commitment verification, temporal deadline enforcement, and Poseidon2 nullifier derivation.
- **`circuits/streams`**: Continuous linear payment streaming with block-timestamp verification, temporal accrual monotonicity, and deposit ceiling invariance.
- **`circuits/identity`**: Anonymous group membership verification via Merkle paths and non-sanctioned jurisdiction screening without revealing user identifiers.

### 1.2 L1 Smart Contracts (`contracts/`)
- **`contracts/HumanityTimeLockVault.sol`**: Timelock contract governing circuit verification key updates (mandatory 14-day delay) and backup asset recovery without administrative backdoor paths.
- **`contracts/security/LedgerDeadmanSwitch.sol`**: Time-enclosed dead-man switch enforcing strict temporal constraints (`block.timestamp >= lastPing + timeoutPeriod`).
- **`contracts/HumanityIdentityRegistry.sol`**: Sovereign identity registry binding WorldID and proof nullifiers with anti-usurpation guarantees.

### 1.3 Client Proving and Isolation Boundary
- **`public/workers/prover.worker.js`**: Dedicated Web Worker execution boundary ensuring private witness confidentiality under COOP/COEP isolation.
- **`lib/security/eaf-guard.ts`**: Ephemeral Application Framework payload bounding and schema validation.

---

## 2. Prospective Audit Partners

The protocol maintains engagement discussions with specialized cryptographic and smart contract audit firms:
- Spearbit / Cantina
- OpenZeppelin
- Nethermind
- Zellic

---

## 3. Engagement Prerequisites Checklist

Prior to engagement execution:
- [x] All 1,332 unit and integration tests passing in CI on 4 Nov 2026 (`npm run test:run`).
- [x] All 43 Hardhat L1 contract invariant tests passing (`npm run test:contracts`).
- [x] 60,000-iteration property fuzzing suite passing (`test/property_fuzz.test.ts`).
- [x] Bytecode verification passing on target testnets (`scripts/verify-l1-bytecode.ts`).
- [x] Zero CVE dependencies confirmed (`npm audit`).
- [ ] Finalize scope bounding and engagement schedule with selected audit partner.
