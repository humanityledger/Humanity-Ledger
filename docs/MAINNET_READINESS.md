# Ledger Chat on Aztec Alpha (mainnet): readiness

**Date:** 5 November 2026, updated 10, 11 and 14 November 2026. **16 November:** the paragraphs below still hold. This note only records the delta since 15 November.

**Delta 18 November 2026 (operator decisions, signed by Stefan Antonio Cirisanu; `docs/alpha/OPERATOR_DECISIONS.md`).**

- **Fees, option A.** D-1 to D-5 in `docs/protocol/FEE_CONTRACT_SPEC.md` are the technical base for after the alpha. They are not confirmed for charging. The spec now says the same as this file.
- **Closed alpha.** It charges no protocol fee (OD-7). Its classes accept at most 100 HLC per escrow and per stream, fixed in bytecode (OD-2). Wave 1 is escrow and streams on Aztec Alpha with HLC, for at most 20 testers invited by Stefan. The Ethereum portal is wave 2, after an external review.
- **Status of those classes.** They are recompiled by CI and not deployed. Agreements on Alpha stay refused until the `closedAlpha` gate and a recorded deployment exist. `"audit"` stays `null`.
- **Retired** (B-3): HumanityIdentityRegistry and StudioProvenance. LedgerDeadmanSwitch is out of the deploy script.
- **Q8 and M3.** Private fee payment, if it comes, uses an FPC operated by Aztec or the community, never one of ours.

**Delta 16 November 2026.**

- Fees: unchanged from the 15 November decision under "Network fees: no sponsorship". No fee contract. Phase 0 is `docs/protocol/FEE_CONTRACT_SPEC.md`. D-1 through D-5 are recommendations waiting on the operator. This file does not confirm them.
- Q1–Q10 remain OPEN (`docs/AZTEC_DECISIONS.md`). Q7's question to Aztec (a future sponsored payer) is open. The product already refuses sponsorship with 410.
- R-17: `communityMls` defaults to false. Post routes return 410 only when it is true, and then they do not write the post. `xmtpGroupId` is stored only for a flagged community, and only if the client sends a group id. Existing communities are unchanged. Communities are still server-readable. AC-03 is not done.
- Mobile: external phone browsers get an explicit "Open in MetaMask" link (`https://link.metamask.io/dapp/ledgerchat.org`). WalletConnect on the same page remains. SIWE is the same request. See `docs/CONNECT.md`.
- The dossier for Aztec Labs is `docs/AZTEC_FOUNDATION_DOSSIER.md` section 0 and Annex A. It is not sent until Stefan reviews it.

