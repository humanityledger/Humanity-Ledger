# Closed technical beta of private cUSDC payments

Status on 22 November 2026: **built, switched off**. `cusdcBeta.enabled` is `false` in `deployments/aztec-mainnet.json`.

This is a closed technical test for at most 100 invited people. Its only purpose is to check that private cUSDC payments in the chat work end to end for real users. It is not a launch: the landing keeps saying "Not enabled yet" for USDC (`lib/landing/claims.ts`, row `usdc`), and nothing public changes while the beta runs. Only Stefan switches it on.

## What is built

| Piece | Where |
| --- | --- |
| Switch `cusdcBeta` (off, 100 people, end date required) | `deployments/aztec-mainnet.json`, `lib/beta/cusdc-beta.ts` |
| Invitations and members (at most 100, database lock) | `CusdcBetaInvite`, `CusdcBetaMember`, `scripts/beta/cusdc-invites.mjs`, `/api/beta/cusdc/redeem` |
| Join page with the technical notice | `/beta` (`app/beta/page.tsx`), `/api/beta/cusdc/status` |
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
4. **Invitations.** One per person, after the sanctions list and age checks:

   ```sh
   node scripts/beta/cusdc-invites.mjs create --by 0xOPERATOR --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked --days 14
   ```

   The script needs `DATABASE_URL`, `ALPHA_INVITE_PEPPER` and `ALPHA_ADMINS`, the same as the alpha.
5. **Switch on.** In a pull request, set `cusdcBeta.enabled: true` and `cusdcBeta.until` to the end date (ISO date-time).
6. **Testers join** at `/beta`: sign in with their wallet, read the notice, tick the box, enter the code.

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
