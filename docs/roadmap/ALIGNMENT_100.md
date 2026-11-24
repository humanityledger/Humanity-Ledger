# Alignment with Aztec: the 100 items, state on `556b3c6` (24 November 2026)

Phase 0 of `prompt-alineacion-aztec-fases-2026-11-24.md`. One row per item. States:
`EXISTÍA` (already in the code), `PARCIAL`, `FALTA`, `HECHO` (done in this branch), `EXCLUIDO`
(rule 3.7: not built under any name), `DECISIÓN` (needs Stefan), `SIN VERIFICAR` (no evidence found
yet; to confirm before building). Evidence is a path; "—" means none was found.

Duplicates merged: 1 + 3 + 20 → "chat first, payments later"; 40 + 98 → "10× peaks"; 34 + 85 + 89 →
"observability without user data".

## Excluded (rule 3.7), with the reason and the replacement

| # | Item | Reason | Replacement |
|---|---|---|---|
| 11 | Import the address book | Phone numbers; hashes are reversible | R1: one QR with username, Aztec address, inbox and G7 binding |
| 44 | Block screenshots | Impossible on the web; false security | R2: blur on hide and hidden previews, with honest copy |
| 65 | Scheduled or recurring payments | Needs keys or authority on a server | R3: pre-funded stream claimed by the recipient (`PaymentStream` exists) |
| 70 | Abstraction for other payment rails | Treats Aztec as replaceable | R4: private fees through an FPC (`docs/aztec/FPC_EVALUATION.md`) |
| 71 | Referrals with an incentive | Social graph on the server, sybil farming | R7: single-use invites with no inviter stored |
| 76 | Browser extensions | Attack surface over keys | R8: detect an Aztec rollup upgrade and freeze value actions |
| 78 | Achievements | Engagement tracking | R9: private membership proof (new Noir contract, test network only) |
| 81 | Share conversations by link | Takes decryptable content out of E2E | R10: verifiable receipt for one payment |
| 82 | Calendar integration | Leaks payment metadata to third parties | R11: on-device tax report with selective disclosure |
| 92 | Abstract the network away from Aztec | Same as 70 | R5: the user chooses their Aztec node |
| 93 | Several payment networks in parallel | Same as 70 | R6: open-source the Noir contracts and the G7 binding |

## Items

