# Protocol fee: contract specification (Phase 0)

> **Status, 18 November 2026 (operator decisions, `docs/alpha/OPERATOR_DECISIONS.md`).**
> - **D-1 to D-5 and D1 to D7: option A.** They are the technical base for after the alpha. They are not confirmed for charging. Until 18 November this file called them "authorized by Stefan as baseline", while `docs/STATUS.md` and `docs/MAINNET_READINESS.md` called them unconfirmed. Both now say the same.
> - **The closed alpha charges no protocol fee (OD-7).** The current source has `FEE_BPS = 0` and `MIN_FEE = 0` in PrivateEscrow, and `FEE_BPS = 0` in PaymentStream. It also has a maximum of 100 HLC per escrow and per stream (`MAX_AMOUNT`, OD-2). The formula below is unchanged and runs with that zero schedule.
> - **Treasury (D-4).** The source carries the address Stefan designated on 17 November 2026 (`0x1773…faed`). That address is **not** the 4-of-7 multisig that D-4 requires. With no fee it receives nothing. Before any fee is charged, D-4 is decided again: either the Aztec account of the 4-of-7 multisig, or a written change of that condition.
> - **D-2.** The compiled baseline minimum was section 8's `MIN_FEE = 1000`, not D-2's placeholder of 1 (see the note after section 6). In the alpha it is 0.

State: **compiled, not deployed**. `PrivateEscrow` and `PaymentStream` charge the fee on settlement. Aztec 6.0.0
compiled that source; TXE passed (escrow 19, streams 29); the current classes are recorded in
`deployments/aztec-testnet.json` with `address: null` (dossier section 0). Sections 6 and 8 are the authorized baseline (16 November 2026). Launch
condition 1 of `docs/TOKENOMICS.md` (deployed and externally audited) is unmet. There is no external audit.
`TREASURY` is the zero placeholder. Nothing here was deployed, and nothing was sent on Alpha.

This document is written so that an aztec-nr engineer can implement the fee in `PrivateEscrow` and `PaymentStream`
without further questions, and an auditor can check the result against it.

## 1. Arithmetic

```text
fee = max(minFee, ceil(amount × feeBps / 10,000))
refuse if fee × 10,000 > amount × maxFeeShareBps
net = amount − fee
```

| Parameter | Type | Range | Meaning |
|---|---|---|---|
| `amount` | u128 | 1 to 2^128 − 1 | Token base units of the agreement (HLC: 6 decimals) |
| `feeBps` | u128 | 0 to 10,000 | Proportional fee in basis points |
| `minFee` | u128 | 0 to 2^128 − 1 | Minimum fee per agreement |
| `maxFeeShareBps` | u128 | 0 to 10,000 | Largest share of the amount the fee may take; above it the agreement is refused, not charged (finding T-5, `docs/security/AUDIT_2026-11-13.md`) |

**Rounding.** Ceiling division, so splitting one payment into several never pays less in total.

**u128 safety.** `amount × feeBps` can exceed 2^128 − 1 (at `amount = 2^128 − 1`, `feeBps = 30`). The contract must
compute the proportional part without that product:

```text
q = amount / 10,000
r = amount % 10,000
proportional = q × feeBps + ceil(r × feeBps / 10,000)      // r × feeBps < 10^8
```

and the share check as `fee × 10,000 <= amount × maxFeeShareBps` only after asserting `fee <= amount` (then
`fee × 10,000` and `amount × maxFeeShareBps` are compared in Field, where neither wraps: both are below 2^142).
`ceilBps` in `lib/protocol/fees.ts` is this formula; the tests check it against the direct formula for 4,000+ amounts
including 2^128 − 1.

### Test vectors

Schedule for the vectors only (not a proposal): `feeBps = 30`, `minFee = 500`, `maxFeeShareBps = 500`.
The contract's TXE tests must reproduce every row.

| amount | fee | net |
|---|---|---|
| 1 | refused (fee exceeds share) | — |
| 9999 | refused (fee exceeds share) | — |
| 10000 | 500 | 9500 |
| 10001 | 500 | 9501 |
| 166667 | 501 | 166166 |
| 166668 | 501 | 166167 |
| 1000000 | 3000 | 997000 |
| 1234567 | 3704 | 1230863 |
| 100000000000 | 300000000 | 99700000000 |
| 340282366920938463463374607431768211455 | 1020847100762815390390123822295304635 | 339261519820175648072984483609472906820 |

