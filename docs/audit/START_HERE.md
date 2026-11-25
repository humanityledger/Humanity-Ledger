# Reviewer start page: 25 November 2026

This is the entry point for anyone reviewing Ledger Chat. It is current as of `main` on 25 November 2026. The older audit documents listed in section 7 are history, and where they disagree with this page, this page is right.

**An external audit begins on 25 November 2026. None has been completed.** Until its report exists, `deployments/aztec-mainnet.json` keeps `"audit": null`, and the report will be published in full from `/docs/audits`. Aztec Labs, the Aztec Foundation and XMTP Labs have not reviewed, endorsed or audited this project. The internal reviews were written by the engineering assistant and the operator, and they do not replace an external one.

## 1. What runs today

| Part | Where | State |
|---|---|---|
| Encrypted direct messages | XMTP v3 (MLS, browser SDK 5.2.0) | Live. We use XMTP's MLS and do not implement it |
| Private payments: send, shield, unshield | Aztec Alpha on Ethereum mainnet (v6.0.0 Tierra, rollup version 2070860440) | Live, in cUSDC for a closed beta of at most 100 invited members until 23 Feb 2027, with a cap on each payment |
| Payment cards, requests and receipts in the chat | Client | Live |
| Escrow and payment streams (aztec-nr) | Aztec test network only | **Refused on Alpha** in the client and in the scripts while `audit` is `null` |
| Ethereum portal, receiver addresses and `PortalToken` | None | Written and tested, **not deployed on any network** |
| Community posts | XMTP MLS for new communities; our server for older ones | Since 24 Nov 2026 a new community's first channel is an XMTP MLS group made by the creator's client, and the server keeps only its id. Older communities stay readable by our server and are not migrated |
| Attachments | Client, Cloudflare R2 | Encrypted in the browser (AES-256-GCM); R2 holds ciphertext only (`lib/chat/remote-attachment.ts`) |
| Languages | Website and chat | English, Spanish, Russian, German, Chinese (`lib/i18n`); legal pages in English |

Each claim comes with its evidence in `docs/EVALUATION_DOSSIER.md` §1.

## 2. Scope by priority

### P1. Code that touches real value on Alpha today

| Area | Files |
|---|---|
| Wallet keys and the encrypted store | `lib/aztec/wallet/keys.ts`, `lib/aztec/wallet/client.ts`, `lib/aztec/wallet/passkey.ts`, `lib/xmtp/device-key-vault.ts`, `lib/xmtp/db-key.ts` |
| Network identity and fees | `lib/aztec/fees.ts` (`identifyNode`), `lib/aztec/fee-juice.ts`, `lib/aztec/wallet/node-choice.ts` |
| Token loading (AIP-20 cUSDC, class pinned) | `lib/aztec/standards-token.ts`, `lib/aztec/token-dialect.ts` |
| Beta gate, checked on the server before every payment | `lib/beta/*`, `app/api/alpha/*`, `lib/payments/personal-limits.ts` |
| Binding a chat identity to an Aztec address (G7, `hl/aztec-binding/v2`) | `lib/aztec/peer-binding.ts`, spec in `docs/aztec/G7_BINDING_SPEC.md` |
| What the user is told stays private | `lib/privacy/disclosure.ts` |

### P2. Contracts written but not live

| Contract | Lines | Tests | Notes |
|---|---|---|---|
| `contracts/portal/HLPortal.sol` | 425 | `test/portal/HLPortal.test.ts` (36 cases, Hardhat) | Invariants I1 to I6 in the file header (lines 1 to 37). Design in `docs/PORTAL.md` |
| `contracts/portal/HLReceiver.sol` and its factory | 175 | Same suite | EIP-1167 clones at CREATE2 addresses. Design in `docs/RECEIVER_ADDRESSES.md` |
| `contracts/aztec/portal_token` | 147 | 233 lines of TXE | No public total supply |
| `contracts/aztec/escrow` (PrivateEscrow) | 372 | 453 lines of TXE | Test network only |
| `contracts/aztec/streams` (PaymentStream) | 543 | 619 lines of TXE | Test network only |
| `contracts/aztec/identity` | 313 | 295 lines of TXE | Test network only |

### P3. Client security added on 24 November 2026

These are small and each has its own unit tests:
- `lib/chat/message-authority.ts`: who may edit or delete a message;
- `lib/backup/encrypted-archive.ts`: an archive sealed with a passphrase (PBKDF2-SHA256 at 600,000 iterations, AES-256-GCM) and bound to the wallet that made it;
- `lib/chat/safety-glyphs.ts` and `lib/chat/verified-contacts.ts`: the safety number, taken from both inboxes and every installation on them;
- `lib/communities/mls-membership.ts`: never removes members against an incomplete list;
- `lib/xmtp/client.ts` (`routeFor`): a chat keyed by an XMTP inbox or conversation id sends to that DM instead of failing, and inbox ids resolve through the SDK 5 inbox state.

### Out of scope

The repository has a long history, and most of its directories are not Ledger Chat. Out of scope are the standalone circuits, retired on 25 November 2026 to `archive/standalone-circuits` (they have known soundness issues, section 4; nothing in the product, build or CI reaches them), the Solidity contracts outside `contracts/portal/`, and modules under `lib/` that the app does not import (Studio, BSV, the academic tooling and other experiments). If a file is not named in this section or reached from it, it is not part of the product.

## 3. How to reproduce

The commands are in `docs/EVALUATION_DOSSIER.md` §14. In brief:
- `npm ci`, then `npm run test:run` and `npm run test:contracts`;
- `aztec compile` and `aztec test` in each `contracts/aztec/*` directory (Aztec 6.0.0).

