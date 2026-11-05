# Humanity Ledger — Technical Dossier for the Aztec Ecosystem

**Date:** 4 November 2026 (updated 16:30 CET)
**Repository:** [github.com/humanityledger/Humanity-Ledger](https://github.com/humanityledger/Humanity-Ledger)
**Status:** Pre-release. Aztec testnet only. No external audit. Not affiliated with the Aztec Foundation.
**Engineering plan and full state table:** [`docs/zk/MASTER_PROMPT.md`](zk/MASTER_PROMPT.md) (Spanish)

---

## 1. Summary

Humanity Ledger is a messaging application (Ledger Chat). Direct messages go over XMTP v3, which uses MLS (RFC 9420); we do not implement MLS ourselves. Private payments use an Aztec PXE in the browser with the standard `Token` contract (our test tokens zkUSDC, zkDAI and zkETH, which have no value) and `SponsoredFPC` on Aztec testnet. Private transfers hide the amount and the parties; shielding and unshielding are public steps.

For escrow, payment streams and identity we wrote three aztec-nr v6 contracts (section 2.1). They compile with Aztec 6.0.0 and pass 55 TXE tests in CI. On 4 November 2026 one instance of each was deployed on Aztec testnet (`docs/AZTEC_TESTNET_DEPLOYMENTS.md`); those first escrow and stream instances were deployed without public keys and must not receive deposits; keyed instances of the current classes have since run end to end there (section 2.1). We would value a review of their design (section 5).

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
| aztec-nr contracts (escrow, streams, identity) | Compile with Aztec 6.0.0; 55 TXE tests pass in CI; keyed escrow and stream instances and identity claims of the current classes ran end to end on testnet; the first escrow and stream instances (4 Nov, morning) are keyless (do not use); all checked daily against the node | See [`docs/AZTEC_TESTNET_DEPLOYMENTS.md`](AZTEC_TESTNET_DEPLOYMENTS.md) for live contract addresses, class IDs and verification hashes |
| Browser (Web Worker) prover for the standalone circuits | Real in tests only; not used by any page | `npx vitest run test/zk/browser-prover.test.ts` |
| Keyed `PrivateEscrow` and `PaymentStream`, current classes, end to end (escrow claim and refund after the deadline, stream withdrawal bounded by accrual) | Real on Aztec testnet, 4 November 2026 (run 41881180186, blocks 18528 to 18542) | Workflow "Aztec escrow e2e (testnet)"; hashes in `docs/AZTEC_TESTNET_DEPLOYMENTS.md` |
| Unit and integration tests | 1,338 passing in CI on 4 November 2026 (they mock external services such as the database, Redis and RPC providers where needed) | `npm run test:run` |
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

Three contracts written against `aztec-labs-eng/aztec-nr@v6.0.0`: `PrivateEscrow`, `PaymentStream` and `IdentityCredential`. They compile with Aztec 6.0.0 in CI (workflow "Aztec contracts") and pass 55 TXE tests there (escrow 13, identity 20, streams 22), using a test-only token (`contracts/aztec/test_token`).

| Contract | What it does | Verified |
|---|---|---|
| `PrivateEscrow` | A claim note for the recipient and a refund note for the sender, which emit the same settlement nullifier: only one of claim and refund can land. Claim requires `anchor <= deadline` and expires by the deadline; refund requires `anchor > deadline`; a deposit cannot land after its own deadline. `escrow_view` (utility) returns the stored terms and whether the escrow has settled | 13 TXE tests; on testnet: claim, refund after the deadline, and a claim with the right secret after the deadline refused with `escrow expired` |
| `PaymentStream` | Accrual from the start time, capped at the total without overflow; each withdrawal re-creates the stream note. Sender cancel: every state has an index and a state nullifier emitted by both withdraw and cancel, and withdrawals hand the sender a copy of the next state. `stream_view` (utility) returns the live state to either party and skips the sender's stale copies | 22 TXE tests, two of which keep a second stream funding the instance so only the state nullifier can stop a withdrawal after a cancel or a cancel from a stale copy; on testnet: withdrawal, cancel (every token accounted for) and a later withdrawal rejected by the node with `Existing nullifier` |
| `IdentityCredential` | Depth-32 Poseidon2 membership, fixed and committed sanction lists, one `SingleUseClaim` per scope; the claim expires by the credential's expiry; a replaced root stays valid for one hour (revocable); two-step issuer rotation | 20 TXE tests; on testnet: claim against a real root, claim within the grace period of a replaced root, rotation of the issuer |

Escrow and stream balances are token notes owned by the contract, so each agreement gets its own instance, deployed with public keys derived from a secret that only its two parties hold (`lib/aztec/keyed-deploy.ts`). The client opens and accepts agreements through `lib/aztec/agreements.ts`; the receiver accepts an invitation only after recomputing its address and class from the shared secret (`lib/aztec/agreement-invite.ts`), and then confirms the deposit against the contract's stored note (`confirmAgreement`). The peer's Aztec address is announced in the XMTP conversation and pinned on first use (`lib/aztec/peer-binding.ts`); this is trust on first use, not yet a proof that the peer controls the account. Credential trees for `IdentityCredential` are built by `lib/aztec/credential-tree.ts`.

Every instance we deployed is in [`deployments/aztec-testnet.json`](../deployments/aztec-testnet.json), checked daily against the node (workflow "Aztec testnet deployments"), and every end-to-end run with its transaction hashes is in [`docs/AZTEC_TESTNET_DEPLOYMENTS.md`](AZTEC_TESTNET_DEPLOYMENTS.md). The first escrow and stream instances of 4 November (`0x1d88…3097`, `0x0567…c895`) were deployed without keys: tokens sent to them could never be spent. They are marked do-not-use. The first identity instance (`0x174e…56f0`) keeps placeholder roots.

Findings, fixes and open limits are in [`docs/zk/AZTEC_CONTRACTS_REVIEW.md`](zk/AZTEC_CONTRACTS_REVIEW.md) (AZ-01 to AZ-22).

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

Our direction is the aztec-nr contracts of section 2.1, so that note ownership and the network's nullifier tree replace hand-written state handling.

1. Is the shared settlement nullifier, with those timestamp checks, an idiomatic way to express "claim before the deadline, refund after it"?
2. Is a keyed deployment whose secret is shared with the parties the pattern you recommend for a contract that holds a private balance, or is there a better one?
3. Our contracts call the token through a raw `transfer_in_private` selector to avoid depending on a token crate. Is depending on the standard Token contract's interface preferred, and how do you avoid a duplicated `aztec` crate when doing so?
4. Our stream cancel shares a per-state nullifier between withdraw and cancel and has withdrawals deliver a copy of the next state to the sender. Is that the pattern you would use, or would you reach for something else (for example a delayed public mutable for the cancellation time)?
5. A cancel measures accrual at its anchor block, chosen by the sender's PXE; we bound it by expiring the cancel 600 s after its anchor. Is there a better way to bound a time-dependent value in a private function?

---

## 6. Non-claims

1. No quantum resistance (BN254, secp256k1 and Curve25519 are classical).
2. No traffic-analysis protection.
3. Testnet only; no external audit; not production ready.

## 7. Contact

Stefan Antonio Cirisanu · `humanityledger@icloud.com`
