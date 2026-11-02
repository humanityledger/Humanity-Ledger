# P2-C.1 Studio ZK Status

> Applies the strict ZK-washing prevention rule from the P2-C.1 authorization.

## Rule
> "If Studio produces a proof that is not verified via a real verifier connected to the flow, its status CANNOT be VERIFIED."

---

## ZK Component Inventory

### 1. `generateCoreEntropy` (client-side)
- **Type:** Local entropy generation (32-byte hex)
- **Circuit:** None (no circuit involved)
- **Prover:** None (pure `crypto.randomBytes` / CSPRNG equivalent)
- **Verifier:** None
- **Status:** `DEMO` — Generates a unique value but is not a ZK proof

### 2. `POST /api/premium/prover` (server-side)
- **Type:** Server-side ZK proof delegation
- **Circuit:** `provenance_v1` (Noir circuit — exists in `noir-projects/`)
- **Prover:** Server relay to external prover (or local WASM fallback)
- **Inputs:** `entropy` (private), `creator` (public)
- **Public inputs:** `creator`
- **Private inputs:** `entropy`
- **Verifier:** NONE — no on-chain verifier contract is connected to this flow
- **Proof verification path:** The txHash is stored in DB; there is no contract call to a Noir verifier
- **Deployment:** Circuits in repo, not deployed on Aztec Mainnet
- **Test vectors:** None documented
- **Status:** `DEMO` — Proof is generated (or simulated via `0xLocalWasmProof`) but NOT cryptographically verified on-chain

### 3. `POST /api/aztec/anchor` (blockchain interaction)
- **Type:** Aztec Mainnet transaction
- **Circuit:** Aztec protocol-level (not application-level Noir circuit)
- **Prover:** Aztec Sequencer
- **Verifier:** Aztec protocol
- **Status:** `BETA` — Real testnet tx submitted, but no application-layer ZK proof is verified

---

## Summary Table

| Component | Status | Verifier Connected | On-chain |
|---|---|---|---|
| generateCoreEntropy | DEMO | No | No |
| POST /api/premium/prover | DEMO | No | No |
| POST /api/aztec/anchor | BETA | Aztec Protocol | Testnet |

---

## P2-C.1 Constraint
No ZK component may be reclassified from DEMO to PARTIAL or VERIFIED during this pilot
unless a real verifier contract is deployed and the proof is validated through it.
The Identity Adapter does NOT change the ZK status of any of these components.
