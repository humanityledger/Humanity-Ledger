# Protocol fee: contract specification (Phase 0)

State: **not implemented**. The arithmetic is **real only in tests** (`lib/protocol/fees.ts`,
`test/unit/protocol/fees.test.ts`). No contract on any network charges a fee today, and none will until the decisions
in section 6 are taken and launch condition 1 of `docs/TOKENOMICS.md` (deployed and externally audited) is met.

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

These change what users pay and are not engineering choices. Each needs the operator's decision, recorded in
`docs/TOKENOMICS.md`. Status of every row: **engineering recommendation, pending operator confirmation.**

| ID | Decision | Engineering recommendation (pending operator confirmation) |
|---|---|---|
| D-1 | Fee on settlement (claim, withdraw) or on deposit | **On settlement.** A refunded agreement pays no fee |
| D-2 | `feeBps`, `minFee`, `maxFeeShareBps` for escrow | **Placeholder only:** `feeBps = 50` (0.5 %), `minFee = 1` base unit, `maxFeeShareBps = 1000` (10 %). With 18-decimal tokens, `minFee = 1` is in effect no minimum; smallest accepted amount: 10 base units. The operator sets the final values before the contract is compiled for deployment (they pin the class ID, section 4) |
| D-3 | Stream fee: per withdrawal with `minFee = 0`, or once at creation | **Per withdrawal, `minFee = 0`,** so small streams are never blocked by a minimum |
| D-4 | `TREASURY`: an Aztec account controlled by the 4-of-7 multisig (launch condition 3) | **Operator requirement.** No code assumes an address; there is no such account today, and nothing deploys until it exists |
| D-5 | Staking tiers (a lower `feeBps` for stakers) | Out of Phase 0: a tier would need a proof of stake inside the private call; not specified here |
