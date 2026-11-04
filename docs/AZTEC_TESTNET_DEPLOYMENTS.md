# Aztec testnet deployments

> **Status, checked against the node on 4 November 2026.** The three instances below exist and run exactly the classes compiled from this repository. `PrivateEscrow` and `PaymentStream` were deployed **without public keys** (they carry `PublicKeys.default()`): tokens sent to them become notes that no PXE can ever spend, so **do not deposit into these two addresses**. Escrows and streams must use a keyed instance per agreement (`scripts/aztec/deploy-keyed.ts`). `IdentityCredential` was deployed with placeholder roots, so no member can claim until the issuer sets a real identity root.
>
> The machine-readable record is [`deployments/aztec-testnet.json`](../deployments/aztec-testnet.json). The workflow [Aztec testnet deployments](../.github/workflows/aztec-deployments.yml) checks it against the node every day: instance present, class ID equal to the committed artifact, public keys present exactly when the record says so.

**Network:** Aztec Testnet (Tierra Alpha V6)  
**Aztec Node RPC:** `https://aztec-testnet.drpc.org`  
**Underlying L1:** Ethereum Sepolia (`chainId: 11155111`)  
**Rollup Version:** `679261766`  
**Deployer Admin Account:** `0x2eeb88d85fd060957000fd67a3c3fbf7f2fa3799f809841bb7577764c4c9a0e1`  
**Sponsored Fee Payment Contract (FPC):** `0x2d8fff82a3b0c15d0a89169e7d8d043e079ab94d52031f1de1e4972ebad169d3`  
**Date of Deployment:** 4 November 2026  

---

## 1. Native Aztec v6.0.0 Contracts

All three contracts were written against `aztec-nr` v6.0.0, compiled with `aztec compile` (Aztec 6.0.0) and deployed in ordinary testnet transactions, proved by the PXE and paid by the Sponsored FPC.

### A. IdentityCredential
* **Contract Address:** `0x174e4652dd027f6de9dfe025d46fbfc4378039f19e67c53a34803a8079db56f0`
* **Contract Class ID:** `0x2d3cef07dd06a489ccc524334c38e694f27d5757059d485cb04e20983d3d68ad`
* **Deployment Transaction Hash:** `0x2fc62a72af16f7d9fd8194ecc3d60b4c840998d1e7ffd458a2a6230d3cb71ae9`
* **Issuer (Admin):** `0x2eeb88d85fd060957000fd67a3c3fbf7f2fa3799f809841bb7577764c4c9a0e1`
* **Initial Identity Merkle Root:** `0x0000000000000000000000000000000000000000000000000000000012345678` (placeholder)
* **Initial Sanction List Root:** `0x0000000000000000000000000000000000000000000000000000000087654321` (placeholder)
* **Artifact Path:** `contracts/aztec/identity/target/identity_credential-IdentityCredential.json`

### B. PrivateEscrow (do not use: deployed without keys)
* **Contract Address:** `0x1d88555bead4ba81d1f93a16dd8366b5659d062928af1e57f94a75e08d343097`
* **Contract Class ID:** `0x1e8340e05494363e696ad4f474ee2fdc88250887d69ce2c81706967ad84351d0`
* **Deployment Transaction Hash:** `0x1a11cf43d4985bb8c31e77870d973e8f38b9c59dc752c73e906ba468d4dc961f`
* **Bound Asset (zkUSDC):** `0x0753220b168733678aec0b69efd3866127babba191e98383740f5ec4cd3566a5`
* **Artifact Path:** `contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json`

### C. PaymentStream (do not use: deployed without keys)
* **Contract Address:** `0x0567a641e6e8e10b99bbe9f7c0787763b7ef6cfc75ef7e2c59d55dd754e2c895`
* **Contract Class ID:** `0x07c8ec07c1c067cc3ddad361337a2418c48bbf818317792972d68ce1ed70186d`
* **Deployment Transaction Hash:** `0x08903233b34baf61bda481f8eb5839ee7821709972a251d20bdd9431c62b0a7c`
* **Bound Asset (zkUSDC):** `0x0753220b168733678aec0b69efd3866127babba191e98383740f5ec4cd3566a5`
* **Artifact Path:** `contracts/aztec/streams/target/payment_stream-PaymentStream.json`

---

## 2. Deployed Testnet Token Contracts

| Token | Address | Symbol | Decimals | Admin Minter |
|---|---|---|---|---|
| **zkUSDC** | `0x0753220b168733678aec0b69efd3866127babba191e98383740f5ec4cd3566a5` | `zkUSDC` | 6 | `0x188d4e726d48a0cb67f1c78fa3336787381487bfa296c0e71048366de0b9446a` |
| **zkDAI** | `0x187223e54a0492d76ef6f08d4a5dc0ac5428e59e588a09d65ffd42c22ac149f9` | `zkDAI` | 18 | `0x188d4e726d48a0cb67f1c78fa3336787381487bfa296c0e71048366de0b9446a` |
| **zkETH** | `0x1d612bbb8f52e5e5b3390528664a6af4e262eb47362d6675b23c835d20cd339e` | `zkETH` | 18 | `0x188d4e726d48a0cb67f1c78fa3336787381487bfa296c0e71048366de0b9446a` |

---

## 3. How to Independently Verify on Aztec Testnet

Any developer or reviewer can verify these deployments using Aztec.js or a direct JSON-RPC call against `https://aztec-testnet.drpc.org`:

```bash
# Query contract instance metadata from the testnet node
curl -X POST https://aztec-testnet.drpc.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "node_getContractInstance",
    "params": ["0x1d88555bead4ba81d1f93a16dd8366b5659d062928af1e57f94a75e08d343097"],
    "id": 1
  }'
```

The response returns the instance: its current class ID, initialization hash and public keys. `npx vitest run test/unit/aztec/deployments-registry.test.ts` recomputes each class ID from the committed artifact, offline.
