# Circuit Constraint Completeness Analysis

**Normative specification:** HLSPEC 2026.1  
**Canonical commit:** `783df711`  
**Circuits:** `escrow`, `identity`, `streams`  
**Compiler:** `nargo compile` (Noir toolchain)  
**Proving backend:** Barretenberg UltraHonk over BN254  
**Hash function in all three circuits:** `pedersen_hash` (Aztec standard over BN254)

> **Update, 3 November 2026.** A review of the circuits found soundness
> issues that this analysis did not cover, because it examined each proof in
> isolation: ZK-01 (streams accepts repeated claims of the same accrual),
> ZK-02 (no payout address among the public inputs), ZK-03 (escrow claims need
> the sender's secret), ZK-04 and ZK-05 (identity domain separation and an
> anonymity set of two), ZK-06 (prover-chosen timestamps) and ZK-07 (verifier
> did not pin the VK; fixed). Details and the plan to replace these circuits
> with aztec-nr contracts: [`docs/zk/MASTER_PROMPT.md`](../docs/zk/MASTER_PROMPT.md).
> The circuits are experimental and must not hold value.

> This document lists every constraint enforced in each circuit, the type of
> each constraint, its corresponding positive and negative tests, and an honest
> account of regions that are potentially under-constrained or not yet formally
> verified. It exists specifically to invite pre-audit technical scrutiny.

---

## 1. Hash Function Note

All three circuits use `pedersen_hash` from `std::hash::pedersen_hash`, which
is Noir's standard Pedersen hash over the BN254 scalar field. This is the
same hash function used in Aztec native note commitment construction. The
protocol documentation uses the term "collision-resistant hash over BN254
field elements" to describe this function throughout. Any reference to
"Poseidon2" in related documentation was an error that has been corrected: the
circuits use Pedersen, not Poseidon2. Poseidon2 adoption is a planned future
migration documented in Open Engineering Problem 5 (see below).

---

## 2. circuits/escrow/src/main.nr

### 2.1 Constraint Table

| # | Constraint | Type | Positive Test | Negative Test |
|---|---|---|---|---|
| C1 | `amount > 0` | Range (lower bound) | Happy path: `amount = 5_000_000_000` | `amount = 0` throws `amount must be > 0` |
| C2 | `amount <= 1_000_000_000_000_000` | Range (upper bound) | Happy path | `amount = 1e15 + 1` throws `amount exceeds MAX_ESCROW_AMOUNT` |
| C3 | `sender_secret != 0` | Non-zero field | Happy path | `sender_secret = 0` throws `sender_secret must not be zero` |
| C4 | `recipient_pubkey != 0` | Non-zero field | Happy path | `recipient_pubkey = 0` throws `recipient_pubkey must not be zero` |
| C5 | `current_timestamp <= deadline` | Temporal | `current = 1_750_000_000, deadline = 1_800_000_000` | `current = 1_750_000_000, deadline = 1_700_000_000` throws `current_timestamp <= deadline` |
| C6 | `commitment == Pedersen(sender_secret, recipient_pubkey, amount, salt)` | Equality (preimage binding) | Happy path | Tampered commitment `0xdeadbeef` throws `commitment mismatch` |
| C7 | `nullifier == Pedersen(sender_secret, salt)` | Equality (nullifier binding) | Happy path | Forged nullifier `0xbad000...` throws `nullifier mismatch` |

Test file: `test/circuits/escrow.test.ts` (8 tests: 1 happy path + 7 negative)

### 2.2 Value Range Justification

`MAX_ESCROW_AMOUNT = 1_000_000_000_000_000` (10^15).

The BN254 scalar field modulus is approximately 2^254, so there is no
arithmetic overflow risk at this range. The upper bound exists for two
practical reasons:

* **Denomination safety.** The protocol denominates values in the smallest
  fungible unit. 10^15 units corresponds to a value far exceeding any plausible
  single-transaction ceiling under foreseeable economic conditions, while
  remaining well below the field modulus.
* **Witness generation determinism.** Bounding `amount` as a `u64` (maximum
  2^64 - 1 ≈ 1.8 × 10^19) rather than a full field element allows safe integer
  comparison in circuit arithmetic. The `u64` type is enforced by Noir's type
  system at witness generation time; no additional range check over the BN254
  field is required because `u64` cannot represent a value exceeding 2^64.

