# External security review: preparation package (NLnet D-4, D-5)

Start at [`START_HERE.md`](START_HERE.md) for the current state, the scope by priority and the known issues.

**An external audit begins on 25 November 2026; none has been completed.** `deployments/aztec-mainnet.json` keeps `"audit": null` until a report exists. This file lists what a reviewer receives. It is a preparation, not a claim. D-4 and D-5 are deliverables proposed in `docs/NLNET_DRAFT.md`: the proposal was submitted on 14 November 2026 and is under review; nothing has been awarded.

## Scope proposed

1. The Noir contracts `contracts/aztec/escrow` (PrivateEscrow) and `contracts/aztec/streams` (PaymentStream), at the classes in `closedAlpha.classes`.
2. Their use from the app: `lib/aztec/agreements.ts`, `lib/aztec/chat-agreements.ts`, `lib/aztec/keyed-deploy.ts`, `lib/aztec/agreement-policy.ts` and `lib/alpha/gate.ts`.
3. The wallet's key handling: `lib/aztec/wallet/keys.ts` and the encrypted store.
4. The closed alpha admission: `/api/alpha/*` and `scripts/alpha/*`.

5. Added on 24 November 2026 (alignment phases 1 to 7), each small and with its own tests:
   - `lib/chat/message-authority.ts`: who may edit or delete a message (a security fix);
   - `lib/backup/encrypted-archive.ts`: the passphrase-sealed history file (PBKDF2-SHA256 600,000, AES-256-GCM);
   - `lib/chat/safety-glyphs.ts` `safetyDigits`: the device-based safety number;
   - `lib/aztec/wallet/node-choice.ts` and the rollup check in `lib/aztec/wallet/client.ts`;
   - `lib/payments/personal-limits.ts`, checked inside `wallet.send`;
   - `lib/communities/mls.ts`: membership sync of communities on MLS (new communities start on MLS since 24 November 2026; older ones are not migrated);
   - `lib/xmtp/client.ts` `routeFor` and `resolveInboxIdToAddress` (24 November 2026): sending in a chat keyed by an XMTP inbox or conversation id.
6. The address binding, written as a standalone specification: `docs/aztec/G7_BINDING_SPEC.md`.
7. Candidates for a second round, not built: a WebAuthn account contract with guardian recovery
   (`docs/design/ACCOUNT_RECOVERY_PASSKEY.md`) and a private membership proof (`docs/design/PRIVATE_MEMBERSHIP.md`).

## What is ready

- **Artifacts and class ids.** `test/unit/aztec/wave1-classes.test.ts` ties them together, and the "Aztec contracts" workflow recompiles them with 6.0.0.
- **TXE suites:** 24 escrow tests and 35 stream tests (package 4).
- **Internal reviews:** `INTERNAL_SECURITY_REVIEW_2026-11-18.md` and `INTERNAL_SECURITY_REVIEW_2026-11-19.md`.
- **Threat model:** `docs/security/threat-model.md`, including the closed alpha section.
- **Operator documents:** `docs/alpha/DEPLOY_RUNBOOK.md`, `INCIDENT.md` and `OPERATOR_DECISIONS.md`.

## Still to do before a reviewer is engaged (D-4, D-5)

- **D-4:**
  - call the token through its typed interface instead of a raw selector;
  - property tests for accrual and settlement invariants.
- **D-5:**
  - one invariant list per contract;
  - a reproduction guide that someone outside the project can follow in under 30 minutes;
  - narrowing the CSP (R2-6).
- Choosing and contracting a reviewer is Stefan's decision. Nothing in the repository names one.
