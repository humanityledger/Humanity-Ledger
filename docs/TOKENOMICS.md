# HLC: token model

**Status: plan, not an offer.** HLC is not sold, airdropped or distributed until every launch condition below is met
and recorded in this repository. The figures here are the ones in `lib/protocol/tokenomics.ts`; the landing page and
`/protocol` read the same file, and `test/unit/protocol/tokenomics.test.ts` checks that they add up.

## The token today

The HLC token contract is deployed on Aztec Alpha (Ethereum mainnet): address, deployment transaction and block are in
`deployments/aztec-mainnet.json`. Its on-chain name is "Humanity Ledger Corp.". Its admin is still live and can grant
minting rights, so **the supply is not fixed yet**; `/protocol` shows the admin read from public storage. Fixing it is
launch condition 3.

## Supply and distribution

Fixed supply: **1,000,000,000 HLC** (6 decimals). Never inflationary.

| Allocation | Share | HLC | Terms |
| --- | --- | --- | --- |
| Community airdrop | 45% | 450,000,000 | Real users only, weighted by settled escrow activity, sybil-filtered. No purchase. |
| Fair launch | 20% | 200,000,000 | One price for everyone. No discounts, no private round, no venture capital. |
| Protocol treasury | 20% | 200,000,000 | Multisig 4 of 7, 48-hour timelock, every movement public on-chain. Also funds the onboarding sponsor (Fee Juice). |
| Team | 15% | 150,000,000 | Nothing before month 18; vests linearly to month 48 from genesis; unvested tokens can be cancelled back to the treasury. |

No investor allocation exists, and none will.

## Value return: buyback and burn (decided 13 Nov 2026)

Every protocol fee buys HLC on the open market, spread over a 7-day TWAP by a public contract, and the purchased HLC is
burned. **Nothing is distributed to holders or stakers.** A share of fees paid to stakers is what the ESMA guidelines on
the qualification of crypto-assets treat as a profit right, which can make a token a financial instrument; that model was
rejected for this reason.

There are no protocol fees today: the escrow and stream contracts charge none (Phase 0, below).

## Staking: utility, not income

Locking HLC gives a staking weight = amount × lock multiplier:

| Lock | Multiplier |
| --- | --- |
| Flexible | 1.0× |
| 6 months | 1.8× |
| 12 months | 3.0× |
| 24 months | 5.0× |

Weight sets a lower fee tier on agreements and a quota of sponsored onboarding transactions for the staker's community.
It never entitles anyone to fees, ETH or USDC.

## Fee arithmetic (Phase 0)

`fee = max(minFee, ceil(amount × feeBps / 10,000))`, in bigint base units: rounding up means splitting a payment never
pays less, and the minimum makes dust pay. The fee is taken inside the private deposit as a private note to the treasury,
so it reveals no amount; the treasury publishes the weekly aggregate when it converts it, which is what makes protocol
revenue verifiable without revealing any payment.

## Launch conditions (non-negotiable)

1. Fee contract deployed on Aztec Alpha and externally audited. **Not met.**
2. Six months of real fees visible on `/protocol`. **Not met.**
3. Supply fixed on-chain: minters revoked, admin renounced, allocations held by the verified multisig. **Not met.**
4. Legal opinion on MiCA / ESMA classification and, for the fair launch, a crypto-asset white paper notified to the
   competent authority before any offer to the public in the EU. **Not met.**
5. No venture capital and no private round, ever. **Met.**

Owners for each step: `docs/PENDING_STEFAN.md`.
