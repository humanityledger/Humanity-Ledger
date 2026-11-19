# Private fee payment on Aztec Alpha: evaluation (package 5)

**Decision: no change.** Each account keeps paying its own network fee in Fee Juice, and the fee payer stays public. Nothing is sponsored. The interface says so in a single text, `FEE_PRIVACY` in `lib/landing/content.ts`, read by the web and the wallet. The test for it is `test/unit/landing/fee-privacy.test.ts`.

## What is public today

On Alpha, a private payment hides its amount and its parties. The transaction still shows its fee and the account that paid it. Fee Juice cannot be transferred on L2. So the payer is the sender's own account, and all of that account's transactions can be linked to each other. Q8 in `docs/AZTEC_DECISIONS.md` records this.

## Options

| Option | What it would hide | Why not now |
| --- | --- | --- |
| A. Self-pay in Fee Juice (current) | Nothing about the payer | It is the honest baseline and needs no intermediary. |
| B. Sponsored FPC | The user's account, behind the FPC | It exists only on the test network (`lib/aztec/fees.ts`). Alpha has none (Q7), and `/api/aztec/sponsor` returns 410. |
| C. A fee-paying contract run by Ledger Chat | The user's account, behind ours | We would pay fees for users, holding Fee Juice and taking value from them. That is a new custodial role, it needs legal review (MiCA, AMLR from 10/07/2027), and our contract would be one public payer for every tester. It is out of scope for the closed alpha. |
| D. An FPC run by Aztec or a community | The user's account, behind that FPC | There is none on Alpha that this repository can name with evidence. Q7 and Q8 are open questions to Aztec. |

## When to revisit

- Aztec publishes an FPC on Alpha, or a private fee path, with an address that the read-only preflight can verify.
- Counsel has assessed option C, if it is ever proposed, before any code is written.
- Any change keeps one rule: the interface says what is visible. The `FEE_PRIVACY` text changes in the same PR as the mechanism.
