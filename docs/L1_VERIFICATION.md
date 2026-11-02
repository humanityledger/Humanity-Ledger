# Humanity Ledger — L1 Smart Contract Bytecode & Invariant Verification
**Public Verification Procedure & Zero-Backdoor Specification**

This document provides the canonical procedure for third parties to independently verify the L1 smart contracts of the Humanity Ledger protocol against compiled source code and on-chain bytecode, satisfying Acceptance Criterion **A4** and Task **T8** (`docs/PROTOCOL_SPEC.md`).

---

## 1. Critical L1 Contracts & Network Addresses

All contracts are compiled with Solidity `0.8.20` or higher with optimizer enabled (`runs: 200`).

| Contract Name | Source Path | Target Testnet (Base Sepolia / Polygon Amoy) | Verified Deployed Address |
|---|---|---|---|
| **`HumanityTimeLockVault`** | [`contracts/HumanityTimeLockVault.sol`](file:///C:/Users/Grati/Documents/GitHub/Humanity-Ledger/contracts/HumanityTimeLockVault.sol) | Base Sepolia (Chain ID 84532) | `0x3a71bE8d7fD1E229bB60bcfB9507E7bDb6d1A861` |
| **`HumanityIdentityRegistry`** | [`contracts/HumanityIdentityRegistry.sol`](file:///C:/Users/Grati/Documents/GitHub/Humanity-Ledger/contracts/HumanityIdentityRegistry.sol) | Base Sepolia (Chain ID 84532) | `0x5f8b5029D83b27b3dF0E7eC7c49392c6Bcb4f553` |
| **`LedgerDeadmanSwitch`** | [`contracts/security/LedgerDeadmanSwitch.sol`](file:///C:/Users/Grati/Documents/GitHub/Humanity-Ledger/contracts/security/LedgerDeadmanSwitch.sol) | Polygon Amoy (Chain ID 80002) | `0x1927c9D80816A9Ea21d1d86641A58d341bEcEE83` |
| **`HumanTimeLock`** | [`contracts/civilization/HumanTimeLock.sol`](file:///C:/Users/Grati/Documents/GitHub/Humanity-Ledger/contracts/civilization/HumanTimeLock.sol) | Base Sepolia (Chain ID 84532) | `0x718a20Cbcf5De73FeD192931a5401Fa2e7bb0F2b` |
| **`ZKIdentityRegistry`** | [`contracts/ZKIdentityRegistry.sol`](file:///C:/Users/Grati/Documents/GitHub/Humanity-Ledger/contracts/ZKIdentityRegistry.sol) | Base Sepolia (Chain ID 84532) | `0x918cb0eFa71F021B7E2095811A1B283296062f84` |

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

### Step 3: Verify on Block Explorer via Hardhat
```bash
# Base Sepolia
npx hardhat verify --network baseGoerli 0x3a71bE8d7fD1E229bB60bcfB9507E7bDb6d1A861

# Polygon Amoy
npx hardhat verify --network polygonAmoy 0x1927c9D80816A9Ea21d1d86641A58d341bEcEE83
```

---

## 3. Explicit Guarantee: Zero Unilateral Admin Backdoors

The contract architecture enforces the following mathematical and access-control invariants:

1. **No Unilateral Vault Drain**:
   - `HumanityTimeLockVault` contains **zero** `adminWithdraw()`, `emergencyDrain()`, or owner transfer overrides.
   - User funds deposited into vaults can only be withdrawn by the authentic user address, or by their designated backup wallet *after* the immutable `timeoutPeriod` has elapsed without user ping.
   - Invariant verified by automated test: `test/contracts_invariants.test.ts` (Invariant 3).

2. **No Instant Verification Key Replacement**:
   - Updating circuit verification keys requires routing through `HumanityTimeLockVault` with a mandatory **14-day timelock delay** (1,209,600 seconds).
   - No multisig or admin key has the authority to bypass this delay. Any proposed circuit change is publicly visible on-chain for 14 days before it can take effect.

3. **Identity Self-Sovereignty**:
   - `HumanityIdentityRegistry` assigns ownership strictly to the registering Ethereum account (`msg.sender`).
   - Profile updates are constrained by `msg.sender`; neither contract owner nor deployer can alter or revoke another user's identity record.
   - Nullifier collision prevention guarantees that each unique proof/WorldID nullifier can only ever be bound to a single identity.
   - Invariant verified by automated test: `test/contracts_invariants.test.ts` (Invariant 4 & 5).

4. **Dead-Man Switch Temporal Enclosure**:
   - `LedgerDeadmanSwitch` requires proof that `block.timestamp >= lastPing + timeoutPeriod`.
   - Any premature execution reverts immediately with `Timeout not reached`.
   - Invariant verified by automated test: `test/contracts_invariants.test.ts` (Invariant 2).
