# Changelog

All notable changes to Humanity Ledger will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
