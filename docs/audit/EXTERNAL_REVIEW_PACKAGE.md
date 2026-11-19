# External security review: preparation package (NLnet D-4, D-5)

**No external audit or external review of Ledger Chat exists.** `deployments/aztec-mainnet.json` has `"audit": null`. This file lists what a reviewer would receive. It is a preparation, not a claim. D-4 and D-5 are deliverables proposed in `docs/NLNET_DRAFT.md`, which has not been submitted or granted.

## Scope proposed

1. The Noir contracts `contracts/aztec/escrow` (PrivateEscrow) and `contracts/aztec/streams` (PaymentStream), at the classes in `closedAlpha.classes`.
2. Their use from the app: `lib/aztec/agreements.ts`, `lib/aztec/chat-agreements.ts`, `lib/aztec/keyed-deploy.ts`, `lib/aztec/agreement-policy.ts` and `lib/alpha/gate.ts`.
3. The wallet's key handling: `lib/aztec/wallet/keys.ts` and the encrypted store.
4. The closed alpha admission: `/api/alpha/*` and `scripts/alpha/*`.

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
