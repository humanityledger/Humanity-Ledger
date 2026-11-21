# XMTP network readiness

21 November 2026. Phase 0, item 1 of the state-of-the-project prompt. Read from XMTP's public
documentation on this date; re-check every point against the live docs before acting, because
XMTP's own pages disagree on dates.

## What XMTP says

| Topic | What the docs say | Source |
|---|---|---|
| Fees | The decentralized network charges per message; apps pay, in USDC, from a payer wallet registered in the Payer Registry on Base | xmtp.org/decentralization; docs.xmtp.org/fund-agents-apps/fund-your-app |
| Gateway | Browser and mobile apps must host an XMTP Gateway Service on their own infrastructure, because it holds the payer wallet's private key; clients pass its address when they are created | docs.xmtp.org/fund-agents-apps/run-gateway |
| Minimum SDK | Browser SDK v6.0.0 (Node SDK v5.0.0, React Native v6.0.0, Kotlin and Swift v5.0.0) | docs.xmtp.org/fund-agents-apps/update-sdk |
| Timing | One page gives 9 December 2025 for all traffic on the decentralized network; the forum describes a 60-day migration window that starts after testnet validation | docs.xmtp.org/fund-agents-apps/get-started; improve.xmtp.org/t/decentralization-milestones/2039 |

## Where Ledger Chat stands

* `@xmtp/browser-sdk` is pinned at **5.2.0** (`package.json`): below the documented minimum of 6.0.0.
* No Gateway Service and no payer wallet exist.
* Messages flow today, so the cutover has not reached this client yet, or 5.x still connects to the
  legacy network. Which of the two is true is the first thing to confirm.

## Plan

1. Confirm the current cutover date and whether 5.x is already refused (XMTP status page and docs).
2. Upgrade to Browser SDK 6.x behind the flag `xmtpNext`, in its own PR, with the full chat test suite.
3. Build the Gateway Service as a Ledger Relay capability (`relay/`), so organisations can run their
   own; Ledger Chat's own instance needs a payer wallet.
4. Group size and rate limits: read them from the 6.x documentation before Communities on MLS.

## Needs Stefan

* Funding a payer wallet in USDC on Base, and the monthly messaging budget. This is spending money.
* Where the Gateway Service runs (a Railway service, or a Ledger Relay instance) and who holds the
  payer wallet key. The agent never handles keys.
