# Humanity Ledger — L1 Smart Contract Bytecode & Invariant Verification
**Public Bytecode Verification Procedure & Administrative Invariant Specification**

This document provides the canonical procedure for third parties to independently verify the L1 smart contracts of the Humanity Ledger protocol against compiled source code and on-chain bytecode, satisfying Acceptance Criterion **A4** and Task **T8** (`docs/PROTOCOL_SPEC.md`).

---

## 1. L1 contracts and their deployment status

> **Correction, 18 November 2026.** This table used to give a "Verified Deployed Address" for five
> contracts. On 18 November 2026 Blockscout (Base Sepolia, `/api/v2/addresses/...`) showed **no
> contract code** at the four Base Sepolia addresses (`0x3a71…A861`, `0x5f8b…f553`, `0x718a…0F2b`,
> `0x918c…2f84`): `is_contract: false`, no creation transaction. The Polygon Amoy address
> (`0x1927…EE83`) could not be checked from here. No deployment record in `deployments/` supports
> any of them. They are withdrawn. A contract gets an address here only with its transaction hash
> and block, from a deployment the operator signed.

All contracts compile with solc 0.8.24 (optimizer, 200 runs).

| Contract | Source | Status |
|---|---|---|
| `HumanityTimeLockVault` | [`contracts/HumanityTimeLockVault.sol`](../contracts/HumanityTimeLockVault.sol) | Not deployed |
| `LedgerDeadmanSwitch` | [`contracts/security/LedgerDeadmanSwitch.sol`](../contracts/security/LedgerDeadmanSwitch.sol) | Not deployed; out of `scripts/deploy-system.ts` (decision B-3c, 18 Nov 2026) |
| `HumanTimeLock` | [`contracts/civilization/HumanTimeLock.sol`](../contracts/civilization/HumanTimeLock.sol) | Not deployed |
| `ZKIdentityRegistry` | [`contracts/ZKIdentityRegistry.sol`](../contracts/ZKIdentityRegistry.sol) | Not deployed; verification disabled (reverts) |
| `ZKVerificationKeyRegistry` | [`contracts/ZKVerificationKeyRegistry.sol`](../contracts/ZKVerificationKeyRegistry.sol) | Not deployed |
| `HLPortal`, `HLReceiver` | [`contracts/portal/`](../contracts/portal/) | Not deployed; wave 2 of the alpha, after an external review (OD-1) |
| `HumanityIdentityRegistry`, `StudioProvenance` | removed | **Retired** 18 Nov 2026 (decisions B-3a, B-3b; IR-05, IR-06) |

---

## 2. Independent Bytecode Verification Command

Any third party can compile the contracts locally from source and verify deployed bytecode equality:

### Step 1: Compile Local Contracts
```bash
npm run build:contracts
```

### Step 2: Run Bytecode & Anti-Backdoor Verification Script
```bash
npx tsx scripts/verify-l1-bytecode.ts
```

### Step 3: Verify on a block explorer
Only once a contract has a recorded deployment (address, transaction hash and block):
```bash
npx hardhat verify --network <network> <address> <constructor args>
```

---

## 3. Administrative Invariants & Access Control Restrictions

The contract architecture enforces the following mathematical and access-control invariants:

1. **No Unilateral Vault Drain**:
   - `HumanityTimeLockVault` contains **zero** `adminWithdraw()`, `emergencyDrain()`, or owner transfer overrides.
   - User funds deposited into vaults can only be withdrawn by the authentic user address, or by their designated backup wallet *after* the immutable `timeoutPeriod` has elapsed without user ping.
   - Invariant verified by automated test: `test/contracts_invariants.test.ts` (Invariant 3).

2. **No Instant Verification Key Replacement**:
   - `ZKVerificationKeyRegistry` activates a new or changed key hash only after its timelock (`delay`, at least `MIN_DELAY` = 1 day; `scripts/zk/deploy-vk-registry.ts` uses 2 days by default). Revocation is immediate and can only make verification fail closed.
   - Tests: `test/ZKVerificationKeyRegistry.test.ts`.
   - (Corrected 18 November 2026: this item used to describe a 14-day delay routed through `HumanityTimeLockVault`, which no code implements.)

3. **Identity**: `HumanityIdentityRegistry` was retired on 18 November 2026 (IR-05: it accepted a World ID nullifier without a proof). Identity is `IdentityCredential` in aztec-nr (`contracts/aztec/identity`).

4. **Dead-Man Switch Temporal Enclosure**:
   - `LedgerDeadmanSwitch` requires proof that `block.timestamp >= lastPing + timeoutPeriod`.
   - Any premature execution reverts immediately with `Timeout not reached`.
   - Invariant verified by automated test: `test/contracts_invariants.test.ts` (Invariant 2).
