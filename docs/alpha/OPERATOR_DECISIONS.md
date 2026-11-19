# Operator decisions: closing Phase 0 and opening the closed alpha

**Signed:** Stefan Antonio Cirisanu — signed in writing in the chat on 18/11/2026, transcribed by the agent.

**Decision document:** "Decisiones del operador: cierre de la Fase 0 y entrada en la alpha cerrada" (18 November 2026). It is the source of the values below.

**What the signature covers.** It authorizes the decisions. It does not authorize any deployment. Every deployment on Aztec Alpha or Ethereum is signed by Stefan with his own keys, and he gives the transaction hash and the block. No agent holds a key, signs or broadcasts.

**What it does not change.**
- `deployments/aztec-mainnet.json` keeps `"audit": null`. No contract of Humanity Ledger has an external audit.
- The Phase 0 review is internal (`docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-18.md`).
- Q1–Q10 (`docs/AZTEC_DECISIONS.md`) stay open until Aztec Labs answers.

## Phase 0: B-1 to B-5

| Id | Finding | Decision (18/11/2026) |
|---|---|---|
| B-1 | IR-04 (medium): the guardian cannot cancel a queued admin, guardian or sunset change | **Accepted with mitigations.** No `cancelRoleChange`. Conditions for wave 2: admin is a Safe of at least 2 of 3 (OD-6); an alert on every `queueAdmin`, `queueGuardian` and `queueSunset`; the deploy preflight refuses admin = guardian (IR-10). |
| B-2 | IR-02 (medium, fixed in `d3890e0`) | **Confirmed.** |
| B-3a | IR-05 (medium): HumanityIdentityRegistry accepted a World ID nullifier without a proof | **Retired.** The contract and its bytecode-verifier target are removed. Identity is IdentityCredential (aztec-nr). |
| B-3b | IR-06 (medium): StudioProvenance claims could be front-run | **Retired.** If Studio returns, it is written with commit-reveal. |
| B-3c | IR-13 (low): LedgerDeadmanSwitch's pause has no expiry | **Out of `scripts/deploy-system.ts`**, and the 410 text no longer says it operates on Polygon. If it returns to the roadmap: a pause that expires after 30 days and only the owner renews. |
| B-4 | Aderyn retired upstream | **Slither alone**, with its justified exclusions. Semgrep with Solidity rules later, if wanted. |
| B-5 | Two items that were mislabelled | **IA-08:** `npm audit` (43 high). This is a Phase 0 exit criterion; Stefan clears it on a machine with network access (`npm audit fix`, major upgrades reviewed one by one, CI green). **IA-09:** the CI authorship check fails because the licence names its holder. Decision: add `LICENSE-MIT`, `README.md`, `app/layout.tsx`, `lib/protocol/fees.ts` and the escrow source to its exceptions. It does not block the alpha. Stefan applies it (an agent does not change CI guards). |

**Fees D-1 to D-5: option A.** They remain the technical base for after the alpha and are not confirmed for charging. During the alpha there is no protocol fee (OD-7).

**IA-01** (a stream can always be cancelled; dust pays no fee; a fee above TX_CAP is charged as TX_CAP) applies once a fee is charged. With OD-7 it has no effect in the alpha.

## Closed alpha: OD-1 to OD-10

| Id | Decision | Value | Date |
|---|---|---|---|
| OD-1 | Contracts in the alpha | **Wave 1:** PrivateEscrow and PaymentStream on Aztec Alpha, with HLC. **Wave 2, after an external review:** HLPortal, PortalToken, receivers. | 18/11/2026 |
| OD-2 | Maximum per payment, escrow and stream | **100 HLC each** (100,000,000 base units; HLC has 6 decimals), immutable in the new classes (`MAX_AMOUNT`) and repeated in the client (`ALPHA_MAX_AMOUNT`, `lib/protocol/fees.ts`). | 18/11/2026 |
| OD-3 | Portal caps per asset | **Does not apply to wave 1.** For wave 2 they are set with the external review, with min ≤ per deposit ≤ per sender and day ≤ global. Around midnight a sender can move twice the daily cap (IR-07). | 18/11/2026 |
| OD-4 | Number of testers, and who invites them | **At most 20.** Only Stefan's wallet invites (`ALPHA_ADMINS`). Each tester is named. Whether MiCA's 150-persons-per-Member-State exemption applies is a question for the lawyer (OD-8), not a fact stated here. | 18/11/2026 |
| OD-5 | Gate scope | **`value`:** only escrow and streams on Alpha are gated. | 18/11/2026 |
| OD-6 | Admin Safe and guardian | **Wave 2 only.** A Safe of 2 of 3, with three keys on different devices held by different people; the guardian on a separate hardware wallet. | 18/11/2026 |
| OD-7 | Protocol fee | **Off in the alpha:** `FEE_BPS = 0` and `MIN_FEE = 0` in the escrow, `FEE_BPS = 0` in the stream (its minimum was already 0). TXE tests show that nothing is transferred to the treasury. | 18/11/2026 |
| OD-8 | Lawyer's note and testers' terms | **A written note before the first invitation code**, covering free HLC to 20 people, non-custodial software and AMLR 2027. Agents do not write legal texts. | 18/11/2026 |
| OD-9 | End date and maximum loss | **8 weeks from the first deployment.** Maximum loss: **20 AZTEC per tester × 20 = 400 AZTEC** of Fee Juice given to testers. Fee Juice has a market value; HLC has no monetary value. Wave 2 needs its own figure: twice the daily caps plus everything open. | 18/11/2026 |
| OD-10 | Authorization | "Yo, Stefan, desplegaré OD-1 en Aztec Alpha con los límites anteriores, sin auditoría externa, para una alpha cerrada." Wave 2 is signed separately and includes Ethereum. | 18/11/2026 |

