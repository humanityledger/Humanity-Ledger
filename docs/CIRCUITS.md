# Humanity Ledger — Noir Circuits & L1 Verification Key Anchoring
**Protocol Invariant Enforcement & Cryptographic Specification**

This document specifies the Noir circuits used in the Humanity Ledger protocol (`circuits/escrow`, `circuits/streams`, and `circuits/identity`), the invariants they enforce, their derived UltraHonk verification keys, and the normative procedure for anchoring verification keys on Ethereum L1.

---

## 1. Circuit Inventory & Invariants

| Circuit | Purpose | Target Proving System | Curve | Public Inputs Count | Target Artifact |
|---|---|---|---|---|---|
| **`circuits/escrow`** | Private escrow release with temporal and nullifier constraints | UltraHonk | BN254 | 4 | `circuits/escrow/target/escrow.vk.json` |
| **`circuits/streams`** | Continuous linear payment stream withdrawal | UltraHonk | BN254 | 3 | `circuits/streams/target/streams.vk.json` |
| **`circuits/identity`** | Anonymous Merkle citizenship proof & sanctions screening | UltraHonk | BN254 | 3 | `circuits/identity/target/identity.vk.json` |

---

## 2. Invariants Formally Enforced per Circuit

### A. Escrow Circuit (`circuits/escrow/src/main.nr`)
1. **Positive Amount**: `amount > 0`. Zero or negative transfers are rejected.
2. **Ceiling Protection**: `amount <= MAX_ESCROW_AMOUNT` ($10^{15}$). Guards against integer wrap-around.
3. **Non-Zero Identity**: `sender_secret != 0` and `recipient_pubkey != 0`.
4. **Temporal Boundary**: `current_timestamp <= deadline`. Escrows cannot be released after expiration.
5. **Commitment Binding**: `escrow_commitment == pedersen_hash([sender_secret, recipient_pubkey, amount, salt])`.
6. **Unique Nullifier**: `nullifier == pedersen_hash([sender_secret, salt])`. Prevents double release.

### B. Payment Stream Circuit (`circuits/streams/src/main.nr`)
1. **Temporal Monotonicity**: `current_time >= start_time`.
2. **Strictly Positive Parameters**: `claim_amount > 0`, `rate_per_second > 0`, `total_allocation > 0`.
3. **Non-Zero Identity**: `sender_secret != 0` and `recipient_pubkey != 0`.
4. **Accrual Capacity Ceiling**: `(withdrawn_amount + claim_amount) <= (current_time - start_time) * rate_per_second`. Users cannot withdraw ahead of linear accrual.
5. **Total Allocation Ceiling**: `(withdrawn_amount + claim_amount) <= total_allocation`.
6. **Stream Commitment Binding**: Matches algebraic Pedersen hash of initial parameters.
7. **Stream Nullifier**: Emits state-transition nullifier binding commitment to new cumulative withdrawal.

### C. Identity & Compliance Circuit (`circuits/identity/src/main.nr`)
1. **Sanctions Compliance**: `jurisdiction_code != 999` and `jurisdiction_code != 998`. Screened in zero-knowledge without revealing exact location.
2. **Valid Jurisdiction**: `jurisdiction_code > 0`.
3. **Non-Zero Secret**: `identity_secret != 0`.
4. **Merkle Membership**: Proves inclusion of `H(identity_secret, jurisdiction_code)` into `expected_merkle_root`.
5. **Sybil Resistance / Scoped Nullifier**: `scoped_nullifier == pedersen_hash([identity_secret, scope])`. Enforces single action per identity per scope (e.g. governance vote, aid round).

---

## 3. Verification Key Hashes & Artifacts

All verification keys are generated for the UltraHonk proving system over BN254 and committed under `circuits/<name>/target/`:

* **Escrow VK Hash**: `0x2e8f19da5c0882e36b80d4400e2380f7aa9580b8529f7cefa5c2c9d09c693a15`
  * Artifact: [`circuits/escrow/target/escrow.vk.json`](file:///C:/Users/Grati/Documents/GitHub/Humanity-Ledger/circuits/escrow/target/escrow.vk.json)
* **Streams VK Hash**: `0x5a18c092dbce2b33918a5bf8e8071869e96e5792444b055963be5708846c98aa`
  * Artifact: [`circuits/streams/target/streams.vk.json`](file:///C:/Users/Grati/Documents/GitHub/Humanity-Ledger/circuits/streams/target/streams.vk.json)
* **Identity VK Hash**: `0x44d18fa792c01826f59b6579be4053ae897d2e06c3f0b263b65cb4659187da42`
  * Artifact: [`circuits/identity/target/identity.vk.json`](file:///C:/Users/Grati/Documents/GitHub/Humanity-Ledger/circuits/identity/target/identity.vk.json)

---

## 4. L1 Verification Key Anchoring Procedure

To ensure zero unilateral developer modification or circuit replacement, all verification keys are anchored on Ethereum L1 according to Section 8 of `docs/PROTOCOL_SPEC.md`:

```
                 +-----------------------------------+
                 | 1. Commit Circuit Code & VK Hash  |
                 +-----------------------------------+
                                   |
                                   v
                 +-----------------------------------+
                 | 2. Propose VK in Timelock Vault   |
                 |    (HumanityTimeLockVault)        |
                 +-----------------------------------+
                                   |
                                   v
                 +-----------------------------------+
                 | 3. Mandatory 14-Day Public Delay  |
                 |    (1,209,600 seconds)            |
                 +-----------------------------------+
                                   |
                                   v
                 +-----------------------------------+
                 | 4. On-chain Execution / Activation|
                 |    (ZKIdentityRegistry.setVK)     |
                 +-----------------------------------+
```

### Protocol Steps:
1. **Hash Verification**: The candidate circuit source is deterministically compiled. Its SHA256 ACIR hash and UltraHonk VK hash are posted publicly to GitHub and IPFS.
2. **On-Chain Timelock Proposal**: A transaction is submitted to `HumanityTimeLockVault` proposing the VK update:
   ```solidity
   bytes32 operationId = timelock.queueTransaction(
       targetContract,
       0,
       "setVerificationKey(bytes32,bytes)",
       abi.encode(circuitId, vkBytes),
       block.timestamp + 14 days
   );
   ```
3. **14-Day Observability Window**: During the 14-day timelock delay, all node operators and users observe the queued operation. If any malicious or unauthorized circuit modification is proposed, users have 14 days to exit via L1 exit paths or emergency triggers.
4. **Execution**: After the timelock expires, anyone can call `executeTransaction(operationId)` to register the new verification key into the active registry.
5. **Immutability of Historical Proofs**: Historical nullifiers remain anchored on L1; state transitions validated under retired VK versions remain permanently immutable.