Generated from `protocolFee` in `lib/protocol/fees.ts`.

## 2. Where the fee is taken

Recommended (decision D-1, section 6): **on settlement, not on deposit.**

| Contract | Path | Today | With the fee |
|---|---|---|---|
| `PrivateEscrow` | `deposit` | `transfer_in_private(sender → this, amount)` | Unchanged, plus `assert` that `protocolFee(amount)` is not refused, so an agreement that could never pay its fee is never created |
| `PrivateEscrow` | `claim` | `transfer_in_private(this → claimer, amount)` | `transfer_in_private(this → claimer, net)` and `transfer_in_private(this → TREASURY, fee)` |
| `PrivateEscrow` | `refund` | `transfer_in_private(this → sender, amount)` | Unchanged: a refunded agreement pays no fee |
| `PaymentStream` | each `withdraw` | `transfer_in_private(this → recipient, withdrawable)` | Fee on each withdrawal: `net` to the recipient, `fee` to `TREASURY`, with `minFee = 0` for streams so small withdrawals stay possible (decision D-3) |
| `PaymentStream` | `cancel` | Accrued to recipient, rest to sender | Fee only on the accrued part paid to the recipient |

`create_stream` does not quote `total` against `TX_CAP`. A stream whose one-shot fee would exceed the cap is still created. The recipient withdraws it in slices. Each slice is quoted on its own amount and pays its own fee. A slice whose fee is above `TX_CAP` is refused. A slice at the cap is paid. Two slices of 1_000_000_000 base units each pay a fee of exactly 5_000_000 and a net of 995_000_000. That is the baseline (fee per withdrawal). It is not a way around the cap.

Both contracts already call the token through the raw `transfer_in_private` selector
(`contracts/aztec/escrow/src/main.nr` lines 77, 143–147, 187–193). The fee is a second call to the same selector with
`authwit_nonce = 0` (the contract spends its own notes; no authwit needed).

## 3. The fee note

- The fee is a **private token note owned by `TREASURY`**, created by the token's own `transfer_in_private`. No new
  note type: the treasury's balance is an ordinary private balance of the token.
- Nobody else learns the fee: the note is encrypted to the treasury, and on chain the claim shows only note hashes and
  nullifiers, as today. The claimer sees `fee` (it is the difference to `amount`); that is unavoidable and acceptable.
- Revenue is verifiable without revealing any payment: the treasury publishes a weekly aggregate when it converts
  (`docs/TOKENOMICS.md`, "Value return"). An auditor checks the aggregate against the treasury's own note history.

## 4. Where the schedule lives

**In the contract code, as global constants, not in storage or constructor arguments.**

```noir
global FEE_BPS: u128 = ...;
global MIN_FEE: u128 = ...;
global MAX_FEE_SHARE_BPS: u128 = ...;
global TREASURY: AztecAddress = AztecAddress::from_field(...);
```

Reason: each agreement is its own keyed instance, deployed by the sender (`lib/aztec/keyed-deploy.ts`). Constructor
arguments are chosen by the deployer, so a fee set there could be set to zero. Constants are part of the bytecode, so
they change the **class ID**, which the client already verifies before any agreement
(`lib/aztec/agreement-policy.ts`, class IDs recorded per network). Changing the fee is therefore a new class, recorded
in `deployments/aztec-mainnet.json`, never a silent change.

## 5. Acceptance criteria

The fee contract is done when all of these hold:

1. `contracts/aztec/escrow` and `contracts/aztec/streams` implement sections 1 to 4 against aztec-nr v6.0.0.
2. TXE tests reproduce every test vector of section 1, and cover: claim pays `net` + `fee`; refund pays the full
   amount and no fee; a deposit that would be refused fails; a stream withdrawal pays its fee; the sum of all
   transfers equals the deposit in every path.
3. The u128-safe formula is the only one in the contracts (`grep` for `amount * ` in the fee path finds none).
4. New class IDs recorded in `deployments/aztec-testnet.json`; testnet e2e (`.github/workflows/aztec-escrow-e2e.yml`)
   passes with the fee.
5. The client computes the same fee before an agreement (`protocolFee`), shows it, and refuses what the contract
   would refuse.
6. External audit of the two contracts (launch condition 1). Only then deployment on Alpha.

## 6. Decisions before deployment

