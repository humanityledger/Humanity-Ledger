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

## Current classes: keyed PrivateEscrow and PaymentStream, end to end (4 November 2026)

The same workflow, after two contract fixes (`PrivateEscrow.deposit` can no longer land after its own deadline; `PaymentStream` accrual can no longer overflow u128 and lock a stream), published both classes and ran run 41881180186, all checks passing:

| Contract | Instance (keyed) | Class |
| --- | --- | --- |
| `PrivateEscrow` | `0x062677942994e9d9bbc4bd9c47094b1e90d81caf3716867fb88098d144c191b9` | `0x163f855efb404a868d60e9ebd2352fd8317c54bc054561348c1cf764b2cdf873` |
| `PaymentStream` | `0x2a56c0d41aefa6a6eaae89611be7aaab3ac0aad91faf10fec26277ca9e689f1b` | `0x2de5fa9bcca0762779eeb30892cabdc550db12a0a755840a79ada60ecbf8783e` |

| Step | Transaction | Block |
| --- | --- | --- |
| Shield 90 test tokens into the sender's private balance | `0x003f1172a7792ae034f050767981448e8b0b9c6d0cf2298dbb6eae8d5852f1db` | 18528 |
| Escrow 1: deposit 25, deadline in 2 h (authwit) | `0x0b0e0a4fb040f9a25675b35d4371b41cf563a305564d0980150d21667a74a284` | 18531 |
| Escrow 2: deposit 10, deadline in 7 min (authwit) | `0x2953da19194fdc716e9437d40a8a6dc85a3432290ae7c9a5db872972c2321da1` | 18533 |
| Escrow 1: claim by the recipient | `0x26fae63291c3644cb43cb36bd2a4f7c6cba4dc0e14673093f821f4da696e8680` | 18535 |
| Stream: create 20 at 10,000 units/s (authwit) | `0x1deacfd33ff0d45950ad5de1254b9f1809c0711cb323387cf3f71539d902d96b` | 18538 |
| Stream: withdraw 5, within accrual | `0x04911e1af621aa648be48416fce752aadd7fe617fc25cb042204b869e99df3cc` | 18540 |
| Escrow 2: refund to the sender after the deadline | `0x1b2a358c6ce8c236a473b4af4b142a71d30f7e42a968065c600bd7fa46b4a0f0` | 18542 |

- Balances were checked after every step: sender 90 → 55 → 35 → 45, recipient 25 → 30.
- Refused, as expected: a refund of escrow 2 before its deadline (`deadline not reached`); a second claim of escrow 1 (`escrow not found`); a withdrawal of the whole stream total (`insufficient accrued balance`).
- Two further refusals hold for a narrower reason than their labels suggest, and we say so: the sender's refund of escrow 1 failed on the deadline check (its deadline had not passed), and the claim of escrow 2 after its deadline was sent with a wrong claim secret, so it shows the secret check. The deadline check on claims is covered by the TXE tests.
- These two instances are reference runs, not addresses for new deposits: each agreement gets its own keyed instance, and the throwaway keys of this run were discarded.

## First keyed PrivateEscrow, end to end (4 November 2026)

The workflow [Aztec escrow e2e (testnet)](../.github/workflows/aztec-escrow-e2e.yml) ([`scripts/aztec/e2e-escrow-testnet.mts`](../scripts/aztec/e2e-escrow-testnet.mts)) runs the escrow as it is meant to be used, with throwaway accounts paid by the Sponsored FPC and a fresh test token, so anyone can repeat it without our keys. Run 41865790651 passed every check:

| Step | Transaction | Block |
| --- | --- | --- |
| Mint to the sender (public) | `0x09cd9e7fbd665619c52d47048f24d9957c91b02d40d8bd878857fb0c9c9e2bf8` | 18442 |
| Shield into the sender's private balance | `0x140773382d81907e5ebbe311cdbe53766e5b95ab546e14cd5b7cba4a8f34210c` | 18443 |
| Deposit into a keyed `PrivateEscrow` (authwit for the token pull) | `0x10700502f17d393476d27f019601318ccbe371baea056968f858e318e0815f13` | 18445 |
| Claim by the recipient with the claim secret | `0x10fb36c09b2fcb05ba68269ccd9d579d5cc3e00feb6c8d280359cfb7022223f2` | 18447 |

- The escrow instance `0x1e03bcfe5c8b325ffb5a6252b25f3cd9126960d009734dbfbf9d93173ec1d182` is a universal deployment of the published `PrivateEscrow` class with public keys derived from a fresh secret; its address equals the one computed locally from that secret (`lib/aztec/keyed-deploy.ts`), and the node returns those keys.
- Both parties registered the escrow with its secret. The sender's private balance went from 60 to 35 test tokens, the recipient's to 25, and a second claim was refused (`PrivateEscrow: escrow not found`).
- The escrow and claim secrets were never printed or stored.

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
