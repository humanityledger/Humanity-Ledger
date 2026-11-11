# First private transfer on Aztec Alpha (mainnet): runbook

Written 11 November 2026. Everything here is done by the operator, in the browser, with their
own wallet; no private key is ever typed into a terminal or sent to anyone.

## What a transfer needs on Alpha

| Who | Needs | Why |
|---|---|---|
| Sender | Fee Juice on their Aztec account | Every Aztec transaction pays its fee in Fee Juice, including the one that creates the account. No sponsored payer exists on Alpha |
| Sender | A balance of the token (HLC) in their **app** wallet | The private wallet in Ledger Chat is a different Aztec account from the CLI deployer that minted HLC |
| Receiver | A verified Aztec address in the DM (G7) | Value only goes to an address with a fresh proof of control; it is sent automatically when the receiver opens their private wallet |
| Receiver (to spend later) | Fee Juice | Receiving costs the receiver nothing; spending needs Fee Juice |
| Service | `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS` with a cap for HLC, `AZTEC_VALUE_MODE` unset or `open` | Payments over the cap, or with no cap, are refused on Alpha |

## Budget with 246 AZTEC and about 8 USD of ETH

- One deposit of Fee Juice = two Ethereum transactions (approve + deposit), about 310,000 gas.
  At 1 gwei that is 0.00031 ETH (~1 USD); at 5 gwei ~5 USD. **Check the gas price before each
  deposit**; with 8 USD of ETH you can do one to a few deposits.
- So: make **few, larger** deposits. Do one for yourself (for example 20 AZTEC) and, for each
  person you want to onboard, use their fee link (below) with a few AZTEC each.
- Fee Juice cannot come back to Ethereum.

## Steps

1. **Your Fee Juice.** In Ledger Chat open the private wallet → *Add Fee Juice* (or Settings →
   Network fees). Connect the Ethereum wallet that holds the AZTEC, enter the amount, accept the
   public notice, approve and deposit. The account is created by itself when the deposit reaches
   Aztec (a few minutes; keep the tab open, or reopen the wallet later).
2. **HLC into the app wallet.** Copy *Your Aztec address* from the private wallet and send HLC
   to it from the deployer account with the Aztec CLI you used for the deployment (your key
   stays in your terminal; use `read -rs` as before). Start with a small amount within the cap.
3. **The receiver.** They sign in on their phone, open the private wallet once (this announces
   their verified address in your DM). If they have no AZTEC they tap *Share fee link* and send
   it to you; you open it and pay a few AZTEC of fees for them.
4. **Send.** In the DM: attach → *Private payment*, token HLC, amount within the cap, accept the
   two notices (unaudited, public fee payer), confirm. The wallet shows the transaction and its
   explorer link; a payment not confirmed in time stays *pending* — check before sending again.
5. **Record it** in `docs/MAINNET_READINESS.md` (G2, G6, G7: first real run).

## Stop switch

Set `AZTEC_VALUE_MODE=exits-only` on the Railway service to pause new payments at once without
a deploy. Claims, refunds and withdrawals keep working.