Border case tests: `amount = 1`, `amount = 1_000_000_000_000_000` (at ceiling),
`amount = 1_000_000_000_000_001` (one above ceiling). All three are covered in
the negative test suite.

### 2.3 Potential Under-Constrained Regions

| Region | Assessment | Status |
|---|---|---|
| `salt` entropy | The circuit does not assert salt uniqueness across escrows. A reused salt with the same sender produces a duplicate nullifier, which is rejected at the Aztec sequencer level via the Nullifier Tree. No additional circuit constraint is required. | Covered by protocol layer |
| `deadline` range | No constraint on maximum deadline. A very large deadline is technically valid. This is considered acceptable: a sender who sets deadline to `type(u64).max` is opting into a permanent escrow, which is a valid protocol state. | Accepted by design |
| Field element `recipient_pubkey` vs Grumpkin point | The circuit treats `recipient_pubkey` as a Field element, not a validated Grumpkin curve point. Note encryption to a non-curve-point recipient would fail at the PXE layer, not in the circuit. This is a known gap relative to Aztec native Npk validation. | Open gap — documented |

---

## 3. circuits/identity/src/main.nr

### 3.1 Constraint Table

| # | Constraint | Type | Positive Test | Negative Test |
|---|---|---|---|---|
| C1 | `jurisdiction_code != 999` | Equality (sanction) | `jurisdiction = 840` | `jurisdiction = 999` throws `sanctioned jurisdiction detected` |
| C2 | `jurisdiction_code != 998` | Equality (sanction) | `jurisdiction = 840` | `jurisdiction = 998` throws `sanctioned jurisdiction detected` |
| C3 | `jurisdiction_code > 0` | Range (lower bound) | `jurisdiction = 840` | `jurisdiction = 0` throws `jurisdiction_code must be > 0` |
| C4 | `identity_secret != 0` | Non-zero field | Happy path | `identity_secret = 0` throws `identity_secret must not be zero` |
| C5 | `Pedersen_MerkleVerify(root, identity_secret, path) == 1` | Merkle membership (2-node path) | Happy path with matching root | Tampered root `0x1234567890abcdef` throws `Merkle root mismatch` |
| C6 | `scoped_nullifier == Pedersen(identity_secret, scope)` | Equality (scoped sybil resistance) | Happy path | Tampered nullifier throws `scoped nullifier mismatch` |

Test file: `test/circuits/identity.test.ts` (7 tests: 1 happy path + 6 negative)

### 3.2 Sanction Set Architecture: Honest Statement

**Current implementation:** The sanctioned jurisdiction set is a hardcoded
constant pair (`SANCTIONED_JURISDICTION_1 = 999`, `SANCTIONED_JURISDICTION_2 =
998`) compiled directly into the circuit. The post claims the set is committed
as a "public input" and updateable via timelock governance. **This is a known
discrepancy between the current implementation and the intended design.**

The current circuit embeds the sanction set at compile time, which means:

* Adding a jurisdiction to the sanctioned set requires a new circuit
  compilation, a new verification key, and the full 14 day VK upgrade lifecycle
  via `HumanityTimeLockVault`.
* Removing a jurisdiction from the sanctioned set requires the same process.

This is actually more conservative than a dynamic public input design (the
sanctioned set cannot be manipulated at runtime), but it imposes a higher
upgrade cost. The intended production design (dynamic set as public input
against a committed Merkle root) is documented as a planned iteration.

The two hardcoded values (999, 998) are test placeholders with no real
jurisdiction meaning and are not intended to represent any actual jurisdiction.

### 3.3 Merkle Tree Depth

The current implementation verifies a 2-node Merkle path (depth 1). This is
sufficient for a demonstration circuit but is not production-ready for an
identity tree containing more than two leaves. Extending to full Merkle tree
depth (e.g., 32 levels) is planned before external audit.

### 3.4 Scope Unlinkability Analysis

Two proofs produced by the same identity for different scopes produce nullifiers
`Pedersen(identity_secret, scope_A)` and `Pedersen(identity_secret, scope_B)`.
These are computationally unlinkable without knowledge of `identity_secret` due
to the preimage resistance of Pedersen hash over BN254. A passive observer
seeing both nullifiers on-chain cannot determine they originate from the same
identity. This property is not formally proven but follows from standard
assumptions for Pedersen hash over BN254.