| # | Item | Phase | State | Evidence or note |
|---|---|---|---|---|
| 1, 3, 20 | Chat without Fee Juice; chat-only; progressive onboarding | 6 | EXISTÍA | Chat runs on XMTP; the wallet opens only for payments (`components/zk/ZkWalletPanel.tsx`) |
| 2 | Onboarding under 45 s | 6 | SIN VERIFICAR | Not measured |
| 4 | Recovery without a single wallet | 2 | EXISTÍA + DECISIÓN | Passkeys wrap the account root (`passkey.ts`). Guardian recovery needs an audited account contract: after G8 (`docs/design/ACCOUNT_RECOVERY_PASSKEY.md`) |
| 5 | Passkey sign-in | 2 | EXISTÍA + DECISIÓN | Passkey unlock (PRF). A WebAuthn account contract waits for G8 (same document) |
| 6 | Privacy state per action | 1 | HECHO | `lib/privacy/disclosure.ts`, `components/privacy/DisclosurePanel.tsx` in send, shield, unshield and the chat cards |
| 7 | Contacts by QR, link, username | 2 | EXISTÍA | `components/chat/profile/BrandedQr.tsx`, `app/u/page.tsx` |
| 8 | Username search, privacy kept | 2 | EXISTÍA | Exact match only, 30 per minute (`app/api/chat/username/lookup/route.ts`) |
| 9 | One-click group invites | 4 | EXISTÍA | Invite link `app/join/[code]/page.tsx`; joining opens the community |
| 10 | 90-second tutorial | 6 | PARCIAL | `components/chat/LedgerChatOnboarding.tsx` |
| 12 | Themes | 6 | EXCLUIDO for now | `app/ledger-tokens.css`: one light theme by decision |
| 13 | Typing and online, efficient | 1 | EXISTÍA | Mutual contacts, cached (PR #153); toggles for typing, read receipts and last seen (`LedgerSettingsFull.tsx`) |
| 14 | Voice with local transcription | 5 | PARCIAL | Voice notes exist; "Transcribing" in `CustomAudioPlayer.tsx`: where it runs is not verified |
| 15 | Reactions and replies | 6 | EXISTÍA (decision) | Quick reactions are off by product decision (`MessageBubble.tsx:577`); replies exist |
| 16 | Edit or delete within a window | 6 | HECHO + security fix | Edits within 24 h; remote edits and deletions apply only from the message's own author (`lib/chat/message-authority.ts`). Before, the other person could rewrite or delete your messages on your screen by naming their ids |
| 17 | Notification centre | 1 | HECHO | Previews hidden by default, no sender in the title (`lib/privacy/defaults.ts`) |
| 18 | Dark mode and high contrast | 6 | DECISIÓN taken: light only | One light theme with 7:1 body contrast (`app/ledger-tokens.css`, `WalletUI.tsx`) |
| 19 | Mobile gestures | 6 | SIN VERIFICAR | — |
| 21 | Faster proofs in the browser | 5 | PARCIAL + HECHO (measure) | Proving time recorded per device (`lib/perf/proof-timings.ts`) and shown as an expectation; anonymous durations already reach the server log (`payment-report`) |
| 22 | Transaction queue | 5 | PARCIAL | Activity record with stages (`components/zk/PaymentProgress.tsx`) |
| 23 | Aggressive caching | 5 | SIN VERIFICAR | — |
| 24 | Web Workers | 5 | PARCIAL | `lib/zk/prover-client.ts`, `lib/chat/record-worker.ts` |
| 25 | Smaller initial bundle | 5 | EXISTÍA | The Aztec SDK loads on demand (`loadSdk`, dynamic import) only when the wallet opens |
| 26 | Lazy-load old messages | 5 | SIN VERIFICAR | — |
| 27 | Media compression | 5 | PARCIAL | Images (`lib/chat/compress-image.ts`); not audio or video |
| 28 | Storage for tens of thousands of messages | 5 | SIN VERIFICAR | — |
| 29 | Multi-device sync | 5 | PARCIAL | Linked devices exist; PXE notes across devices not documented |
| 30 | Offline mode with an outbox | 5 | SIN VERIFICAR | — |
| 31 | Battery during proving | 5 | FALTA | — |
| 32 | Prefetch frequent contacts | 5 | SIN VERIFICAR | — |
| 33 | Messaging separate from payments | 5 | EXISTÍA | Different stacks (XMTP, Aztec) and code paths |
| 34, 85, 89 | Observability without user data | 7 | EXISTÍA | `app/api/wallet/payment-report` logs stage, kind, network and duration only, no address; hourly counters (`lib/ops/counters.ts`) |
| 35 | Graceful degradation when Aztec is slow | 5 | HECHO | The progress screen says when it is slower than usual on this device and that it can still go through |
| 36 | CDN for assets only | 7 | SIN VERIFICAR | — |
| 37 | Optimise the Noir contracts | 5 | PARCIAL | CI job summary reports ACIR opcodes per circuit (`aztec-ci.yml`); ceiling after the first baseline |
| 38 | Client rate limiting | 5 | SIN VERIFICAR | Server rate limits exist (`lib/security/rateLimiter.ts`) |
| 39 | Smart reconnection | 5 | SIN VERIFICAR | — |
| 40, 98 | 10× peaks | 7 | PARCIAL | `scripts/load-test-k6.js` exists; one replica (doc of 18 Nov) |
| 41 | Payments say exactly what is revealed | 1 | HECHO | Same as 6. Copy that said the sender is hidden on Alpha was corrected |
| 42 | Safety numbers | 1 | HECHO | 60 digits from both inboxes and every device (`lib/chat/safety-glyphs.ts` `safetyDigits`), same digest as the glyphs; was derived from wallet addresses |
| 43 | Disappearing messages | 1 | HECHO | Burn timer with honest copy: the other person can copy before it ends (`BurnTimerSheet.tsx`) |
| 45 | Encrypted export | 1 | HECHO | `lib/backup/encrypted-archive.ts` (PBKDF2 600k + AES-256-GCM), `HistoryBackupSheet.tsx` |
| 46 | What the server sees | 1 | HECHO | `docs/privacy/DATA_INVENTORY.md` and the page `/docs/data-inventory` |
| 47 | Key rotation | 1 | PARCIAL | MLS rotates; Aztec keys are tied to the address (`lib/aztec/wallet/passkey.ts`: rotation = new account) |
| 48 | New device warnings | 2 | PARCIAL | A new device on either inbox changes the safety number and glyphs (phase 1); no push alert |
| 49 | Revoke devices | 2 | EXISTÍA | Linked devices: unlink revokes the session at once (`components/link/LinkedDevicesPanel.tsx`) |
| 50 | Threat model, accessible | 1 | PARCIAL | `docs/SECURITY.md`, `/security`; to link from the app |
| 51 | Maximum privacy by default | 1 | HECHO (decision) | Notification previews off by default. Read receipts and typing stay on by default, as in Signal, each with its toggle; last seen is contacts or nobody |
| 52 | G7 verifiable by the user | 1 | PARCIAL | v2 binding (`lib/aztec/peer-binding.ts`); proves the signing key only (R6) |
| 53 | Alert on Aztec address change | 1 | EXISTÍA | `AgreementCard.tsx`: conflict and failed proof shown as security warnings, never pinned |
| 54 | Audit (reformulated) | 8 | PARCIAL | `docs/AUDIT_SCOPE.md`, `docs/BUG_BOUNTY.md`; no external audit |
| 55 | Trust centre in the app | 1 | HECHO | Settings, Data and backup, Who sees what → `/docs/data-inventory` |
| 56 | Payments never block chat | 3 | EXISTÍA | |
| 57 | Request payment in chat | 3 | EXISTÍA | `components/chat/PaymentRequestCard.tsx` (restyled in this branch) |
| 58 | Payment history | 3 | EXISTÍA | `components/zk/wallet/WalletActivity.tsx` (local) |
| 59 | Payment received notice (reformulated) | 3 | EXISTÍA | The payer's chat message carries the hash; the receiver confirms against its own wallet (`PaymentCard.tsx`) |
| 60 | Fee Juice friction / private FPC | 3 | EXISTÍA + DECISIÓN | Fee Juice station exists. Private fees: option A kept (`docs/aztec/FPC_EVALUATION.md`); our own FPC would be a custodial role that needs counsel first |
| 61 | More private tokens, modular | 3 | EXISTÍA | `lib/aztec/token-check.ts`, `lib/payments/assets.ts` |
| 62 | Escrow and streams | 3 | EXISTÍA | `PrivateEscrow`, `PaymentStream` with caps (`lib/aztec/keyed-deploy.ts`) |
| 63 | Network cost before confirming | 3 | PARCIAL | The review names who pays and that it is public; a numeric estimate needs a simulation API not verified against the pinned SDK |
| 64 | Verifiable confirmation | 3 | HECHO | Card shows the transaction and its link; Copy receipt (R10) |
| 66 | Shield and unshield (reformulated) | 3 | HECHO | Both now show what becomes public, from the shared map |
| 67 | Spending limits | 3 | HECHO | Per-payment limit per token, checked in `wallet.send` before any proof (`lib/payments/personal-limits.ts`) |
| 68 | Receive-only mode | 3 | HECHO | Same module; the request card shows it instead of Pay |
| 69 | Private statistics | 3 | HECHO | 30-day totals computed on the device (`lib/payments/activity-report.ts`) |
| 72 | Use cases | 8 | DECISIÓN | Remittances need legal advice |
| 73 | Communities with privacy controls | 4 | HECHO (off until flipped) | `lib/communities/mls.ts`: an MLS community reads and posts through its XMTP group, the admin's client keeps group members equal to the server's, new channels are created as groups. The operator flips `communityMls` per community |
| 74 | Public group search | 4 | EXISTÍA | "Find one" lists discoverable communities (`LedgerCommunitiesTab.tsx`) |
| 75 | Full web version | 8 | EXISTÍA | |
| 77 | Templates | 6 | PARCIAL | Invoice and agreement composers exist |
| 79 | Spanish and English | 6 | PARCIAL | `lib/i18n/dictionaries.ts`; chat strings are English |
| 80 | Privacy education | 6 | EXISTÍA | `/docs` |
| 83 | In-app feedback | 6 | SIN VERIFICAR | `app/api/chat/report` exists |
| 84 | Beta tester programme | 8 | EXISTÍA | cUSDC closed beta, 100 people (`lib/beta`) |
| 86 | Flags to switch payments off | 7 | PARCIAL | `lib/feature-flags/index.ts` (Redis); payments use env switches |
| 87 | Public status page | 7 | EXISTÍA | `app/status/page.tsx` |
| 88 | Runbooks | 7 | EXISTÍA | `docs/INCIDENT_RESPONSE.md` |
| 90 | Backups under the user's control | 1 | HECHO | Same file as 45, restore merges and never deletes |
| 91 | Portable messaging layer | 7 | FALTA | — |
| 94 | Cost model | 7 | SIN VERIFICAR | — |
| 95 | Scalable support | 7 | SIN VERIFICAR | — |
| 96 | Automated audit process | 7 | PARCIAL | `npm run aztec:preflight`, Slither in CI |
| 97 | Gradual rollout | 7 | PARCIAL | Flag engine supports a rollout percentage |
| 99 | Health metrics | 7 | PARCIAL | `/status` |
| 100 | Chat works without Aztec (reformulated) | 7 | EXISTÍA | |

## Replacements

| R | Item | Phase | State | Note |
|---|---|---|---|---|
| R1 | One QR with a verified binding | 2 | HECHO (decision) | The QR stays minimal (no address in it); the binding is proved inside the encrypted chat (`docs/design/ACCOUNT_RECOVERY_PASSKEY.md`) |
| R2 | Blur on hide, hidden previews | 1 | EXISTÍA + HECHO | Screen privacy blur already existed (`LedgerChatV2.tsx`); previews now hidden by default |
| R3 | Recipient-claimed stream | 3 | EXISTÍA | `PaymentStream` with caps is the answer to recurring payments; no server ever holds keys |
| R4 | Private FPC | 3 | DECISIÓN taken: not now | Revisit when Aztec publishes an FPC on Alpha (`docs/aztec/FPC_EVALUATION.md`) |
| R5 | User-chosen Aztec node | 2 | HECHO | `lib/aztec/wallet/node-choice.ts`, Settings → Aztec node; same identity checks, never replaced by the relay |
| R6 | G7 v3 and open-source contracts | 1, 8 | FALTA | |
| R7 | Invites without an inviter | 4 | EXISTÍA | Operator-issued HMAC codes; no person-to-person referral graph is stored |
| R8 | Rollup upgrade readiness | 2 | HECHO | Different rollup on the same L1 → `ROLLUP_CHANGED_MESSAGE`, nothing opens or moves |
| R9 | Private membership proof | 4 | DECISIÓN taken: later | `docs/design/PRIVATE_MEMBERSHIP.md` |
| R10 | Verifiable receipt | 3 | HECHO (v1) | Receipt proves inclusion of the transaction and says the amount is stated, not proven. Note-inclusion proof: API not verified, v2 |
| R11 | On-device tax report | 3 | HECHO | CSV from the wallet's record, formulas neutralised, nothing uploaded |

## Phase 6 (`claude/align-fase-6`)

- 16 built, with a security fix found on the way. Not done: 79 (Spanish in the chat; the chat strings are not in the i18n dictionaries), 2 and 19 not measured.

## Phase 5 (`claude/align-fase-5`)

- 21 (measure), 35 and 37 (report) built; 25 and 34 already existed. Not done: 27 audio/video compression, 31 battery, 28/30/32/39 not verified.

## Phase 4 (`claude/align-fase-4`)

- 73 built (client side of R-17, off until the operator flips a community); 9, 74 and R7 already existed; R9 decided.

## Phase 3 (`claude/align-fase-3`)

- 64, 67, 68, 69, R10 and R11 built; R3 already existed; R4 and 60 decided (no FPC of our own).

## Phase 2 (`claude/align-fase-2`)

- R5 and R8 built; R1, 4 and 5 decided (`docs/design/ACCOUNT_RECOVERY_PASSKEY.md`); 49 already existed.

## Phase 1 (`claude/align-fase-1`)

- 17, 42, 43, 45, 46, 51, 55, 90 and R2 as marked above. 13 and 53 already existed.
- Still open in phase 1: 47 (documented), 48 and 49 (device list UI, see phase 2), R6 (G7 v3, phase 8).

## Done in phase 0 (`claude/align-fase-0-1`)

- Items 6, 41, 46, 66: the disclosure map, its panel in the send review, shield, unshield and both
  chat cards, and this inventory.
- A correction found during the inventory: the send screen said the network does not see "you".
  On Alpha the account pays its own fee publicly, so that was not true. Every sentence now comes
  from `lib/privacy/disclosure.ts`.