CI runs on every pull request. Four checks are required to merge into `main` and pass there since 24 November 2026: TypeScript & Lint, Unit Tests (Vitest), Contract Tests (Hardhat) and Foundry.
- `.github/workflows/ci.yml` (type check, lint, unit tests);
- `aztec-contracts.yml` (compile and TXE);
- `aztec-ci.yml` (including the ACIR opcode report).

The read-only checks against Alpha are `aztec-mainnet-preflight.yml` and `aztec-deployments.yml`. Addresses, classes and transaction hashes on Alpha are in `deployments/aztec-mainnet.json`.

## 4. Known issues, stated before you find them

| ID | Severity | Issue | Effect today |
|---|---|---|---|
| ZK-01 to ZK-07 | Up to critical | Standalone Noir circuits (for example, a stream accrual that can be claimed many times, or proofs not bound to the payout address) | Retired on 25 November 2026 to `archive/standalone-circuits`, whose README maps each issue to the aztec-nr contracts. Never deployed. Listed in `docs/EVALUATION_DOSSIER.md` §9 |
| FEE-PAYER | Privacy | On Alpha there is no sponsored FPC, so each account pays its own Fee Juice and is the public fee payer. Its transactions can be linked | Stated in the app before every payment (`lib/privacy/disclosure.ts`) |
| CUSDC-RECV | Function | A cUSDC receive is not yet listed by the wallet, so cUSDC requests stay "announced" | `docs/EVALUATION_DOSSIER.md` §3 |
| PORTAL-ADMIN | Design | The portal has an admin and a guardian. They can pause deposits, lower caps, disable an asset and pause withdrawals for at most 3 days. **No key can take funds out (I2)**. Relaxations wait 2 days and are public (I4) | Not deployed |
| PORTAL-L1-PUBLIC | Privacy | In L2 there is no public supply, but `totalLocked` and the portal's balances on L1 are public | Not deployed |
| RECEIVER-LINK | Privacy | Until private fees exist, the account that claims from a receiver pays its own Fee Juice and is public. Receivers are therefore not presented as unlinkable on Alpha | Not deployed |
| TESTNET-KEYLESS | Function | The shared `PrivateEscrow` and `PaymentStream` instances on the test network were deployed without public keys, so tokens sent to them can never be spent. The app uses a keyed instance for each agreement | `docs/AZTEC_TESTNET_DEPLOYMENTS.md` |
| XMTP-PUBLISH | Reliability | Some sends log "Sync failed to wait for intent" and are retried. Under investigation, with no loss of confidentiality | Messages may arrive late |
| DEADMAN-SELF | Funds stuck (owner's own mistake) | `LedgerDeadmanSwitch` accepted its own address as backup, so a trigger locked the owner's tokens in it. Found by the Foundry invariant `invariant_deadman_rules` | Fixed in #260. Not deployed |
| CI-RED | Hygiene | The four required checks pass on `main`. Non-required checks still fail for reasons outside the product code: `npm audit` and the dependency audits (prisma and effect rated high, next rated moderate), Lighthouse, and a check that the owner's name does not appear in files outside its exception list | Waiting on the operator |
| SEND-UNRESOLVED | Function | Fixed 24 Nov 2026 (#273): replies in a chat filed under an XMTP id failed with "Not sent" | `test/unit/chat/send-to-unresolved-peer.test.ts` |
| DOCS-500 | Availability | Fixed 25 Nov 2026 (#275): every `/docs` page returned 500 for about seven hours after the i18n merge | `test/unit/i18n/rsc-boundary.test.ts` |
| XMTP-LABS-CLOSING | Dependency | XMTP announced on 22 Oct 2026 that the network hosted by XMTP Labs, which carries all our direct messages, shuts down in early 2027. Our own backend is planned in `docs/xmtp/SELF_HOSTED_MIGRATION.md`; backend authentication is in code and off | Plan, phases M0 to M7 |
| G7-R8 | Test gap | The address binding has not been run between two different people | Unit tests only |
| PASSKEY-DEVICE | Test gap | The passkey path (WebAuthn PRF) has not been tested on a real device | Unit tests only |

## 5. Operator decisions that constrain the design

The decisions are recorded in `docs/alpha/OPERATOR_DECISIONS.md`:
- **OD-1:** the portal is wave 2 and goes after an external review;
- **OD-6:** the admin is a 2-of-3 Safe and the guardian is a separate hardware wallet;
- **B-1:** an alert on every `queueAdmin`, `queueGuardian` and `queueSunset`;
- **OD-3:** caps are set with the review;
- **OD-9:** the portal needs its own maximum-loss figure.

## 6. Questions for Aztec Labs

These are in `docs/EVALUATION_DOSSIER.md` §15. Feedback on the G7 binding (`docs/aztec/G7_BINDING_SPEC.md`) and on the portal's use of the Inbox and Outbox would help most.

## 7. Older documents (history)

These are kept as written. Read them for context, not for the current state:
- `docs/AUDIT_SCOPE.md` (31 Oct);
- `docs/audit/JANUARY_2027_AUDIT_DOSSIER.md` (2 Nov);
- `docs/AZTEC_AUDIT_MANIFEST.md` (10 Nov);
- `docs/audit/PROTOCOL_STATE_2026-11-14.md`;
- `docs/AUDIT_DOSSIER.md` (18 Nov);
- `docs/audit/INTERNAL_AUDIT_2026-11-18.md`;
- `docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-18.md` and `-19.md`.

`docs/audit/EXTERNAL_REVIEW_PACKAGE.md` lists what a reviewer receives and is kept current. `docs/LEGAL_REVIEW_25NOV.md` lists where the legal pages no longer match the code; they are left to the operator and counsel (OD-8).

## Disclosure

To report a vulnerability, follow `SECURITY.md`.