---

## 4. circuits/streams/src/main.nr

### 4.1 Constraint Table

| # | Constraint | Type | Positive Test | Negative Test |
|---|---|---|---|---|
| C1 | `current_time >= start_time` | Temporal monotonicity | `current = 1060, start = 1000` | `current = 1999, start = 2000` throws `current_time >= start_time` |
| C2 | `claim_amount > 0` | Range | Happy path | Zero claim would fail at circuit; tested via direct constraint check |
| C3 | `rate_per_second > 0` | Range | Happy path | `rate = 0` throws `rate_per_second > 0` |
| C4 | `total_allocation > 0` | Range | Happy path | Zero allocation tested |
| C5 | `sender_secret != 0` | Non-zero field | Happy path | Tested indirectly via commitment mismatch |
| C6 | `recipient_pubkey != 0` | Non-zero field | Happy path | `recipient_pubkey = 0` throws `recipient_pubkey must not be zero` |
| C7 | `(withdrawn + claim) <= elapsed * rate` | Accrual ceiling | 60s elapsed, rate=10, claim=300 ≤ 600 | 20s elapsed, rate=10, claim=500 > 200 throws `withdrawal exceeds accrued capacity` |
| C8 | `(withdrawn + claim) <= total_allocation` | Allocation ceiling | Claim within cap | `withdrawn=800, claim=300, allocation=1000` throws `withdrawal exceeds total allocation` |
| C9 | `commitment == Pedersen(sender_secret, recipient_pubkey, total_allocation, rate, start_time, salt)` | Equality (stream binding) | Happy path | Tampered commitment throws `stream commitment mismatch` |
| C10 | `nullifier == Pedersen(stream_commitment, new_total_withdrawn)` | Equality (state nullifier) | Happy path | Tampered nullifier throws `stream nullifier mismatch` |
| C11 | `rate_per_second <= MAX_RATE` | Range (overflow prevention) | `rate = MAX_RATE` accepted | `rate = MAX_RATE + 1` throws `rate_per_second exceeds MAX_RATE`; closes Gap G4 |

Test files: `test/circuits/streams.test.ts` (6 tests: 1 happy path + 5 negative), `test/circuits/streams_rate_bound.test.ts` (4 tests: rate bound boundary + nullifier uniqueness)

### 4.2 Integer Overflow Analysis in Accrual Constraint

The accrual constraint is computed as:

```
let elapsed_seconds = current_time - start_time;
let accrued_capacity = elapsed_seconds * rate_per_second;
```

Both `current_time` and `start_time` are `u64`. The subtraction is safe given
`current_time >= start_time` (enforced by C1). The multiplication
`elapsed_seconds * rate_per_second` is also `u64 * u64`. In Noir, `u64`
arithmetic wraps on overflow at 2^64. Without a bound on `rate_per_second`,
a very large rate value combined with a long elapsed duration could overflow
`u64`, producing a truncated `accrued_capacity` smaller than the true accrual
and blocking a legitimate withdrawal.

**Gap G4 Status: CLOSED.** The constraint `rate_per_second <= MAX_RATE`
(C11, where `MAX_RATE = 1_000_000_000_000_000`) was added to the circuit.
At `MAX_RATE`, the accrual product `elapsed * rate` first hits the
`total_allocation` ceiling well before reaching `u64::MAX` under any
realistic stream configuration. The `total_allocation` ceiling (C8) remains an
independent hard stop regardless. A stream running at `MAX_RATE` for the
theoretical maximum duration before hitting a typical allocation ceiling of
`MAX_RATE` tokens takes exactly one second, making overflow arithmetically
impossible in practice. The constraint is covered by negative and boundary
tests in `test/circuits/streams_rate_bound.test.ts`.

### 4.3 Withdrawal Replay Prevention

> **Correction (3 November 2026): this analysis is wrong; see ZK-01.** It
> assumes `withdrawn_amount` reflects earlier withdrawals, but it is a free
> private input. A recipient can always declare `withdrawn_amount = 0` and
> claim 600, 599, 598, ... against one accrual: each total is different, so
> each nullifier is new. `test/circuits/streams_zk01_known_issue.test.ts`
> reproduces it with real proofs. `circuits/streams_v2` fixes it by chaining
> state (`old_state -> new_state`) with a verifier that stores the current state.

