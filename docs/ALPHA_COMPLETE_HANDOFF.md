# Alpha complete — handoff for an implementer (16 November 2026, updated 17 November 2026)

This file tells an implementer what is already true, what is still missing before Ledger Chat can be called complete on Aztec Alpha, and what must not be done. It is a gap list. It is not a claim that the product is complete, audited, or free of visual defects.

Authority, when documents disagree: `docs/AZTEC_FOUNDATION_DOSSIER.md` section 0, then this file. `docs/MAINNET_READINESS.md` row R6 is stale. The fee classes have been compiled and tested. They are not deployed.

Nothing in the decision package of 16 November 2026 has been accepted or rejected by Stefan Antonio Cirisanu. Do not treat a recommendation as a decision.

## Do not do these things

- Do not invent a treasury address. Since 17 November 2026 `TREASURY` in `contracts/aztec/escrow/src/main.nr` and `contracts/aztec/streams/src/main.nr` is `0x177395a38df8c95a572d3e7591240312b2fddbaf14d294d9e1443f3b0d55faed`, designated by Stefan Antonio Cirisanu. It is not the 4-of-7 multisig. Use no other address.
- Do not deploy the fee classes on Alpha. Do not send any Alpha transaction.
- Do not set `communityMls` to true. The schema default is false. The guard in `test/communities/r17-acceptance.test.ts` fails if `app/`, `components/`, or `lib/` assigns it true.
- Do not claim an external audit. `deployments/aztec-mainnet.json` has `"audit": null`.
- Do not close Q1–Q10. They are OPEN.
- Do not edit `lib/docs/pages/legal.ts` or `protocol.ts`. R2 is counsel’s text.
- Do not edit `lib/aztec/` to measure prover memory. That edit was not authorized.
- Do not register a new class id by hand. The two below are the current recorded ones, compiled with the zero placeholder. A new class id is recorded only after the "Aztec contracts" workflow recompiles the designated-treasury source and TXE passes inside each crate.

## What already exists

Production Ledger Chat runs on Aztec Alpha (Ethereum L1 chain 1) when the build has both `NEXT_PUBLIC_AZTEC_NETWORK=alpha` and `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true`. The first private HLC payment from the app is L2 block 29012, transfer `0x1eb2bb76ae52d876e0ef8e107bf9de5b83ce9cb42850a1a1a938cae3c24040a5`, 0.10 HLC. A later send from the wallet screen is L2 block 29771. Both parties were accounts of the operator `0x1Ba9c5cC429Ac7B8742F58c0215D6D58c009f675`. Those runs are not R8.

HLC on Alpha is `0x1f49571a48699da4e70e1b7dbc5afcea5bb712f7b2cfaf432353e694851e24e5`. The retired token `0x2cd0f377…e55d` is do-not-use. The recorded per-payment cap is 1000 HLC. Each account pays its own Fee Juice. `/api/aztec/sponsor` answers 410. Two old LedgerSponsor instances exist and nothing in the app calls them.

The fee baseline (spec sections 6 and 8, authorized 16 November 2026) is in the escrow and stream source. Aztec 6.0.0 compiled it. TXE from inside each crate: PrivateEscrow 19 passed, PaymentStream 29 passed. Current classes, `status: not-deployed`, `address: null`, `tracksCurrentArtifact: true`:

- PrivateEscrow `0x177021740d92d13f78e3f96a5bd3447eeb268cb6e9073e88832d14856b66e0ee`
- PaymentStream `0x2c22f32674231c50fe77c970d5f604f9a5bd60f9dd800bd575c1f6f89eba1ae3`

The client refuses to deploy while the treasury is unset, and it accepts only a class that tracks the current artifact. Pre-fee testnet instances keep their old class ids and no longer track the current artifact. No fee class has an address.

Direct messages are XMTP v3 under MLS, RFC 9420. This repository does not implement MLS. Before a private payment, the client checks a domain-separated Schnorr signature over Grumpkin that binds the XMTP inbox to the Aztec account. That check is trust on first use. It is not a proof of the nullifier key.

## What “complete on Alpha” means here

