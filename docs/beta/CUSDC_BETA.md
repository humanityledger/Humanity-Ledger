# Closed technical beta of private cUSDC payments

Status on 23 November 2026: **switched on**. `cusdcBeta.enabled` is `true` in `deployments/aztec-mainnet.json`, `until` is `2027-02-23T23:59:59Z` (3 months). Remaining steps: confirm the cUSDC contract on-chain (`verifiedOnChain`), set Railway variables, generate and assign the 100 invitation codes.

This is a closed technical test for at most 100 invited people. Its only purpose is to check that private cUSDC payments in the chat work end to end for real users. It is not a launch: the landing keeps saying "Not enabled yet" for USDC (`lib/landing/claims.ts`, row `usdc`), and nothing public changes while the beta runs. Only Stefan switches it on.

## What is built

| Piece | Where |
| --- | --- |
| Switch `cusdcBeta` (off, 100 people, end date required) | `deployments/aztec-mainnet.json`, `lib/beta/cusdc-beta.ts` |
| Invitations and members (at most 100, database lock) | `CusdcBetaInvite`, `CusdcBetaMember`, `scripts/beta/cusdc-invites.mjs`, `/api/beta/cusdc/redeem` |
| The 100 codes and the operator's table | `scripts/beta/generate-100-codes.mjs`, `lib/beta/invite-codes.mjs`, `docs/beta/100_BETA_INVITE_CODES.md` (gitignored) |
| Join page: wallet, code, notice, unlock | `/beta` (`components/beta/BetaGateView.tsx`, `lib/beta/gate.ts`), `/api/beta/cusdc/status` |
| Recipient and balance checks before a cUSDC proof | `/api/beta/cusdc/member`, `lib/payments/send-checks.ts`, `components/chat/ZkMoneyModal.tsx` |
| Settings > Payments: what works today | `components/beta/PaymentsAvailability.tsx` |
| cUSDC listed for members only, asked again before every send | `lib/aztec/wallet/config.ts`, `lib/beta/cusdc-beta-client.ts`, `lib/aztec/wallet/client.ts` |
| Payment card with real status | `components/chat/PaymentCard.tsx`, `lib/payments/payment-message.ts` |
| Payment requests with a locked pay form | `components/chat/PaymentRequestComposer.tsx`, `components/chat/PaymentRequestCard.tsx` |
| Notice for incoming payments | `components/chat/IncomingPaymentNotifier.tsx`, `lib/payments/incoming.ts` |
| Two-session test (request, pay, notices, statuses) | `scripts/ui/payments-e2e.mjs`, workflow "Payments e2e" |
| Closing check of all the above | `test/unit/beta/cusdc-beta-closure.test.ts` |

## The nine gates (unchanged, all unmet)

The operator decided on 22 November 2026 to run this beta before the legal and company gates are met, and to deal with them in a later phase. `CUSDC_GATES` in `lib/payments/assets.ts` are untouched. All nine stay `met: false` and `cusdcReady()` stays `false`, so the wallet hides cUSDC from everyone outside the beta. The beta is a separate path that never reads or changes them.

| Gate | What it needs | State | In the beta |
| --- | --- | --- | --- |
| `legal` | Written legal note: non-custodial software, not a CASP for cUSDC payments | Not met | Deferred by the operator |
| `entity` | The operating company exists; its terms and privacy policy cover real payments | Not met | Deferred by the operator |
| `onchain` | The cUSDC address confirmed on the Aztec v6 node by the read-only preflight | Not met | **Required** (`verifiedOnChain`) |
| `alpha` | Closed alpha with HLC finished within its targets | Not met | Deferred by the operator |
| `operator` | Stefan signs the switch-on, with a cap per payment | Not met | **Required in part**: Stefan switches the beta on, and a cap is required |
| `issuerWrittenClassification` | Written answer from human.tech: MiCA classification, issuer, 1:1 redemption | Not met | Deferred by the operator |
| `legalNoteNotCasp` | Counsel: the integration does not make the company a CASP or a payment service provider | Not met | Deferred by the operator |
| `sanctionsPolicy` | Written policy on users from sanctioned countries, and how it is applied | Not met | Deferred. The beta keeps the per-person EU sanctions list check before each invitation |
| `insurance` | Professional liability and cyber insurance | Not met | Deferred by the operator |