Fee Juice per tester: in the last measurement, creating an account reserved about 15 AZTEC and charged 1.8. The team hands it over with a fee link. Ledger Chat still sponsors no fee (decision of 15 November 2026).

## What still has to happen before wave 1 (not decisions)

1. The new classes recompiled by CI and their class IDs recorded (`deployments/aztec-testnet.json`).
2. Invitations, the `closedAlpha` gate, the code and consent screens, monitoring, and the incident runbook, rehearsed once.
3. A rehearsal on the test network between two accounts that are not the operator's.
4. A real G7 session between two people (R8).
5. The lawyer's note (OD-8).
6. IA-08.
7. The four questions Q1, Q2, Q4 and Q5 sent to Aztec Labs.

## Reported by Stefan (18/11/2026, in the chat)

Stefan reported that between two different phones, calls, video calls, chat and sending money work. No accounts, network or transaction hashes were given, so this record holds no figure. R8 (a G7 session and a payment between two different people, `docs/MAINNET_READINESS.md`) is marked done only with those details.

## OD-4 amended (19/11/2026)

**Decision:** the closed alpha takes **at most 50 testers, for messaging and for payments** (option A). It was 20 for payments.

Stefan Antonio Cirisanu decided this in writing in the chat on 19/11/2026 ("50 para todo, mensajería y pagos"). The agent transcribed it here.

**Applied in:**
- `lib/alpha/invites.ts`: `MAX_TESTERS = 50`;
- `deployments/aztec-mainnet.json`: `closedAlpha.maxTesters` = 50;
- `scripts/alpha/invites.mjs`;
- `docs/alpha/DEPLOY_RUNBOOK.md`;
- the landing (`lib/landing/content.ts`, `NEXT_WAVE`).

`/api/alpha/redeem` enforces the cap on the server.

**Unchanged:**
- OD-2: 100 HLC per agreement.
- OD-9, the Fee Juice budget: set at 20 AZTEC per tester × 20 = 400 AZTEC. With 50 testers it would be 1,000 AZTEC. **Open: Stefan decides whether the budget per tester or the total changes.**

## PA-1: the payment assets (19/11/2026)

**Decision:** **HLC is a test token**, with no monetary value, used only to test private payments in the closed alpha. It
is never sold, offered, airdropped or launched, and **no launch of HLC is planned**: the token model in
`docs/TOKENOMICS.md` is suspended. **Real payments are planned in cUSDC** (Clean USDC, issued by human.tech through its
Shield bridge, not by Humanity Ledger) and stay off until every gate in `lib/payments/assets.ts` (`CUSDC_GATES`) is met.
AZTEC, as Fee Juice, only pays network fees: Aztec makes it non-transferable on L2.

Stefan Antonio Cirisanu decided this in writing in the chat on 19/11/2026 ("deja claro de forma explícita que HLC es
prueba token para posteriormente integrar cUSDC como activo de pago real"). The agent transcribed it here.

**Applied in:**
- `lib/payments/assets.ts`: roles, the test-token note, `CUSDC_GATES` (all unmet);
- `deployments/aztec-mainnet.json`: HLC `role: "test"`, `monetaryValue: "none"`; cUSDC in `plannedTokens`, `verifiedOnChain: false`;
- the wallet (balance and send review) shows "Test token · no monetary value" next to HLC;
- the landing FAQ; `docs/TOKENOMICS.md` and `lib/protocol/tokenomics.ts` marked suspended;
- `docs/payments/CUSDC_INTEGRATION.md`, `docs/alpha/TESTER_MISSIONS.md`.

**Gates for cUSDC (none met today):** a written legal note (non-custodial software, not a crypto-asset service
provider); the S.L. with terms of use and privacy policy for real payments; the address confirmed on the Aztec v6 node
by the read-only preflight; the HLC alpha finished within its targets; Stefan's signature with a cap per payment.

**Unchanged:** OD-2 (100 HLC per agreement), OD-7 (no protocol fee), OD-8 (the lawyer's note before the first
invitation code), OD-9 (open, see above).

**PA-1, applied further (19/11/2026, afternoon).** Following the preliminary legal note prepared for counsel (not yet
signed by a lawyer), the HLC token model is **withdrawn**, not only suspended: `docs/TOKENOMICS.md` now states that HLC
is a test token and that no launch is planned; the allocations, fair launch, buyback and burn, staking, vesting and
launch conditions are removed from `lib/protocol/tokenomics.ts` and from the landing sections; the old text stays only in
git history. In the same change: the Alpha banner no longer says "Real ETH" (payments are in HLC, fees in Fee Juice);
the visit counter stores nothing in the browser; `public/aztec_x_ledger_partnership.svg` is removed. Still for Stefan:
redeploy HLC with a neutral on-chain name (the current contract is named "Humanity Ledger Corp.").
