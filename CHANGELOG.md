# Changelog

All notable changes to Humanity Ledger will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Phone landing, second pass (19 November 2026)

- No slide numbers: each section opens with its eyebrow only.
- Films edge to edge at 4:5, the same size and place in every section, with the poster being the
  loop's first frame. The hero loop is seamless (forward and back) and blends into the hero.
- Flow diagrams in the style of the settlement diagram: the path of a message, of a private payment,
  of a call, the layers, usernames and the roadmap. All their words come from `lib/landing/content.ts`.
- Skipped sections get an intrinsic height only (`contain-intrinsic-height`). The previous
  `contain-intrinsic-size: auto <n>px` set an intrinsic width too.
- `Vary` for `/` is set in `next.config.js`, because Next replaced the middleware's.

### Phone landing: a separate tree for iOS and Android (19 November 2026)

- `/` now decides on the server, from the user agent or `Sec-CH-UA-Mobile` (`lib/landing/device.ts`),
  whether to serve the phone tree (`components/landing/mobile`) or the immersive landing.
  - Tablets and desktops keep the immersive landing, unchanged.
  - `Vary` and `Accept-CH` are set for `/` only.
- The phone tree:
  - Content: the same fifteen sections in the same order, all copy from `lib/landing/content.ts`.
  - Rendering: a Server Component in normal flow, with two client islands. One reveals sections
    (IntersectionObserver, used once per section); the other handles copy buttons and the live numbers.
  - Images: AVIF and WebP made from the existing posters.
  - Video: two short muted loops that play only while on screen.
  - What it leaves out: no per-frame JavaScript, no pinned scenes, no scrubbed video, no globe or 3D
    phone, and none of the app's fixed layers or providers.
- Docs: `docs/LANDING.md`.
- CI:
  - `scripts/ui/landing-webkit.mjs` adds the tree split and frame checks: long animation frames, rAF
    p95, layout shifts, passive listeners and traced layout work, on a Pixel 7 at 4x CPU and an iPhone 15.
  - `scripts/ui/mobile-budget.mjs` enforces the budgets.
  - `lighthouserc.mobile.json` adds a mobile Lighthouse run with a Performance score of at least 95.

### Mature protocol, packages 0-10 (19 November 2026)

- Landing: `/?debug=scroll` overlay; the browser test now checks pixels, real touch flicks (Android) and the browser bars (iPhone). Phones pass.
- `/api/health` reports the running commit and whether the database has every migration of the build.
- Wallet payment events (attempted, sent, mined, unconfirmed, failed with a reason) and a daily purge cron; the signed-terms procedure; an invitation rehearsal against a throwaway Postgres; a 10-line first-code checklist.
- Wave 1 classes tied to the committed artifacts by a test; two new TXE exit tests; the deploy runbook in the order the gate enforces.
- One statement of fee privacy on Alpha (`FEE_PRIVACY`) for the web and the wallet; one screen that said the sender was hidden is corrected; an FPC evaluation (no change, no sponsoring).
- Alerts from measured data (payment failures, send failures, a stalled node), a `/status` page with measured data only, and the first incident drill.
- Internal security review 2. The closed alpha gate is now enforced before an agreement is opened (R2-1); cap, budget, CSV and lock fixes. It is not an audit; `audit` stays `null`.
- Aztec questions Q1, Q2, Q4, Q5 with repository evidence, and a forum draft for Stefan.
- A cUSDC wallet slot behind its nine gates, without changing test-network readiness.

### Closed alpha gates and one source of truth (19 November 2026)

- HLC is a test token with no monetary value (PA-1). The token model is withdrawn, and the wallet labels HLC a test token. A new instance named "HLC Test Token" is prepared for Stefan to deploy (`docs/alpha/HLC_REDEPLOY_RUNBOOK.md`). The read-only preflight checks the on-chain name.
- No route claims "Humanity Ledger Corporation". The unused paid-API routes are removed.
- HLC cannot be distributed until `closedAlpha.distributor` records who distributes it (MiCA art. 4(1)(a)).
- Tester admission needs the signed terms (three boxes, hashed) and the operator's sanctions and age checks. These fields are deleted 6 months after the alpha.
- Fee Juice grants to testers are recorded within a budget and checked on the network, with a CSV export for the tax adviser.
- cUSDC has four more gates, and the wallet never lists it while any gate is unmet.
- Third-party marks are recorded with their source. Aztec is named in text until its brand rules are in writing (D-1).
- `docs/legal/` drafts now state the real facts. ADR 005: no upgradeable contracts in the alpha.
- `docs/GLOSSARY.md` forbidden terms are checked in CI (`test/unit/docs/consistency.test.ts`), and false audit claims are removed from `docs/` and `lib/translations.ts`.

