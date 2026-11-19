# HLC

**Withdrawn on 19 November 2026 (operator decision PA-1, `docs/alpha/OPERATOR_DECISIONS.md`).**

HLC is a test token with no monetary value. It exists only to test private payments in the closed alpha of Ledger
Chat. It gives no right to money, goods, profits or a share in any company. It is never sold, bought, exchanged,
offered, airdropped, launched or admitted to trading, and no launch is planned.

The token model that this file used to describe (a fixed supply, allocations, a fair launch, fee buyback and burn,
staking, team vesting and launch conditions) was withdrawn from the repository, the pages and the docs on the same date.
It is no longer a plan. It remains only in the git history, for the record.

Real payments are planned in **cUSDC** (Clean USDC, issued by human.tech through its Shield bridge, not by Humanity
Ledger). They stay off until every gate in `lib/payments/assets.ts` is met: `docs/payments/CUSDC_INTEGRATION.md`.

Any future token would need a new written decision, a legal opinion and, where MiCA requires it, a crypto-asset white
paper notified before any offer.

## Agreement fee arithmetic

The protocol charges no fee in the alpha (OD-7). The fee formula is kept for the fee contract specification:
`fee = max(minFee, ceil(amount × feeBps / 10,000))`, in bigint base units. Reference implementation: `protocolFee` in
`lib/protocol/fees.ts`; specification: `docs/protocol/FEE_CONTRACT_SPEC.md`.
