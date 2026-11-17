# Humanity Ledger portal (L1 <-> Aztec)

Status: 17 November 2026. Module 2 of the zk.money / Nyx parity plan. **Not deployed on any network. No external audit.**

Code:
- Ethereum: `contracts/portal/HLPortal.sol`, `contracts/portal/AztecMessaging.sol`;
- Aztec: `contracts/aztec/portal_token`;
- client: `lib/portal/{config,l1,receivers}.ts`.

Tests:
- `test/portal/HLPortal.test.ts` (Hardhat);
- `contracts/aztec/portal_token/src/test.nr` (TXE);
- `test/unit/portal/*.test.ts`.

## 1. Assets

DAI, USDC, USDT and WETH. ETH is wrapped into WETH by `depositEthToAztecPrivate`, and a WETH withdrawal can be paid as ETH (`unwrap`).

Each asset is bound once to its own `PortalToken` instance on Aztec. A fee-on-transfer or rebasing token is refused at deposit (`AmountMismatch`).

## 2. Deposit

1. `depositToAztecPrivate(token, amount, secretHash)` checks the caps, pulls the tokens and checks that exactly `amount` arrived.
2. It sends `Inbox.sendL2Message({asset's PortalToken, rollupVersion}, sha256ToField(mint_to_private(amount)), secretHash)`.
3. The holder of the secret claims it with `PortalToken.claim_private(recipient, amount, secret, leafIndex)` into any Aztec account. The message is consumed privately.

Decision: the Aztec token and the bridge are one contract, with private balances only and no public total supply. A claim therefore publishes nothing about the amount (`docs/RECEIVER_ADDRESSES.md` §3.4). The cost: there is no public supply on Aztec to compare with L1. The L1 `totalLocked` is the reference (I1).

## 3. Withdrawal

1. On Aztec, `PortalToken.withdraw_private(from, recipient, amount, callerOnL1, nonce)` burns the private balance and emits the L2->L1 message `sha256ToField(withdraw(recipient, amount, caller))`.
2. On Ethereum, after Aztec proves that epoch, anyone calls `HLPortal.withdraw(...)` with the Outbox proof. Only the bound caller can call it if `callerOnL1` is set.

**Privacy of a withdrawal.** The L2->L1 message is a public output of the Aztec transaction, and that transaction's fee is paid from the person's account (until Module 3). So a withdrawal links the account to the L1 recipient and the amount. The wallet says so and asks for an explicit acknowledgement before withdrawing. A private fee payer (Module 3) removes the account from the transaction; the recipient and amount stay public by nature.

**In the wallet (17 Nov 2026).**
- Claims and withdrawals are exits. They stay available in exits-only mode, so an operator pause never traps funds.
- Before proving, the wallet checks that the PortalToken is one of this build's configured assets. It also reads `portal_address()` on the device and refuses an instance that is linked to any other L1 contract. A withdrawal to an unknown portal would burn the balance into a message that no honest contract executes.
- The withdraw form refuses the zero address and the person's own receiver addresses (`lib/portal/withdraw.ts`). It shows a review step before anything is proved.
- The form stays **off** (`WITHDRAW_COMPLETES_IN_WALLET = false` in `components/zk/wallet/ReceiversCard.tsx`) until the wallet also fetches the Outbox proof and sends the L1 payout itself. Starting a withdrawal that only a script could finish is not offered.

**Build configuration** (`lib/portal/config.ts`). The portal is off unless every check passes:
- The Aztec test network pairs only with Sepolia, and Aztec Alpha only with Ethereum (chain 1).
- On Ethereum, every symbol must be its canonical token with its real decimals: DAI `0x6b17…1d0f` (18), USDC `0xa0b8…eb48` (6), USDT `0xdac1…1ec7` (6), WETH and ETH `0xc02a…6cc2` (18). One mismatch turns the whole portal off.
- The portal, the factory and the implementation must be three different addresses.
- No two assets may share a symbol or an Aztec token.

Not wired yet: fetching the Outbox proof from the Aztec node in the wallet. `lib/portal/l1.ts executeWithdrawal` takes the proof as input; the aztec.js v6 call that produces it is to be confirmed against a deployment.

## 4. Invariants (`HLPortal`)

| | Invariant | Test |
|---|---|---|
| I1 | `totalLocked[t]` = deposits - withdrawals, and the balance held is ≥ it. Every deposit locks exactly its message amount. A withdrawal above `totalLocked` is refused. | fee-on-transfer refused; `NotLocked` |
| I2 | Tokens leave only through `withdraw`, against an Outbox-consumed message from the asset's own Aztec token. No sweep, no admin transfer, no upgrade. | ABI check (no other payout function) |
| I3 | An asset's Aztec token is set once and never changes, so messages in flight stay withdrawable. | `AssetAlreadyBound` |
| I4 | Restrictions are immediate (guardian or admin): pause deposits, disable an asset, lower caps, cancel a queued change. Relaxations wait 2 days, in public: enable or raise caps, change roles, sunset. Unpausing deposits is immediate but admin-only, and caps still apply. | timelock tests |
| I5 | Withdrawals can be paused for at most 3 days, then not again for 4 days. A sunset closes deposits forever and leaves withdrawals open. | pause and sunset tests |
| I6 | Caps per asset: minimum, per deposit, per sending address per UTC day, global per UTC day. For a receiver, "sending address" is the receiver. | caps tests |

Roles:
- **Admin:** queues relaxations, accepts after the timelock. It should be a multisig; none is designated (the 4-of-7 of launch condition 3 is open).
- **Guardian:** can only restrict.

There is no owner key that can move funds.

Suggested first caps, all per asset, to be set at deployment:

| Cap | Value |
|---|---|
| Per deposit | 1,000 USD |
| Per sending address per day | 2,000 USD |
| Global per day | 50,000 USD |
| Minimum deposit | 1 USD |

## 5. Migration (Aztec upgrade)

1. Queue a sunset to the new portal. After 2 days, deposits close.
2. Withdrawals continue until every note has left.
3. People re-deposit through the new portal and its new `PortalToken` instances.

The old `PortalToken` keeps working on its rollup for as long as that rollup lets messages out.

## 6. Second security layer (Oxide-style)

Deferred. A second, independent approval of large withdrawals would have to sit in `withdraw`. It would add a party that can delay exits, which conflicts with I5.

The caps, the 2-day timelock on relaxations and the bounded withdrawal pause are the layer for now.

**Residual risk:** a bug in `PortalToken` or `HLPortal`, or in Aztec's Outbox, could release locked funds before anyone notices. Daily caps bound the exposure.

## 7. Before any deployment

1. External audit of `HLPortal`, `HLReceiver`, `HLReceiverFactory` and `PortalToken`. `deployments/aztec-mainnet.json` keeps `"audit": null` until then.
2. A test-network deployment (Sepolia and the Aztec test network), then a two-account run:
   - receiver;
   - forward by a third party;
   - claim after the delay;
   - transfer;
   - withdrawal with a real Outbox proof.
3. An admin multisig and a guardian, designated by the project owner.
4. The Outbox proof call wired in the wallet (§3).
5. Private fees (Module 3) before receiver addresses are presented as unlinkable on Alpha.