### Live activities: the island and the floating call window (19 November 2026)

- One ActivityManager (`lib/activities`, zustand) replaces the old Dynamic Island store. Each activity has static
  attributes and a dynamic state, like ActivityKit: call, payment proof, payment received, recording, message,
  session. Pure priority rules (`priority.ts`) decide what the island shows: one primary, one minimal, a count.
- Privacy by types: an activity holds a 32-character display name, an amount and a token symbol, made only by
  `values.ts`. A message notification names the sender and never shows the message (it used to show a preview).
- The call has one presentation for the whole app: the full-screen stage, the floating window or the island.
  The window is draggable and throwable to the four corners, keyboard-operable (arrows, Enter, Escape, + and -),
  stays above the keyboard and inside the safe areas, remembers its corner and size, and offers the browser's
  picture in picture where it exists. The call and the window share one `layoutId`, so they morph into each other.
- The call survives route changes: the chat is mounted by `ChatKeepAlive` from the root layout and stays alive,
  hidden, while a call is live off `/chat`. A call that ends shows "Call ended" with its length for 2.4 s.
- The wallet's payment proof and incoming payments appear in the island with their real stage; the fake
  waveform of the old minimised call is gone. Reduced motion uses a short fade; dark mode follows the document.
- Tests: `test/unit/activities` (priority edge cases, store lifecycle, geometry, values).

### No fee sponsorship (15 November 2026)

- Product decision: Ledger Chat sponsors no network fee. Every account pays its own fees on Aztec Alpha, with
  Fee Juice it bridges or that a contact bridges for it through a fee link.
- Removed: the LedgerSponsor contract and artifact, `/api/aztec/sponsor` (now 410 at the edge), voucher signing
  and quotas, the wallet's sponsor path, the operator screen, the verify script and workflow, the `/protocol`
  sponsorship metrics, and the `AZTEC_SPONSOR_*` / `NEXT_PUBLIC_AZTEC_SPONSOR*` variables. `sponsoredFpc` is null
  in `deployments/aztec-mainnet.json`. `test/unit/aztec/no-sponsorship.test.ts` keeps it that way.
- Public texts (protocol docs, landing staking paragraph, tokenomics) no longer mention sponsored onboarding.

### Ledger Chat motion: send, presence, ticks, expression panel (15 November 2026)

- Send: the double jump is gone. A confirmed message kept its bubble only by id, which changes from
  `optimistic-…` to the real id, so the bubble remounted and its entrance played again. Bubbles are now keyed
  by a render key that survives confirmation (`clientKey`, `renderKey`, `adoptOptimistic`), the confirmed copy
  keeps its place, and the entrance is one 180 ms CSS animation of transform and opacity, played once.
  The second, smooth scroll of the wrapper on every change is gone; the list scrolls once, before paint.
- Presence: green dot and "Online" / "typing…" cross-fade in a fixed-height header line; the typing bubble
  under the list (which changed its height) is gone; typing timers no longer race, and a message from the
  peer clears "typing…" at once.
- Ticks: clock, one grey (sent), two grey (delivered), two green (read) in one fixed box that cross-fades;
  status only moves forward, and receipts that beat the send confirmation are kept.
- Emojis / Stickers / GIF: 8 px between tabs with a sliding indicator and arrow-key navigation; wider gaps
  between emojis, stickers and GIFs.

### Fix: LedgerSponsor could not pay (15 November 2026)

- `sponsor()` ends the setup phase but lacked `#[allow_phase_change]`; aztec-nr 6.0.0 then fails every real
  sponsored transaction with "Phase change detected on function with phase check". TXE tests stop at the
  fee-payer election, before `end_setup`, so they could not see it. Fixed, recompiled, TXE vectors regenerated;
  `test/unit/aztec/phase-change.test.ts` now requires the attribute on any private function that ends setup.
