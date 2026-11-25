# Legal pages: facts that no longer match the code (25 November 2026)

**For the operator and the lawyer. Not legal text.** OD-8 (`docs/alpha/OPERATOR_DECISIONS.md`) says
agents do not write legal texts, so `lib/docs/pages/legal.ts` was **not changed**. This file lists,
page by page, each statement in it that the code on `main` (`ee6ed46`) no longer supports, with the
evidence. The rule at the top of `legal.ts` ("every statement about data must match what the code
does today") is what these items fail. Each needs a human decision and wording.

## Terms of Service (`/docs/terms`)

| § | Says today | The code shows | Evidence |
|---|---|---|---|
| 1 | "an experimental private payments wallet on the Aztec test network" | The wallet runs on **Aztec Alpha** (mainnet), with a cap per payment, since the first private payment on 14 November 2026 | `docs/STATUS.md` header; `deployments/aztec-mainnet.json` |
| 3 | "the wallet address you sign in with, or the email address you verify" | Email sign in was removed; its routes answer 410 | `test/unit/auth/connect-wallet-only.test.ts`, `lib/security/retiredRoutes.ts` |
| 4 | "Our contracts have not been reviewed by an independent auditor" | Still true. An external audit begins on 25 November 2026; no report yet | operator, 25 Nov 2026 |
| 5 | Whole section: wallet on the **test network** only, tokens with **no monetary value** | On Alpha, members of the closed beta can hold **cUSDC, a dollar token issued by human.tech, with real value** and a cap per payment. HLC on Alpha is a test token with no monetary value (decision of 19 Nov 2026). The test network still exists | `lib/payments/private-asset.ts`, `lib/payments/assets.ts`, wallet banner "cUSDC, real value, capped" |

## Privacy Policy (`/docs/privacy`)

| Row or section | Says today | The code shows | Evidence |
|---|---|---|---|
| 1, "Email address, if you sign in with email" | Email kept to send sign in codes | No email sign in. Email is still received when someone **asks for the closed beta** (sent by email to the beta inbox through Resend, with Reply-To; the route says nothing from the form is saved in the database), for **email alerts** and for the **newsletter** | `app/api/beta/cusdc/apply/route.ts`, `app/api/notifications/email/route.ts`, `app/api/newsletter/subscribe/route.ts` |
| 1, "Sign in codes" | Hash of codes kept minutes | Codes no longer exist | as above |
| 1, "Session data" | "thirty days for the email refresh token" | `hl_refresh` is set only by `createSession` in `lib/session.ts`, which no route calls any more; confirm and remove | `lib/session.ts` |
| 1, "Community memberships, roles, posts…" | Posts kept on our server | Communities created from 24 Nov 2026 keep posts in an XMTP MLS group; the server stores only the group id | `app/api/chat/communities/route.ts` |
| 1, "Attachments" | "Not yet encrypted" | Encrypted in the browser (AES-256-GCM); the server and R2 hold ciphertext only | `lib/chat/remote-attachment.ts`, `lib/chat/send-attachment.ts` |
| 1, "What we do not receive" | Wallet "talks to the Aztec test network directly" | Talks to **Aztec Alpha** (or the test network) directly | `lib/aztec/` |
| 3, providers | "Resend: sending sign in codes" | Resend sends the beta request, alerts and newsletter | as row 1 |
| 3, providers | "Cloudflare: bot protection on email sign in, and storage of attachments" | No Turnstile anywhere in the code. Cloudflare provides **R2** (ciphertext attachments), **TURN** relays and a **STUN** server | `lib/storage/r2.ts`, `app/api/calls/ice/route.ts`, `lib/calls/media.ts` |
| 3, providers | "PeerJS, Google and OpenRelay" | OpenRelay is not used. Signalling runs on **our own Ledger Relay**, falling back to the **public PeerJS cloud** when the relay does not answer; Google STUN | `lib/calls/media.ts` (`peerServerOptions`, `pickPeerServer`) |
| 3, providers | "Aztec test network nodes" | Also **Aztec Alpha** nodes | as above |
| 3, providers | Not listed | **Groq** processes what people send to Ledger Studio (open models); conversations are not stored by our server | `docs` whitepaper §8, `lib/studio/` |
| 3, providers | Not listed | **human.tech** issues cUSDC (not a processor of our data as far as the code shows; decide whether to name it) | `lib/payments/private-asset.ts` |

## Cookie Policy (`/docs/cookies`)

| Cookie | Listed? | The code shows | Evidence |
|---|---|---|---|
| `hl_refresh` | Yes, "when you signed in with email" | Probably no longer set (see Privacy, Session data) | `lib/session.ts` |
| `hl_locale` | **No** | Set when a person picks a language; one year; read by the server to render the page in that language | `lib/i18n/client.tsx`, `lib/i18n/locales.ts` |
| `system_handshake`, `wallet-auth` | **No** | Set at sign in, readable by scripts, seven days; carry the wallet address | `app/api/siwe/verify/route.ts` lines 245 to 251 |
| `kyc_status`, `ledger_system_consent` | **No** | Set by code in the repository; check whether either is reachable from a page in production | `grep -rn "kyc_status\|ledger_system_consent" app lib` |
| Browser storage | Partly | `localStorage` also holds `hl_locale` | `lib/i18n/client.tsx` |

## Risk disclosure (`/docs/disclaimer`)

| Says today | The code shows |
|---|---|
| "Private payments run on a test network… our wallet refuses [Alpha]…", and a promise not to connect the wallet to a network with real value before an audit of our contracts | The wallet has run on Aztec Alpha since 14 November 2026, with cUSDC of real value for the closed beta and a cap per payment, **before** an external audit. This section contradicts the product and the banner in the wallet |
| "Our contracts have not been reviewed by an independent auditor" | Still true; the external audit begins on 25 November 2026 |

## Content and copyright (`/docs/content-policy`)

| Row | Says today | The code shows |
|---|---|---|
| "Community posts… Yes. They are stored on our server." | Only for communities created before 24 Nov 2026 |
| "Attachments: Yes, if you give us the link." | We hold ciphertext only; we cannot see the file unless a participant gives us the decrypted file |

## Legal notice (`/docs/legal-notice`)

No factual mismatch found. The page date (`REVIEWED = "2026-11-11"`) changes when the texts above do.

## Translations

The website and the chat are translated into Spanish, Russian, German and Chinese. The legal pages
are shown in English in every language, with one translated line saying only that the page is
available in English. Translating them, or saying which language prevails, is writing legal text
(OD-8) and is left to the operator.
