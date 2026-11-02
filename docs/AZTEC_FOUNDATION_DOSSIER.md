# Aztec Foundation — Technical Integration & Product Validation Dossier
## Protocol: Humanity Ledger | Recipient: Alejo Amiras & Aztec Foundation Product Team
**Date:** November 2026  
**Repository:** [https://github.com/humanityledger/Humanity-Ledger](https://github.com/humanityledger/Humanity-Ledger)  
**Canon Commit (main):** `931b1005`  
**Current Protocol Maturity:** Testnet Stage 1 — Audit & Validation Ready  

---

## 1. Executive Summary

Humanity Ledger is an open source cryptographic protocol coupling end to end encrypted group messaging conforming to Messaging Layer Security (MLS, RFC 9420) with **client side zero knowledge proof generation powered by Aztec Network's Private Execution Environment (PXE) and UltraHonk proving system**.

This dossier is submitted to **Alejo Amiras** and the Aztec Foundation Product Validation & Ecosystem team to facilitate a rigorous, reproducible technical review of our Aztec integration, Noir circuits, client side proving architecture, and security boundaries.

### Core Value Proposition
- **Sovereign Client Execution:** User private balances, witness generation, and transaction notes never touch any backend server or RPC relay unshielded. Proving is executed inside the client's local PXE (`@aztec-labs/aztec.js`).
- **Cryptographic Non-Simulated Proving:** We prohibit mocked cryptographic primitives. Continuous integration enforces a strict non-simulation test requirement (`test/aztec_e2e_no_simulation.test.ts`) banning synthetic random fields (`Fr.random()`) or dummy proof strings in production test paths.
- **Auditable Hybrid Architecture:** Off-chain private state transitions via Aztec UltraHonk, combined with verifiable Layer 1 EVM dispute resolution and timelocked vaults (`HumanityTimeLockVault`, `LedgerDeadmanSwitch`).

---

## 2. Aztec Integration Architecture

```
+-------------------------------------------------------------------------+
|                        Client Device (Browser / Desktop)                |
|                                                                         |
|  +--------------------+        +-------------------------------------+  |
|  | MLS Messaging      |        | Aztec Private Execution (PXE)       |  |
|  | (RFC 9420 / XMTP)  |        | - Local Witness Generation          |  |
|  +--------------------+        | - UltraHonk Client Prover           |  |
|                                | - Note Discovery & Key Store        |  |
|                                +-------------------------------------+  |
|                                                   |                     |
|                                                   v                     |
|                                      +-------------------------+        |
|                                      | Noir Circuits (BN254)   |        |
|                                      | - Escrow Release        |        |
|                                      | - Anonymous Identity    |        |
|                                      | - Payment Streams       |        |
|                                      +-------------------------+        |
+---------------------------------------------------|---------------------+
                                                    |
                                      Private Tx / Shielded Proof
                                                    |
                                                    v
                                    +-------------------------------+
                                    | Aztec Network Testnet         |
                                    | - Sequencer / Prover Pool     |
                                    | - Rollup State Tree           |
                                    +-------------------------------+
                                                    |
                                            Batch Settlement
                                                    |
                                                    v
                                    +-------------------------------+
                                    | Ethereum L1 Settlement        |
                                    | - Rollup & Fast Inbox         |
                                    | - HumanityTimeLockVault       |
                                    +-------------------------------+
```

### 2.1 Noir Circuits Deployed
The repository implements three specialized Noir circuits in `circuits/`, compiled with production verification keys (`target/*.vk.json`):

1. **Private Escrow Release Circuit (`circuits/escrow/src/main.nr`):**
   - **Invariants:** 
     - Commitment binding: $\text{commitment} = \mathcal{H}(\text{sender\_secret}, \text{recipient\_pubkey}, \text{amount}, \text{salt})$
     - Temporal boundary: $\text{current\_timestamp} \le \text{deadline}$
     - Nullifier uniqueness: $\text{nullifier} = \mathcal{H}(\text{sender\_secret}, \text{salt})$
     - Value bounding: $0 < \text{amount} \le 10^{15}$ (overflow & negative value protection)
     - Non-zero identity: $\text{sender\_secret} \ne 0 \land \text{recipient\_pubkey} \ne 0$

2. **Anonymous Identity & Compliance Circuit (`circuits/identity/src/main.nr`):**
   - **Invariants:**
     - Sanction screening without disclosing nationality: $\text{jurisdiction\_code} \notin \{\text{SANCTIONED\_1}, \text{SANCTIONED\_2}\}$
     - Merkle membership of identity secret within authorized identity tree.
     - Sybil resistance via scoped nullifier: $\text{nullifier} = \mathcal{H}(\text{identity\_secret}, \text{scope})$.

3. **Continuous Payment Stream Circuit (`circuits/streams/src/main.nr`):**
   - **Invariants:**
     - Temporal monotonicity: $\text{current\_time} \ge \text{start\_time}$
     - Accrual constraint: $(\text{withdrawn} + \text{claim}) \le (\text{current\_time} - \text{start\_time}) \times \text{rate}$
     - Allocation ceiling: $(\text{withdrawn} + \text{claim}) \le \text{total\_allocation}$
     - Unique nullifier per withdrawal state transition.

### 2.2 Client-Side Verification Key (VK) Lifecycle Enforcer
In accordance with Invariant P4 (Private State Integrity), `lib/aztec/verifier.ts` asserts that local circuit verification keys match on-chain registered hashes anchored under a 14-day timelock before client proof synthesis:
- **`ACTIVE`:** Proof synthesis permitted if local canonical SHA-256 matches on-chain commitment.
- **`DEPRECATED`:** Proving permitted with console deprecation warning and migration banner.
- **`RETIRED` / `HASH MISMATCH`:** Client-side proof synthesis is unconditionally blocked.

### 2.3 Aztec PXE Testnet Pipeline
Implemented in `scripts/aztec-pxe-e2e.ts`:
- Derives ephemeral `EmbeddedWallet` Schnorr keys from OS CSPRNG (`crypto.randomBytes`).
- Connects to Aztec Node (`node.aztec.network`).
- Issues faucet minting, executes `transfer_to_private` (shielding), `transfer` (private-to-private), and `transfer_to_public` (unshielding).
- Tested against Aztec Testnet contracts (`SponsoredFPCContract`, `TokenContract`).

---

## 3. Reproducible Verification & Test Evidence

The Aztec Foundation engineering team can independently verify all test batteries in less than 60 seconds from a clean checkout:

```bash
# 1. Clone repository
git clone https://github.com/humanityledger/Humanity-Ledger.git
cd Humanity-Ledger

# 2. Verify Non-Simulated Proving & Noir Circuit Invariants
npx vitest run test/aztec_e2e_no_simulation.test.ts test/aztec_vk_integrity.test.ts test/circuits/

# 3. Verify Key Custody & MLS Post-Compromise Security
npx vitest run test/key_custody.test.ts test/mls_post_compromise.test.ts

# 4. Verify L1 Smart Contract Invariants (Cancun Hardhat Runtime)
npm run test:contracts

# 5. Run L1 Anti-Backdoor Bytecode Verifier & Traceability CI Checker
npx tsx scripts/verify-l1-bytecode.ts
npm run check:traceability

# 6. Run Full Property-Based Fuzzing (60,000 iterations)
npx vitest run test/property_fuzz.test.ts

# 7. Run Full Unit & Security Suite (1,076 tests)
npm run test:run
```

### Verification Results Summary (Commit `931b1005`)
| Test Battery | Target Area | Result | Status |
|---|---|---|---|
| **Non-Simulated Proving** (`test/aztec_e2e_no_simulation.test.ts`) | Aztec PXE Pipeline | 3/3 passed | ✅ VERIFIED |
| **VK Lifecycle Integrity** (`test/aztec_vk_integrity.test.ts`) | SHA-256 VK registry | 8/8 passed | ✅ VERIFIED |
| **Noir Escrow Circuit** (`test/circuits/escrow.test.ts`) | Temporal & value invariants | 8/8 passed | ✅ VERIFIED |
| **Noir Identity Circuit** (`test/circuits/identity.test.ts`) | Compliance & Merkle proof | 7/7 passed | ✅ VERIFIED |
| **Noir Streams Circuit** (`test/circuits/streams.test.ts`) | Accrual & capacity bounds | 6/6 passed | ✅ VERIFIED |
| **Key Custody** (`test/key_custody.test.ts`) | Zero server key knowledge | 5/5 passed | ✅ VERIFIED |
| **MLS Security** (`test/mls_post_compromise.test.ts`) | RFC 9420 PCS & epoch ratchet | 6/6 passed | ✅ VERIFIED |
| **Contract Invariants** (`test/contracts_invariants.test.ts`) | L1 Timelock & Registry | 5/5 passed | ✅ VERIFIED |
| **High-Capacity Fuzzing** (`test/property_fuzz.test.ts`) | 60k iterations property fuzz | 6/6 suites passed | ✅ VERIFIED |
| **Full Vitest Suite** (`npm run test:run`) | Entire codebase unit/integration | **1,076 / 1,076 passed** (61 files) | ✅ VERIFIED |

---

## 4. Transparent Boundaries & Explicit Non-Claims

We adhere to a policy of total technical honesty. In our documentation (`README.md`, `docs/PROTOCOL_SPEC.md`), we publish explicit **Non-Claims**:

1. **No Quantum Immunity Claim for Classical Primitives:** While the protocol uses hybrid post-compromise ratchets and defense-in-depth isolation, we explicitly state that underlying elliptic curve cryptography (BN254 curve in Aztec UltraHonk, secp256k1 on Ethereum L1, Curve25519) remains vulnerable to Shor's algorithm on cryptanalytically relevant quantum computers (CRQC).
2. **No Metadata Privacy Claim for Network Topology:** MLS guarantees message payload confidentiality and post-compromise security, but does not obscure network packet headers, IP transport timings, or graph communication frequency.
3. **Testnet Stage 1 Status:** Humanity Ledger is currently deployed on Aztec Testnet and Polygon Amoy / Base testnets. It is NOT presented as mainnet production-ready until Aztec reaches mainnet stability and formal external audits are complete.

---

## 5. Proposed Collaboration & Validation Agenda

We invite Alejo Amiras and the Aztec Foundation team to collaborate on the following milestone initiatives:

1. **Client-Side Proving Optimization (Browser & Mobile WASM):**
   - Benchmark and optimize UltraHonk proof generation memory footprint and latency inside mobile Safari and low-end Chromium devices.
   - Profile `@aztec-labs/aztec.js` Web Worker proof pipelines under constrained hardware (4 GB RAM devices).
2. **Sponsored Fee Abstraction for Private Micro-Settlement:**
   - Implement native Paymaster / Sponsored Fee Payment mechanisms for gasless private note generation in consumer chat flows.
3. **Note Discovery & State Synchronization:**
   - Evaluate Aztec's latest note-tagging and viewing key scanning strategies to minimize initial sync latency on client launch.
4. **Formal Circuit Review:**
   - Joint security review of `circuits/escrow`, `circuits/identity`, and `circuits/streams` ahead of our external audit cycle.

---

## 6. Engineering Contacts
- **Core Engineering:** `core@humanityledger.com`
- **Lead Developer & Protocol Architect:** Stefan Antonio Cirisanu (`stefan@humanityledger.com`)
- **Repository:** `https://github.com/humanityledger/Humanity-Ledger`
- **Branch:** `main` (Commit `931b1005`)