- The first instance on Alpha (`0x268bb3e4…090aafa8`) is retired: it keeps 74 AZTEC of Fee Juice that cannot be
  withdrawn. A new instance is to be deployed and funded.

### Licence made consistent, README brought to 15 November (15 November 2026)

- Licence: one statement everywhere, `MIT OR Apache-2.0`. `LICENSE` now gives the SPDX expression, the
  scope (code, contracts, circuits, scripts, tests, deployment records and documentation), inbound =
  outbound contributions and the names-and-logos exclusion. `NOTICE` replaces the "All Rights Reserved"
  ownership notice, whose restrictions contradicted both licences, with an Apache-style notice: copyright,
  names and logos, third-party dependencies and the logos of other projects in `public/`. `LICENSE-MIT`
  names the same copyright holders.
- Website: the protocol, company, developers and legal pages, the page metadata, the structured data and
  `llms.txt` said "source available, not open source" under a proprietary licence; they now say open
  source, MIT OR Apache-2.0, with the names and logos excluded.
- README: status as of 15 November; LedgerSponsor deployed on Aztec Alpha (block 30105, 9 AZTEC of Fee
  Juice, verify workflow passes, not yet used) in the status table, section 3, the anchors, R4 and
  questions 7 and 8; TXE counts from the "Aztec contracts" run 43646090307 (escrow 16, identity 20,
  streams 25, sponsor 10); NLnet proposal reference; licence section. `docs/readme/FACTS.md` line numbers
  regenerated and the new values added. `docs/SPONSOR.md`, `docs/MAINNET_READINESS.md` (R4) and
  `docs/STATUS.md` no longer say the sponsor is undeployed or unchecked.

### Fix: a Fee Juice deposit claimed twice blocked every transaction (15 November 2026)

- The sponsor tools (deploy, claim into the sponsor) paid their fee by claiming the operator's own arrived
  deposit and never forgot it, so every later transaction failed with "No non-nullified L1 to L2 message
  found". They now drop it, and any failed send that reports an already-claimed own deposit forgets it
  (`consumedMessageHash`, `healConsumedClaim`); "Claim into the sponsor" retries once, paid from the balance.
- "Claim into the sponsor" counted a failed claim as claimed; a deposit now counts only with a receipt, and
  older entries are tried again. A failed sponsor deployment no longer reports "Deployed".
- The activity list shows the operator's sponsor transactions as "Ledger sponsor", not "Private account created".

### LedgerSponsor on Aztec Alpha (15 November 2026)

- Deployed at `0x268bb3e40fc6fdb39e482ef1214788b5cbedf5ddadb658367ef6df41090aafa8` (block 30105, fee 3.979 AZTEC),
  funded with 9 AZTEC of Fee Juice, recorded in `deployments/aztec-mainnet.json` → `sponsoredFpc`. The workflow
  "Aztec verify sponsor" passes: network, class, server key and the 40 AZTEC cap. Not audited.
- `scripts/aztec/verify-sponsor.mjs` prints the record to add, with the Fee Juice slot the SDK computes.
- Docs: the protocol page no longer says Alpha has no sponsored fee payer.

### LedgerSponsor readiness (14 November 2026)

- Fix: a refused sponsor request no longer uses up anything. Each limit was a separate rate-limit call
  that records every request, so a wallet asking on a day the daily limit was reached lost one of its
  lifetime sponsored transactions per attempt. `lib/aztec/sponsor-quota.ts` takes a slot in both limits
  or in neither, and refuses when Redis does not answer instead of falling back to per-process limits.
  Nothing is counted while the server cannot sign.
- Fix: the wallet no longer sends a sponsored transaction without estimated gas limits (the sponsor
  would refuse it above its 40 AZTEC cap after the voucher was spent); operator transactions are never
  sponsored.
- `scripts/aztec/verify-sponsor.mjs` and the "Aztec verify sponsor" workflow: read-only check of a
  deployed sponsor (network, class, key and cap, Fee Juice, limits, record).
- Contract: TXE tests for voucher id zero and the constructor's zero key and zero cap.
- `docs/SPONSOR.md`: state table, deployment checklist, V2 digest, the Alpha-only signer key, and that
  Fee Juice in the sponsor cannot be withdrawn. /protocol: the 24 h counter now reads "vouchers issued".

### Protocol fee foundation (14 November 2026)

