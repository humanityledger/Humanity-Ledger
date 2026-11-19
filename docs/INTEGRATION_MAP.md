# Integration map: one source of truth per fact

Estado: vigente · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: este archivo

Each topic has one source. Every other file links to it or reads it in code. Inventory made with `git grep -n` on
19/11/2026 over `app/`, `components/`, `lib/` and `docs/` (main `3cf7215`), for the terms listed in
[`docs/GLOSSARY.md`](GLOSSARY.md). `scripts/docs/check-consistency.mjs` repeats the search on every CI run.

| Topic | Source of truth | Files that repeat it | Action |
| --- | --- | --- | --- |
| Contract instances on Alpha (HLC, classes, blocks, audit: null) | `deployments/aztec-mainnet.json` | `lib/landing/content.ts`, `lib/protocol/read.ts`, `docs/MAINNET_READINESS.md` | Code reads the JSON. Docs link to it |
| Testnet instances | `deployments/aztec-testnet.json` | `docs/AZTEC_TESTNET_DEPLOYMENTS.md` | Link |
| Operator decisions (OD-1 to OD-10, PA-1) | `docs/alpha/OPERATOR_DECISIONS.md` | `docs/PENDING_STEFAN.md`, `docs/MAINNET_READINESS.md` | Link |
| What each asset is (HLC test, cUSDC planned, Fee Juice fees) | `lib/payments/assets.ts` | wallet, landing FAQ, `docs/payments/CUSDC_INTEGRATION.md`, `docs/TOKENOMICS.md` | Code reads it. Docs link |
| HLC on-chain metadata (name, symbol, decimals) | `HLC_TOKEN_META` in `lib/payments/assets.ts` (package 1) | operator tool in `components/zk/ZkWalletPanel.tsx`, preflight | Read from the source |
| HLC token model | Withdrawn (PA-1). `docs/TOKENOMICS.md` says so | `docs/protocol/FEE_CONTRACT_IMPLEMENTATION_LOG.md` | Kept as a historical record, marked |
| Closed alpha gate, tester cap, distributor | `closedAlpha` in `deployments/aztec-mainnet.json`, `lib/alpha/gate.ts` | `lib/alpha/invites.ts`, runbook | Read from the source |
| Legal provider and controller | `lib/constants/legalEntity.ts` | `lib/docs/pages/legal.ts` (not edited), `docs/legal/*.md` | Drafts link to it |
| Legal analysis | `docs/legal/NOTA_PRELIMINAR_2026-11-19.md` (unsigned) | dossier for counsel | Kept as a draft |
| Alpha terms, privacy, legal notice, assignment to the S.L. | `docs/legal/drafts/ANEXO_I` to `ANEXO_IV` | none | Drafts until counsel signs |
| Allowed and forbidden words | `docs/GLOSSARY.md` | every surface | Checked in CI |
| Third-party marks on the site | `BRAND_FILES` in `lib/landing/content.ts` and `public/brand/README.md` | landing | Package 7 |
| Contract upgrade policy | `docs/ADR/005-contratos-no-actualizables-en-alpha.md` (package 9) | none | New |
| What a private payment reveals on Alpha | `FEE_PRIVACY` in `lib/landing/content.ts` (package 5) | wallet, agreement composer, invoice, settings | Read from one place; tested |
| Closed alpha gate enforcement | `GET /api/alpha/gate` + `lib/alpha/gate-client.ts` (package 7, R2-1) | `lib/aztec/chat-agreements.ts` | Asked before deploy and before funding |
| Payment and delivery measures | `/api/wallet/payment-report`, `/api/chat/delivery-report`, `lib/ops/counters.ts` | `/status`, `/api/status/alpha`, "Alpha alerts" workflow | Package 6 |
| Alert thresholds | `lib/ops/alerts.ts` | `docs/alpha/TESTER_MISSIONS.md` | Proposals for Stefan |
| Signed terms served and hashed | `docs/alpha/TERMS_PUBLISHING.md` | `/alpha`, `/api/alpha/redeem` | Package 3 |
| Admission data retention | `railway.purge.toml`, `docs/alpha/PURGE_CRON.md` | `scripts/alpha/purge.mjs` | Package 3 |
| Wave 1 classes vs artifacts | `test/unit/aztec/wave1-classes.test.ts` | `closedAlpha.classes`, `DEPLOY_RUNBOOK.md` | Package 4 |
| Wallet slots and test-network readiness | `TOKEN_ORDER`, `TESTNET_TOKEN_KEYS` in `lib/aztec/wallet/config.ts` | `lib/payments/assets.ts` | Package 9 |

## Findings of the inventory and what was done

| Finding | Where | Action |
| --- | --- | --- |
| False claims of an audit | `docs/RELEASES.md`, `docs/AUDIT_DOSSIER.md`, `lib/translations.ts`, "[AUDITED]" code comments | Reworded: internal security review, no external audit |
| "Humanity Ledger Corporation" and `ledgeralert.corp` | `app/api/payment/webhook`, `app/api/v1/ledger/*`, `lib/api-guard.ts`, `lib/email.ts` | Package 2 |
| HLC deploy tool uses "Humanity Ledger Corp." | `components/zk/ZkWalletPanel.tsx` | Package 1 |
| DPO and external consultancy that do not exist; "anonymous transfers" | `docs/legal/*.md` | Package 8 |
| Aztec nodes labelled "official" | `docs/DEPLOYMENT_TOPOLOGY.md`, `docs/SEQUENCER_RESILIENCE.md` | Reworded: run by Aztec Labs |
| Historical records that quote old wording | `docs/archive/`, `docs/inventory/`, `docs/security/`, `docs/audit/`, `docs/UPGRADE_LOG.md` | Kept as written, skipped by the check |
| `lib/docs/pages/legal.ts`, `protocol.ts` | not edited by project rule | The check skips them. No finding is known in them today |

## Pending, with owner

- ADR numbering: the prompt asked for `docs/adr/0001-…`. The repository already has `docs/ADR/`. On Windows and macOS, `adr` and `ADR` are the same folder, so the new ADR is `docs/ADR/005-…`.
- The four-line header (state, date, owner, source of truth) is on every file created in this work. Older documents get it when they are next edited.