A person who is not the operator can sign in, fund Fee Juice, deploy an Aztec account, exchange a direct message, and send a capped private HLC payment that the other person can read. The public fee payer is disclosed. The contracts in that path are externally audited, or the unaudited acknowledgement and the caps remain and are not described as removed. Agreements, if they are on Alpha at all, use the fee classes, a real treasury account, and the same audit rule. Communities are not described as end-to-end encrypted until R-17 is met. Legal pages do not contradict the network the app is on.

That state is not the state of the repository today.

## Blockers a code change cannot close

| ID | What is missing | Who closes it | Current fact |
|---|---|---|---|
| B1 | Treasury Aztec address of the 4-of-7 multisig | Stefan | Open. On 17 November 2026 Stefan designated `0x177395a38df8c95a572d3e7591240312b2fddbaf14d294d9e1443f3b0d55faed` (created on Alpha, L2 block 33001). It is in the source and the client. It is not the 4-of-7 multisig |
| B2 | External audit of the fee classes, report under `deployments/aztec-mainnet.json` → `audit` | Stefan engages an auditor | `audit` is null. Launch condition 1 of `docs/TOKENOMICS.md` is not met |
| B3 | Explicit acceptance to deploy the fee classes once B1 and B2 exist | Stefan | Decision package row 6 is blocked. Do not deploy ahead of it |
| B4 | Q1–Q10 left OPEN, or a written decision that marks a posture definitive | Stefan, or a reply from Aztec Labs | All ten are OPEN. See the dossier table |
| B5 | R8: Annex B of the dossier, two browsers, two accounts, neither the operator | Stefan authorizes, then two people | Not run. No hash. Operator payments do not count |
| B6 | R2 legal wording | Stefan with counsel | Agents do not edit it |
| B7 | `communityMls` for one named test community, only after `docs/communities/R17_ACCEPTANCE.md` | Stefan names the community | Flag is false. Do not turn it on |
| B8 | Launch conditions 2, 3, and 4 of `docs/TOKENOMICS.md` | Not engineering | Six months of fees, fixed supply in the multisig, MiCA filing. All not met |
| B9 | TURN credentials if calls across networks must connect | Stefan, Railway | `docs/CALLS.md`. `/api/calls/ice` can answer `source: none` |
| B10 | `DATABASE_URL_UNPOOLED` direct URL | Stefan, Railway | R9. Migrations work around it |

## Engineering that is still open

Do these only inside the blocker above them. Do not skip a blocker.

1. **Fee classes on Alpha.** Source and TXE are done. Still required before any deploy, and not sufficient alone: B1, B2, B3. After a real treasury address exists, replace the zero constant, recompile, run TXE again from inside `contracts/aztec/escrow` and `contracts/aztec/streams` (`cd` into the crate; `aztec test` from the repo root fails because there is no root `Nargo.toml`), record the new class ids only if those tests pass, and deploy nothing until B2 and B3 are met. `assertCanOpen` must keep refusing a missing treasury and any class that is not current. The pre-fee classes must stay `tracksCurrentArtifact: false`.

2. **Agreements are not on Alpha.** Escrow, stream, and identity instances on testnet are keyed and are not Alpha instances. `docs/MAINNET_READINESS.md` R6 still says the nullifier recompile has not happened. That sentence is stale. The fee source is compiled. The absence on Alpha is not stale.

3. **R8 is a procedure, not a patch.** Annex B in the dossier. Direct HLC transfer only. Amount 0.01 HLC. Do not raise the cap to make it pass. Do not use agreements in that run. Record the hash only after the two non-operator accounts have done it.

4. **Communities stay server-readable.** `docs/communities/R17_ACCEPTANCE.md` is the list. Today the settings panel does not import an XMTP client and does not call `createSecureGroup`. `removeGroupMember` is not called on expulsion. AC-03 is `describe.skip`. AC-01 has no real `pg_dump`. AC-04 is blocked. `CLM-MSG-COMMUNITY` stays aspirational. Completing this is not flipping the flag.

5. **Public fee disclosure.** Aztec’s own rule: Fee Juice balances are public so the network can see that a transaction can pay for itself. The private note’s sender, recipient, and amount are not on the transcript. The UI must keep saying the fee payer is public. Do not describe the fee as private. Q8 stays OPEN.

