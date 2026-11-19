# Humanity Ledger — Technical Dossier for the Aztec Ecosystem

**Date:** 16 November 2026. Sections 1–7 are the review of 4 November 2026 and stay as the historical record. Where they conflict with section 0, section 0 is the state to use.
**Repository:** [github.com/humanityledger/Humanity-Ledger](https://github.com/humanityledger/Humanity-Ledger)
**LinkedIn:** [linkedin.com/company/humanity-ledger](https://www.linkedin.com/company/humanity-ledger)
**Reference commit named for this package:** `6bec13b9` (public state reviewed 15–16 November 2026).
**Status:** Live on Aztec Alpha (Ethereum mainnet, L1 chain 1) since the first private payment on 14 November 2026 (L2 block 29012). No external audit. Not affiliated with the Aztec Foundation.
**Engineering plan and full state table:** [`docs/zk/MASTER_PROMPT.md`](zk/MASTER_PROMPT.md) (Spanish)

This dossier is for human review before any external send.

---

## 0. State on 16 November 2026

Humanity Ledger (Ledger Chat) is a messaging application with private payments on Aztec. Direct messages use XMTP v3, which uses MLS (RFC 9420). We do not implement MLS. Private execution stays in the browser PXE. Private state is Aztec notes in the note hash tree. Nullifiers are Aztec's. Authwit nonce is 0. Private balances are not stored in public storage.

### Alpha, first payment, fees

| Fact | Record |
|---|---|
| Network | Aztec Alpha, L1 chain 1. Client build requires `NEXT_PUBLIC_AZTEC_NETWORK=alpha` and `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true` |
| HLC | `0x1f49571a48699da4e70e1b7dbc5afcea5bb712f7b2cfaf432353e694851e24e5`, deployed L2 block 28992. The earlier HLC `0x2cd0f377…e55d` is do-not-use |
| First private payment from Ledger Chat | 14 November 2026. Transfer `0x1eb2bb76ae52d876e0ef8e107bf9de5b83ce9cb42850a1a1a938cae3c24040a5`, L2 block 29012, 0.10 HLC. Preflight run 43583640304. Sender and recipient were both operator accounts |
| Later the same day | 0.9 HLC in block 29771; a new-account path in blocks 29921 and 29923. Still operator accounts |
| What is public | The fee payer and the fee. Sender, recipient and amount of the private transfer are not visible |
| Fees since 15 November 2026 | Each account pays its own Fee Juice (the user bridges it, or a contact bridges it through `/fees`). Ledger Chat sponsors nothing. `/api/aztec/sponsor` answers 410. The protocol fee is in the PrivateEscrow and PaymentStream source. Since 18 November 2026 the source runs it with a zero schedule for the closed alpha (no protocol fee, OD-7) and a maximum of 100 HLC per agreement (OD-2). The current classes, not deployed, are the entries with `tracksCurrentArtifact: true` in `deployments/aztec-testnet.json` (this file no longer repeats their ids). The treasury in the source is `0x177395a38df8c95a572d3e7591240312b2fddbaf14d294d9e1443f3b0d55faed`, designated by the operator on 17 November 2026 (created on Aztec Alpha, L2 block 33001). It is not the 4-of-7 multisig, and with no fee it receives nothing. There is no external audit. Two LedgerSponsor instances exist on Alpha and nothing in the app calls them (`docs/MAINNET_READINESS.md`) |

### Agreements, L1, communities

- Escrow, payment stream and identity (aztec-nr v6) are on testnet, keyed instances, not on Alpha. Caps apply to payments. No external audit.
- L1 `HumanityTimeLockVault` and `LedgerDeadmanSwitch`: local tests only, deployed on no network, not externally audited. HumanityIdentityRegistry and StudioProvenance were retired on 18 November 2026 (B-3). The TimeLockVault adversarial file passed 9/9 locally on 15 November 2026 (`docs/UPGRADE_LOG.md`, session 4). That run is not an audit.
- Communities: posts are still readable by our server. Prisma has `communityMls` (default `false`) and `CommunityChannel.xmtpGroupId`. When `communityMls` is true, the post routes answer 410 and do not write the post. Existing communities stay `false`. The client does not yet create the XMTP group when a channel is added (doubt below). R-17 acceptance AC-03 (expelled member) is not done. `CLM-MSG-COMMUNITY` stays aspirational.

### Q1–Q10 — all OPEN

Provisional positions are in [`docs/AZTEC_DECISIONS.md`](AZTEC_DECISIONS.md). None has an Aztec reply. Each interim line is: keep the pattern already in the code (Path A: notes and Aztec nullifiers, noir-contracts v6 examples) until Aztec Labs answers or a new decision is written down. The recommended posture for each question is the last section of that file (16 November 2026). It does not close the question and it is not a confirmation by Stefan.

| ID | Question, short | Interim position (not a decision by Aztec) | Status |
|---|---|---|---|
| Q1 | Shared settlement nullifier for claim before the deadline and refund after it | Keep it, including the deposit nullifier | OPEN |
| Q2 | Keyed deployment for a contract that holds a private balance | Keep keyed instances. Trust on first use for the peer address (G7) | OPEN |
| Q3 | Raw `transfer_in_private` selector versus the Token interface | Keep the raw selector. The Token crate duplicates `aztec` on this toolchain | OPEN |
| Q4 | Stream cancel shares a per-state nullifier with withdraw | Keep it. No `delayed_public_mutable` | OPEN |
| Q5 | Bound a time-dependent private value | 600 s cancel window. Known limit | OPEN |
| Q6 | 25 % gas padding | Keep the heuristic. No Aztec margin is published | OPEN |
| Q7 | Sponsored FPC on Alpha | Alpha is Fee Juice only. Product decision of 15 November 2026 removed sponsorship (410). Whether Aztec will offer a sponsored payer later is unanswered | OPEN |
| Q8 | Private fee payment on Alpha | Fees are public. The UI says so. No private fee method is used | OPEN |
| Q9 | Prove control of the peer's nullifier key, not only the signing key | Signed announcement, trust on first use. Not a proof of the nullifier secret key | OPEN |
| Q10 | Note discovery for a recipient who was offline | Standard PXE sync only. No extra tagging | OPEN |

### Fee contract — Phase 0 only

[`docs/protocol/FEE_CONTRACT_SPEC.md`](protocol/FEE_CONTRACT_SPEC.md) is the specification. On 16 November 2026 Stefan authorized sections 6 and 8 as the baseline: fee on settlement in the agreement’s private token, no in-circuit buyback or oracle, 100% of the fee to a treasury address that does not exist yet, the D5 constants as written, no owner or pause on the Aztec class. That baseline is in the `PrivateEscrow` and `PaymentStream` source. Aztec 6.0.0 compiled it. TXE from inside each crate: escrow 19 passed, streams 29 passed. (Superseded, 18 November 2026: those classes, `0x1770…` and `0x2c22…`, were compiled with a zero treasury and are history in `deployments/aztec-testnet.json`. The source then carried the designated treasury from 17 November. Since 18 November it runs the closed-alpha zero schedule; D-1 to D-5 are the base for after the alpha, option A.) Nothing was deployed. A documentary skeleton remains [`docs/protocol/fee-router-skeleton/`](protocol/fee-router-skeleton/README.md). Launch condition 1 of `docs/TOKENOMICS.md` is unmet. There is no external audit. Q1–Q10 stay OPEN. R8 has not been run. `communityMls` stays false.

### Fee Contract — Alpha readiness (16 November 2026; status of 18 November in `docs/alpha/OPERATOR_DECISIONS.md`)

The fee baseline is in the source. It is not deployable on Alpha.

| Fact | Record |
|---|---|
| Source | `PrivateEscrow` and `PaymentStream` charge the authorized baseline on settlement. Aztec 6.0.0 compiled that source |
| TXE | `aztec test` inside each crate, 16 November 2026 with the zero placeholder, and again on 17 November 2026 with the designated treasury ("Aztec contracts" run 44061471400): PrivateEscrow 19 passed, PaymentStream 29 passed, IdentityCredential 20 passed |
| Class ids | The current ones are the entries of `deployments/aztec-testnet.json` with `tracksCurrentArtifact: true`, `status: not-deployed` and `address: null`, computed with `getContractClassFromArtifact` from the committed artifacts. On 17 November those were PrivateEscrow `0x2ade…04c6` and PaymentStream `0x0251…777b` (run 44063139479). PaymentStream became `0x07e2…cca7` on 18 November (IA-01, run 44199682089), and both change again with the closed-alpha classes (18 November). The zero-treasury classes `0x177021740d92d13f78e3f96a5bd3447eeb268cb6e9073e88832d14856b66e0ee` and `0x2c22f32674231c50fe77c970d5f604f9a5bd60f9dd800bd575c1f6f89eba1ae3` stay in the record with `tracksCurrentArtifact: false`; the client refuses them |
| TREASURY | Current classes and source since 17 November 2026: `0x177395a38df8c95a572d3e7591240312b2fddbaf14d294d9e1443f3b0d55faed`, designated by Stefan Antonio Cirisanu, created on Aztec Alpha in L2 block 33001, Fee Juice bridged from `0x1Ba9c5cC429Ac7B8742F58c0215D6D58c009f675`. It is not the 4-of-7 multisig. Nothing is held in `deployments/aztec-pending-recompile.json` |
| External audit | None. `audit` is `null` in `deployments/aztec-mainnet.json`; the HLC token model and its launch conditions were withdrawn on 19/11/2026 (PA-1) |
| Alpha | Not deployable until both blockers below are resolved. Nothing in this section was sent on Alpha |

Two blockers, both open:

1. TREASURY: designated on 17 November 2026, written into the source, compiled and TXE-tested; the current class ids carry it. The designated account is not the 4-of-7 multisig, and whether the treasury must be the multisig before Alpha is Stefan's decision.
2. No external audit. Launch condition 1 is unmet.

State: not deployable on Alpha until both are resolved.

#### Recommendations pending acceptance by Stefan Antonio Cirisanu

These are recommendations aligned with Aztec Labs Path A. They are not decisions. Stefan has not accepted them.

| Topic | Recommendation | Status |
|---|---|---|
| TREASURY | An Aztec account controlled by the 4-of-7 treasury multisig in launch condition 3 of `docs/TOKENOMICS.md`. Do not deploy until that account exists. Do not invent an address. Do not use the zero placeholder as a treasury | Pending acceptance by Stefan Antonio Cirisanu |
| External audit | Meet launch condition 1 before any deploy of this fee class on Alpha. Do not skip the external audit | Pending acceptance by Stefan Antonio Cirisanu |
| Q1–Q10 | Leave them OPEN until Aztec Labs answers or Stefan writes an explicit decision. Do not close them unilaterally | Pending acceptance by Stefan Antonio Cirisanu |
| R8 | When Stefan authorizes it, run Annex B with two accounts that are not the same operator account. Do that before treating the Alpha flow as fully validated | Pending acceptance by Stefan Antonio Cirisanu |
| `communityMls` | Keep it `false` until the settings panel holds an XMTP client and `docs/communities/R17_ACCEPTANCE.md` is met. Do not turn it on before that | Pending acceptance by Stefan Antonio Cirisanu |

### Decision package for Stefan Antonio Cirisanu — 16 November 2026

Stefan Antonio Cirisanu confirms or rejects each row. Nothing in this package is a decision already taken. No external audit exists. No Alpha transaction is included. `communityMls` stays false.

Note, 17 November 2026: Stefan designated `0x177395a38df8c95a572d3e7591240312b2fddbaf14d294d9e1443f3b0d55faed` as the treasury and it is written into the source. Row 1 asks for the 4-of-7 multisig; that account is not it, so row 1 is not marked accepted.

| # | Point | Action required of Stefan Antonio Cirisanu | Current state |
|---|---|---|---|
| 1 | TREASURY address | Provide the Aztec address of the 4-of-7 multisig. Until that address exists, the contract is not deployed | Designated address `0x1773…faed` in the source since 17 Nov (not the multisig). Since 18 Nov the alpha charges no fee (OD-7), so it receives nothing; D-4 is decided again before any fee |
| 2 | External audit (launch condition 1) | Authorize and complete an external audit before any deploy on Alpha | Not met. On 18 Nov 2026 Stefan authorized in writing a closed alpha without external audit (OD-10): escrow and streams, HLC only, at most 20 testers and 100 HLC per agreement. The portal waits for an external review |
| 3 | Q1–Q10 | Confirm that they stay OPEN, or mark a specific posture as definitive | OPEN |
| 4 | R8 execution | Authorize execution of the Annex B procedure with two distinct accounts, neither of them the operator account | Documented, not executed |
| 5 | `communityMls` | Authorize activation only once the checklist in `docs/communities/R17_ACCEPTANCE.md` is met and a test community is named | `false` |
| 6 | Fee Contract deploy on Alpha | Confirm explicitly that deploy may proceed once the TREASURY address exists and the external audit is complete | Blocked |

### Gaps (do not claim these are closed)

| Gap | State |
|---|---|
| External audit | Not started |
| R8 | Payments on Alpha have been between operator accounts only. A two-person browser run is open. The procedure is Annex B. It has not been run. No hash is recorded here |
| Agreements on Alpha | Off. The fee classes are recorded and not deployed. No Alpha agreement. No external audit |
| Communities | Server-readable until R-17 is finished, including deletion of old post rows after an export. Not done |
| Legal copy | Some public and legal pages still say the wallet is test-network only (R2). Agents do not edit that text |
| Mobile sign-in | See below. Not a protocol gap |

### Mobile sign-in (Safari and Chrome)

On an external phone browser the native MetaMask app can open and still not return a WalletConnect signature. `/connect` detects that browser (mobile user agent, no injected `window.ethereum`). It shows **Open in MetaMask**, a link the person taps:

`https://link.metamask.io/dapp/ledgerchat.org`

That opens Ledger Chat inside MetaMask. The same SIWE path runs there (`/api/siwe/nonce`, personal sign, `/api/siwe/verify`). Nothing assigns that URL by itself. WalletConnect stays available on the page. If the signature fails, the failure screen repeats the link and says to sign inside MetaMask, or to try WalletConnect again. Wallet in-app browsers do not show the link. Aztec proving and contracts are not part of this path.

### What still needs Stefan

The fee baseline in spec sections 6 and 8 is authorized. The items below are still open. This session does not close them.

1. Send this dossier, or not. It was not sent.
2. Q1–Q10 stay OPEN. The recommended postures stay as written until Aztec Labs replies or Stefan marks one definitive.
3. Decide when a community may set `communityMls`. The checklist is in `docs/communities/R17_ACCEPTANCE.md`. The settings screen does not hold an XMTP client and does not call `createSecureGroup`. Every community stays `false`.
4. R8: two Ethereum accounts that are not the operator, then the run in Annex B. This file has no hash for that run. It stays unexecuted.
5. External audit before any claim of audited contracts, and before a fee contract is deployed on Alpha. The authorized baseline is not that audit.
6. R2 legal wording, with counsel. It stays pending. Agents do not edit that text.
7. `lib/aztec/` stays unedited. Measuring prover memory was not authorized in this session.
8. A treasury Aztec address, controlled by the 4-of-7, before any deploy. None is written here. The contract constant is zero. Deploy scripts and the agreement composer refuse to deploy while it stays zero.

### Annex A — How to read this file, and what was checked (16 November 2026)

Section 0 is the state. Sections 1–7 are the 4 November review and stay as history. [`docs/STATUS.md`](STATUS.md), [`docs/MAINNET_READINESS.md`](MAINNET_READINESS.md) and [`docs/CONNECT.md`](CONNECT.md) were not edited when the fee baseline was authorized. They still describe Alpha with a cap, the first payment in block 29012, no sponsorship (410), no fee contract in production, Q1–Q10 OPEN, `communityMls` default false, and R8 open. In `STATUS.md`, “Not claimed: mainnet readiness” means an unqualified claim. It does not withdraw the capped Alpha payments in that file’s header. The fee parameters in spec sections 6 and 8 are an authorized baseline as of 16 November 2026. They are not a deployed contract and not an audit.

No row below is an Aztec decision. There is no transaction here between two people who are not the operator.

| Change | File | Evidence |
|---|---|---|
| Alpha record, first payment, fees, Q1–Q10 OPEN, gaps | This file, section 0 | The payment hash is the one in `deployments/aztec-mainnet.json` (`firstPrivatePayment`) and preflight run 43583640304. Not re-executed in this session |
| Sponsorship removed | `/api/aztec/sponsor` answers 410 | `test/unit/aztec/no-sponsorship.test.ts` (“the old endpoint answers 410”) |
| L1 TimeLockVault adversarial file | `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` | Local Hardhat run recorded in `docs/UPGRADE_LOG.md` session 4: 9 passing. Not an external audit. Not redeployed |
| MetaMask link on an external phone browser | `components/connect/ConnectView.tsx`, `lib/wallet/mobileWallet.ts` | `test/unit/auth/connect-wallet-only.test.ts` (the URL is a tap; `location` is not assigned). Not measured on a phone |
| R-17 gate, flag still false | Post routes; `lib/xmtp/groupId.ts` | `test/communities/r17-acceptance.test.ts`: 410 and no `communityPost.create` when the flag is true; 200 when it is false. AC-03 stays skipped |
| Swipe reveals actions and does not run them | `components/chat/SwipeableConversationRow.tsx` | `test/unit/chat/session8-guards.test.ts` (source check: no automatic archive or pin) |
| Studio closed | `app/studio/page.tsx`, `middleware.ts` | Same file: the page does not import the studio; `/api/studio/` returns `STUDIO_LOCKED` |
| Payment card: failed step and Fee Juice text | `components/zk/PaymentProgress.tsx` | Same file: `feeJuiceGuidance` for an insufficient-fee error. Not a live payment |
| Settings copy (HLC, Fee Juice, local handle, TURN not assumed) | `components/chat/LedgerSettingsFull.tsx` | Reading the strings. No separate test |
| Fee baseline compiled, class ids recorded, not deployed | `contracts/aztec/escrow`, `contracts/aztec/streams`, `deployments/aztec-testnet.json` | TXE 17 November 2026 with the designated treasury: escrow 19 passed, streams 29 passed. Classes then `0x2ade…04c6` and `0x0251…777b`; current since 18 Nov 2026 (closed alpha, no fee, at most 100 HLC): `0x165090de7e22e636ed3c392069f26895eca9600c5355d5766265b84d59c6f143` and `0x0f2ba459de8636b73e86365de0d9a8d775b3b82bc47f39333dd17deeef6fc1e3`, status `not-deployed`, address null. Not an audit |
| R-17 stays off | `test/communities/r17-acceptance.test.ts` guard; `docs/communities/R17_ACCEPTANCE.md` checklist | The guard fails if `app/`, `components/` or `lib/` writes `communityMls` true. Schema default remains false |

Commands that reproduce the rows which are unit tests:

```bash
npx vitest run test/unit/aztec/no-sponsorship.test.ts test/communities/r17-acceptance.test.ts test/unit/auth/connect-wallet-only.test.ts test/unit/chat/session8-guards.test.ts
```

### Annex B — Procedure for R8 (not run)

This is the procedure for one private HLC payment on Aztec Alpha between two people who are not the operator. It was not executed. It contains no transaction hash and no L2 block for R8. Writing those in later does not close Q1–Q10 and does not confirm D-1–D-5.

The known operator account, which must not be either party, is `0x1Ba9c5cC429Ac7B8742F58c0215D6D58c009f675` (`docs/MAINNET_READINESS.md`, R1). Payments already recorded there (blocks 29012, 29771, 29921, 29923) are operator-to-operator and do not count.

#### 1. Preconditions

1. Two Ethereum accounts, A and B. Different keys. Neither is the operator account above. Each person controls only their own recovery phrase.
2. Two separate browsers or devices. Not two tabs of one profile: the private wallet store is per browser. A desktop profile and a phone, or two browser profiles, are enough.
3. Production Ledger Chat built for Alpha: `NEXT_PUBLIC_AZTEC_NETWORK=alpha` and `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true`. The screen says Aztec Alpha. If it says the test network, stop.
4. Each account holds enough AZTEC on Ethereum mainnet to bridge Fee Juice. The wallet shows the minimum from the node before the first account deployment. Bridge at least that amount. A later private send is paid from the Fee Juice already on the Aztec account. The recipient needs their own Fee Juice to deploy their account and open the wallet. Ledger Chat does not sponsor this. `/api/aztec/sponsor` answers 410.
5. HLC on Alpha is `0x1f49571a48699da4e70e1b7dbc5afcea5bb712f7b2cfaf432353e694851e24e5`. Do not use the retired token `0x2cd0f377…e55d`. The sender needs a private HLC balance. The operator may issue a small amount to A’s Aztec address first. Archive that issuance hash on its own line. It is not the R8 payment, even if it is included in a block. The recorded Alpha per-payment cap for HLC is 1000 HLC (`docs/MAINNET_READINESS.md`). Send 0.01 HLC. If the wallet refuses the amount, stop and write down the refusal. Do not raise the cap for this run.
6. Agreements (escrow, streams) stay off. This run is a direct private transfer only.

#### 2. Per account: SIWE, Aztec account, wallet, address

Do this once for A and once for B. Do not export a key or copy a seed.

1. Open `/connect` in that browser. Sign in with SIWE (`/api/siwe/nonce`, personal sign, `/api/siwe/verify`). The session address must be the Ethereum address that just signed.
2. Open the private wallet. The Aztec account is derived on the device from the wallet signature. It is not the Ethereum address. Alpha uses a different EIP-712 message from testnet, so this Aztec account is not the testnet one.
3. If the panel says Fee Juice is missing: Add funds, bridge the minimum AZTEC from that person’s own Ethereum wallet through the pinned Fee Juice portal, wait until the deposit shows ready, then open the wallet again. Account deployment claims that deposit in the same transaction. Copy that deployment hash from the activity list. It is not the R8 payment.
4. Copy **Your Aztec address** from the wallet panel. It is the 0x-prefixed field the panel labels as the Aztec address, not the Ethereum address used for SIWE.

#### 3. Exchange the Aztec addresses

On Alpha a private payment is sent only to an address the client has verified (G7). Pasting an address in a side channel is not enough for the send button.

1. A and B open a direct XMTP conversation with each other (the Ethereum identities they just used for SIWE).
2. Each shares their Aztec address in that conversation with the signed v2 announcement the wallet sends. Wait until the other person’s card says verified.
3. Optional check, outside the chat: read the address aloud or on a second channel and compare it to the card. If a second address appears, the product keeps the first pin and warns. Do not send until the card for the address you intend says verified.
4. If the send control stays disabled, stop. Forcing a payment around that check is out of this procedure.

#### 4. Build and send the private HLC payment

A pays B. B does not need to send a transaction for the payment itself.

1. In the direct conversation, or in the private wallet’s send form, choose HLC, amount 0.01, recipient = B’s verified Aztec address.
2. The fee is Fee Juice from A’s Aztec account. It is public: the fee payer and the fee amount are visible. The HLC amount and the two parties are not.
3. The proof is made on A’s device (PXE, UltraHonk). Leave the tab open until the payment card leaves “Making the proof on this device”.
4. Submit once. If it fails before a hash exists, use the failure rules below. Do not send a second payment “in case”.

#### 5. After inclusion

1. On A’s activity list, wait until the payment is settled, not pending. Copy the transaction hash and the L2 block number from that row. The hash is `0x` plus 64 hex characters. The block is the L2 block, not an Ethereum block. Open the same hash in the Aztec explorer and check that the two strings match character for character. Do not type the hash from memory.
2. On that explorer transaction, confirm the body has note hashes, nullifiers, and a public fee payment. Do not expect the explorer to show 0.01 HLC, A’s Aztec address, or B’s Aztec address as the private parties. A nullifier is not an identity; record that nullifiers are present, and copy a nullifier only if the explorer shows it as part of this transaction.
3. On B’s device, open the private wallet and sync. B’s private HLC balance increases by 0.01. That balance is read from B’s notes on that device. A screenshot of B’s balance is part of the evidence. The explorer will not show it.
4. If A is settled and B does not see the note, leave the wallet open and sync again before treating the payment as failed. Note discovery is the standard PXE sync (Q10 is still OPEN). Do not send the 0.01 again while the first transaction is pending or already settled.

#### 6. What to archive

When a run actually happens, add one record. Do not invent it in advance.

| Field | Where it comes from |
|---|---|
| Date, browsers, devices | The two people |
| Ethereum address of A and of B | SIWE session. Neither equals the operator address in section 1 |
| Aztec address of A and of B | Wallet panel, after the G7 card says verified |
| Account-deployment hashes, if this session created the accounts | Activity list |
| R8 transaction hash and L2 block | A’s settled activity row, same hash on the explorer |
| Nullifiers | “Present” on that explorer transaction, plus the value only if it is shown there |
| Recipient | Note that B’s wallet showed +0.01 HLC after sync, with a screenshot |
| Preflight | Optional. A later read-only “Aztec mainnet preflight” run id, if one has read this hash. This annex does not name a run |

Suggested place to write that record later: `deployments/aztec-mainnet.json` under a new key `r8TwoPartyPayment`, and a short paragraph in `docs/MAINNET_READINESS.md` next to R8. Until that record exists, R8 stays open and this annex stays “not run”.

Leave this table empty until that run. Do not fill it from the operator payments in blocks 29012, 29771, 29921 or 29923.

| Field | Value |
|---|---|
| Date, browsers, devices | |
| Ethereum address of A | |
| Ethereum address of B | |
| Aztec address of A | |
| Aztec address of B | |
| HLC issuance hash, if any (not R8) | |
| Account-deployment hashes | |
| R8 transaction hash | |
| L2 block | |
| Nullifiers | |
| B’s balance after sync | |
| Read-only preflight run id, if any | |

#### 7. Success and failure

Success, all of these:

- A and B are two Ethereum accounts, neither the operator.
- Both Aztec addresses were verified in the DM before the send.
- One private transfer of 0.01 HLC is settled in an L2 block. Hash and block are written down from the chain, not from memory.
- The explorer shows note hashes, nullifiers, and a public fee. It does not show the amount or the parties.
- B’s own wallet shows the 0.01 HLC after sync.

Failure, stop and record the reason. Do not retry blindly:

| What happened | What it means |
|---|---|
| “Insufficient fee” or the Fee Juice card tells A to add funds | A’s account cannot cover the fee. Bridge more Fee Juice. Nothing private was sent if there is no transaction hash |
| The payment card stops on “Making the proof on this device”, or the tab reloads | The device ran out of memory during the local proof (about 1.8 GB). Nothing is sent. Use a computer. This is not an on-chain failure |
| Send stays disabled, or the peer is not verified | G7 did not pass. No proof should be started |
| A hash exists and the row stays pending | Wait. Do not send again until the wallet says to check before sending again |
| Settled on A, B’s balance unchanged after a full sync | Record the hash and block. Do not send a second payment. This is the open note-discovery case (Q10), not a second transfer |
| The two Ethereum addresses are the operator, or they are the same account | The payment can be real and still does not close R8 |
| The screen is not Alpha, or the token is not the HLC address in section 1 | Stop. Wrong network or retired token |

### Annex C — Automated test results, 16 November 2026

Internal suite only. This is not an external audit. Nothing here confirms D-1–D-5, closes R8, or activates `communityMls`. No payment was sent on Alpha. The first table is the run from about 11:30. The two files that failed to load were fixed later the same day. The counts to use are in “Re-run after the 16 November proposals”, below.

Run on this machine, 16 November 2026, about 11:30 local. `npm run test:run` is `vitest run` (`package.json`). Live Aztec checks stay inside that command and skip unless `AZTEC_MAINNET_PREFLIGHT=1` or `AZTEC_VERIFY_DEPLOYMENTS=1`. Those variables were not set.

| Suite | Command | Result |
|---|---|---|
| Unit and integration (Vitest) | `npx vitest run --reporter=dot` | Exit 1. Files: 177 passed, 2 failed, 3 skipped (182). Tests: 2095 passed, 47 skipped, 1 todo (2143). The two failed files did not run a single assertion |
| Same file under Hardhat, not under Vitest | `npx hardhat test test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts --network hardhat` | Exit 0. 9 passing (7s) |
| L1 Hardhat script | `npm run test:contracts` | Exit 0. 59 passing (8s). Files: `test/contracts_invariants.test.ts`, `test/HumanTimeLock.test.ts`, `test/LedgerDeadmanSwitch.test.ts`, `test/ZKIdentityRegistry.test.ts`, `test/ZKVerificationKeyRegistry.test.ts` |
| R-17 acceptance | Included in the Vitest command above (`test/communities/r17-acceptance.test.ts`) | Not one of the two failed files. The cases that set `communityMls` do it on a mock. The schema default was not changed |

The two Vitest failures, one line each:

- `test/unit/aztec/fee-router.adversarial.test.ts` — the file calls Mocha’s `this.timeout` and Vitest has no such function, so the suite does not load. It is a Fee Contract phase-0 adversarial file, not a deployed contract.
- `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` — same load error under Vitest. The same file passes under Hardhat (row above).

Not run, and why:

| Item | Why |
|---|---|
| `nargo test` on the standalone circuits | `nargo` is not installed on this machine |
| `aztec test` (TXE) in `contracts/aztec/` | The Aztec CLI is present. The command writes compiler output inside `contracts/aztec/`, which this session does not modify |
| `npm run test:aztec:e2e` | Needs a live node and the testnet configuration. Not run. No Alpha payment |
| `npm run test:5h` | Multi-hour endurance script. Not this pass |
| R8 procedure (Annex B) | Not executed. No new hash |
| External audit | Does not exist. These numbers are not one |

### Re-run after the 16 November proposals

Same day, after the fee proposals, the R-17 guard, and the Annex B record table. No Alpha payment. The fee-router cases stay skipped because the contract does not exist. This is not an external audit and it does not confirm D1–D7 or D-1–D-5.

| Suite | Command | Result |
|---|---|---|
| Vitest, the two files that previously failed to load, plus the R-17 file | `npx vitest run test/unit/aztec/fee-router.adversarial.test.ts test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts test/communities/r17-acceptance.test.ts --reporter=verbose` | Exit 0. Files: 2 passed, 1 skipped (3). Tests: 17 passed, 14 skipped (31). Vault: 9 passed. R-17 guard passed. AC-03 still skipped (2). Fee router: the file loads and its 12 cases stay skipped |
| Hardhat, same vault file | `npx hardhat test test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts --network hardhat` | Exit 0. 9 passing |
| L1 Hardhat script | `npm run test:contracts` | Exit 0. 59 passing |

### Re-run after the fee baseline was authorized

Same day. No production contract was added. No Alpha payment. Not an external audit.

| Suite | Command | Result |
|---|---|---|
| Vitest, vault adversarial, fee-router file, R-17 | `npx vitest run test/unit/aztec/fee-router.adversarial.test.ts test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts test/communities/r17-acceptance.test.ts --reporter=dot` | Exit 0. Files: 2 passed, 1 skipped (3). Tests: 17 passed, 14 skipped (31). Fee-router cases stay skipped. R-17 guard passed |
| Hardhat, vault adversarial | `npx hardhat test test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts --network hardhat` | Exit 0. 9 passing |
| L1 Hardhat script | `npm run test:contracts` | Exit 0. 59 passing |

## Estado de completitud — 16 noviembre 2026

Nothing in this file is an external audit. The fee is in the escrow and stream source. TXE on 17 November 2026 passed with the designated treasury: PrivateEscrow 19, PaymentStream 29. The current class ids, not deployed, are the closed-alpha ones of 18 November 2026: PrivateEscrow `0x165090de7e22e636ed3c392069f26895eca9600c5355d5766265b84d59c6f143`, PaymentStream `0x0f2ba459de8636b73e86365de0d9a8d775b3b82bc47f39333dd17deeef6fc1e3` (no protocol fee, at most 100 HLC). Sections 6 and 8 are the fee base for after the alpha (option A). Q1–Q10 stay OPEN. R8 has no hash. `communityMls` stays false. TREASURY is the designated address above, not the 4-of-7.

| Bucket | What |
|---|---|
| Shown by tests | Vitest on 16 November 2026, full suite: 2095 passed, 47 skipped, 1 todo, and 2 files that did not load (`this.timeout`). After the load fix, same day: `HumanityTimeLockVault.adversarial.test.ts` 9 passed under Vitest; `fee-router.adversarial.test.ts` loads and its 12 cases stay skipped (no contract). Earlier the same day, Hardhat adversarial 9 passing and `npm run test:contracts` 59 passing. The later re-run of those suites is the last table in Annex C |
| Written, compiled, not deployed | Fee source in `contracts/aztec/escrow` and `contracts/aztec/streams`. TXE: 19 and 29 passed. Current class ids recorded in `deployments/aztec-testnet.json` with `address: null`. TREASURY is still the zero placeholder. No external audit. `docs/protocol/fee-router-skeleton/` is not bytecode |
| Documented, not run | Annex B (R8), including the empty record table. No hash, no block, no second identity |
| Blocked on Stefan | Send the dossier or not. Q1–Q10 stay OPEN. R8 stays unexecuted. `communityMls` stays false. R2 stays with counsel. `lib/aztec/` stays unedited. A treasury address still does not exist. An external audit still does not exist |
| Blocked by protected files | Prover memory (~1.8 GB) lives in `lib/aztec/`. It was not measured and not changed. `lib/aztec/`, `LedgerChatV2.tsx`, `package.json` and the lockfiles were not changed when the fee source was written. `openEscrow` in `lib/aztec/agreements.ts` was not rewired |
| Still OPEN | Q1–Q10. No Aztec reply. The recommended postures are not Aztec decisions |

With `communityMls` false, post routes store the post. The 410 path runs only when the flag is true. Existing communities stay on the old path. The guard now fails if application code writes the flag true. There is no exception for a settings panel that mentions `createSecureGroup`.

### Checklist before `communityMls = true`

The full list is `docs/communities/R17_ACCEPTANCE.md`. All of the following have to be true first. None of them is true today except the schema default and the 410 behaviour on a mocked flag.

1. The screen that adds a channel (since 17 November 2026, Manage → Channels in `components/communities/CommunityManage.tsx`; the old `CommunitySettingsPanel` is deleted) holds an XMTP client and calls `createSecureGroup` when a channel is created. It does not do either.
2. The server stores only the returned group id on `CommunityChannel.xmtpGroupId`. It does not store the post.
3. AC-01: a database dump of a flagged community contains no post text.
4. AC-02: `POST` of a post to a flagged community returns 410. The route does this when the flag is already true. Nothing sets the flag.
5. Expulsion calls `removeGroupMember`, and AC-03 is recorded with two real accounts.
6. No migration and no update sets existing rows to true. The schema default stays false.
7. Stefan names one test community. Other communities stay false.
8. The guard test is updated in the same change that writes the flag, and only that community is allowed.

## Preparación para análisis de seguridad

Perimeter only. This section does not exploit anything. It is the boundary an analyst can treat as in scope without waiting for Stefan, and the boundary that is not built yet.

In scope today:

- The web app: `/`, `/connect`, `/chat`, `/studio` (lock page, studio not loaded).
- HTTP APIs under `app/api/`, including SIWE, communities, and `/api/studio/*` which answers 410.
- Wallet connection: SIWE in the browser, WalletConnect, and the explicit MetaMask dapp link. Signing stays in the wallet. Aztec keys are derived on the device.
- The PXE and UltraHonk prover run in the user’s browser. Private notes and keys are not a server balance.
- Community posts while `communityMls` is false: the server stores the text. That is the current behaviour, not a migrated community.
- The L1 contracts under test only: `HumanityTimeLockVault`, `LedgerDeadmanSwitch` and the verification-key registry (the identity registry was retired on 18 November 2026). They are not deployed from this proposal. Local adversarial tests are listed below.
- Alpha payments that already exist (operator accounts, blocks 29012, 29771, 29921, 29923): public fee, private note hashes and nullifiers. They are not an R8 run.

Not in the tree, so there is no deployed surface to attack:

- A deployed fee contract. The source charges on settlement and has no buyback, oracle, pause, or daily cap. The class ids are recorded and not deployed. TREASURY is the zero placeholder. Launch condition 1 is unmet. There is no external audit.
- Escrow and streams on Alpha.
- Any community with `communityMls` true.
- A private fee-paying contract. Alpha fees are public Fee Juice.

Adversarial tests already in the tree (internal, not an audit):

- `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` — see Annex C for the latest pass count.
- `npm run test:contracts` — vault invariants, dead-man switch, identity registry, VK registry.
- `test/unit/aztec/fee-router.adversarial.test.ts` — specification only, every case `it.skip`, contract does not exist. Its comments describe the old sketch, not section 8.
- Vitest also holds other adversarial files (EAF isolation, key custody, property fuzz). They are part of the 16 November full Vitest run, not a new audit.

Known gaps an analyst should treat as open, not as closed holes we have exploited:

- No external audit.
- R8 has not been run, so a two-person Alpha payment is not evidence yet.
- Q1–Q10 are design questions, not findings. Recommended postures are not answers from Aztec.
- Fee Juice and the fee payer are public on Alpha.
- Community post text is readable by the server while the flag is false.
- TURN for calls may be unset (`docs/MAINNET_READINESS.md` R3).
- Prover memory on a phone is unmeasured.
- The fee baseline is authorized, compiled with the designated treasury, and not deployed. TXE passed (escrow 19, streams 29). That run is not an external audit.

### Still waiting on Stefan before the next phase

| Item | State on 16 November 2026 | What stays blocked |
|---|---|---|
| Fee baseline (spec sections 6 and 8) | Authorized. Source compiled. TXE 19 and 29 passed. Class ids recorded, not deployed. TREASURY is zero. No external audit | Deploy, until a treasury address exists and an external audit is recorded |
| Q1–Q10 | OPEN. Recommended postures unchanged | A contract rewrite that would answer one of them |
| This dossier | Not sent | An external send |
| R8 | Not executed. Annex B table empty | Any hash for a two-person payment |
| `communityMls` | False. Checklist not met. No test community named | Setting the flag |
| R2 | Pending counsel | Edits to the legal pages |
| Prover RAM | `lib/aztec/` not authorized for edit | Measurement and any change there |

---

## 1. Summary

> **Superseded where it conflicts with section 0.** Aztec Alpha does not use a sponsored fee-paying contract. Each account pays its own Fee Juice. There is no fee contract in production. The SponsoredFPC sentence below describes the testnet-era write-up of 4 November 2026.

Humanity Ledger is a messaging application (Ledger Chat). Direct messages go over XMTP v3, which uses MLS (RFC 9420); we do not implement MLS ourselves. Private payments use an Aztec PXE in the browser with the standard `Token` contract (our test tokens zkUSDC, zkDAI and zkETH, which have no value) and `SponsoredFPC` on Aztec testnet. Private transfers hide the amount and the parties; shielding and unshielding are public steps.

For escrow, payment streams and identity we wrote three aztec-nr v6 contracts (section 2.1). They compile with Aztec 6.0.0 and pass 55 TXE tests in CI. On 4 November 2026 one instance of each was deployed on Aztec testnet (`docs/AZTEC_TESTNET_DEPLOYMENTS.md`); those first escrow and stream instances were deployed without public keys and must not receive deposits; keyed instances of the current classes have since run end to end there (section 2.1). We would value a review of their design (section 5).

We first wrote three standalone Noir circuits for the same purposes. A review on 3 November 2026 found soundness issues in all three (section 4). They remain in the repository as tested reference code; nothing relies on them.

An earlier version of this dossier pointed to commit `783df711` and described the circuits as production circuits; they did not compile then. That description was wrong.

---

## 2. What can be verified today

| Component | State | How to check |
|---|---|---|
| Browser wallet: shield, private send, unshield (`lib/aztec/wallet/`) | Real on Aztec testnet | `npm run test:aztec:e2e`. It needs our testnet token and faucet addresses, which are not yet published in the repository (task R-15) |
| Circuits compile and their tests pass | Real, nargo 1.0.0 | `cd circuits/escrow && nargo test` (same for identity, streams) |
| Committed artifacts are the compiled ones and the VKs are pinned | Real | `node scripts/zk/check-artifacts.mjs` |
| UltraHonk proving and verification with the pinned VK | Real in tests only (Node) | `npx vitest run test/unit/aztec/circuit-proving.test.ts test/zk/` |
| ZK-01 reproduction (streams double claim) | Documented | `npx vitest run test/circuits/streams_zk01_known_issue.test.ts` |
| aztec-nr contracts (escrow, streams, identity) | Compile with Aztec 6.0.0; 55 TXE tests pass in CI; keyed escrow and stream instances and identity claims of the current classes ran end to end on testnet; the first escrow and stream instances (4 Nov, morning) are keyless (do not use); all checked daily against the node | See [`docs/AZTEC_TESTNET_DEPLOYMENTS.md`](AZTEC_TESTNET_DEPLOYMENTS.md) for live contract addresses, class IDs and verification hashes |
| Browser (Web Worker) prover for the standalone circuits | Real in tests only; not used by any page | `npx vitest run test/zk/browser-prover.test.ts` |
| Keyed `PrivateEscrow` and `PaymentStream`, current classes, end to end (escrow claim and refund after the deadline, stream withdrawal bounded by accrual) | Real on Aztec testnet, 4 November 2026 (run 41881180186, blocks 18528 to 18542) | Workflow "Aztec escrow e2e (testnet)"; hashes in `docs/AZTEC_TESTNET_DEPLOYMENTS.md` |
| Unit and integration tests | 1,338 passing in CI on 4 November 2026 (they mock external services such as the database, Redis and RPC providers where needed) | `npm run test:run` |
| Direct messages | Real, provided by XMTP | XMTP browser SDK 5.2.0 |
| Community posts | Readable by our server | Disclosed in the product; migration to XMTP MLS groups is planned (`docs/communities/MLS_MIGRATION.md`) |

Pinned verification keys (SHA-256 of `circuits/<c>/target/vk`, @aztec/bb.js 5.3.0):

| Circuit | VK SHA-256 |
|---|---|
| escrow | `0x4e3cc4c8ce03607dcb2b98bd50c0d31084300634ee8f70f4674919682eb915c2` |
| identity | `0xcd02d2407de202d61e1a03c360633a9b0cdd8fe4b4d67b007cce108990632194` |
| streams | `0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346` |

A VK registry contract with a timelock exists (`contracts/ZKVerificationKeyRegistry.sol`, Hardhat tests) and `lib/aztec/verifier.ts` can read it, but it is not deployed on any network.

### 2.1 aztec-nr v6 contracts (`contracts/aztec/`)

Three contracts written against `aztec-labs-eng/aztec-nr@v6.0.0`: `PrivateEscrow`, `PaymentStream` and `IdentityCredential`. They compile with Aztec 6.0.0 in CI (workflow "Aztec contracts") and pass 55 TXE tests there (escrow 13, identity 20, streams 22), using a test-only token (`contracts/aztec/test_token`).

| Contract | What it does | Verified |
|---|---|---|
| `PrivateEscrow` | A claim note for the recipient and a refund note for the sender, which emit the same settlement nullifier: only one of claim and refund can land. Claim requires `anchor <= deadline` and expires by the deadline; refund requires `anchor > deadline`; a deposit cannot land after its own deadline. `escrow_view` (utility) returns the stored terms and whether the escrow has settled | 13 TXE tests; on testnet: both parties read the stored terms with `escrow_view` (run 42030688268), claim, refund after the deadline, and a claim with the right secret after the deadline refused with `escrow expired` |
| `PaymentStream` | Accrual from the start time, capped at the total without overflow; each withdrawal re-creates the stream note. Sender cancel: every state has an index and a state nullifier emitted by both withdraw and cancel, and withdrawals hand the sender a copy of the next state. `stream_view` (utility) returns the live state to either party and skips the sender's stale copies | 22 TXE tests; on testnet, `stream_view` returned the live state instead of the sender's stale copy (run 42030688268); two of which keep a second stream funding the instance so only the state nullifier can stop a withdrawal after a cancel or a cancel from a stale copy; on testnet: withdrawal, cancel (every token accounted for) and a later withdrawal rejected by the node with `Existing nullifier` |
| `IdentityCredential` | Depth-32 Poseidon2 membership, fixed and committed sanction lists, one `SingleUseClaim` per scope; the claim expires by the credential's expiry; a replaced root stays valid for one hour (revocable); two-step issuer rotation | 20 TXE tests; on testnet: claim against a real root, claim within the grace period of a replaced root, rotation of the issuer |

Escrow and stream balances are token notes owned by the contract, so each agreement gets its own instance, deployed with public keys derived from a secret that only its two parties hold (`lib/aztec/keyed-deploy.ts`). The client opens and accepts agreements through `lib/aztec/agreements.ts`; the receiver accepts an invitation only after recomputing its address and class from the shared secret (`lib/aztec/agreement-invite.ts`), and then confirms the deposit against the contract's stored note (`confirmAgreement`). The peer's Aztec address is announced in the XMTP conversation and pinned on first use (`lib/aztec/peer-binding.ts`); this is trust on first use, not yet a proof that the peer controls the account. Since 5 November 2026 this runs inside Ledger Chat: a Private agreement entry in a direct conversation, and cards for invitations with verify and accept, claim, refund, withdraw and cancel (`docs/chat/AGREEMENTS.md`). Credential trees for `IdentityCredential` are built by `lib/aztec/credential-tree.ts`.

Every instance we deployed is in [`deployments/aztec-testnet.json`](../deployments/aztec-testnet.json), checked daily against the node (workflow "Aztec testnet deployments"), and every end-to-end run with its transaction hashes is in [`docs/AZTEC_TESTNET_DEPLOYMENTS.md`](AZTEC_TESTNET_DEPLOYMENTS.md). The first escrow and stream instances of 4 November (`0x1d88…3097`, `0x0567…c895`) were deployed without keys: tokens sent to them could never be spent. They are marked do-not-use. The first identity instance (`0x174e…56f0`) keeps placeholder roots.

Findings, fixes and open limits are in [`docs/zk/AZTEC_CONTRACTS_REVIEW.md`](zk/AZTEC_CONTRACTS_REVIEW.md) (AZ-01 to AZ-23).

## 3. What was removed or corrected in this revision

- The `*.vk.json` files used to carry invented Plonk-style fields (`circuitSize: 1024`, `qM`, `sigma1`, an "ACTIVE_REGISTERED" L1 anchoring). They now carry only values read from the real VK and toolchain.
- The VK "integrity" check hashed that JSON. It now hashes the binary VK and compares it with constants in code.
- `verifyProof` derived the VK from whatever bytecode was on disk. It now rejects an artifact that does not produce the pinned VK.
- Modules that produced fabricated transaction hashes (`lib/aztec/realTx.ts`) or targeted Aztec Connect v1 (`lib/aztec-zk-engine.ts`) were deleted.
- `ZKIdentityRegistry.verifyCredential` accepted any proof (the verifier call was commented out). It now always reverts.

---

## 4. Known soundness issues in the standalone circuits

| ID | Severity | Issue |
|---|---|---|
| ZK-01 | Critical | Streams: `withdrawn_amount` is a free private input and the nullifier is `H(commitment, withdrawn + claim)`, so the same accrual can be claimed many times with `withdrawn = 0` |
| ZK-02 | Critical | Escrow and streams: no payout address among the public inputs, so a proof can be front-run |
| ZK-03 | High | Escrow: claiming requires the sender's secret (a bearer instrument); no refund path |
| ZK-04 | High | Identity: leaf and nullifier are both 2-input Pedersen hashes with no domain separation; a scope equal to the jurisdiction code reveals the leaf |
| ZK-05 | High | Identity: depth-1 tree (anonymity set of two); the jurisdiction is a free witness |
| ZK-06 | Medium | Timestamps are chosen by the prover |
| ZK-07 | Medium | Verification did not pin the VK (fixed in this revision) |

---

## 5. Direction, and our questions

Meanwhile, v2 standalone circuits (`circuits/*_v2`) fix ZK-01 to ZK-05 with Poseidon2 and domain separation, a depth-32 identity tree, a committed sanction list, recipient-authorised escrow claims with sender refunds, and state chaining for streams. They compile and pass 36 tests in CI with nargo 1.0.0, and their VK hashes are pinned in CI (`scripts/zk/v2-vks.mjs`), but they have no deployed verifier that stores their state ([`docs/zk/V2_CIRCUITS.md`](zk/V2_CIRCUITS.md)).

Our direction is the aztec-nr contracts of section 2.1, so that note ownership and the network's nullifier tree replace hand-written state handling.

1. Is the shared settlement nullifier, with those timestamp checks, an idiomatic way to express "claim before the deadline, refund after it"?
2. Is a keyed deployment whose secret is shared with the parties the pattern you recommend for a contract that holds a private balance, or is there a better one?
3. Our contracts call the token through a raw `transfer_in_private` selector to avoid depending on a token crate. Is depending on the standard Token contract's interface preferred, and how do you avoid a duplicated `aztec` crate when doing so?
4. Our stream cancel shares a per-state nullifier between withdraw and cancel and has withdrawals deliver a copy of the next state to the sender. Is that the pattern you would use, or would you reach for something else (for example a delayed public mutable for the cancellation time)?
5. A cancel measures accrual at its anchor block, chosen by the sender's PXE; we bound it by expiring the cancel 600 s after its anchor. Is there a better way to bound a time-dependent value in a private function?

---

## 6. Non-claims

1. No quantum resistance (BN254, secp256k1 and Curve25519 are classical).
2. No traffic-analysis protection.
3. No external audit; payments on Alpha are capped. Agreements (escrow, streams) remain testnet only.

## 7. Contact

Stefan Antonio Cirisanu · `humanityledger@icloud.com`
Repository: https://github.com/humanityledger/Humanity-Ledger
LinkedIn: https://www.linkedin.com/company/humanity-ledger