## Technical checks the beta never skips

A wallet sees and sends cUSDC only when all of these hold. They are checked by `cusdcBetaDecision` on the server, and again in the wallet before every new payment.

1. **`cusdcBeta.enabled` is `true` and `cusdcBeta.until` is in the future.**
2. **The cUSDC contract is confirmed on the network.** `plannedTokens[cUSDC].verifiedOnChain` is `true`, set in a pull request from a read-only preflight run. The run must show the instance found, the name, symbol and decimals matching the record, and `checkTokenInstance` ok. That last check is the one the wallet runs on Alpha before it uses any token: if it refuses cUSDC, the wallet will not load it and the beta cannot work.
3. **A cap per payment** for the cUSDC address in `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS`. Every private payment on Alpha also refuses a token without a cap (`lib/payments/direct-private.ts`). Requests above the cap cannot be sent.
4. **Active membership with the current notice confirmed** (`BETA_NOTICE_VERSION`).
5. **Exits-only mode** (`AZTEC_VALUE_MODE`) stops new payments at once, without a deploy. It is checked before the beta, and it fails closed.
6. **The build check** (`scripts/aztec/check-alpha-config.mjs`) refuses a `CUSDC` slot that is not the planned address, symbol and decimals.
7. **The payee is always the address verified in the conversation** (G7). It is never typed, and never taken from a request.

### What each person sees

| Visibility | When | What it means |
| --- | --- | --- |
| `send` | Every condition holds | cUSDC is listed and can be sent |
| `exits` | A member whose access was revoked, or a beta that was paused, ended or lost its cap | The balance stays visible and the person's own funds can still be moved, but new payments are refused |
| `hidden` | Not a member, or the contract was never confirmed | cUSDC is not listed |

Revoking someone never locks what they hold.

## Before switching on: what Stefan needs

All of these are the operator's actions. Agents change no Railway variable, deploy nothing and merge nothing.

1. **Confirm the contract.** Run the "Aztec mainnet preflight" workflow and read the `planned cUSDC` lines: instance, class, name, symbol, decimals and `checkTokenInstance`. If all match, open a pull request that sets `verifiedOnChain: true` with the run number. If `checkTokenInstance` refuses, stop: cUSDC uses a contract the wallet does not trust yet, and that needs its own pull request first.
2. **Railway variables of the app.**
   - Add the slot `"CUSDC": { "address": "0x30112e52178143b74cf6037d047bbba924f4b0db8aab587a340aacfc6ecb4f38", "symbol": "cUSDC", "decimals": 6 }` to `NEXT_PUBLIC_AZTEC_TOKENS`.
   - Add the cap to `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS`, keyed by that address, in base units. For example, `"5000000"` is 5 cUSDC.
   - Redeploy. Both variables are build arguments in the `Dockerfile`.
3. **Fee Juice.** Every tester pays network fees in Fee Juice (AZTEC bridged from L1). Ledger Chat sponsors none. Each tester bridges their own, or is given some through a fee link (the same path as the alpha, `docs/alpha`).
4. **Invitations.** The scripts need `DATABASE_URL`, `ALPHA_INVITE_PEPPER` (at least 32 characters) and `ALPHA_ADMINS`, the same as the alpha. Run them from the repository root on the operator's own machine.
   - Generate the codes once. Only the HMAC of each code is stored; the codes in clear go to `docs/beta/100_BETA_INVITE_CODES.md` (gitignored, owner-only, never overwritten):

     ```sh
     node scripts/beta/generate-100-codes.mjs --by 0xOPERATOR
     ```

     Options: `--count N` (default 100, never more than 100 unrevoked codes in total) and `--days D` (codes expire after D days).
   - Every code starts **Unassigned** and cannot be redeemed. Before giving a code to someone, check that person (EU consolidated sanctions list, 18 or older) and record it on one code, by its number in the table:

     ```sh
     node scripts/beta/cusdc-invites.mjs assign 7 --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked
     ```

     One code per person. A match on the sanctions list gets no code. Only the result is stored, never an identity document.
   - Refresh the table (Status, Redeemed By Wallet, Redeemed At) and print `X / 100 redeemed`:

     ```sh
     node scripts/beta/cusdc-invites.mjs export-table
     ```

   - A single code with its checks in one step still works: `cusdc-invites.mjs create --by 0xOPERATOR --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked`.