6. **Peer binding.** G7 is trust on first use of a signing key. Q9 stays OPEN. Do not describe it as a proof of the nullifier secret key.

7. **Mobile sign-in is unverified on a phone.** `/connect` shows Open in MetaMask for an external mobile browser (`https://link.metamask.io/dapp/ledgerchat.org`). The unit test checks that the URL is a tap and that `location` is not assigned. Nobody in the recorded evidence has completed that path on a physical phone. A visual pass of `/connect` on a phone is still required before calling sign-in complete.

8. **Studio is closed on purpose.** `app/studio/page.tsx` and `middleware.ts`. `/api/studio/` returns `STUDIO_LOCKED`. Do not reopen it as part of Alpha completeness.

9. **Dollar token and L1 vaults are out of this Alpha slice.** R5 and the L1 portal in `docs/MAINNET_READINESS.md` need their own audit. `HumanityTimeLockVault` adversarial tests passing locally are not that audit.

## Visual completeness

No browser pass of the production UI was made for this handoff. Do not report the interface as free of visual defects.

Before any claim of a clean UI, exercise these surfaces in a browser, desktop and a phone width, and fix what breaks:

- `/connect`, including the external-phone branch and the failure screen.
- The private wallet: empty Fee Juice, bridge, account deploy, send 0.01 HLC, insufficient-fee copy in `components/zk/PaymentProgress.tsx`.
- A direct message thread and the payment card that hangs off it.
- Settings (`components/chat/LedgerSettingsFull.tsx`): HLC, Fee Juice, local handle, and the line that does not assume TURN.
- Community screens while `communityMls` is false: posts still readable as server state, with no copy that says they are end-to-end encrypted.
- Agreement entry points: they must refuse Alpha deploy of the fee classes while the treasury is zero, and the refusal must be visible.

A screenshot of a static page is not that pass.

## Stale sentences an implementer must not obey

- `docs/MAINNET_READINESS.md` R6: “artifacts must be recompiled with the deposit and creation nullifiers.” The fee source is already compiled and TXE-tested. It is still not deployed on Alpha.
- Any sentence that says the fee contract has not been written. The source exists. The instance does not.
- Any sentence that says sponsorship is still the product. It is not. The endpoint answers 410.

## Decisions still waiting on Stefan Antonio Cirisanu

The table in `docs/AZTEC_FOUNDATION_DOSSIER.md`, “Decision package for Stefan Antonio Cirisanu — 16 November 2026”, is the list. Six rows, none accepted: treasury address, external audit, Q1–Q10, R8, `communityMls`, and fee-class deploy on Alpha. Do not mark a row accepted in his place.

## Reproduce the facts that are already tested

```bash
npx vitest run test/unit/aztec/no-sponsorship.test.ts test/communities/r17-acceptance.test.ts test/unit/auth/connect-wallet-only.test.ts test/unit/chat/session8-guards.test.ts test/unit/aztec/deployments-registry.test.ts
```

TXE, only from inside the crate, with Aztec 6.0.0:

```bash
cd contracts/aztec/escrow && aztec test
cd contracts/aztec/streams && aztec test
```

Those two commands passed on 16 November 2026 (19 and 29). Re-run them only if the Noir source changes. Do not run them from the repository root.

## 17 November 2026 — what changed

Base: `af6fa15`. No Alpha transaction, no deploy, no broadcast. `audit` is still null. Q1–Q10 are still OPEN. `communityMls` is still false. No decision-package row is marked accepted. No B item is closed.

The operator states that a private transfer between two non-operator accounts succeeded. No hash was supplied.

