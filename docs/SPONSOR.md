# Ledger sponsor (P1): sponsored fees for people without Fee Juice

People who open Ledger Chat's private wallet on Aztec Alpha with no Fee Juice get their account
created and their first transactions paid by **LedgerSponsor** (`contracts/aztec/sponsor`), a few per
account and up to a daily limit. Everyone else keeps paying with their own Fee Juice.

## How it works

1. The wallet sees no usable Fee Juice and asks `POST /api/aztec/sponsor` (signed-in wallets only).
2. The server checks the limits (`AZTEC_SPONSOR_PER_WALLET`, default 3 for life;
   `AZTEC_SPONSOR_PER_DAY`, default 200 for everyone) and signs a one-use voucher valid 15 minutes:
   ECDSA secp256k1 over `sha256("HL-SPONSOR-V1"‖0‖0‖0 ‖ voucher id ‖ expiry)`.
3. The transaction's first call is `LedgerSponsor.sponsor(...)`: the contract checks the key fixed at
   deployment, the signature, the expiry, that the voucher was never used (nullifier) and that the
   transaction's maximum fee is at most 40 AZTEC, then pays the fee.

A leaked voucher pays for at most one capped transaction. The sponsor can never pay more than the Fee
Juice it holds.

## Operator setup, from the phone (no terminal)

1. Merge the PR. CI compiles the contract (Aztec 6.0.0) and runs its tests.
2. Railway, service humanity-ledger, variables:
   - `NEXT_PUBLIC_AZTEC_SPONSOR_ADMIN` = your Ethereum address (public, not a secret).
   - Optional `AZTEC_SPONSOR_SIGNER_KEY` = 64 hex characters. Without it the key is derived from
     `JWT_SECRET`, so nothing else has to be created.
3. Open Ledger Chat on the phone with that wallet, open the private wallet (it needs its own Fee Juice
   for this one deployment), then Settings, Network fees, **Ledger sponsor**, **Deploy the sponsor**.
4. Copy the address it shows into `NEXT_PUBLIC_AZTEC_SPONSOR` in Railway; Railway redeploys.
5. Back in Ledger sponsor: enter an amount, **Add AZTEC** (your Ethereum wallet signs the deposit),
   wait a few minutes, **Claim into the sponsor**. The panel shows the sponsor's Fee Juice.

Record the deployment (address, transaction hash, block) in `deployments/aztec-mainnet.json` under
`sponsoredFpc` after the mainnet preflight has seen it.

## Limits and costs

Each sponsored transaction costs the sponsor only the gas used (well below the 40 AZTEC cap). Raise or
lower the per-wallet and daily limits in Railway at any time; to stop sponsoring at once, empty
`NEXT_PUBLIC_AZTEC_SPONSOR` and redeploy. Not audited (G8).
