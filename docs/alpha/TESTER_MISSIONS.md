# Closed alpha: what the testers do, and what we measure

**Asset:** HLC, a **test token with no monetary value** (decision PA-1). Testers move HLC to prove that private payments
work end to end, from one person's phone to another's, without anyone's money at risk. The value of the alpha is the
evidence it produces, not the token.

**Who:** at most 50 named testers (OD-4 amended), invited only by Stefan's wallet. Each tester accepts the alpha terms
written by counsel (OD-8) before the first code. **How long:** 8 weeks from the first deployment (OD-9).

**What each tester receives:** HLC issued by Stefan (the only operation he signs), and Fee Juice for network fees
through a fee link (OD-9, budget open). HLC is free and has no value; Fee Juice has a market value and is counted as
the alpha's maximum loss.

## Missions

Each mission has a pass condition that the tester confirms in the app, and that the diagnostics can check.

| # | Mission | Pass when |
| --- | --- | --- |
| M1 | Open Ledger Chat with your wallet on your phone, install it from Safari or Chrome | The chat list loads; the wallet shows "Test token · no monetary value" next to HLC |
| M2 | Send "hi" to another tester, wallet to wallet | The other tester sees it; both `/chat?debug=delivery` panels show `send_published` and `recv` |
| M3 | Reply from a second device of yours (phone and desktop) | The message arrives on both of your devices |
| M4 | Send 1 HLC privately to another tester from the chat | The recipient's private balance rises by 1 HLC; the explorer shows a mined transaction with no amount or parties |
| M5 | Request 2 HLC with an invoice in the chat, and pay a request you receive | The requester sees the payment; the card shows it paid |
| M6 | Once the wave 1 classes are deployed: try to open an escrow or a stream above 100 HLC | The app refuses before signing and the contract would refuse too (OD-2). Direct private sends have no cap: HLC has no value |
| M7 | Make a voice call and a video call with another tester | Both connect and you hear and see each other |
| M8 | Close the app, reopen it a day later | Messages and balance are there, with no new signature beyond the wallet's |
| M9 | Report one thing that confused you | A report in the alpha channel Stefan gives each tester |

## What we measure (and where)

Targets are proposals for Stefan to sign before the first code; none is a result yet.

| Measure | Source | Proposed target |
| --- | --- | --- |
| Messages delivered between two testers | `/api/chat/delivery-report` (send and receive events) | ≥ 99% within 10 s |
| Median delivery time | same | ≤ 2 s |
| Private HLC payments mined / attempted | `[payment]` log lines from `/api/wallet/payment-report` (`stage=attempted`, `stage=mined`), explorer | ≥ 95% |
| Proving time on the phone, per payment | `ms` of `stage=sent` (proving and sending are one step in the SDK) | measured per device; no target until the first week |
| Network fee per payment, in AZTEC | Aztecscan, as in `measuredFees` | recorded, compared with the OD-9 budget |
| Reports per tester per week | the alpha channel | trend only |
| Missions passed per tester | the table above | all of M1 to M8 |

**To build before the first code:** wallet payment events in the same report format as delivery events (attempted,
proved, sent, mined, failed with a reason). Today only message delivery is reported. There is no in-app feedback form yet; reports go through the alpha channel.

## Exit criteria (gate `alpha` for cUSDC)

The alpha is finished when:

- the 8 weeks have passed, or Stefan ends it earlier;
- every measure above has at least two weeks of data;
- no open incident is classed high or critical in `docs/INCIDENT_RESPONSE.md`;
- the results are published in the repository, aggregated and without personal data.

Then, and only after the other gates in `lib/payments/assets.ts`, cUSDC can be switched on
(`docs/payments/CUSDC_INTEGRATION.md`).
