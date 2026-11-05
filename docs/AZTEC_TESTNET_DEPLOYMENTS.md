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

## Current classes, end to end (5 November 2026): stored-terms views, agreement confirmation, a three-member credential tree

Run 42030688268 of the workflow [Aztec escrow e2e (testnet)](../.github/workflows/aztec-escrow-e2e.yml), all checks passing, throwaway accounts and a fresh test token. These are the classes of the committed artifacts.

| Contract | Instance | Class |
| --- | --- | --- |
| `PrivateEscrow` (keyed, with `escrow_view`) | `0x0253dbdd1e81bb19bcfb0401c5d64d6d0337c0dc113663c67fc6bf9c87bf8a7f` | `0x1fc9702de2946be7308126990f4cf3b8a3fbe9a4c53dc072d9ccb95bf9f04b5e` |
| `PaymentStream` (keyed, with `stream_view`) | `0x27fc79965b3a5d5b9bb3c2178527e8711b2b8ac8ce73be84c50e404c9b3d799d` | `0x1fd6afbe0bffe6a7cb675927dedc0aed886a46bf7c6d58edc32854af073701f2` |
| `IdentityCredential` | `0x024a1a10f3dfd34b72347edb484bfbf5578b13fda79273f4fed4ad00954993cb` | `0x1be813182640bfe08c2dea56bc3f96a7192b380a8dadc8210fc27ae0867e6c06` |
| `PrivateEscrow` opened with `openEscrow` | `0x12cf33312a1f026163492cea08f954c68e77914023be12850ffb2f0dc4590355` | `0x1fc9702de2946be7308126990f4cf3b8a3fbe9a4c53dc072d9ccb95bf9f04b5e` |

| Step | Transaction | Block |
| --- | --- | --- |
| Escrow: keyed deploy, publishing the class | `0x1bb4b2696fa3cbbcd6ffea65d35b88c653307d262aeb6765fb8c5318ec8620c2` | 19563 |
| Escrow 1: deposit 25 | `0x2f76cb066329b8d746c32342b72790eadcebe2388e04e37d020f5d738e7e86dc` | 19564 |
| Escrow 2: deposit 10, deadline in 7 min | `0x262980d61c1e38f6bc8b69b40a4d167164aa3e14d44a4fb57db8dbad5dc429c8` | 19566 |
| Escrow 1: claim by the recipient | `0x06e7662854f63c53d7d024591a0702b55db69aae32844450529b125ad180eaa4` | 19568 |
| Stream: keyed deploy, publishing the class | `0x274acaf9bc287080495267f0352b9a56dfe01737a79dc42a8ad7736e88f9a0c9` | 19570 |
| Stream 1: create 20; stream 2: create 5 | `0x0b75d12f4e4691e8b076d36458a21b673e0ab1868ec617fa15c87146a2a5a81b`, `0x2d89e6f43d74ed9b0740a4874b4e255ab541817868f5a0bf9c1971158f5ba9b6` | 19571, 19573 |
| Stream 1: withdraw 5 | `0x2e020c1fcc1de912ab8b00a15443af3a4ac360b2d0fcd7792e4c6fc8df193185` | 19575 |
| Escrow 2: refund after the deadline | `0x074f22d4557b77a8fe5084235f37162f29f00af549ac5172b3f2ed3a087a413a` | 19577 |
| Stream 1: cancel by the sender | `0x1ddc4b00d5eb41d9b86ecc31442f93e5f0405024647c04c6f4027e0dad383bd0` | 19580 |
| Identity: deploy with a placeholder root | `0x2a31319ee9c49e267bd5b3a85daf5cd93af1cee27c5f040f908af2ca5ed0811c` | 19582 |
| Identity: the issuer publishes the root of a three-member tree | `0x161aa4e36daf86d6cc10c3b3be809c7db8d0c123bafbe35a46722f3a3b34ac72` | 19583 |
| Identity: the member at index 5 claims in scope 1 | `0x1a47ebc1bbdecfe6397c891f9c17b40d10aef8b796577e9142787037665f6b21` | 19585 |
| Identity: the issuer replaces the root | `0x1d1dd45575f9b91944acd140c29ef1b12d854d26cd57885a646c709b8bf2646b` | 19587 |
| Identity: a claim against the replaced root, within the grace period | `0x165ce6cf22e87f01917fd7d51c8e2fa35b23c82aed0c8440f7e5780cf2f650e1` | 19589 |
| Identity: propose and accept a new issuer | `0x3060ce25150bb351484f719ce2bcfe194291475ce27e10f46528cb61864de3cb`, `0x23bf4b211a3d0f0b5399eb41c1779d2d308983b42a6e632684b90fe94617ca7b` | 19591, 19592 |
| Agreement: keyed deploy by `openEscrow` | `0x13b184c657e37f667bf18d84d7e89762e463c650e45dde1051a84bbd12280c8a` | 19594 |
| Agreement: deposit of 3 by `openEscrow` | `0x1ee3818e7be62caf5d68297980980e25d5309c6fe974c472ab8f05e731b76015` | 19595 |
| Agreement: the recipient claims with the secret from the invitation | `0x1e0f7d74fafd83e98d8b77877f0988444f97b3a458e30d156eb7b7f4d14d83c9` | 19597 |

