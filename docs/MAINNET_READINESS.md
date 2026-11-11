# Ledger Chat on Aztec Alpha (mainnet): readiness

**Date:** 5 November 2026, updated 10 and 11 November 2026. **Status (11 November):** one contract of ours is on Aztec Alpha, the operator's token HLC (below); no escrow or stream is. The Alpha variables are set in Railway, but **production does not run on Alpha yet**: the Dockerfile declared no `ARG`, so Railway never passed them to `next build` and every build so far used the defaults of `lib/aztec/wallet/config.ts` (test network, no tokens). The wallet refuses a node that settles on Ethereum mainnet (`assertNetworkAllowed`) unless the build carries **both** `NEXT_PUBLIC_AZTEC_NETWORK=alpha` and `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true`.

## State on 11 November 2026

| Item | State | Evidence |
| --- | --- | --- |
| Alpha variables in Railway | Set: `NEXT_PUBLIC_AZTEC_NETWORK=alpha`, `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true`, node `https://aztec-mainnet.drpc.org`, L1 chain 1, `NEXT_PUBLIC_AZTEC_TOKENS` (HLC), `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS` (HLC, 1000 HLC) | Railway service `humanity-ledger`, production |
| Alpha in the client build | **Not effective.** No `ARG` in the Dockerfile before 11 November, so `NEXT_PUBLIC_AZTEC_*` never reached `next build`. The `ARG` lines are added in the PR of 11 November; **merging it is what switches production to Alpha.** It is merged only after the preflight confirms HLC | `Dockerfile`; [Railway: using variables at build time](https://docs.railway.com/builds/dockerfiles#using-variables-at-build-time) |
| Wallet without tokens on Alpha | Opens with Fee Juice only; Shield, Unshield and Send hidden until a token is configured (PR #40) | `isWalletConfigured`, `hasPrivateTokens` in `lib/aztec/wallet/config.ts` |
| Token HLC | Deployed by the operator: `0x2cd0f3775d129210ecf2165e338e1b6b708f2243ac1b30feb0ac49875366e55d`, admin `0x01c7e18f1751ea94e3d63aad2d0b7221642ad299454f769103f0d32364ce549b`, deploy tx `0x0dfc7146b9f807432d06bccf43d3cea88e849455f8f62372ea2b93d41be29136`. Name "Humanity Ledger Corp.", symbol HLC, 6 decimals. Issued by Humanity Ledger; not backed by and unrelated to USDC (the wallet slot `USDC` is internal and never shown). Supply is not capped by the contract: the admin can mint | `deployments/aztec-mainnet.json` (`tokens`) |
| HLC confirmed on the node | **Confirmed** by the mainnet preflight (run 42990431384): deploy transaction checkpointed in L2 block 24544; instance class `0x067df4ddda0b0872ef604f47f3681d5e8c0de98280ac6b79963851c055ba91e0`, deployer = admin; `checkTokenInstance` ok against the Token of noir-contracts.js 6.0.0. Block and class recorded from that run | `test/live/aztec-mainnet-preflight.live.test.ts` |
| Build check | `scripts/aztec/check-alpha-config.mjs` runs before `next build`: tokens and caps must match the record. Mode `warn` until HLC is confirmed, then `strict` (`AZTEC_ALPHA_CONFIG_CHECK`) | `test/unit/aztec/check-alpha-config.test.ts` |
| Agreements on Alpha | **Off.** `contracts` in the record is empty, so `agreement-policy.ts` refuses every escrow and stream whatever the caps. The escrow and stream artifacts also predate the deposit and creation nullifiers (`deployments/aztec-pending-recompile.json`): they are recompiled and run on testnet before anything is published on Alpha | `test/unit/aztec/agreement-policy.test.ts` |
| Exits-only mode | In the code (`lib/aztec/value-mode.ts`), not set in Railway, so the mode is `open`. To stop new value without a deploy: set `AZTEC_VALUE_MODE=exits-only` on the service (read at every new value action through `/api/aztec/value-mode`; unreachable or unknown means exits-only) | `lib/aztec/value-mode.ts` |
| Public texts | The legal and documentation pages (`lib/docs/pages/legal.ts`, `protocol.ts`) and the site metadata still say the wallet runs only on the test network, and the legal page says it will not be connected to a network with real value before an audit. Switching production to Alpha contradicts that text; the decision is open and not part of the 11 November PR | `lib/docs/pages/legal.ts` |

## Where Aztec is

- Aztec Alpha runs on Ethereum mainnet (L1 chain 1), version 6.0.0 ("Tierra", 3 November 2026), the same version our contracts and client are built against. The testnet runs the same release and Aztec calls it the staging environment for Alpha. Source: [docs.aztec.network/networks](https://docs.aztec.network/networks).
- Aztec's own words on Alpha: live but early, bugs (including critical ones) expected. Earlier coverage of the Alpha launch quoted the team: deposit only funds you can afford to lose.
- Alpha has **no Sponsored FPC**. Fees are paid in Fee Juice, from the account's balance or by claiming Fee Juice bridged from L1 in the same transaction (`FeeJuicePaymentMethodWithClaim`). `PrivateFeePaymentMethod` and `PublicFeePaymentMethod` are deprecated and do not work on Alpha. Source: [Paying Fees](https://docs.aztec.network/developers/docs/aztec-js/how_to_pay_fees).

## First preflight against Alpha (5 November 2026)

Workflow "Aztec mainnet preflight", run 42040311011, read-only against `https://aztec-mainnet.drpc.org`:

- node 6.0.0, L1 chain 1, rollup version 2070860440: no drift from `lib/aztec/sequencer/networks.ts`;
- no contract at the testnet's sponsored fee payer address: fees on Alpha are paid in Fee Juice;
- the classes of our committed artifacts are not published on Alpha: PrivateEscrow `0x1fc9702de2946be7308126990f4cf3b8a3fbe9a4c53dc072d9ccb95bf9f04b5e`, PaymentStream `0x1fd6afbe0bffe6a7cb675927dedc0aed886a46bf7c6d58edc32854af073701f2`, IdentityCredential `0x1be813182640bfe08c2dea56bc3f96a7192b380a8dadc8210fc27ae0867e6c06`. The same classes run on testnet (run 42030688268).

## Gates

| # | Gate | State on 5 Nov 2026 | How to check |
| --- | --- | --- | --- |
| G1 | The client knows which network it talks to and refuses drift | Done: `identifyNode` (`lib/aztec/fees.ts`) reads the node's L1 chain ID, rollup version, node version and rollup address and compares them with `lib/aztec/sequencer/networks.ts` **Client delta: node identity and Fee Juice pins re-checked before every value-moving step on Alpha (`assertNodeForValue`), not only at start.** | `test/unit/aztec/fees.test.ts`; workflow "Aztec mainnet preflight" against the Alpha node |
| G2 | Fees in Fee Juice, never a sponsored payer on Alpha | Done in the wallet, not yet run against Alpha. On Alpha the wallet pays in Fee Juice (`lib/aztec/fee-juice.ts`, `lib/aztec/wallet/client.ts`). A new account waits in `needs-fee-juice` until the user bridges AZTEC from L1 through the **pinned** FeeJuicePortal (a node reporting another portal or token is refused), then deploys by claiming in the same transaction (`FeeJuicePaymentMethodWithClaim`). Later transactions pay from the balance and claim any deposit that has arrived. Claim secrets are derived from the wallet signature, so deposits are recoverable from L1 on any device (`recoverFeeJuiceClaims`). Alpha signs a different EIP-712 message, so it is a different account from testnet. Checked against the Aztec v6.0.0 sources (aztec-node `1b6de149`). The screen is in `ZkBridgePortal` (Settings, Network fees). Open: one real run **Client delta: agreements pay from the Fee Juice balance only (`agreementFeeCheck`); explicit per-deposit consent to the public deposit and fee payer in `ZkBridgePortal`. Open: the real run (Stefan).** | `test/unit/aztec/fee-juice.test.ts` (12); first real run on Alpha with a small deposit, by Stefan |
| G3 | A real private token for agreements | Partly done: `lib/aztec/token-check.ts` accepts a token only if its instance runs a class computed from an artifact the client trusts and that artifact has `transfer_in_private((Field),(Field),u128,Field)`, the function our contracts call by selector; the standard Token of noir-contracts.js 6.0.0 matches. Open: which private tokens are live on Alpha, and with which contract, is a question for Aztec **Client delta: on Alpha every configured token passes `checkTokenInstance` against the node when the wallet opens, or the wallet refuses. Open: Aztec's answer.** | `test/unit/aztec/token-check.test.ts`; per-token caps |
| G4 | Contract risk is bounded | Partly done: `lib/aztec/agreement-policy.ts` allows an agreement on Alpha only for a recorded class, with the user's acknowledgement while unaudited, and within a per-token cap; `openEscrow`, `openStream` and `acceptInvite` enforce it before anything is sent or registered. No external audit **Client delta: the policy also requires a verified G7 binding and the public-fee-payer acknowledgement; caps from `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS` (malformed or ≤0 dropped); `checkAgreementContext` refuses node ≠ build and Alpha not enabled; the same rules apply to direct payments (`lib/payments/direct-private.ts`).** | `test/unit/aztec/agreement-policy.test.ts` |
| G5 | Deployments recorded like on testnet | Ready: `deployments/aztec-mainnet.json` (empty) and its offline checks (transaction hash and block required, keys required for token-holding instances, class equal to the committed artifact); the preflight checks every entry on the node **Client delta: `authorizedMainnetRecord` keeps only entries with transaction, block, current class, not do-not-use, keyed when holding tokens; a record for another network authorises nothing. Open: deploy (Stefan).** | `test/unit/aztec/deployments-registry.test.ts`, preflight |
| G6 | Agreements usable from the chat | Built: Private agreement in the attach menu, cards for invitations and address announcements, verify and accept, claim, refund, withdraw, cancel (`docs/chat/AGREEMENTS.md`). Open: a recorded two-account session in browsers **Client delta: direct private payment from the DM (R-11), payee = pinned address. Open: the session in `docs/chat/G6_SESSION_CHECKLIST.md`.** | Two-account demo |
| G7 | Proof that the peer controls the pinned Aztec address | Done in code (10 November). Version 2 announcements carry a Schnorr signature by the account's signing key over `hl/aztec-binding/v1 \| address \| signer inbox \| dm:recipient inbox`. The receiver recomputes the address from the signing key, salt and public keys before pinning it as verified. A failed proof is rejected with a warning. On Alpha, private payments go only to verified addresses (`lib/payments/rails.ts`). Limit: proves the signing key, not the privacy keys (`docs/AZTEC_AUDIT_MANIFEST.md` §4). Open: a run between two browsers **Client delta: `verifiedPeerBinding` re-verifies the stored proof (Schnorr and address) every time value moves; the cached flag alone is never trusted. Open: the run between two browsers.** | `test/unit/aztec/peer-binding.test.ts` (7 G7 tests) |
| G8 | External security review | Open **Unchanged: open. Nothing in the client deltas is audited.** | Report recorded in `deployments/aztec-mainnet.json` (`audit`) |

Test tokens (zkUSDC, zkDAI, zkETH, HLT) are testnet tokens with no value. They are never shown as mainnet assets.

## G2 notes: what paying in Fee Juice means for privacy

Paying with the account's own Fee Juice is public: the account is the visible fee payer of each transaction. Amounts and recipients of private transfers stay private, but an observer can link an account's transactions to each other. Aztec's documentation points to a private FPC, which holds Fee Juice as an internal private balance, as the way to remove that link ("Pay Fees Privately", `how_to_use_private_fee_juice.md`). The documented example is community code with its own operator, so it needs a review before Ledger Chat relies on it. Until then, the wallet and the website must not describe Alpha transactions as unlinkable.

Operator settings for Alpha:

- `NEXT_PUBLIC_AZTEC_NETWORK=alpha` and `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true`;
- `NEXT_PUBLIC_AZTEC_NODE_URL` (defaults to the pinned public RPC) and `NEXT_PUBLIC_AZTEC_EXPLORER` (no default on Alpha);
- `NEXT_PUBLIC_AZTEC_TOKENS`, listing only tokens that pass `checkTokenInstance` against the Alpha node (G3);
- `NEXT_PUBLIC_AZTEC_L1_FROM_BLOCK`: the L1 block of the release, the start of the claim recovery scan.

## G3: tokens

No code can settle this. Which private token contracts are live on Alpha, and who controls their minting, is a question for Aztec (Stefan is sending it). When the answer comes:

1. Run `checkTokenInstance` against the Alpha node for each address.
2. List only the tokens that pass, in `NEXT_PUBLIC_AZTEC_TOKENS`.
3. Set per-token caps in `agreement-policy.ts`.

## G7 design: proof that the peer controls an Aztec address

The idea is to let the peer prove control of the signing key behind the Aztec address it announces in the DM, without revealing anything that can spend. A Schnorr account's address commits to its signing public key: the key is a constructor argument, so it enters the initialization hash, then the partial address, then the address. The announcement would carry:

- the signing public key, salt, deployer and class id, and the account's public keys;
- a Schnorr signature by the signing key over `hl/aztec-binding/v1 | <aztec address> | <xmtp inbox id> | <conversation id>`.

The verifier recomputes the address from those values, checks that it equals the announced one, verifies the signature, and only then pins the address. Nothing in the announcement can spend: the signing private key never leaves the wallet. The SDK functions for each step (initialization hash, partial address, address from public keys and partial address, Schnorr verification) must be confirmed against the pinned `@aztec-labs` 6.0.0 sources before this is written. That check was not part of the 10 November work.

## G8

An external review cannot be done in code. `docs/AUDIT_SCOPE.md` lists what a reviewer would look at; the report, when there is one, is recorded in `deployments/aztec-mainnet.json` (`audit`). Until then the Alpha policy (`agreement-policy.ts`) keeps the "unaudited" acknowledgement and small caps.

## What December can honestly hold

- **Reachable by December if G2, G3, G5 and G6 are done:** a limited Alpha release of agreements: deployed and recorded classes, small per-token caps, an explicit "unaudited" acknowledgement, Fee Juice for fees. Every instance recorded with its transaction hash and block, checked weekly by the preflight.
- **Not reachable by December:** an external audit (G8), and therefore any claim that the contracts are audited or that agreements are safe for significant amounts.
- **Who deploys:** the deployment on Alpha spends real Fee Juice and is signed by Humanity Ledger's own account. It is run by Stefan, after the same script has run on testnet, never by an automated agent.

## Order of work

1. G2 in the wallet: done in code (10 November). Bridging goes through the user's own Ethereum wallet against the pinned portal, not through `L1FeeJuicePortalManager`, which expects a private-key L1 client. Next: the bridging screen in `ZkWalletPanel`, then one real run with a small amount.
2. G3: ask Aztec which private token contracts are live on Alpha, and list a token only after `checkTokenInstance` passes against the Alpha node.
3. G6: agreements in the conversation (invitation messages, status, claim, refund, withdraw, cancel).
4. G5: deploy on Alpha (Stefan), record, preflight green.
5. Small caps, acknowledgement on; raise caps only with an audit.

## Conditions before raising caps or softening the disclaimers

Caps (`NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS`, per-payment limits) and the "not audited" notices stay as they are until every line below is true and recorded here with a date and a link. Any single one missing keeps the current caps.

1. Third-party audit of `contracts/aztec/escrow` and `contracts/aztec/streams` (including the deposit and creation nullifier changes), findings fixed, report public.
2. Aztec Alpha release in use has no open critical advisory from Aztec Labs; the node identity pins (`lib/aztec/fees.ts`, `lib/aztec/fee-juice.ts`) match it.
3. CI "SDK still encrypts the wallet stores" green on the exact SDK version shipped; no plaintext `pxe_data*` / `wallet_data*` store left after one sign-in (manual check in two browsers).
4. Subresource Integrity active in production (every `<script>` from `/_next/` carries `integrity`), and the proving VK pins (`scripts/zk/check-artifacts.mjs`) green on the deployed commit.
5. Two-browser runs of: direct payment, escrow fund/release/refund/cancel, stream create/withdraw/cancel, community → DM handoff, each on Alpha with the smallest amount, recorded with tx hashes.
6. G7 refusal verified: an unverified peer, a peer whose binding proof was edited, and a peer on another network are all blocked before any proof is made.
7. Incident path written: who can pause the UI rails (config flag), how users are told, and how funds in open agreements are recovered without the operator.

Raising a cap is a config change reviewed by two people; lowering it never needs review.
