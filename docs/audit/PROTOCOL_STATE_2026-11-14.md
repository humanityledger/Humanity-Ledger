# Protocol state after #88, 14 November 2026

Source of truth: code and `deployments/*.json` on `main` at `926013e` (merge of #88). Where a document disagrees, the code and JSON win and the contradiction is listed. Vocabulary as in `docs/zk/MASTER_PROMPT.md`: real on testnet, real only in tests, pending first recorded run, refused by policy, experimental, unproven.

## 0. Baseline

| Component | Claimed (docs) | Evidence | Risk if wrong | Confidence |
|---|---|---|---|---|
| Network of production | Alpha since #41 | `docs/MAINNET_READINESS.md` lines 3, 46 and 55: Railway sets `NEXT_PUBLIC_AZTEC_NETWORK=alpha` and `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true`; `scripts/aztec/check-alpha-config.mjs` runs in mode `strict` before `next build`. Not checked against the Railway variables themselves (no access) | Users on Alpha read testnet copy | Medium |
| Build arguments | Every `NEXT_PUBLIC_AZTEC_*` is passed to `next build` | `Dockerfile` ARGs: `NEXT_PUBLIC_AZTEC_NETWORK, _ALPHA_ENABLED, _NODE_URL, _L1_*, _EXPLORER, _TOKENS, _AGREEMENT_CAPS, _VALUE_MODE, _RPC_MAX_BATCH, _SPONSORED_FPC, _FAUCET, _SPONSOR, _SPONSOR_ADMIN`, plus `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_WC_PROJECT_ID`, `NEXT_PUBLIC_ONE_CLICK_AUTH`, `AZTEC_ALPHA_CONFIG_CHECK` | A variable set in Railway but not an ARG never reaches the bundle | High |
| Server variables | — | Read at run time: `AZTEC_VALUE_MODE`, `AZTEC_SPONSOR_SIGNER_KEY`, `AZTEC_SPONSOR_PER_DAY`, `AZTEC_SPONSOR_PER_WALLET`, `AZTEC_NODE_URL`, `AZTEC_NODE_RELAY`, `AZTEC_PXE_URL`, `AZTEC_FPC_ADDRESS`, `AZTEC_RELAYER_SECRET_KEY`, `AZTEC_TOKEN_CONTRACT_ADDRESS` | — | High |
| Boot | #88: the server starts even when a migration needs a person | `start.sh`: `node scripts/railway-pre-deploy.js \|\| echo "[start.sh] WARNING …"`; deploy healthy after #88 (operator) | A failed migration only visible in one log | High |
| Migration status | Unknown in production | This PR: `/api/health` lists failed migrations (`services.migrations`, `degraded: ["migrations"]`); runbook `docs/runbooks/MIGRATIONS.md` | Silent schema drift | Medium until the first health read |
| Dependencies | `npm audit` clean | `pm2` 7.1.2 (#85); "Invariant & Security CI" green on #84 | — | High |

## 1. Aztec Alpha (L1 chain 1, rollup version 2070860440)

| Item | State | Evidence |
|---|---|---|
| HLC token | Deployed and confirmed | `deployments/aztec-mainnet.json`: address `0x2cd0f3775d129210ecf2165e338e1b6b708f2243ac1b30feb0ac49875366e55d`, class `0x067df4ddda0b0872ef604f47f3681d5e8c0de98280ac6b79963851c055ba91e0`, deploy tx `0x0dfc7146b9f807432d06bccf43d3cea88e849455f8f62372ea2b93d41be29136`, block 24544, confirmed by "Aztec mainnet preflight" run 42990431384, 6 decimals |
| Our contracts | None | `contracts: []`, `sponsoredFpc: null`, `audit: null` |
| Private HLC transfer from Ledger Chat | **Real on Alpha** (R1, 14 November) | Transfer `0x1eb2bb76…40a5` in L2 block 29012, issue `0x1d90c138…8940` in 29001, new HLC `0x1f49571a…24e5` deployed in 28992; preflight run 43583640304. Record in `MAINNET_READINESS.md` |
| Fees | Fee Juice only, no sponsored payer | `lib/aztec/fee-juice.ts`; `needs-fee-juice` state in `lib/aztec/wallet/client.ts`; about 28 AZTEC before the first transaction (R4) |
| Agreements | Refused by policy | `lib/aztec/agreement-policy.ts` accepts on Alpha only a class recorded in `deployments/aztec-mainnet.json`, which has none; and R6: escrow and stream artifacts predate the deposit and creation nullifiers (`deployments/aztec-pending-recompile.json`) |
| Sponsor | Not deployed; V2 digest in source (#84) | `contracts/aztec/sponsor`, TXE 7 tests on #84 |
| Public copy | Contradiction | `lib/docs/pages/protocol.ts` said "Test network only … will not be connected to a network with real value until … audit". **Fixed in this PR** for `protocol.ts`; `lib/docs/pages/legal.ts` still needs counsel (agents do not edit legal text) |

Gates (`docs/MAINNET_READINESS.md`): G1 done; G2 built, real run open; G3 partly (HLC only, operator issued); G4 partly (policy, caps, no audit); G5 ready, deploys open; G6 built, two account session open; G7 done in code, two browser run open; G8 open. Remaining items R1 to R9 are all open; R2 is partly closed by this PR.

## 2. Aztec test network

| Contract | Real on testnet (keyed, end to end) | Do not use |
|---|---|---|
| PrivateEscrow | v1 `0x1e03bcfe5c…` (settled), v2 `0x0626779429…`, v3 `0x0253dbdd1e…`, v3 via `openEscrow` `0x12cf33312a…` | keyless `0x1d88555bea…` |
| PaymentStream | v2 `0x2a56c0d41a…`, v3 `0x2bd80a8d2d…`, v4 `0x27fc79965b…` | keyless `0x0567a641e6…` |
| IdentityCredential | v2 `0x10a7799394…`, v3 `0x07c1380971…` (current artifact), `0x174e4652dd…` (active) | — |

Full addresses and class IDs: `deployments/aztec-testnet.json`. Recorded e2e runs: "Aztec escrow e2e (testnet)" 41865790651, 41881180186, 41999587163, 42023143254, 42030688268. TXE on #84: escrow 16, identity 20, sponsor 7, streams 25 (68 tests, all passing on a fresh compile). Real only in tests: the deposit and creation nullifiers (source ahead of the deployed classes), sponsor V2.

## 3. Gap register

| Priority | Gap | Location | Fix | Depends on | Effort | Owner |
|---|---|---|---|---|---|---|
| Done | First recorded private payment on Alpha (R1) | `deployments/aztec-mainnet.json` `firstPrivatePayment` | Recorded 14 November, blocks 28992 to 29012 | — | — | — |
| Critical | Legal text says test network only (R2) | `lib/docs/pages/legal.ts` | Counsel wording for Alpha | Counsel | Days | Stefan |
| Critical | No external audit (G8, R7) | All contracts | Engage auditor; record under `audit` | Budget | External | Stefan |
| High | Escrow and stream artifacts behind source (R6) | `deployments/aztec-pending-recompile.json` | Recompile (Aztec contracts workflow), record class IDs, testnet e2e, clear entries, then Alpha deploy | Toolchain, testnet funds | 1 to 2 days | Engineer + Stefan |
| High | Zero balance onboarding (R4, P1) | `lib/aztec/fee-juice.ts` | Decide P1 (sponsor V2 is ready in source) then deploy sponsor with its own key | Decision, Fee Juice | Days | Stefan |
| High | Unbacked, operator issued HLC (R5, P2) | `deployments/aztec-mainnet.json` tokens | Decide P2 (dollar portal) | Decision, legal | Weeks | Stefan |
| High | Two browser G7 and G6 sessions (R8) | `docs/chat/G6_SESSION_CHECKLIST.md` | Run and record | Two testers | 2 h | Stefan |
| Medium | TURN relay (R3) | `/api/calls/ice` | `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | Railway | 15 min | Stefan |
| Medium | `DATABASE_URL_UNPOOLED` (R9) | Railway | `${{Postgres.DATABASE_URL}}` | — | 5 min | Stefan |
| Medium | Migration visibility after #88 | `/api/health` | Done in this PR | — | — | — |
| Medium | Community posts readable by the server (R-17) | `docs/communities/MLS_MIGRATION.md` | MLS migration as planned | Design | Weeks | Engineer |
| Low | Tokenomics decisions T-1 to T-4 | `lib/protocol/tokenomics.ts` | Priority 2 branch | Decision | Days | Stefan |

## 4. What may and may not be claimed

May: private messaging on XMTP; private HLC balances on Aztec Alpha with fees in Fee Juice, unaudited, first run pending; escrows and streams real on testnet. May not: audited, live private payments on mainnet (until R1 is recorded), dollar value, sponsored onboarding on Alpha, formal verification, quantum resistance, protection against traffic analysis.

## 5. Operations

Healthy after #88 (operator). `/api/health` now reports database, Redis and failed migrations; no secrets in the body. Value mode (`AZTEC_VALUE_MODE=exits-only`) stops new value without a deploy.

## 6. Public status, ready to use

Short: "Ledger Chat runs on Aztec Alpha, a new network that holds real value. Private balances use the HLC token, fees are paid in Fee Juice, and our contracts have not been audited yet. Escrows and payment streams work on the Aztec test network only. Use small amounts."

## 7. Aztec ecosystem

Not listed on aztec.network/apps (checked 14 November 2026; listed: Aztecscan, Dark Forest Aztec, Galactica, Nemi, Nulo, Nyx, Olla, RavenHouse, RollingChat, Shield, Xochi, zk.money, ZKPassport). Missing for a listing request: R1 hashes, an audit or a scoped review, and a public status page in the wording above. Draft (not sent):

> Ledger Chat (ledgerchat.org) is end to end encrypted messaging (XMTP) with private payments on Aztec Alpha v6. HLC token at `0x2cd0…e55d` (block 24544). Escrow, payment stream and identity contracts run end to end on testnet (keyed instances and runs in `deployments/aztec-testnet.json`; 68 TXE tests). Source: github.com/humanityledger/humanity-ledger. We would like to be considered for the apps directory once our first recorded Alpha payment and review are published.

## 8. Lower confidence and what would raise it

| Area | Missing evidence |
|---|---|
| Production variables | A dump of Railway variable names (no values) |
| Migration state in production | First `/api/health` read after this PR |
| Fee Juice amount (about 28 AZTEC) | A recorded account deployment on Alpha |
| Whether the wallet is enabled for users on Alpha | `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED` value in Railway |