These change what users pay. The recommendation text in each row is unchanged. Status of every row: **technical base for after the alpha, not confirmed for charging (option A, 18 November 2026).** The alpha source runs the formula with a zero schedule (OD-7). Nothing is deployed. `TREASURY` is the address designated on 17 November 2026, which is not the 4-of-7 multisig (see the status at the top).

| ID | Decision | Engineering recommendation (values unchanged) | Status |
|---|---|---|---|
| D-1 | Fee on settlement (claim, withdraw) or on deposit | **On settlement.** A refunded agreement pays no fee | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| D-2 | `feeBps`, `minFee`, `maxFeeShareBps` for escrow | **Placeholder only:** `feeBps = 50` (0.5 %), `minFee = 1` base unit, `maxFeeShareBps = 1000` (10 %). With 18-decimal tokens, `minFee = 1` is in effect no minimum; smallest accepted amount: 10 base units. The operator sets the final values before the contract is compiled for deployment (they pin the class ID, section 4) | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| D-3 | Stream fee: per withdrawal with `minFee = 0`, or once at creation | **Per withdrawal, `minFee = 0`,** so small streams are never blocked by a minimum | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| D-4 | `TREASURY`: an Aztec account controlled by the 4-of-7 multisig (launch condition 3) | **Operator requirement.** No code assumes an address; there is no such account today, and nothing deploys until it exists | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| D-5 | Staking tiers (a lower `feeBps` for stakers) | Out of Phase 0: a tier would need a proof of stake inside the private call; not specified here | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |

The escrow minimum to compile is section 8’s `MIN_FEE` of 1,000, not the `minFee = 1` placeholder in D-2. D-2’s numbers are left as written. Section 8 is the same baseline, not a second schedule.

## 8. Parameter proposals D1–D7 (16 November 2026)

**Status of every row in this section: technical base for after the alpha, not confirmed for charging (option A, 18 November 2026).** The values below are unchanged. The source uses them and is compiled. There is no deploy and no external audit. No treasury address is stated here.

D1–D7 here are the parameter questions named in `docs/protocol/FEE_CONTRACT_IMPLEMENTATION_LOG.md`. They are not section 6’s D-1–D-5. Section 6 stays an unconfirmed engineering recommendation. The implementation log quotes an earlier router sketch (`HLFeeRouter`, public mutable parameters, `trigger_buyback`, fee taken inside `deposit`). That sketch is not the text of sections 1–6. Where the sketch and this section disagree, this section is the proposal to review. `test/unit/aztec/fee-router.adversarial.test.ts` still describes the sketch and every case stays `it.skip`.

Path A, as this repository uses it: the agreement token moves only by Aztec private notes and Aztec nullifiers. The fee is a second private note to the treasury. Network gas on Alpha is Fee Juice and is public. Nothing in the private class reads a price, burns, or keeps a public running total.

| ID | Proposal | Justification | Status |
|---|---|---|---|
| D1 | The protocol fee is paid in the **same private token the agreement already holds** (HLC when the agreement is in HLC). It is not paid in Fee Juice. There is no separate fee token | Fee Juice is the Aztec network fee. On Alpha that payment is public (the fee payer and the amount). Charging the protocol fee in Fee Juice would publish it. A second token would need a price. The private transfer the contracts already use can pay the treasury in the token they already hold. Section 3 | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| D2 | **No** buyback and **no** burn inside the private call. No nullifier is used as a burn switch. In-circuit share: 0 | A nullifier marks a spent note. It does not buy HLC. Burning the fee note in the same call either destroys the fee token (no buyback) or emits a public burn that shows the amount. `docs/TOKENOMICS.md` (13 November 2026) already says aggregated fees later buy HLC and burn it, and that nothing is paid to stakers. That step stays outside this class, is not built, and is not re-decided here | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| D3 | **No external oracle.** The fee is computed in the token’s own base units, section 1 | A price in a private function is a public read or a delayed public value. It can move between the proof and inclusion, and it couples the class to a feed Aztec Alpha does not provide. Native units need no feed | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| D4 | **100% of `fee` to `TREASURY`, 0% burned in the private call.** One note, one recipient | A second note to a burn address is not a buyback. The treasury address itself is still section 6’s D-4: no address exists, and this proposal does not invent one. A later public buyback, if Stefan keeps the 13 November policy, spends treasury notes the treasury already owns | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| D5 | See the constants below. `DAILY_CAP` is **rejected** | A daily total needs public storage. That publishes fee volume as it happens and, if a full day then charges zero, lets the next agreement skip the fee. Section 3 uses a weekly treasury aggregate instead. The sketch’s clamp `min(raw_fee, tx_cap)` undercharges one large payment relative to several small ones, which fights the ceiling rule in section 1. A fee above the cap is refused, not reduced | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| D6 | The Aztec class has **no owner and no pause flag**. Operational stop is the client’s class-id allow-list (section 4). **`Ownable2Step` is proposed only for a future L1 contract** that would hold public proceeds after an unshield, if that contract is ever written: the next owner must accept, `address(0)` cannot own it, and pause cannot move tokens. 4-of-7 and a 48-hour timelock, as in `docs/TOKENOMICS.md`. No Solidity is written | OpenZeppelin `Ownable2Step` is an L1 pattern. `LedgerDeadmanSwitch` already uses it. An aztec-nr pause bit would be public admin state and could zero the fee, which is a silent waiver. Keyed instances keep the bytecode they were deployed with; changing the fee is a new class id, not a storage write | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| D7 | Value leaves the agreement **only on settlement**, by the existing private token transfer: `net` to the recipient and `fee` to the treasury on claim or withdraw. A refund pays the full amount and no fee. No admin `collect`, no public withdraw, no unshield in this path | This is the same recommendation as section 6’s D-1. Taking the fee on deposit would charge an agreement that is later refunded. The sketch’s “inside deposit” default is not the baseline. Authwit nonce stays 0. The call stays the raw selector (Q3, still OPEN) | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |

### D5 constants (authorized baseline, compiled, not deployed)

HLC has 6 decimals: 1 HLC = 1,000,000 base units. The Alpha per-payment cap already recorded for HLC is 1000 HLC (`docs/MAINNET_READINESS.md`). The same numbers are globals in the two contract sources and in `lib/protocol/fees.ts` (`baselineFee`). They are part of the recorded current classes, which are not deployed.

| Constant | Proposed value | What it is | Status |
|---|---|---|---|
| `FEE_BPS` | 50 (0.5%) | Section 6’s D-2 placeholder. The 30 bps figure is the section 1 test-vector fixture (“not a proposal”) and the sketch’s default. The live spec’s placeholder is 50. One schedule, not two | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| `MIN_FEE` | 1,000 base units (0.001 HLC) on **escrow settlement only** | Section 6’s `minFee = 1` is not a minimum (that same row says so). 1,000 is the sketch’s HLC placeholder and is large enough that dust pays. With `MAX_FEE_SHARE_BPS` of 1,000, the smallest escrow that clears is 10,000 base units (0.01 HLC), and the fee on that amount is exactly 10% | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| `MAX_FEE_SHARE_BPS` | 1,000 (10%) | Section 6’s D-2 placeholder. Finding T-5: above this share the agreement is refused, not charged. Not in the user’s short list; required by the formula already in section 1 | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| Stream `minFee` | 0, fee on each withdrawal | Section 6’s D-3. The escrow minimum must not block a small stream withdrawal | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| `TX_CAP` | 5,000,000 base units (5 HLC), as a **ceiling that refuses** | At 50 bps, the fee on 1000 HLC is exactly 5 HLC. The fee class then lines up with the Alpha payment cap: an agreement the product already allows is not refused by the fee, and a larger fee is refused rather than clamped. The sketch’s 1,000,000 (1 HLC) would refuse any escrow above 200 HLC at 50 bps. That placeholder is not adopted | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |
| `DAILY_CAP` | **Rejected.** No constant | The sketch’s 100,000,000 (100 HLC of fees per day) is not adopted. No public day counter | technical base for after the alpha, not confirmed for charging (option A, 18 November 2026) |

Changing any adopted constant later is a new class id (section 4), recorded in the deployment file, not a multisig write to public storage.

### What this section does not do

- It does not deploy a treasury account, a burn role, or a buyback contract. No treasury address is written here.
- It does not meet launch condition 1 (deployed and externally audited). There is no external audit.
- The contract source is `contracts/aztec/escrow` and `contracts/aztec/streams`. The documentary skeleton remains `docs/protocol/fee-router-skeleton/` and is not bytecode. The committed artifacts match the source (`deployments/aztec-pending-recompile.json` lists nothing pending).
- Q1–Q10 stay OPEN. R8 is not run. `communityMls` stays false.
