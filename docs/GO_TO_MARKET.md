# Go-to-market plan

Status: 28 November 2026. This file turns the nine-phase go-to-market plan into work items tied to
the repository. Each phase says what already exists (with paths), what is missing and when it is
done. Nothing here is a claim for the landing: the landing only says what `lib/landing/claims.ts`
allows, and a phase marked done here still needs its evidence there.

## Rules that every phase keeps

- **No audit claim.** `audit` in `deployments/aztec-mainnet.json` stays `null` until a signed
  external report exists. An internal review is not an audit (`docs/audit/START_HERE.md`).
- **No number without a log.** A count of payments, people or messages appears only with the log
  that produced it (`docs/verification-logs/`), and never on the landing
  (`test/unit/landing/claims-register.test.ts`).
- **Telemetry carries no identity.** Funnel counters are per step and per day, with no wallet,
  inbox id, IP or user agent stored. `/privacy` describes them before they ship.
- **Third parties are named as they name themselves.** Ecosystem apps keep the name, category and
  availability shown on aztec.network/apps; a comparison quotes public sources with a date. The
  landing never calls another team a partner (banned word in `BANNED`).
- **Gates stay where they are.** `CUSDC_GATES` (`lib/payments/assets.ts`) and the legal documents
  are not changed by this plan (OD-8).

Legend: **Built** (in the code, with a test), **Partial**, **Missing**, **External** (needs a
person or organisation outside the repo).

## Phase overview

| Phase | Goal | State | Depends on |
| --- | --- | --- | --- |
| 1. Visibility | Be findable in the Aztec ecosystem | Partial | none |
| 2. Controlled access | Let people in at a pace we can support | Partial | none |
| 3. Proof of payments | Private payments between real users, logged | Partial | 2 |
| 4. Security | External review and a public security model | Partial / External | none |
| 5. Positioning | Say plainly what Ledger Chat is and is not | Missing | 3 |
| 6. Assets and wallets | cUSDC, fees from bridges, external wallets | Partial | 4 for cUSDC gates |
| 7. Agreements on Alpha | Escrow and streams, L1 portal | Missing | 4 |
| 8. Public metrics | Weekly measured figures | Partial | 2 (telemetry) |
| 9. Funding and content | Grants, technical guide, joint posts | Partial / External | 3, 4 |

## 1. Visibility

| Item | State | Where / next step |
| --- | --- | --- |
| Links to every app on aztec.network/apps, with favicons | Built | `ECOSYSTEM` in `lib/landing/chapters.ts`, section `#ecosystem` in `components/landing/site/SiteLanding.tsx` |
| Listing of Ledger Chat on aztec.network/apps | External | Submit through the Aztec ecosystem form; until it is live, nothing says we are listed |
| Entry in awesome-aztec | External | One-line PR: name, link, "private chat with in-conversation payments on Aztec" |
| Forum post | Partial | Draft in `docs/AZTEC_FORUM_POST_FINAL.md`; re-check every claim against `lib/landing/claims.ts` before posting |
| Announcement on X | Partial | Draft in `docs/TWITTER_ANNOUNCEMENT.md`; same check |

Done when the listing is live and the forum post links to `/security` and `/record`.

## 2. Controlled access

| Item | State | Where / next step |
| --- | --- | --- |
| `/beta` join page with invite codes (at most 100) | Built | `components/beta/BetaGateView.tsx`, `/api/beta/cusdc/redeem`, `docs/beta/CUSDC_BETA.md` |
| Waitlist for people without a code | Missing | New table (wallet hash, created day), `POST /api/beta/waitlist` behind `resolveVerifiedCaller` and the rate limiter; the operator turns entries into codes with `scripts/beta/cusdc-invites.mjs` |
| Five-step onboarding guide | Partial | Content in `docs/beta/TESTER_GUIDE.md`; in-app version: connect, create Aztec account, add a contact, send a message, send a test payment |
| Funnel telemetry without identity | Missing | `lib/analytics/engine.ts` is wallet-scoped and is not the right base. Add day counters per step (`visit`, `connect`, `account`, `first_message`, `first_payment`) with no identifier, and document them in `/privacy` |

The old `/api/referrals` route is retired (`lib/security/retiredRoutes.ts`) and is not the invite system.

Done when a visitor without a code can join the waitlist, and the five counters show on `/status`.

## 3. Proof of payments

