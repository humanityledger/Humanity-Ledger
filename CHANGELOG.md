# Changelog

All notable changes to Humanity Ledger will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Aztec Alpha (mainnet)
- **Found 11 November 2026:** the Dockerfile declared no `ARG`, so Railway never passed `NEXT_PUBLIC_AZTEC_*` to `next build`. Every production build used the defaults (Aztec test network, no tokens), although the Alpha variables were set in Railway. The `ARG` lines are added; merging them is what switches production to Alpha.
- `scripts/aztec/check-alpha-config.mjs` runs before `next build` and checks `NEXT_PUBLIC_AZTEC_TOKENS` and `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS` against `deployments/aztec-mainnet.json` (mode `warn`, `strict` once the preflight confirms every token).
- The operator's token HLC ("Humanity Ledger Corp.", 6 decimals) is recorded in `deployments/aztec-mainnet.json`. The mainnet preflight now reads each token's deploy transaction and block and runs `checkTokenInstance`; for HLC it confirmed L2 block 24544 and class `0x067df4dd…91e0`.
- On Alpha the wallet opens with Fee Juice only; Shield, Unshield and Send appear once a token is configured (#40). The chat payment message names the token's symbol, never its internal slot (#40).
- In-app texts name the network: agreement cards, the wallet's first-open note and empty activity, the stream panel, and the chat menus no longer say "Aztec test network" on Alpha.
- Agreements stay off on Alpha: no escrow or stream class is deployed or recorded there.

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