Each withdrawal emits a nullifier `Pedersen(stream_commitment, new_total_withdrawn)`. The nullifier is a function of the cumulative withdrawn amount after this withdrawal, not of the withdrawal index. This means:

* The same `new_total_withdrawn` value produces the same nullifier.
* If two separate withdrawals reach the same cumulative total (which requires
  one of them to be zero), they would produce a nullifier collision. The `claim_amount > 0` constraint (C2) prevents zero withdrawals, so this case cannot occur in a valid witness.
* Different cumulative totals produce different nullifiers (under Pedersen preimage resistance assumptions).

---

## 5. Cross-Circuit Gaps and Open Pre-Audit Items

Updated 3 November 2026. "v1" are the pinned circuits above; "v2" are the experimental crates `circuits/*_v2` (details: `docs/zk/V2_CIRCUITS.md`).

| # | Gap | Circuit | Severity | v1 | v2 |
|---|---|---|---|---|---|
| G1 | `recipient_pubkey` treated as Field, not validated Grumpkin point | escrow, streams | Medium | Open | Not applicable: parties are key hashes bound to a secret. Client-side curve check: `lib/aztec/grumpkin.ts` |
| G2 | Sanction set hardcoded, not dynamic public input | identity | Medium | Open | **Closed** in `identity_v2`: list committed by public `sanction_root`, non-membership checked (16 entries; `docs/zk/SANCTION_NON_MEMBERSHIP.md`) |
| G3 | Merkle tree depth is 1 (2-node path) | identity | High for production | Open | **Closed** in `identity_v2`: depth 32 |
| G4 | `u64` overflow in accrual multiplication | streams | **CLOSED** | `rate_per_second <= MAX_RATE` (`test/circuits/streams_rate_bound.test.ts`) | **CLOSED**; accrual also computed in u128 |
| G5 | Hash function is Pedersen, not Poseidon2 | all three | Low (both collision resistant over BN254) | Open | **Closed**: Poseidon2 with domain separators (`circuits/hl_lib`) |
| G6 | No formal equivalence check between Noir source and compiled ACIR | all three | High for production | CI checks the committed ACIR equals a fresh compile (`.github/workflows/aztec-ci.yml`). Formal equivalence: open | Compiled in CI; formal equivalence: open |

Soundness findings from the 3 November review (`docs/zk/MASTER_PROMPT.md`):

| # | Finding | v1 | v2 |
|---|---|---|---|
| ZK-01 | Streams accepts repeated claims of one accrual | Open (reproduced) | Fixed by state chaining (needs a verifier that stores state) |
| ZK-02 | No payout address among public inputs | Open | Fixed: `payout_address`, `domain` public |
| ZK-03 | Escrow claim needs the sender's secret | Open | Fixed: recipient secret claims, sender refunds after deadline |
| ZK-04 | No domain separation | Open | Fixed |
| ZK-05 | Anonymity set of two | Open | Fixed (depth 32) |
| ZK-06 | Prover-chosen timestamps | Open | Deadline committed; current time still checked by the verifier |
| ZK-07 | Verifier did not pin the VK | Fixed (`lib/zk/prover.ts`) | VKs reported by CI, not pinned yet |

---

## 6. Reproducible VK Integrity Verification

`nargo compile` produces ACIR, not a verification key, so hashing a file after
compiling (as this section used to suggest) checked nothing. The checks are:

```bash
# Committed ACIR equals a fresh compile (also run in CI, workflow "Noir circuits")
for c in escrow identity streams; do (cd circuits/$c && nargo compile); done
git diff --exit-code -- circuits/*/target/zk_*.json

# Binary VKs match the hashes pinned in lib/zk/vk-pins.ts; with npm
# dependencies installed, the VKs are also re-derived from the ACIR with bb.js
node scripts/zk/check-artifacts.mjs
```

An on-chain VK registry contract is written and tested but not deployed
(`contracts/ZKVerificationKeyRegistry.sol`). `docs/VK_MONITORING.md` describes
the current mechanism.

---

*This document is a normative part of HLSPEC 2026.1. It will be updated before
each external audit engagement to reflect the current constraint coverage and
open gap status.*