5. **Switch on.** In a pull request, set `cusdcBeta.enabled: true` and `cusdcBeta.until` to the end date (ISO date-time).
6. **Testers join** at `/beta` (below).

## The gate at /beta

**After sign-in** (`lib/beta/landing.ts`): an explicit return path wins; otherwise a member goes straight to `/chat`, someone who can still join goes to `/beta`, and a closed or full beta (or no answer) opens the chat. The status is asked once more after a short pause if the session cookie is not readable yet, so a phone returning from its wallet app is not sent back to `/connect`. The middleware accepts every session the rest of the app accepts: there is no fixed sign-out epoch.


Signed-out visitors go to `/connect` first and come back. The page shows the capacity ("Closed Beta • 100 spots total • X remaining", from `/api/beta/cusdc/status`) and asks one thing at a time:

1. **Wallet.** The signed-in Ethereum address, shortened, with a green check. This is the account the server admits.
2. **Code.** Four blocks of four characters. Lower case, spaces, hyphens and Crockford look-alikes (O, I, L) are accepted; a full code pasted into any block fills all four.
3. **Notice.** The technical notice and one box, not ticked in advance. "Unlock cUSDC Beta" sends the code with the notice version.

On success the page drops the wallet's cached beta answer, so cUSDC appears at the next wallet refresh rather than up to a minute later, and opens the chat. Every answer of `/api/beta/cusdc/redeem` has its own message (`lib/beta/gate.ts`):

| Case | Answer | What the person sees |
| --- | --- | --- |
| Unknown, used, revoked or expired code | 400 | One message for all, so codes cannot be probed; back to the code step |
| Code not assigned yet (no checks recorded) | 403 | "This invitation is not active yet"; ask the operator |
| Already a member, same wallet again | 200 | Shown as a member; retrying is safe |
| 101st person | 409 | "The cUSDC beta is full"; the counter shows 0 |
| More than 5 tries in an hour | 429 | Try again in an hour |
| Session expired | 401 | Back to the wallet step; the code was not used |
| Network failure | none | Try again; the same code is safe to resend |
| Beta switched off | 503 | "The cUSDC beta is not open" |

Members see their own state instead of the form: in the beta, notice to confirm again, paused, or revoked. A payment request in cUSDC shown to someone outside the beta links to `/beta`.

## The payment flow

1. **Redeem.** The member row is written in the same transaction as the code, under a database lock. Visibility becomes `send` on the server at once.
2. **Wallet refresh.** The wallet asks `/api/beta/cusdc/status` (cached for a minute, dropped by `/beta` after redeem) and lists cUSDC. On Alpha it runs `checkTokenInstance` before it loads the token.
3. **Before a proof**, the payment form stops with a reason when: the recipient is not an active beta member (`/api/beta/cusdc/member`, asked only by members, rate limited); the amount is above the private balance; the peer's Aztec address is not verified in this chat (G7) or its fingerprint is not confirmed; the risk acknowledgement is missing; or the app is in exits-only mode.
4. **Send.** The wallet asks the server again, uncached (`assertCusdcBetaAllows`), checks the cap (`NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS`), proves on the device and submits to the Aztec node. The network fee is Fee Juice from the sender's own account.
5. **In the chat.** A payment message with the transaction hash (never the amount) is posted. The sender's card goes sending, sent, confirmed or failed from the sender's own wallet activity. The recipient's card turns to received when their own wallet finds the settled note, and a notice appears (`IncomingPaymentNotifier`, muted by Do Not Disturb, content hidden when the person chose so).
6. **Requests.** "Pay privately" fixes the token and amount; the payee is still the verified address. A request is shown paid once paid from this device, and opens again if that payment fails in the wallet.

