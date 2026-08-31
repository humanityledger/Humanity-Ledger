# Humanity Ledger — Routing Index
*Created: August 2026*

This document classifies all frontend routes in the `app/` directory by Layer, Island visibility, indexing status, and production claim.

## 🟢 CAPA 2 (App / Workspace)
Requires SIWE session. `<DynamicIsland />` is **VISIBLE**. Not indexed by crawlers (`noindex`).

| Route | Island | Indexed | Claim | Status |
|---|---|---|---|---|
| `/chat` | YES | NO | End-to-end encrypted messaging via XMTP | LIVE |
| `/portfolio` | YES | NO | Multi-chain balance sync | LIVE |
| `/studio/provenance` | YES | NO | ZK Identity Dashboard | PARTIAL |
| `/settings` | YES | NO | User configuration & Enclave PIN | LIVE |
| `/hub` | YES | NO | Ecosystem dashboard | PARTIAL |
| `/ledger` | YES | NO | On-chain transfers & QDs | LIVE |
| `/terminal` | YES | NO | Advanced trading terminal | SIMULATED |
| `/scan` | YES | NO | Identity QR scanner | LIVE |
| `/passport/*` | YES | NO | Public identity profiles | LIVE |

## 🟡 CAPA 1 (Gate / Auth)
Authentication entry points. `<DynamicIsland />` is **HIDDEN**. Not indexed by crawlers (`noindex`).

| Route | Island | Indexed | Claim | Status |
|---|---|---|---|---|
| `/connect` | NO | NO | Web3 Wallet connection | LIVE |
| `/login` | NO | NO | Web2 Email fallback | LIVE |
| `/sign-up` | NO | NO | User registration | LIVE |
| `/mobile-auth` | NO | NO | Handshake for mobile devices | LIVE |

## 🔵 CAPA 0 (Public / Marketing)
Public-facing pages. `<DynamicIsland />` is **HIDDEN**. Indexed by crawlers (`index, follow`).

| Route | Island | Indexed | Claim | Status |
|---|---|---|---|---|
| `/` | NO | YES | `ImmersiveManifestoLanding` - Privacy redefined | MARKETING-ONLY |
| `/how-it-works` | NO | YES | Architecture overview | MARKETING-ONLY |
| `/product/*` | NO | YES | Product features | MARKETING-ONLY |
| `/faq` | NO | YES | Frequently Asked Questions | MARKETING-ONLY |
| `/blog` | NO | YES | Corporate updates | MARKETING-ONLY |
| `/docs` | NO | YES | User documentation | MARKETING-ONLY |
| `/manifesto` | NO | YES | Vision statement | MARKETING-ONLY |
| `/whitepaper` | NO | YES | Technical paper | MARKETING-ONLY |
| `/company` | NO | YES | About us | MARKETING-ONLY |
| `/contact` | NO | YES | Contact form | MARKETING-ONLY |

## ⚪ CAPA LEGAL (Legal & Compliance)
Legal documents. `<DynamicIsland />` is **HIDDEN**. Indexed.

| Route | Island | Indexed | Claim | Status |
|---|---|---|---|---|
| `/legal` | NO | YES | Terms Directory | LIVE |
| `/privacy` | NO | YES | Privacy Policy | LIVE |
| `/terms` | NO | YES | Terms of Service | LIVE |
| `/security` | NO | YES | Security practices | LIVE |

## 🔴 CAPA TEST & DEAD (Orphaned / Experiments)
Unlinked routes or developer playgrounds. `<DynamicIsland />` is **HIDDEN**. Not indexed.

| Route | Island | Indexed | Claim | Status |
|---|---|---|---|---|
| `/test-qd` | NO | NO | QD transfer testing | DEAD |
| `/test-xmtp` | NO | NO | XMTP sandbox | DEAD |
| `/zk-sandbox` | NO | NO | Noir circuits testbed | TEST |
| `/voss-supremacy` | NO | NO | Legacy campaign landing | DEAD |
| `/gold-registry` | NO | NO | Alternate feature landing | DEAD |
| `/cosmic-forge` | NO | NO | Alternate feature landing | DEAD |