| Area | Change |
|---|---|
| Treasury | `TREASURY` in both contracts is `0x177395a38df8c95a572d3e7591240312b2fddbaf14d294d9e1443f3b0d55faed`. Client: `TREASURY_ADDRESS` in `lib/protocol/fees.ts`. Both sources are pinned in `deployments/aztec-pending-recompile.json` with their sha256 |
| TXE | Not run in this session: the session had no Aztec toolchain. The "Aztec contracts" workflow recompiles and runs `aztec test` inside each crate on a `claude/**` branch. No new class id is recorded until that passes |
| Client gate | `lib/protocol/agreement-gate.ts`, used by `assertCanOpen`, the composer and both scripts. Order: on Alpha with `audit: null`, refused (no external audit); a crate pending recompile, refused (its artifact still carries the zero placeholder); no treasury, refused. Class must be a current `tracksCurrentArtifact` entry; escrow amounts use `baselineFee`; a stream total is not refused for `TX_CAP` |
| Composer | The refusal is the first block, before any field, and disables Open. On Alpha it says there is no external audit. A large stream is explained, not called refused |
| Scripts | `deploy-keyed.ts` refuses an Alpha node, the shared gate and a class that is not current, before any wallet. The e2e run refuses Alpha and a pending recompile |
| Dead risk | `app/api/test-aztec/route.ts` removed (a retired route that described a sponsored fee payer). `/api/aztec/sponsor` stays 410 |
| Clear chat | `lib/chat/cleared-chats.ts`: one cut-off, no margin into the future. Checked by the cache load, the offline queue, the legacy `/api/chat/direct` read, stream replays, the stored history and the list line. A cut-off that cannot be stored is an error; nothing is removed |
| Delete for me | Stored before it leaves the screen; a failed store keeps the message with an error. The list line becomes the previous visible message, or empty |
| Communities | Opening one shows `components/communities/CommunityReader.tsx`: the posts, the sentence "People in this community can read what you write here. It is not a private conversation.", one large field and Send. Members, channels, apps, settings, analytics, governance and the treasury are behind **Manage** (the existing `CommunityView`). A failed post stays, marked "Not sent", with Try again and Remove. The list uses 18 px names, 16 px details, 48 px targets |
| Wallet creation | `components/zk/WalletCreation.tsx` replaces the "Open your private wallet" block and the Fee Juice step with the status rows of the HLC send card (`PaymentProgress.module.css`): one sentence, steps that follow the wallet's real phase, one button. The unaudited box above it is unchanged. The wallet panel had `w-84`, which Tailwind 3 does not define; it is now full width on a phone and 420 px on a desktop |
| Copy | Chat banner and invoice name the public fee payer. `/join` no longer says "end-to-end encrypted community". Settings does not assume a TURN relay |
| Docs | README, `MAINNET_READINESS.md` R6, `FEE_CONTRACT_SPEC.md` status lines, dossier section 0 treasury lines |

## Screens opened on 17 November 2026

| Screen | How | Result |
|---|---|---|
| `/connect`, desktop | Built-in browser, production `ledgerchat.org` (build before this change) | Link-a-computer QR, sign-in alternative |
| `/connect`, 390 px, phone user agent | Same | **Open in MetaMask** with `https://link.metamask.io/dapp/ledgerchat.org`; WalletConnect still offered. Nothing signed |
| Communities list, one community, write, Cancel, Send, failed send, Try again, Manage | Chrome (Playwright), desktop 1280 px and 390 px, the real components bundled with mocked server answers and Tailwind built from their classes | No target under 48 px, no text under 7:1, no sideways scroll. Found and fixed: a refetch loop on every render; a failed post hidden under the field on a phone; a wrapped button label |
| Wallet creation: idle, signing, keys, Fee Juice, account, error, blocked; and the HLC send card | Same harness, desktop and 390 px | No overflow or clipping; no Open button while working; the error marks the step that stopped |

Not opened: anything behind a signed-in session on a build with these changes (the real wallet, a DM payment card, settings, the clear-chat and delete-for-me reload checks), the `/connect` failure screen, a physical phone. They need the deployed build and Stefan's wallet.

## What only Stefan can still close

1. Treasury: the 4-of-7 multisig account (launch condition 3). The designated account is not it.
2. External audit of PrivateEscrow and PaymentStream (launch condition 1), recorded in `deployments/aztec-mainnet.json` → `audit`.
3. Fee-class deploy on Alpha, after 2 and after the recompile with the designated treasury passes TXE and its class ids are recorded.
4. Legal text (R2) with counsel.
5. A named test community, before any `communityMls` change.
6. TURN credentials (B9).
7. The direct database URL, `DATABASE_URL_UNPOOLED` (B10).
8. Pushing this change to a `claude/**` branch so the "Aztec contracts" workflow recompiles and runs TXE; then recording the new class ids only if it passes.
