# Changelog

All notable changes to Humanity Ledger will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Launch on Aztec Alpha
- **14 November 2026: first private payment from Ledger Chat on Aztec Alpha.** 0.10 HLC, transfer `0x1eb2bb76…40a5`, checkpointed in L2 block 29012; HLC `0x1f49571a…24e5` deployed in block 28992; both confirmed by the mainnet preflight run 43583640304. STATUS, README, the protocol specification and the Aztec dossier no longer say "testnet only".
- NLnet proposal `2027-01-04e` submitted (€40,000, deliverables D-1 to D-5). Under review.
- Landing page on obsidian: live-on-Alpha hero, the on-chain record, an interactive four-layer stack, a playground to try themes, wallpapers, bubbles and stickers, and where it runs today (web app on iPhone, Android and desktop; App Store and Google Play marked "Soon").
- Phone mockups show the real themes, wallpapers and bubble styles, the sticker picker with a scene, and the verified Aztec address (G7) on the payment chat.
- HLC launch conditions carry their next step (`LAUNCH_CONDITIONS[].next`, docs/TOKENOMICS.md); none of conditions 1 to 4 is met.

### Chat appearance and stickers
- **Appearance studio** (Settings → Chat appearance, and Appearance inside a chat): one place with a live preview and three tabs. **40 colour themes** in six families (every pair contrast-tested to WCAG AA), **59 wallpapers** in six families (soft colours, gradients, mesh, patterns, doodles and illustrated scenes, all drawn on the device, nothing downloaded) and **14 bubble styles** (classic tail, soft, elevated, gradient, aurora, glow, glass, tinted…). A chat can keep its own wallpaper; on dark wallpapers the time under messages turns light.
- Fixed: a wallpaper picked in Settings never reached the chat (the chat read ids, Settings stored CSS), and the in-chat picker only offered four bubble styles. Wallpapers are now stored as ids only; values from older builds are mapped.
- **Three original sticker packs** drawn for Ledger Chat (42 stickers): *Nubi & Sol*, a little cloud and a little sun, with couple moments (hug, forehead kiss, smooch, cozy, come here); *Lumi*, a jelly drop; *Spike*, a sassy cactus. Volumetric, die-cut, with idle motion. Impacts buzz on devices that support vibration.
- **Sticker moments**: when a sticker arrives (and when it is tapped) it leaves its bubble and plays a 4–5 s scene over the whole chat: paint that splats on the glass and drips, rain of hearts, lipstick kisses, fireworks, a quake with cracks, money rain, fire, sunrise, night sky… 19 scenes. Reduced motion gets a short still pop; Settings → Chat appearance → Sticker effects turns automatic moments off on a device.

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
