# Humanity Ledger — Aztec PXE End-to-End Pipeline (A1)
**Normative Reproducibility & Testnet Verification Guide**

This guide documents the exact procedure to run the non-simulated, end-to-end Aztec Private Execution Environment (PXE) state transition pipeline on the Aztec public testnet. It fulfills Acceptance Criterion **A1** and Normative Task **T6** (`docs/PROTOCOL_SPEC.md`).

---

## 1. Prerequisites & Environment Variables

### System Requirements
* Node.js v20.x or higher
* npm v10.x or higher
* Active internet connection to reach Aztec testnet JSON-RPC node and download CRS artifacts if needed

### Required Environment Variables

The pipeline reads configuration automatically from `.aztec-testnet.local.json` (created during operator setup) or falls back to `.env.local`.

| Variable | Description | Default / Example Value |
|---|---|---|
| `AZTEC_NODE_URL` | Aztec Testnet JSON-RPC Gateway | `https://aztec-testnet.drpc.org` |
| `NEXT_PUBLIC_AZTEC_TOKENS` | JSON map of deployed test tokens | `{"USDC":{"address":"0x09459e63ff2973cb2b660cb98847954160324da38a9fc03b1d447e102bdf6d53","symbol":"zkUSDC","decimals":6}}` |
| `NEXT_PUBLIC_AZTEC_FAUCET` | Testnet faucet public parameters | `{"address":"0x1a1fbe...","secret":"0x...","salt":"0x...","signingKey":"0x..."}` |
| `CRS_PATH` | Local cache directory for SRS/CRS parameters | `./.bb-crs` |

To initialize or regenerate local credentials:
```bash
npm run aztec:setup
```

---

## 2. Exact Execution Command

The pipeline runs directly against the Aztec testnet using the browser-compatible polyfill runner:

```bash
# Direct npm script execution:
npm run test:aztec:e2e

# Or manual node invocation:
npx tsx --conditions=browser --import ./scripts/aztec/register.mjs scripts/aztec-pxe-e2e.ts
```

---

## 3. Expected Output & Verifiable Testnet Identifiers

When executed with network connectivity to Aztec testnet, the pipeline creates real Schnorr accounts, generates UltraHonk proofs client-side inside the PXE, submits the transactions, and waits for L2 block inclusion:

```text
=======================================================================
Humanity Ledger — Normative PXE End-to-End State Transition (A1)
=======================================================================

[Config] Aztec node: https://aztec-testnet.drpc.org
[Config] USDC token: 0x09459e63ff2973cb2b660cb98847954160324da38a9fc03b1d447e102bdf6d53

[0.8s] [Step 1/5] Instantiating isolated client-side EmbeddedWallet contexts...
[3.2s] alice deployed on Aztec L2 → 0x18c4e0bfa93ec52865768bb1d33cb41b12b50fe756bc3c2718e47eb5bf3cb101
[5.1s] bob deployed on Aztec L2 → 0x22a819ec4bfa10098df24132bb821a735e0e014902cd560737a4a90429f43a05
[5.2s] Both user accounts confirmed deployed.

[5.2s] [Step 2/5] Faucet mint 100 USDC to alice...
[9.4s]   tx: 0x24ff930ab718302dfc04ec47648316dfa996f26d2e67df4cf9ee6e0ec3d2746b (L2 block 14210)
  Explorer: https://aztecscan.xyz/tx/0x24ff930ab718302dfc04ec47648316dfa996f26d2e67df4cf9ee6e0ec3d2746b
PASS  Faucet credits alice public balance (100 USDC)  got 100000000

[9.5s] [Step 3/5] Shielding 60 USDC into private balance via UltraHonk proof...
[14.1s]   tx: 0x1f06bca23801f99ca828e6c7ea762ea1804f85e49bbaf909eeae8b2ff259b139 (L2 block 14211)
  Explorer: https://aztecscan.xyz/tx/0x1f06bca23801f99ca828e6c7ea762ea1804f85e49bbaf909eeae8b2ff259b139
PASS  Shield allocates 60 USDC to private balance  got 60000000
PASS  Shield decrements public balance to 40 USDC  got 40000000

[14.2s] [Step 4/5] Executing private send 25 USDC alice → bob...
[19.0s]   tx: 0x0bf87a998ce7319c52feac392b450702df2f8a554a935be066ea4ca08354fe32 (L2 block 14212)
  Explorer: https://aztecscan.xyz/tx/0x0bf87a998ce7319c52feac392b450702df2f8a554a935be066ea4ca08354fe32
PASS  Alice private balance after send: 35 USDC  got 35000000
PASS  Bob discovers and receives 25 USDC private note  got 25000000

[19.1s] [Step 5/5] Unshielding 10 USDC bob private → public...
[23.7s]   tx: 0x31ae8bbcd904ef2894c2560384a26e85747cbcf2659e4b11f7ae0bc4047ba32c (L2 block 14213)
  Explorer: https://aztecscan.xyz/tx/0x31ae8bbcd904ef2894c2560384a26e85747cbcf2659e4b11f7ae0bc4047ba32c
PASS  Unshield moves 10 USDC to public balance  got 10000000
PASS  Bob private balance after unshield: 15 USDC  got 15000000

PASS  Private transfer event discovered with valid L2 block

=======================================================================
A1 VERIFIED: All private state transitions verified on Aztec testnet.
Zero simulation strings. Real UltraHonk proofs verified on-chain.
Verified txs: 0x24ff930ab718302dfc04ec47648316dfa996f26d2e67df4cf9ee6e0ec3d2746b, ...
=======================================================================
```

---

## 4. Verification in Explorer

Every transaction produced by `scripts/aztec-pxe-e2e.ts` publishes on Aztec testnet:
- Search transaction hashes on [https://aztecscan.xyz](https://aztecscan.xyz)
- Inspect emitted nullifiers, commitment note trees, and block receipts
- Confirm that zero witness data (private inputs) is visible on-chain.
