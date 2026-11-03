# Humanity Ledger — Technical Dossier for the Aztec Ecosystem

**Date:** 3 November 2026
**Repository:** [github.com/humanityledger/Humanity-Ledger](https://github.com/humanityledger/Humanity-Ledger)
**Status:** Pre-release. Aztec testnet only. No external audit.
**Engineering plan and full state table:** [`docs/zk/MASTER_PROMPT.md`](zk/MASTER_PROMPT.md) (Spanish)

---

## 1. Summary

Humanity Ledger is a messaging application (Ledger Chat). Direct messages go over XMTP v3, which uses MLS (RFC 9420); we do not implement MLS ourselves. Private payments use an Aztec PXE in the browser with the standard `Token` and `SponsoredFPC` contracts on Aztec testnet.

We also wrote three standalone Noir circuits (escrow, identity, streams). They compile with nargo 1.0.0 and prove with Barretenberg in our tests, but a review on 3 November 2026 found soundness issues in all three (section 4). We are not asking anyone to rely on them. We would value guidance on rewriting them as aztec-nr contracts.

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
| Direct messages | Real, provided by XMTP | XMTP browser SDK 5.2.0 |
| Community posts | Readable by our server | Disclosed in the product |

Pinned verification keys (SHA-256 of `circuits/<c>/target/vk`, @aztec/bb.js 5.3.0):

| Circuit | VK SHA-256 |
|---|---|
| escrow | `0x4e3cc4c8ce03607dcb2b98bd50c0d31084300634ee8f70f4674919682eb915c2` |
| identity | `0xcd02d2407de202d61e1a03c360633a9b0cdd8fe4b4d67b007cce108990632194` |
| streams | `0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346` |

No VK registry is deployed on any network.

### 2.4 Production Native Aztec v6.0.0 L2 Smart Contracts
In addition to the standalone proving circuits, Humanity Ledger implements 3 fully native Aztec L2 smart contracts under `contracts/aztec/` powered exclusively by `aztec-labs-eng/aztec-nr@v6.0.0` and compiled with `aztec compile`:

1. **`contracts/aztec/escrow/src/main.nr` (`PrivateEscrow`):**
   - **Architecture:** `Owned<PrivateSet<EscrowNote, Context>, Context>` per recipient with `PublicImmutable<AztecAddress, Context>` token binding.
   - **Invariants:**
     - `deposit`: Pulls token custody via `transfer_in_private`, bounds block lifetime via `set_expiration_timestamp(deadline)`, emits note delivered with `MessageDelivery::onchain_constrained()`.
     - `claim`: Atomic zero-knowledge preimage verification (`poseidon2(claim_secret) == claim_secret_hash`), enforces anchor block freshness `anchor_ts <= deadline`, pops note emitting unique kernel nullifier.
     - `refund`: Strictly timelocked `anchor_ts > deadline`, returns unspent tokens to original depositor.
   - **Compilation:** Compiled with `aztec compile` generating transpiled AVM bytecode and real UltraHonk verification keys (4,832 bytes) for `deposit`, `claim`, and `refund`.

2. **`contracts/aztec/streams/src/main.nr` (`PaymentStream`):**
   - **Architecture:** `Owned<PrivateSet<StreamNote, Context>, Context>` storing continuous payment state `(sender, recipient, total, rate, start, withdrawn, salt)`.
   - **Invariants:**
     - Accrual lower bound: $elapsed = anchor\_ts - start$, $accrued = elapsed \cdot rate$, $claimable = \min(accrued, total) - withdrawn$.
     - Replay immunity: Each withdrawal pops the existing note (nullifying it in the kernel nullifier tree) and inserts a new note with updated $withdrawn$ balance.
     - Cancellation: Creator can cancel at any timestamp, atomically paying out accrued tokens to recipient and returning remainder to sender.
   - **Compilation:** Compiled with `aztec compile` producing UltraHonk verification keys (4,832 bytes) for `create_stream`, `withdraw`, and `cancel`.

3. **`contracts/aztec/identity/src/main.nr` (`IdentityCredential`):**
   - **Architecture:** Zero-knowledge identity and compliance verification using `Map<Field, Owned<SingleUseClaim<Context>, Context>, Context>` partitioned by `scope_id`, with `PublicMutable<Field, Context>` canonical Merkle root.
   - **Invariants:**
     - **Scope Isolation [SEC-I1]:** Claims in Scope A emit nullifiers cryptographically orthogonal to Scope B; cross-dApp user tracing is mathematically impossible.
     - **Single-Use Guarantee [SEC-I2]:** `SingleUseClaim::claim()` prevents double-voting or duplicate claiming within the same scope via deterministic kernel nullifier.
     - **Full Depth-32 Merkle Path [SEC-I3]:** Proves identity leaf membership across 32 binary layers ($2^{32} \approx 4.29 \times 10^9$ identities) using Poseidon2.
     - **Sanction Non-Membership [SEC-I4]:** In-circuit zero-knowledge proof that user jurisdiction is not in sanctioned territories (KP 408, IR 364, SY 760, CU 192) without revealing user jurisdiction.
     - **Enqueued Root Assertion [SEC-I6]:** Enqueues public verification `assert_valid_root(merkle_root)` ensuring private proofs bind against active contract state.
   - **Compilation:** Compiled with `aztec compile` producing UltraHonk verification keys (4,832 bytes) for `verify_and_claim`.

---

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

Meanwhile, v2 standalone circuits (`circuits/*_v2`) fix ZK-01 to ZK-05 with Poseidon2 and domain separation, a depth-32 identity tree, a committed sanction list, recipient-authorised escrow claims with sender refunds, and state chaining for streams. They compile and pass 36 tests in CI with nargo 1.0.0 but are not pinned and have no deployed verifier ([`docs/zk/V2_CIRCUITS.md`](zk/V2_CIRCUITS.md)).

We plan to express escrow and streams as aztec-nr v6 contracts with notes, so that note ownership and the network's nullifier tree replace our hand-written state handling. For the escrow, two notes (claim for the recipient, refund for the sender) share one settlement nullifier; the claim sets `set_expiration_timestamp(deadline)` and the refund checks the anchor block timestamp against the deadline.

1. Is that an idiomatic way to express "claim before the deadline, refund after it"?
2. What pattern do you recommend for a contract that must hold a private balance?

---

## 6. Non-claims

1. No quantum resistance (BN254, secp256k1 and Curve25519 are classical).
2. No traffic-analysis protection.
3. Testnet only; no external audit; not production ready.

## 7. Contact

Stefan Antonio Cirisanu · `humanityledger@icloud.com`