Errors are shown in plain words (`humanError` in `lib/aztec/wallet/client.ts`): balance too low, not enough Fee Juice, node unreachable, node limiting requests, transaction rejected or dropped, proof failed, already settled. A cUSDC note sent to someone outside the beta is not lost: it is theirs, and they see it once they join.

## Settings > Payments

The Payments tab opens with "What works today":

- **Public tips:** ETH, USDC or USDT on Ethereum mainnet, from the person's Ethereum wallet. Public on the blockchain.
- **Private payments:** on Aztec Alpha in HLC, a test token with no monetary value; the network fee is Fee Juice.
- **cUSDC private payments:** the closed beta, with the person's own state (invitation only with places left, member, notice to confirm, revoked, full, not open) and a link to `/beta`.

## First real transfer between two beta wallets (Stefan)

Two people, A and B, each with their own wallet and device, both redeemed at `/beta`, after the steps above are done and the switch is on.

1. **Both:** open the chat, then the private wallet. cUSDC is listed. Each has Fee Juice; A has a cUSDC balance at least the amount to send, below the cap.
2. **Both:** open a direct chat with each other and share the Aztec address in it (the binding). In the payment form, A sees "Verified (G7)" and the fingerprint; A and B compare the fingerprint over another channel.
3. **A:** private payment, token cUSDC, a small amount. Tick the fingerprint and the risk acknowledgement, then "Send privately". The proof runs on A's device.
4. **Success looks like this:** A's card goes from sending to sent, then confirmed with the amount. On B's side, once B's wallet is open and synced, the card turns to received and a notice appears. A's private balance goes down by the amount; B's goes up. Repeat with a request from B, paid by A.
5. **If it fails or is slow:**
   - The card says failed: read the message under it. Fee Juice and balance are the usual causes; nothing was sent unless the wallet activity shows the transaction.
   - Sent but not confirmed for a long time: the Aztec network can be slow; press "Check now" on the card, then check the node status. Do not resend while the first payment is pending, or both may go through.
   - Confirmed for A but B sees nothing: B opens the wallet and waits for sync; notes are found by B's own device, not pushed by Ledger Chat.
   - "Only members of the closed beta" or the recipient check stops A: check both rows with `cusdc-invites.mjs list` and that the notice is confirmed.
   - cUSDC is not listed: check `verifiedOnChain`, the `CUSDC` slot and its cap in the build, `cusdcBeta.enabled` and `until`, and that `checkTokenInstance` passes in the preflight.

## Limitations and external dependencies

- **Aztec Alpha** (node, sequencer, proving in the browser) is outside Ledger Chat's control: delays, rejected transactions or an upgrade can stop payments. There is no external audit, so caps stay small.
- **The cUSDC contract** on Aztec is not Ledger Chat's. The beta trusts only the planned address after the preflight confirms it.
- **Fee Juice** comes from bridging AZTEC from Ethereum. Ledger Chat sponsors no fees (`/api/aztec/sponsor` stays retired).
- **XMTP** carries the chat messages, including payment messages and requests. If it is down, payments still settle but cards appear late.
- **Postgres** holds invitations and members; **Redis** holds the rate limits. If the database is down, the status fails closed: nobody gains `send`, and balances already shown stay visible.
- **The device:** proving needs memory; an old phone may fail where a computer succeeds. Private notes live in the browser's storage on that device.
- **Not in this beta:** cUSDC for anyone outside it, or on any public page. The landing keeps saying "Not enabled yet".

## Security review (22 November 2026)

What an attacker could try, and what stops it:

| Attempt | Defence |
| --- | --- |
| Guess an invitation code | 80 random bits per code, only 100 assigned; 5 tries per wallet per hour; one answer for every bad code |
| Redeem a generated code nobody checked | Redeem requires the sanctions and age checks recorded by `assign` (403 otherwise) |
| Join past 100 | Members are counted under a database lock in the same transaction (409) |
| Make a signed-in person redeem or confirm the notice from another site | CSRF check in the middleware, and the beta mutations accept `application/json` only (415) |
| List who is in the beta | `/api/beta/cusdc/member` answers only active members, one address at a time, 120 checks per hour |
| Mark a payment request paid with a fake message | A request is paid for the person who asked only when their own wallet finds a settled receive of that transaction, in that token, for at least the amount |
| Send a large payment through a mistyped cap | A hard ceiling of 100 tokens per direct payment on Alpha, whatever the cap says, plus the cap itself |
| Lock real value in an unaudited contract | Escrows and streams refuse cUSDC while the contracts have no external audit |
| Pay a lookalike or substituted address | The payee is the address verified in the chat (G7) with its fingerprint; never typed, never taken from a request |
| Keep sending after revocation or a pause | Every cUSDC send asks the server again, uncached; exits-only mode stops new value at once |

What no code here can promise: the beta controls what Ledger Chat shows and sends, not the cUSDC contract. Anyone holding cUSDC on Aztec can move it with other software. Aztec Alpha, the cUSDC contract, and each person's device and Ethereum wallet are outside this repository; there is no external audit yet.

## cUSDC for everyone (operator switch)

`cusdcPublic.enabled` in `deployments/aztec-mainnet.json` (off) replaces HLC with cUSDC for everyone in the private wallet (`lib/payments/cusdc-public.ts`). It does not mark any of the nine gates as met; they stay a factual record. The wallet lists cUSDC for everyone only when, together:

1. `cusdcPublic.enabled` is `true` (a pull request by Stefan);
2. `plannedTokens[cUSDC].verifiedOnChain` is `true` after the preflight;
3. the `CUSDC` slot in `NEXT_PUBLIC_AZTEC_TOKENS` is that address, symbol `cUSDC`, 6 decimals;
4. a cUSDC cap is set in `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS`.

Then HLC disappears from the token list, the closed beta stops applying (no invitation needed), the landing row for USDC reads "Live", with the cap stated, and the wallet texts name cUSDC. Exits-only mode, the cap, the 100 token ceiling, G7 and the risk acknowledgement still apply to every payment. Escrows and streams stay closed to cUSDC until an external audit. Before switching it on, update the landing pages that still describe HLC, and keep in mind that the gates listed above (legal note, company, sanctions policy, insurance) are still open.

## Pausing and switching off

| To | Do | Effect |
| --- | --- | --- |
| Stop new payments at once | Set `AZTEC_VALUE_MODE=exits-only` on the server | No new payment, shield or agreement. Moving one's own funds to one's own public balance still works. No deploy needed. |
| Close the beta | Set `cusdcBeta.enabled: false` in a pull request | Members switch to `exits`: balances stay visible and own funds can be moved. |
| Remove one person | `node scripts/beta/cusdc-invites.mjs revoke-member 0xWALLET` | That person switches to `exits`. |
| End on a date | `cusdcBeta.until` | After it, everyone switches to `exits`. |

## How the flow is tested

- **Unit tests** in `test/unit/beta/` and `test/unit/payments/`.
- **The two-session test** (`scripts/ui/payments-e2e.mjs`) runs the real composer, cards, pay button, payment message and notifier between two browser sessions, against a simulated wallet and network.
- **Proving and the Aztec network** are covered by the G6 two-account session on a real network (`docs/chat/G6_SESSION_CHECKLIST.md`), which Stefan records.

## Notice text

The notice states facts about the test. It is not legal terms and does not replace them; the legal texts of Ledger Chat are unchanged. Its text lives in `lib/beta/cusdc-beta.ts` (`BETA_NOTICE`). Changing a word changes `BETA_NOTICE_VERSION`, and every member confirms the new text again.