| Item | State | Where / next step |
| --- | --- | --- |
| Two-session payment test (request, pay, notices) | Built | `scripts/ui/payments-e2e.mjs`, workflow "Payments e2e" |
| At least 20 private payments between distinct pairs of real users | Missing | Run inside the closed beta; one log line per payment (date, network, asset, binding scheme, status) in `docs/verification-logs/`, no addresses |
| G7 v2 binding between two real browsers on Alpha | Missing | Listed as not verified in `docs/ACCOUNT_MODEL.md` §6 (R8) |
| "Verified Aztec address" badge in the chat | Missing | Show it in the contact panel only when `verifiedPeerBinding` passes for the current network; never for a typed or pasted address |

Done when the log holds 20 payments and the R8 line in `docs/ACCOUNT_MODEL.md` is closed with its log.

## 4. Security

| Item | State | Where / next step |
| --- | --- | --- |
| External review | External | Package in `docs/audit/EXTERNAL_REVIEW_PACKAGE.md`, request in `docs/security/pentest-request.md`; `audit` stays `null` until the signed report is in the repo |
| Public security model | Partial | `/security` and `/trust` exist; add a section that links `docs/security/THREAT_MODEL.md`, the metadata limits and the incident process (`docs/INCIDENT_RESPONSE.md`) |
| Bug bounty | Partial | `docs/BUG_BOUNTY.md`; publish scope and contact on `/security` |

Done when a signed report exists and its findings are answered in the repo.

## 5. Positioning

| Item | State | Where / next step |
| --- | --- | --- |
| Comparison with RollingChat | Missing | A dated table of facts from both public sites: message model, encryption, identity, payments, availability. No ranking words |
| 90-second demo | Missing | Script: open chat, add contact, end-to-end message, payment request, private payment, receipt. Recorded on Alpha with a test amount |

Done when both are published and every line of the table cites its source.

## 6. Assets and wallets

| Item | State | Where / next step |
| --- | --- | --- |
| cUSDC (AIP-20) | Partial | Closed beta switched on (`docs/beta/CUSDC_BETA.md`, `docs/payments/CUSDC_INTEGRATION.md`); the nine gates stay unmet and untouched |
| Fee Juice from bridges | Partial | Private fees in `docs/PRIVATE_FEES.md`; document arriving with Fee Juice through a bridge that converts the fee asset (Shield does this per aztec.network/apps) |
| External wallets (Nulo, Nyx, Azguard) | Partial | Discovery through `@aztec-labs/wallet-sdk` in `lib/aztec/wallet/external-sdk.ts`; test each wallet and record the result |
| G7 documentation for developers | Partial | Rules in `docs/ACCOUNT_MODEL.md` §5; turn them into a developer page with the statement format and the checks |

## 7. Agreements on Alpha

| Item | State | Where / next step |
| --- | --- | --- |
| Escrow and streams on Alpha | Missing | Refused on Alpha: no contract of ours is deployed there and `lib/protocol/agreement-gate.ts` requires an external audit |
| L1 portal | Missing | Not deployed on any network (`docs/PORTAL.md`) |

Blocked by phase 4. Deployment follows `docs/CONTRACT_DEPLOY_CHECKLIST.md` and adds the transaction hash and block to `deployments/aztec-mainnet.json`.

## 8. Public metrics

| Item | State | Where / next step |
| --- | --- | --- |
| Measured service data | Built | `/status` shows what `/api/status/alpha` measured in the last 24 hours |
| Weekly figures | Missing | A weekly snapshot of the phase 2 counters and the phase 3 payment log on `/status`, with the week and the source of each figure |

## 9. Funding and content

| Item | State | Where / next step |
| --- | --- | --- |
| Grants | Partial | Drafts in `docs/NLNET_DRAFT.md` and `docs/AZTEC_FOUNDATION_DOSSIER.md` |
| Guide "How we built private payments inside MLS conversations" | Missing | Sources: `docs/ACCOUNT_MODEL.md`, `docs/payments/`, `lib/payments/payment-message.ts`; state the limits (fee payer, metadata) next to each claim |
| Joint posts with ecosystem apps | External | Only with a written agreement from the other team; their name and wording as they approve them |

## Order of work

1. Phases 1 and 2 now: they only need outreach and small code.
2. Phase 3 inside the closed beta, with the log from the first payment.
3. Phase 4 in parallel; phases 6 (cUSDC gates) and 7 wait for it.
4. Phases 5, 8 and 9 once phase 3 has its log.