What this run adds to the earlier ones:

- `escrow_view`: both parties read the stored amount, deadline and claim-secret hash of escrow 1; after the claim the sender's view reports it settled.
- `stream_view`: after the withdrawal the sender holds copies at index 0 and 1, and the view returns index 1 (5 withdrawn), the live state; after the cancel the recipient's view reports the stream as not live, with nothing available.
- `confirmAgreement`: the agreement escrow's stored note matched every field of the invitation, and the same note caught an invitation that overstated the amount.
- Identity: the root came from `lib/aztec/credential-tree.ts` with three members, and the recipient claimed at index 5, whose path has non-zero siblings and both left and right steps. The issuer tool and the contract compute the same tree.
- All escrow, stream and identity checks of the runs below were repeated with the same results (stream cancel: 45.12 to the sender, 39.88 to the recipient, 5 still in stream 2).

## Identity grace period and issuer rotation, and an agreement opened through the client library (5 November 2026)

Run 42023143254 of the workflow [Aztec escrow e2e (testnet)](../.github/workflows/aztec-escrow-e2e.yml), all checks passing, throwaway accounts and a fresh test token. It repeated every escrow and stream check of run 41999587163 below on new instances of the same classes, and added:

| Contract | Instance | Class |
| --- | --- | --- |
| `IdentityCredential` (grace period, two-step rotation) | `0x07c1380971e0349643892f2784cfeeb625ace863c86a3b3eae975f27cfa076f3` | `0x1be813182640bfe08c2dea56bc3f96a7192b380a8dadc8210fc27ae0867e6c06` |
| `PrivateEscrow` opened with `openEscrow` (`lib/aztec/agreements.ts`) | `0x2008decef28858d86bb7efda63a1c56b0d82384c1626916e827a406e9d2522b9` | `0x163f855efb404a868d60e9ebd2352fd8317c54bc054561348c1cf764b2cdf873` |

| Step | Transaction | Block |
| --- | --- | --- |
| Identity: deploy with a placeholder root | `0x0ca97aeb5b781274820b35e41c92c36bd02ac6d8ded9149c673ba82df1635e2f` | 19525 |
| Identity: the issuer publishes a real depth-32 root | `0x1f66f1203a6ce484018ea690ec8d894686d8b49d05aeece20ff68ac16f231be9` | 19528 |
| Identity: a member claims in scope 1 | `0x21015aac1f87a8776fcaed627408eab4a2718ea4c1fa585d1e243a5ad6b0879e` | 19530 |
| Identity: the issuer replaces the root | `0x117dcab624b067bc82a13c1b7db8c9800c6347344f085e8860e66a3524fa90eb` | 19532 |
| Identity: a claim against the replaced root, within the grace period | `0x1f66179700fd467a44e57308b5267cd9efe2ca8e73b43d2d603c575909fa2469` | 19534 |
| Identity: the issuer proposes a new issuer | `0x160f266cd228076dfb8d111cd660f6d43c930e0d1d0683b50a1275bb10ae9885` | 19535 |
| Identity: the proposed issuer accepts | `0x13e710c6e24571b88e5b140f5d7b30eedae82d1ba3edbd77a4ace62a36d288b8` | 19537 |
| Agreement: keyed deploy by `openEscrow` | `0x19a95ed31cb36805828009921b57174d7fb9c13d531713e786e53179620006a9` | not recorded |
| Agreement: deposit of 3 by `openEscrow` | `0x09af70437cd18cbf3908978631911d2200ca9d75e4c0475e65b0228485d86205` | not recorded |
| Agreement: the recipient claims with the secret from the invitation | `0x2863bc4d04e2bd1464e49f7a6d75d788ecfe62f6d3c7a259c00d39cedaec0ea6` | 19541 |

- After the rotation, the previous issuer's root change was refused (`only issuer can update root`).
- `acceptInvite` refused an invitation whose address had been swapped (`address does not match the shared secret`) before registering anything, then verified and registered the genuine one; the claim with its secret paid the recipient 3.
- The blocks of the two `openEscrow` transactions were not recorded by this run; `openEscrow` now returns them and later runs record them. Any reader can look the hashes up on the node.

The escrow and stream classes of this run were superseded the same day by the classes with `escrow_view` and `stream_view` (AZ-21, AZ-22); the IdentityCredential class above is current.