- `lib/protocol/fees.ts`: Phase 0 fee arithmetic (`protocolFee`, `ceilBps`, `minimumAmount`), u128-safe, refusing a
  fee above `maxFeeShareBps` of the amount (finding T-5). Real only in tests: `test/unit/protocol/fees.test.ts`.
- `docs/protocol/FEE_CONTRACT_SPEC.md`: where the fee is taken, the fee note, why the schedule is a compiled
  constant (class ID), test vectors, acceptance criteria and the decisions still open (D-1 to D-5).
- `docs/TOKENOMICS.md` and `docs/MAINNET_READINESS.md`: next engineering and operator steps for launch condition 1.

### Launch audit (14 November 2026)
- Calls: the Dockerfile now passes `NEXT_PUBLIC_PEERJS_HOST` / `_KEY` / `_PORT` / `_PATH` to the build. Before, the variables set on Railway never reached the bundle and every call used the public PeerJS cloud. Hanging up releases the camera and microphone before the hang-up message is sent.
- A first-time visitor who opens /chat goes to /connect at once (it waited ~11 s of session retries meant for a sign-in in flight).
- The "[TitaniumGate] Deadlock detected" warning no longer prints on every page load; it only appears if the gate really did not open.
- Docs: MAINNET_READINESS no longer says the first Alpha run is still to be recorded; a broken glossary link fixed.

### Launch day: landing and calls under load
- Landing: a plain headline ("Encrypted messages and private payments, in one place.") and the facts on white cards (network, first private payment in L2 block 29,012, proofs on your device) instead of a badge; the try-it phone is the same iPhone 16 Pro frame as /connect, with the Dynamic Island.
- Calls: `/api/calls/ice` reuses one set of Cloudflare TURN credentials per server instance for half their lifetime (concurrent requests share one upstream call) instead of asking Cloudflare on every call, and has its own rate limit (30 a minute per account or IP).

### Launch on Aztec Alpha
- **14 November 2026: first private payment from Ledger Chat on Aztec Alpha.** 0.10 HLC, transfer `0x1eb2bb76…40a5`, checkpointed in L2 block 29012; HLC `0x1f49571a…24e5` deployed in block 28992; both confirmed by the mainnet preflight run 43583640304. STATUS, README, the protocol specification and the Aztec dossier no longer say "testnet only".
- NLnet proposal `2027-01-04e` submitted (€40,000, deliverables D-1 to D-5). Under review.
- Landing page, still white (a Light / Dark switch in the hero offers dark, remembered per device): live-on-Alpha hero, the on-chain record, an interactive four-layer stack, a playground to try themes, wallpapers, bubbles and stickers, and where it runs today (web app on iPhone, Android and desktop; App Store and Google Play marked "Soon").
- Phone mockups show the real themes, wallpapers and bubble styles, the sticker picker with a scene, and the verified Aztec address (G7) on the payment chat.
- HLC launch conditions carry their next step (`LAUNCH_CONDITIONS[].next`, docs/TOKENOMICS.md); none of conditions 1 to 4 is met.

### Chat appearance and stickers
- **Appearance studio** (Settings → Chat appearance, and Appearance inside a chat): one place with a live preview and three tabs. **40 colour themes** in six families (every pair contrast-tested to WCAG AA), **59 wallpapers** in six families (soft colours, gradients, mesh, patterns, doodles and illustrated scenes, all drawn on the device, nothing downloaded) and **14 bubble styles** (classic tail, soft, elevated, gradient, aurora, glow, glass, tinted…). A chat can keep its own wallpaper; on dark wallpapers the time under messages turns light.
- Fixed: a wallpaper picked in Settings never reached the chat (the chat read ids, Settings stored CSS), and the in-chat picker only offered four bubble styles. Wallpapers are now stored as ids only; values from older builds are mapped.
- **Three original sticker packs** drawn for Ledger Chat (42 stickers): *Nubi & Sol*, a little cloud and a little sun, with couple moments (hug, forehead kiss, smooch, cozy, come here); *Lumi*, a jelly drop; *Spike*, a sassy cactus. Volumetric, die-cut, with idle motion. Impacts buzz on devices that support vibration.
- **Sticker moments**: when a sticker arrives (and when it is tapped) it leaves its bubble and plays a 4–5 s scene over the whole chat: paint that splats on the glass and drips, rain of hearts, lipstick kisses, fireworks, a quake with cracks, money rain, fire, sunrise, night sky… 19 scenes. Reduced motion gets a short still pop; Settings → Chat appearance → Sticker effects turns automatic moments off on a device.

