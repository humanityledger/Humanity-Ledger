# Changelog

All notable changes to Humanity Ledger will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