**Status (11 November):** one contract of ours is on Aztec Alpha, the operator's token HLC (below); no escrow or stream is. Production runs on Alpha since #41 (until then the Dockerfile declared no `ARG`, so every build used the test network defaults). The private wallet's storage bug (#43) and its dead ends are fixed in code. **14 November:** the first real end-to-end run is recorded (R1 below: first private payment from Ledger Chat, L2 block 29012). The wallet refuses a node that settles on Ethereum mainnet (`assertNetworkAllowed`) unless the build carries **both** `NEXT_PUBLIC_AZTEC_NETWORK=alpha` and `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true`.

## State on 12 November 2026: what stands between Ledger Chat and an unqualified "live on mainnet"

Production runs on Aztec Alpha (Ethereum mainnet, chain 1) and HLC is confirmed on the node (below). Since 11 November, in code: CSP for the prover WASM (#58), Fee Juice minimum from live node fees and top-up plan (#59), calls active only when ICE connects (#60), true presence and linked-computer wallet (#61), migrations that bypass PgBouncer and read retries (#63). What remains is listed with its owner. **Nothing below can be closed by code alone in this repository today.**

| # | Remaining | Why it matters | Owner | How it is closed |
| --- | --- | --- | --- | --- |
| R1 | First real run on Alpha | **Done 14 November 2026.** First private payment from Ledger Chat on Alpha, confirmed by the preflight (run 43583640304); record below | Stefan | `deployments/aztec-mainnet.json` (`firstPrivatePayment`) |
| R2 | Public and legal texts | `lib/docs/pages/legal.ts` and `protocol.ts` say the wallet is test-network only and will not touch real value before an audit; production does | Stefan with counsel | Decide the wording; agents do not edit legal text |
| R3 | TURN relay | Calls between different networks cannot connect (`/api/calls/ice` answers `source: none`) | Stefan | `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` in Railway (`docs/CALLS.md`) |
| R4 | Zero-balance onboarding | **Closed by product decision (15 Nov 2026): Ledger Chat sponsors no fee.** Every account pays its own network fees: Fee Juice it bridges, or Fee Juice a contact bridges for it through a fee link. Since 14 Nov transfers and account creation set gas limits from a simulation (`gasLimitsFromSimulation`), so the Fee Juice an account must hold follows the transaction, not the protocol maximum (about 15 AZTEC asked and 1.8 charged for an account creation). See "Network fees: no sponsorship" below | — | Done: estimated transfers confirmed on Alpha (blocks 29895, 29923) |
| R5 | A dollar-denominated token | HLC is issued by the operator, uncapped and unbacked; nobody holds it as money | Decision, then build | Proposal P2 below |
| R6 | Agreements (escrow, streams) on Alpha | Off. The fee source is compiled with Aztec 6.0.0 and TXE-tested (escrow 19, streams 29); the classes are recorded as current with `address: null`, `status: not-deployed`. Not deployed on Alpha: TREASURY is the zero placeholder and there is no external audit | Stefan (treasury address, external audit), then deploy | `deployments/aztec-testnet.json`; `docs/AZTEC_FOUNDATION_DOSSIER.md` section 0; G5 |
| R7 | External audit | G8 open; no claim of audited contracts may be made | Stefan | Engage an auditor; record the report under `audit` |
| R8 | Two-browser G7 run | Peer address proof verified only in tests. Since 17 November proofs name the network (scheme v2) and Alpha refuses v1-scheme proofs: the run must use two clients on this build | Stefan + one tester | `docs/chat/G6_SESSION_CHECKLIST.md` |
| R9 | `DATABASE_URL_UNPOOLED` | #63 works around it; the correct value is the direct database | Stefan | `${{Postgres.DATABASE_URL}}` in Railway |

### R1 record: first private payment on Aztec Alpha (14 November 2026)

The HLC recorded on 11 November (`0x2cd0f3775d…e55d`, admin `0x01c7e18f…549b`) can never be issued: nobody holds the key of its admin account. It is kept under `retiredTokens` with status do-not-use. A new HLC was deployed from the Ledger Chat private wallet of `0x1Ba9c5cC429Ac7B8742F58c0215D6D58c009f675` (operator tool `#r1`, PR #91), with that account as admin.

| Step | Transaction | L2 block | Status |
|---|---|---|---|
| Deploy HLC `0x1f49571a48699da4e70e1b7dbc5afcea5bb712f7b2cfaf432353e694851e24e5` (class `0x067df4dd…91e0`, universal deployment) | `0x1b1031703d15a1cd77507a241c8d3715fb6b80baf484fc9676ad968f3ae47d1c` | 28992 | checkpointed |
| Issue 1 HLC to the sender's private balance (`mint_to_private`) | `0x1d90c138f482e08f2fe4d5cc28e5131a4811ab561e17e6994eab50113fd68940` | 29001 | checkpointed |
| Private transfer of 0.10 HLC | `0x1eb2bb76ae52d876e0ef8e107bf9de5b83ce9cb42850a1a1a938cae3c24040a5` | 29012 | checkpointed |

Sender `0x1cf28fb5c786f5d7587c3a97790cef3d5e4dc453d485efd0b463cb1a8e81fe42` (admin of the new HLC), recipient `0x2ce757e8fc073f67b9e9307ed255fa37ac69b05f6712af31517d6c1e79abb11a`, both accounts of the operator. Fees paid in Fee Juice by the sender. Proved in Chrome on Windows with MetaMask. Confirmed by the read only preflight, run 43583640304. On chain the transfer shows note hashes, nullifiers and the public fee payment; sender, recipient and amount are not visible. Still open: the recipient opening its wallet and reading 0.10 HLC (needs `NEXT_PUBLIC_AZTEC_TOKENS` switched to the new address).

### Second private payment, from the regular wallet screen (14 November 2026)

The first payment sent with **Send privately** in the wallet panel rather than the operator tool, between the same two accounts of the operator.

| Step | Transaction | L2 block | Status |
|---|---|---|---|
| Private transfer of 0.9 HLC | `0x0a333fc0b698454e51f28d8ee18dcf3174a21605479a40a67568d4295c6fcc94` | 29771 | mined (Aztecscan) |

Fee 2.858 AZTEC, paid by the sender in Fee Juice; the same transaction claimed a 47 AZTEC Fee Juice deposit bridged from L1. Before that deposit, sends failed with "insufficient fee payer balance": the node accepts a transaction only if the fee payer can cover its maximum fee, which the wallet sets from the protocol gas limit (`lib/aztec/fee-juice.ts`, `maxFeeFor`), far above what is charged. The R1 transfer in block 29012 was charged 1.256 AZTEC. Record: `deployments/aztec-mainnet.json` (`secondPrivatePayment`).

### A new user, end to end (14 November 2026)

The path a person with no AZTEC takes, run between two accounts of the operator:

| Step | Evidence | Fee |
|---|---|---|
| A contact pays 20 AZTEC of Fee Juice through the fee link (`/fees`) | L1 `0x8bb89e6c377f28e055e5d7ff8f5809ddaa60585e63783ab416796d598d022cbd`, block 26415154, pinned FeeJuicePortal | 108,854 L1 gas |
| "Check for fees" finds the deposit (after #110) | Wallet screen | — |
| The account is created, claiming the deposit | L2 block 29921 | 1.7989 AZTEC |
| Its first private payment, 0.01 HLC | `0x14a71087ff658c6d85d37e11a79b487f46aff73b0eea1b4252ece00ebf8bef49`, L2 block 29923 | 1.307 AZTEC |

Account creation measured about 0.56M L2 gas at the day's fees, inside the 3M budget of `budgetFeeFor`. Record: `deployments/aztec-mainnet.json` (`newUserFlow`). Still between two accounts of the operator: R8 (two different people) stays open.

### Protocol fee (launch condition 1 of docs/TOKENOMICS.md)

Not a blocker for any R item: no contract charges a fee, and none may until launch condition 1 is met.

| Step | State | Owner |
|---|---|---|
| Phase 0 arithmetic, u128-safe, with the T-5 refusal | Real only in tests: `lib/protocol/fees.ts`, `test/unit/protocol/fees.test.ts` | Done |
| Contract specification with test vectors and acceptance criteria | `docs/protocol/FEE_CONTRACT_SPEC.md` | Done |
| Decisions D-1 to D-4 (where the fee is taken, the schedule, streams, the treasury's Aztec account) | Decided 18 Nov 2026: option A. They stay the base for after the alpha, and the alpha charges no fee (OD-7). D-4 (treasury = the 4-of-7 multisig's Aztec account) is decided again before any fee is charged | Operator |
| Implementation in `PrivateEscrow` and `PaymentStream`, TXE tests, testnet e2e | Formula in the source since 16–17 Nov. Alpha classes run it with a zero schedule and `MAX_AMOUNT` 100 HLC (18 Nov); TXE in CI. Testnet e2e with the new classes pending | Engineer |
| External audit, then Alpha | Not started | Operator |

### Runbook for R1 (one browser, smallest amounts)

1. Production on the merged main; sign in with the wallet that will hold the account.
2. Private wallet, Add funds: the screen shows the minimum Fee Juice computed from the node; bridge exactly that amount of AZTEC once (earlier small deposits are added automatically).
3. Wait for the deposit to be ready (the panel shows "ready"); open the wallet: the account deploys by claiming in the same transaction. Copy the transaction hash from the activity list.
4. From the admin account, send 1 HLC to the new account's Aztec address; confirm it appears as private balance.
5. In a DM with a second account whose address is verified (G7), send 0.10 HLC; confirm on the second device.
6. Record in this file: date, the three transaction hashes, L2 blocks, browser and device. Only then may public material say that private payments run on mainnet.

### What zk.money (Aztec Labs) does that Ledger Chat does not, from its public review

Source: the L2BEAT privacy review of zk.money (v5 page, archived after v6 became canonical). zk.money brings dollars to Aztec through **its own L1 portal** (DAI, with USDC and USDT swapped to DAI on Curve) that credits private notes through the Inbox, and **sponsors users' L2 fees with a claim fee-paying contract funded by a 0.1 DAI charge on deposits and withdrawals**; names resolve through an onchain registry; per-payment and daily caps apply. There is no canonical, issuer-backed private stablecoin on Alpha to plug into: each application that wants dollars runs its own portal.

### Network fees: no sponsorship

**Sponsor deployed but disabled by product decision (15 November 2026). Users pay their own fees.**
Every transaction on Alpha, including the one that creates an account, is paid with the account's own Fee
Juice: bridged by the user, or by a contact through a fee link (`/fees`). The code holds no sponsor contract,
route, client path or operator screen (`test/unit/aztec/no-sponsorship.test.ts`), so no variable can turn
sponsorship on; `/api/aztec/sponsor` answers 410.

Technical reference only, **not used**: two LedgerSponsor instances were deployed on Alpha on 14 and 15 Nov 2026
(`0x268bb3e4…090aafa8`, block 30105, holding 74 AZTEC of Fee Juice that cannot be withdrawn; and
`0x231080b2…0d14b95b`, unfunded). Nothing in Ledger Chat calls either.

### Module 2: own portal and receiver addresses (17 November 2026, code only)

The dollar portal of proposal P2 now exists as code: `HLPortal` (DAI, USDC, USDT, WETH/ETH), `HLReceiver` / `HLReceiverFactory`, and the Aztec `PortalToken` (`docs/PORTAL.md`, `docs/RECEIVER_ADDRESSES.md`). Nothing is deployed.

Before Alpha, all of these are needed:
- an external audit;
- a test-network two-account run;
- an admin multisig and a guardian;
- the Outbox proof wired in the wallet;
- private fees (Module 3), so a claim is not tied to the account by its fee payer.

### Proposal P2: a dollar portal (needs approval before any code)

An L1 portal for one dollar token (DAI or USDC) and a matching L2 token minted only by Inbox messages from that portal, per-deposit and daily caps, withdrawals through the Outbox. This is a bridge holding user funds: it is not deployed without an external audit.

## State on 11 November 2026

| Item | State | Evidence |
| --- | --- | --- |
| Alpha variables in Railway | Set: `NEXT_PUBLIC_AZTEC_NETWORK=alpha`, `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true`, node `https://aztec-mainnet.drpc.org`, L1 chain 1, `NEXT_PUBLIC_AZTEC_TOKENS` (HLC), `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS` (HLC, 1000 HLC) | Railway service `humanity-ledger`, production |
| Alpha in the client build | **Effective since 11 November 2026** (#41, Railway deployment `7bdfe72f`, commit `8d679ee`). Before, the Dockerfile declared no `ARG`, so `NEXT_PUBLIC_AZTEC_*` never reached `next build`. Checked on ledgerchat.org: the served client contains the HLC address and the explorer, and the landing reads "Aztec Alpha, with real funds and a cap per payment" | `Dockerfile`; [Railway: using variables at build time](https://docs.railway.com/builds/dockerfiles#using-variables-at-build-time) |
| Wallet storage | **Fixed (#43).** Both encrypted stores were opened in the shared OPFS pool `.aztec-kv`; kv-store 6.0.0 locks a pool per open store, so the second open always failed (`pool ".aztec-kv" is already in use`) and the wallet could not open. Each store now has its own pool (`.aztec-kv-<store>`), which also makes the sign-out wipe find them again. A wallet open in another tab is reported as such | `test/unit/aztec/store-pools.test.ts` |
| Test-network texts in the user flow | **Removed (#41, #42).** Wallet panel, send/shield/unshield forms (symbol HLC, never the internal slot), agreement cards and composer, chat menus, payment message. Remaining: public and legal pages, pending the decision above | PR #41, #42 |
| Dead ends with real funds | **Fixed (wallet no-dead-ends PR).** An account waiting for Fee Juice is offered the bridge in the wallet panel (it was only in Settings); the Fee Juice balance and an Add button are always shown on Alpha; a failed balance read never turns an open wallet into an error or a confirmed payment into a failed one; a transaction not confirmed in time stays pending with "check before sending again" | `test/unit/aztec/wallet-no-dead-ends.test.ts` |
| First real run on Alpha | **Pending.** Open the wallet with a fresh account, bridge a small amount of AZTEC, let the account deploy, receive and send a small HLC amount, in one browser tab. Record the transaction hashes here | — |
| Wallet without tokens on Alpha | Opens with Fee Juice only; Shield, Unshield and Send hidden until a token is configured (PR #40) | `isWalletConfigured`, `hasPrivateTokens` in `lib/aztec/wallet/config.ts` |
| Token HLC | Deployed by the operator: `0x2cd0f3775d129210ecf2165e338e1b6b708f2243ac1b30feb0ac49875366e55d`, admin `0x01c7e18f1751ea94e3d63aad2d0b7221642ad299454f769103f0d32364ce549b`, deploy tx `0x0dfc7146b9f807432d06bccf43d3cea88e849455f8f62372ea2b93d41be29136`. Name "Humanity Ledger Corp.", symbol HLC, 6 decimals. Issued by Humanity Ledger; not backed by and unrelated to USDC (the wallet slot `USDC` is internal and never shown). Supply is not capped by the contract: the admin can mint | `deployments/aztec-mainnet.json` (`tokens`) |
| HLC confirmed on the node | **Confirmed** by the mainnet preflight (run 42990431384): deploy transaction checkpointed in L2 block 24544; instance class `0x067df4ddda0b0872ef604f47f3681d5e8c0de98280ac6b79963851c055ba91e0`, deployer = admin; `checkTokenInstance` ok against the Token of noir-contracts.js 6.0.0. Block and class recorded from that run | `test/live/aztec-mainnet-preflight.live.test.ts` |
| Build check | `scripts/aztec/check-alpha-config.mjs` runs before `next build`: tokens and caps must match the record. Mode `strict` in the Dockerfile since HLC was confirmed: a mismatch fails the build and the previous deployment keeps running (`AZTEC_ALPHA_CONFIG_CHECK=warn` only to diagnose) | `test/unit/aztec/check-alpha-config.test.ts` |
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