### Sign-in on iPhone (Safari, Chrome)
- **Found 14 November 2026:** signing in from Safari or Chrome on iPhone ended on "The wallet did not return the signature", while the Google app signed. WalletConnect opened the wallet by itself, outside the tap, at the same moment it sent the request; Safari and Chrome followed that link at once, iOS suspended the tab before the request reached the relay, and on return the relay's publish timer rejected it. On iPhone, /connect now holds back that automatic open for the sign-in request, enables "Open … to sign" only once the relay has the request, and opens the wallet from the tap on that exact request (`<wallet>://wc?requestId=…&sessionTopic=…`). The sign-in timer no longer runs while the person is in the wallet, and a request the relay never took while the page stayed in view is sent again. Android, computers and wallet browsers are unchanged (`lib/auth/wc-sign-request.ts`).

### Aztec Alpha (mainnet)
- **Found 11 November 2026:** the Dockerfile declared no `ARG`, so Railway never passed `NEXT_PUBLIC_AZTEC_*` to `next build`. Every production build used the defaults (Aztec test network, no tokens), although the Alpha variables were set in Railway. The `ARG` lines are added; merging them is what switches production to Alpha.
- `scripts/aztec/check-alpha-config.mjs` runs before `next build` and checks `NEXT_PUBLIC_AZTEC_TOKENS` and `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS` against `deployments/aztec-mainnet.json` (mode `strict` in the Dockerfile: a mismatch fails the build and the running deployment stays).
- The operator's token HLC ("Humanity Ledger Corp.", 6 decimals) is recorded in `deployments/aztec-mainnet.json`. The mainnet preflight now reads each token's deploy transaction and block and runs `checkTokenInstance`; for HLC it confirmed L2 block 24544 and class `0x067df4dd…91e0`.
- On Alpha the wallet opens with Fee Juice only; Shield, Unshield and Send appear once a token is configured (#40). The chat payment message names the token's symbol, never its internal slot (#40).
- In-app texts name the network: agreement cards, the wallet's first-open note and empty activity, the stream panel, and the chat menus no longer say "Aztec test network" on Alpha.
- Agreements stay off on Alpha: no escrow or stream class is deployed or recorded there.
- **Private wallet storage fixed:** the PXE and wallet stores were opened in the same OPFS pool (`.aztec-kv`); with kv-store 6.0.0 the second open always failed (`pool ".aztec-kv" is already in use by another store instance`). Each store now has its own pool, and the sign-out wipe finds them again (#43).
- The PIN pad no longer flashes before the chat when the PIN screen is off (#43).
- No dead ends on Alpha: the Fee Juice bridge is offered in the wallet panel when the account waits for Fee Juice, the Fee Juice balance is always shown with an Add button, a failed balance read never undoes an open wallet or a confirmed payment, and an unconfirmed transaction stays pending instead of failed.
- Test-network wording removed from the in-app wallet, payment and agreement flow; the send forms show the token's symbol (HLC) (#41, #42).

## [1.0.0] - 2026-10-20

### Security
- **Immediate Containment (Block A)**: `requireWallet` session-only authentication, eradication of client spoofable headers (`x-web3-address`, `x-wallet-address`), eliminated `system_handshake` cookie across all backend handlers.
- **Enclave PIN**: Elimination of fallback secrets, timing-safe equality comparisons, mandatory 403 on DELETE without PIN or OTP.
- **SSRF & CSRF**: Implemented `ssrfGuard` IP range validator and strict Origin/Sec-Fetch-Site validation.

### Brand & Assets
- **Logo Restoration**: Fully restored the authentic World Map silhouette logo and clean sans-serif typography across `HLLogo`, `logo-text.png`, `logo-corporate.png`, and system icons, removing all blackletter gothic fonts.

### CI & Testing
- Fixed CI workflows (`ci.yml`, `security.yml`, `system-core.yml`), added branch protection rules and PR security checklist template.
- Added comprehensive unit tests for session, JWT, PIN, and IDOR protection.
- Fuzz testing with fast-check (10,000 runs) on special message parsers and property-based accounting checks.
