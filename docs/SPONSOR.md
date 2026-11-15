# Ledger sponsor (P1): sponsored fees for people without Fee Juice

People who open Ledger Chat's private wallet on Aztec Alpha with no Fee Juice can get their account
created and their first transactions paid by **LedgerSponsor** (`contracts/aztec/sponsor`), a few per
account and up to a daily limit. Everyone else keeps paying with their own Fee Juice.

## State (15 November 2026)

| Part | State | Evidence |
|---|---|---|
| Contract `LedgerSponsor` | **Code ready, not deployed** (fixed 15 Nov 2026: `#[allow_phase_change]` on `sponsor`). The first instance on Alpha, `0x268bb3e4…090aafa8` (block 30105), **cannot pay**: its `sponsor` lacked the attribute, so every sponsored transaction failed with "Phase change detected". It keeps its 74 AZTEC of Fee Juice, which cannot be withdrawn. A new instance must be deployed and funded | TXE tests (10), `test/unit/aztec/phase-change.test.ts` |
| Voucher signing (V2 digest) | **Real only in tests** | `test/unit/aztec/sponsor-voucher.test.ts` |
| Per-wallet and daily limits | **Real only in tests** | `test/unit/aztec/sponsor-quota.test.ts` |
| Wallet path "no Fee Juice → sponsor" | **Real only in tests** (source checks; the sponsor has never paid on Alpha) | `test/unit/aztec/ledger-sponsor.test.ts` |
| Post-deployment check | **Passed** against the Alpha deployment on 15 November 2026 (workflow "Aztec verify sponsor": network, class, server key and cap) | `scripts/aztec/verify-sponsor.mjs`, `test/unit/aztec/verify-sponsor.test.ts` |
| Audit | Not audited (G8) | |

## How it works

1. The wallet sees no usable Fee Juice and asks `POST /api/aztec/sponsor` (signed-in wallets only).
2. The server checks it can sign at all (a key and a sponsor address), then takes one slot in both
   limits or in neither (`lib/aztec/sponsor-quota.ts`): `AZTEC_SPONSOR_PER_WALLET` (default 3, for
   life) and `AZTEC_SPONSOR_PER_DAY` (default 200, for everyone). A refused request uses up nothing.
   If Redis does not answer, no voucher is issued. A retry within a voucher's life gets the same
   voucher back and takes no new slot.
3. It signs a one-use voucher valid 15 minutes: ECDSA secp256k1 (low-s) over
   `sha256("HL-SPONSOR-V2" ‖ sponsor address ‖ L1 chain id ‖ rollup version ‖ voucher id ‖ expiry)`
   (`contracts/aztec/sponsor/src/voucher.nr`, `lib/aztec/sponsor-voucher.ts`). A voucher is valid on
   exactly one sponsor instance of one network (finding SP-5).
4. The transaction's first call is `LedgerSponsor.sponsor(...)`. In this order the contract checks
   that the voucher id is not zero and has not expired, that the key is the one fixed at deployment,
   the signature, and that the transaction's maximum fee (gas limits × max fee per gas, compared as
   Fields) is at most the cap; then it emits the voucher's nullifier (one use), elects itself fee
   payer and ends the setup phase.
5. The wallet only sends a sponsored transaction with gas limits from a simulation. With the
   protocol's default limits the maximum fee is above the 40 AZTEC cap, so the sponsor would refuse
   it; the wallet stops before sending instead, and the voucher stays usable. The operator's own
   transactions (deploying and funding the sponsor, R1) are never sponsored.

A leaked voucher pays for at most one capped transaction. The sponsor can never pay more than the Fee
Juice it holds. **Fee Juice sent to the sponsor cannot be withdrawn**: the contract has no withdrawal,
so it can only be spent on sponsored fees. Fund it in small amounts.

## Deployment checklist (operator)

Before:

- [ ] `AZTEC_SPONSOR_SIGNER_KEY` in Railway: 64 hex characters, **new, for Alpha only** (never used on
      the test network). On Alpha the server refuses to derive a key from `JWT_SECRET`
      (`lib/aztec/sponsor-voucher.ts`). Keep a copy in your password manager: the public half is fixed
      in the contract, so a changed or lost key means deploying a new sponsor, and the old sponsor's
      Fee Juice stays there.
- [ ] `NEXT_PUBLIC_AZTEC_SPONSOR_ADMIN` = your Ethereum address (public, not a secret).
- [ ] Limits decided: `AZTEC_SPONSOR_PER_WALLET`, `AZTEC_SPONSOR_PER_DAY`. For scale: one account
      creation cost 1.7989 AZTEC on Alpha (block 29921, `deployments/aztec-mainnet.json` →
      `newUserFlow`); the cap per transaction is 40 AZTEC.
- [ ] Redis reachable (`REDIS_URL`): without it the server issues no voucher.
- [ ] Your own private wallet has Fee Juice: deploying the sponsor is not sponsored.

Deploy, from the phone:

1. Ledger Chat with the admin wallet, private wallet, Settings, Network fees, **Ledger sponsor**,
   **Deploy the sponsor**.
2. Copy the address it shows into `NEXT_PUBLIC_AZTEC_SPONSOR` in Railway. `NEXT_PUBLIC_*` values are
   written into the build, so the deployment must be a **new build**: a deployment that only restarts
   the previous build keeps the old value (seen on 15 November 2026: `GET /api/aztec/sponsor` still
   answered `"address": null`). Check that it answers the new address; if not, a commit to `main`
   forces a fresh build.
3. Back in Ledger sponsor: enter a small amount, **Add AZTEC** (your Ethereum wallet signs the
   deposit), wait a few minutes, **Claim into the sponsor**.
4. GitHub, Actions, **Aztec verify sponsor**, Run workflow. Expected: every line PASS except `record`
   (WARN until step 5). A FAIL on `key+cap` means the contract was deployed with another key than the
   server now holds: no voucher would ever verify; do not fund it further.
5. Record the deployment in `deployments/aztec-mainnet.json` → `sponsoredFpc`: address, transaction
   hash, block, and the Fee Juice balance slot from `scripts/aztec/fee-juice-slot.mjs`. Run the
   workflow again: all PASS.

Checks after deployment (manual, on Alpha):

- [ ] A new account with no Fee Juice is created; the explorer shows the sponsor as fee payer, and the
      sponsor's balance falls by about the fee shown.
- [ ] /protocol shows the vouchers issued in 24 h.
- Not exercised on Alpha, enforced by the contract and the node: a voucher used a second time
  (duplicate nullifier) and a transaction above the cap. TXE cannot run either case (see the end of
  `contracts/aztec/sponsor/src/test.nr`).

## Limits, costs and stopping

Each sponsored transaction costs the sponsor only the gas used (well below the 40 AZTEC cap). Raise or
lower the per-wallet and daily limits in Railway at any time. To stop sponsoring, empty
`NEXT_PUBLIC_AZTEC_SPONSOR` and redeploy: the server then issues no voucher, but a voucher issued in
the last 15 minutes can still be used once until it expires.

Counts recorded before 14 November 2026 also include refused requests (the old limiter recorded
every request), so a wallet that was refused then may show fewer sponsored transactions left.