## Escrow, stream with sender cancel, identity claim, end to end (5 November 2026)

Run 41999587163 of the workflow [Aztec escrow e2e (testnet)](../.github/workflows/aztec-escrow-e2e.yml), all checks passing, with throwaway accounts and a fresh test token:

| Contract | Instance | Class |
| --- | --- | --- |
| `PrivateEscrow` (keyed) | `0x1950bee2b9eee9774519a53d39c95275dcce32596c3931e59155177fb4af7d5c` | `0x163f855efb404a868d60e9ebd2352fd8317c54bc054561348c1cf764b2cdf873` |
| `PaymentStream` (keyed, with sender cancel) | `0x2bd80a8d2dabcf30c40e656929b0234d68b03b92cce6eb027847e6ed75737a03` | `0x222a75a82bb2b83dd7be88c60d0c6efd044a2e7d548215ca6ff64792d5560756` |
| `IdentityCredential` | `0x10a7799394def50fc1bc2cfebe549bf2be029cff2e75c68b685badef1530d77c` | `0x090cebe96c81014a14c8408951ca7d0310f517864b15b57df19f045d4cb289ff` |

| Step | Transaction | Block |
| --- | --- | --- |
| Escrow 1: deposit 25 (authwit) | `0x130a9d064edbe475a6fe153fb035021becde20affda468623547f74e60dd7776` | 19332 |
| Escrow 2: deposit 10, deadline in 7 min | `0x1d595ec4e9b611e6d1fccc1f4c2eb879432d4c1b3c303bad4743acd343d01f60` | 19335 |
| Escrow 1: claim by the recipient | `0x09c5963b1944a689f6c16fbec09cc5e64676652b51a9cc57c6cc0c019140cc6c` | 19339 |
| Stream 1: create 20; stream 2: create 5 (same instance) | `0x0367979cc422b3f6797f84c6261b682799bb56be87cd86099b3e70f1e36c197a`, `0x004051220ab9951787a94fa74a0b4e87df9f47d3872cb35aa2d0d869a1ec0831` | 19344, 19346 |
| Stream 1: withdraw 5 | `0x1ea462b30c2c04defb2d0db2400998c40fe316c6022e4a1acf0a57266398533c` | 19348 |
| Escrow 2: refund after the deadline | `0x01acd45f6250f971ad233011f1abb48c0aad7848ae0422f9bce61147e02a322e` | 19350 |
| Stream 1: cancel by the sender | `0x2f219fe034b1bd12b6e962dca59cd31e30456776a61baf6e22f038e3c7791325` | 19352 |
| Identity: deploy with a placeholder root | `0x179142fe105f3f27693ecddab5d1826237464c39d9438518965ecfc7bf17b295` | 19355 |
| Identity: the issuer publishes a real depth-32 root | `0x2331d165dc0e7f4fd1d153fd7cefe41c7eee6b3c691f59efc20500927a07e528` | 19356 |
| Identity: a member claims in scope 1 | `0x2e9eeceeb1be5aaa11bdca705da054ddb07a9bd1f40cafd779ad9e80cc108806` | 19358 |

What each refusal proves, and why:

- Escrow 2 claimed **with its own claim secret** after the deadline: refused with `escrow expired`. The deadline check on claims is now proven on testnet, not only in TXE.
- Stream 1 after the cancel: the sender received 45.13 and the recipient 39.87, with 5 still in stream 2: 90 in total, nothing created or lost.
- A withdrawal from stream 1 after the cancel was **sent** and rejected by the node with `Invalid tx: Existing nullifier`: the state nullifier shared by withdraw and cancel (SEC-S12), with stream 2 still funding the contract.
- A cancel from the sender's stale copy was refused too, but here by the contract balance (stream 2 held less than the stale copy asked for). The same case with enough balance, where only the state nullifier can stop it, is the TXE test `a_cancel_from_a_stale_copy_fails_with_funds_left`.
- Identity: no claim against the placeholder root; a claim against the real root; a second claim in the same scope refused (duplicate nullifier); a root change by a non-issuer refused.

## Keyed PrivateEscrow and PaymentStream, end to end (4 November 2026)

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
# Query contract instance metadata from the testnet node (here the
# IdentityCredential v2 reference instance; any address in
# deployments/aztec-testnet.json works)
curl -X POST https://aztec-testnet.drpc.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "node_getContractInstance",
    "params": ["0x10a7799394def50fc1bc2cfebe549bf2be029cff2e75c68b685badef1530d77c"],
    "id": 1
  }'
```

The response returns the instance: its current class ID, initialization hash and public keys. `npx vitest run test/unit/aztec/deployments-registry.test.ts` recomputes each class ID from the committed artifact, offline.
