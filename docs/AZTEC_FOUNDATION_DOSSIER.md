# Humanity Ledger — Technical Dossier for the Aztec Ecosystem

**Date:** 4 November 2026
**Repository:** [github.com/humanityledger/Humanity-Ledger](https://github.com/humanityledger/Humanity-Ledger)
**Status:** Pre-release. Aztec testnet only. No external audit. Not affiliated with the Aztec Foundation.
**Engineering plan and full state table:** [`docs/zk/MASTER_PROMPT.md`](zk/MASTER_PROMPT.md) (Spanish)

---

## 1. Summary

Humanity Ledger is a messaging application (Ledger Chat). Direct messages go over XMTP v3, which uses MLS (RFC 9420); we do not implement MLS ourselves. Private payments use an Aztec PXE in the browser with the standard `Token` contract (our test tokens zkUSDC, zkDAI and zkETH, which have no value) and `SponsoredFPC` on Aztec testnet. Private transfers hide the amount and the parties; shielding and unshielding are public steps.

For escrow, payment streams and identity we wrote three aztec-nr v6 contracts (section 2.1). They compile with Aztec 6.0.0, pass 30 TXE tests in CI, and on 4 November 2026 were successfully deployed and verified on Aztec Testnet (documented with live addresses in `docs/AZTEC_TESTNET_DEPLOYMENTS.md`). We would value a review of their design (section 5).

We first wrote three standalone Noir circuits for the same purposes. A review on 3 November 2026 found soundness issues in all three (section 4). They remain in the repository as tested reference code; nothing relies on them.

An earlier version of this dossier pointed to commit `783df711` and described the circuits as production circuits; they did not compile then. That description was wrong.

---

## 2. What can be verified today

| Component | State | How to check |
|---|---|---|
| Browser wallet: shield, private send, unshield (`lib/aztec/wallet/`) | Real on Aztec testnet | `npm run test:aztec:e2e`. It needs our testnet token and faucet addresses, which are not yet published in the repository (task R-15) |
| Circuits compile and their tests pass | Real, nargo 1.0.0 | `cd circuits/escrow && nargo test` (same for identity, streams) |
| Committed artifacts are the compiled ones and the VKs are pinned | Real | `node scripts/zk/check-artifacts.mjs` |
| UltraHonk proving and verification with the pinned VK | Real in tests only (Node) | `npx vitest run test/unit/aztec/circuit-proving.test.ts test/zk/` |
| ZK-01 reproduction (streams double claim) | Documented | `npx vitest run test/circuits/streams_zk01_known_issue.test.ts` |
| aztec-nr contracts (escrow, streams, identity) | Compile with Aztec 6.0.0; 30 TXE tests pass in CI; deployed on Aztec Testnet | See [`docs/AZTEC_TESTNET_DEPLOYMENTS.md`](AZTEC_TESTNET_DEPLOYMENTS.md) for live contract addresses, class IDs and verification hashes |
| Browser (Web Worker) prover for the standalone circuits | Real in tests only; not used by any page | `npx vitest run test/zk/browser-prover.test.ts` |
| Unit and integration tests | 1,332 passing in CI on 4 November 2026 (they mock external services such as the database, Redis and RPC providers where needed) | `npm run test:run` |
| Direct messages | Real, provided by XMTP | XMTP browser SDK 5.2.0 |
| Community posts | Readable by our server | Disclosed in the product; migration to XMTP MLS groups is planned (`docs/communities/MLS_MIGRATION.md`) |

Pinned verification keys (SHA-256 of `circuits/<c>/target/vk`, @aztec/bb.js 5.3.0):

| Circuit | VK SHA-256 |
|---|---|
| escrow | `0x4e3cc4c8ce03607dcb2b98bd50c0d31084300634ee8f70f4674919682eb915c2` |
| identity | `0xcd02d2407de202d61e1a03c360633a9b0cdd8fe4b4d67b007cce108990632194` |
| streams | `0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346` |

A VK registry contract with a timelock exists (`contracts/ZKVerificationKeyRegistry.sol`, Hardhat tests) and `lib/aztec/verifier.ts` can read it, but it is not deployed on any network.

### 2.1 aztec-nr v6 contracts (`contracts/aztec/`)

Three contracts written against `aztec-labs-eng/aztec-nr@v6.0.0`: `PrivateEscrow`, `PaymentStream` and `IdentityCredential`. They compile with Aztec 6.0.0 in CI (workflow "Aztec contracts") and pass 30 TXE tests there (escrow 10, identity 11, streams 9), using a test-only token (`contracts/aztec/test_token`).

On 4 November 2026, all three contracts were deployed to the live Aztec Testnet (Sepolia L1, chain ID 11155111, rollup 679261766) and verified via ClientIVC UltraHonk proof generation. Full deployment receipts, class IDs and query verification instructions are in [`docs/AZTEC_TESTNET_DEPLOYMENTS.md`](AZTEC_TESTNET_DEPLOYMENTS.md):
- `IdentityCredential`: `0x174e4652dd027f6de9dfe025d46fbfc4378039f19e67c53a34803a8079db56f0`
- `PrivateEscrow`: `0x1d88555bead4ba81d1f93a16dd8366b5659d062928af1e57f94a75e08d343097` (bound to `zkUSDC`)
- `PaymentStream`: `0x0567a641e6e8e10b99bbe9f7c0787763b7ef6cfc75ef7e2c59d55dd754e2c895` (bound to `zkUSDC`)

A review on 3 November 2026 found that the first version could not refund an escrow or cancel a stream (both popped notes from the sender's set, which had none), and that `pop_notes` without a selector destroyed a user's other escrows and streams. These are fixed; the findings, fixes and open limits (contract keys for private custody, raw-selector token calls) are in [`docs/zk/AZTEC_CONTRACTS_REVIEW.md`](zk/AZTEC_CONTRACTS_REVIEW.md).

| Contract | What it does | State |
|---|---|---|
| `PrivateEscrow` | Claim note for the recipient, refund note for the sender, one settlement nullifier | Deployed on Aztec Testnet at `0x1d88555bead4ba81d1f93a16dd8366b5659d062928af1e57f94a75e08d343097`; 10 TXE tests passing |
| `PaymentStream` | Stream note re-created on each withdrawal (fixes the ZK-01 pattern); accrual from the anchor block | Deployed on Aztec Testnet at `0x0567a641e6e8e10b99bbe9f7c0787763b7ef6cfc75ef7e2c59d55dd754e2c895`; 9 TXE tests passing |
| `IdentityCredential` | Depth-32 membership, fixed and committed sanction lists, `SingleUseClaim` per scope | Deployed on Aztec Testnet at `0x174e4652dd027f6de9dfe025d46fbfc4378039f19e67c53a34803a8079db56f0`; 11 TXE tests passing |

## 3. What was removed or corrected in this revision

- The `*.vk.json` files used to carry invented Plonk-style fields (`circuitSize: 1024`, `qM`, `sigma1`, an "ACTIVE_REGISTERED" L1 anchoring). They now carry only values read from the real VK and toolchain.
- The VK "integrity" check hashed that JSON. It now hashes the binary VK and compares it with constants in code.
- `verifyProof` derived the VK from whatever bytecode was on disk. It now rejects an artifact that does not produce the pinned VK.
- Modules that produced fabricated transaction hashes (`lib/aztec/realTx.ts`) or targeted Aztec Connect v1 (`lib/aztec-zk-engine.ts`) were deleted.
- `ZKIdentityRegistry.verifyCredential` accepted any proof (the verifier call was commented out). It now always reverts.

---

## 4. Known soundness issues in the standalone circuits

| ID | Severity | Issue |
|---|---|---|
| ZK-01 | Critical | Streams: `withdrawn_amount` is a free private input and the nullifier is `H(commitment, withdrawn + claim)`, so the same accrual can be claimed many times with `withdrawn = 0` |
| ZK-02 | Critical | Escrow and streams: no payout address among the public inputs, so a proof can be front-run |
| ZK-03 | High | Escrow: claiming requires the sender's secret (a bearer instrument); no refund path |
| ZK-04 | High | Identity: leaf and nullifier are both 2-input Pedersen hashes with no domain separation; a scope equal to the jurisdiction code reveals the leaf |
| ZK-05 | High | Identity: depth-1 tree (anonymity set of two); the jurisdiction is a free witness |
| ZK-06 | Medium | Timestamps are chosen by the prover |
| ZK-07 | Medium | Verification did not pin the VK (fixed in this revision) |

---

## 5. Direction, and our questions

Meanwhile, v2 standalone circuits (`circuits/*_v2`) fix ZK-01 to ZK-05 with Poseidon2 and domain separation, a depth-32 identity tree, a committed sanction list, recipient-authorised escrow claims with sender refunds, and state chaining for streams. They compile and pass 36 tests in CI with nargo 1.0.0, and their VK hashes are pinned in CI (`scripts/zk/v2-vks.mjs`), but they have no deployed verifier that stores their state ([`docs/zk/V2_CIRCUITS.md`](zk/V2_CIRCUITS.md)).

Our direction is the aztec-nr contracts of section 2.1, so that note ownership and the network's nullifier tree replace hand-written state handling. In `PrivateEscrow`, two copies of one note (a claim note for the recipient, a refund note for the sender) publish the same settlement nullifier, so only one of claim and refund can land. The claim requires `anchor timestamp <= deadline` and sets `set_expiration_timestamp(min(deadline, anchor + 1 hour))`; the refund requires `anchor timestamp > deadline`. Escrow and stream balances are token notes owned by the contract, so the contract is deployed with public keys derived from a secret that the parties register in their PXE (`lib/aztec/keyed-deploy.ts`).

1. Is the shared settlement nullifier, with those timestamp checks, an idiomatic way to express "claim before the deadline, refund after it"?
2. Is a keyed deployment whose secret is shared with the parties the pattern you recommend for a contract that holds a private balance, or is there a better one?
3. Our contracts call the token through a raw `transfer_in_private` selector to avoid depending on a token crate. Is depending on the standard Token contract's interface preferred?
4. `PaymentStream` has no sender cancel: the sender holds no note. What would you use for a cancel that races safely with withdrawals?

---

## 6. Non-claims

1. No quantum resistance (BN254, secp256k1 and Curve25519 are classical).
2. No traffic-analysis protection.
3. Testnet only; no external audit; not production ready.

## 7. Contact

Stefan Antonio Cirisanu · `humanityledger@icloud.com`
