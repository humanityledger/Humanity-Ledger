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

## If the private wallet does not open

- **"Waiting for your wallet signature" that never ends.** The wallet extension never answered.
  Keep one wallet extension enabled for the site, open the wallet again and press *Sign* in the
  popup. After two minutes the app stops waiting and says so.
- **"Open in another Ledger Chat tab or window".** One browser profile has one open private
  wallet. Opening it in a new tab now asks the other tab to close it (like *Use here* in WhatsApp
  Web); a tab in the middle of a payment keeps it until the payment ends. A failed open no longer
  keeps the storage locked, and a page left in the back/forward cache closes its wallet.
- **"Could not reach …" / Safari "Load failed".** The browser could not reach the public Aztec
  node (rate limit of the free endpoint, an extension or network blocking its host). The wallet
  then retries the same request through this site's relay, `/api/aztec/node` (signed-in sessions
  only; public `aztec_` node methods only; same pinned node; node identity still checked). The
  relay is used only after a direct failure. `AZTEC_NODE_RELAY=off` turns it off on the server,
  `AZTEC_NODE_RELAY_UPSTREAMS` (comma-separated, server only) sets the nodes it forwards to.

## Stop switch

Set `AZTEC_VALUE_MODE=exits-only` on the Railway service to pause new payments at once without
a deploy. Claims, refunds and withdrawals keep working.
