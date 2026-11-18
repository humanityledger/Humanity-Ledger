# Operator decisions for the closed alpha (OD-1 … OD-10)

Phase 2 (the closed alpha by invitation) starts only when two things are true:

- Every row below has a **value** and a **date**, written by Stefan.
- The Phase 0 exit criteria hold (`docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-18.md` §7).

An agent never fills this table. Empty means not decided.

| Id | Decision | What the value must say | Constraint found in Phase 0 | Value | Date |
|---|---|---|---|---|---|
| OD-1 | Contracts in the alpha | Which of PrivateEscrow, PaymentStream, HLPortal + PortalToken, receivers. | Every one of them is unaudited. A new escrow or stream class is needed for the immutable `max_amount` (Phase 2). | | |
| OD-2 | Maximums per payment, escrow and stream, per token | Base units per token (HLC has 6 decimals). | They become immutable in the new classes and are mirrored in `lib/aztec/agreement-policy.ts`. | | |
| OD-3 | Portal caps per asset | minDeposit, perDepositCap, perSenderDailyCap, globalDailyCap. | The requirement is `min ≤ perDeposit ≤ perSender ≤ global`. Across midnight, one sender can move 2 × perSenderDailyCap (IR-07). | | |
| OD-4 | Number of testers, and who invites them | A number and the inviting addresses (`ALPHA_ADMINS`). | | | |
| OD-5 | Gate scope | `value` (only value features gated) or `app` (the whole app). | | | |
| OD-6 | Safe address and threshold (at least 2 of 3), and a separate guardian address | Addresses on Ethereum. | The HLPortal constructor accepts admin == guardian (IR-10), so the deploy preflight must refuse it. The guardian cannot cancel role changes (IR-04, decision B-1). | | |
| OD-7 | Protocol fee | "Off", or D-1 … D-5 confirmed. | Fees are fixed in bytecode: changing them is a class change. | | |
| OD-8 | Lawyer's note on MiCA and AMLR; testers' terms | A reference to the lawyer's note. The terms are written by the lawyer. | Agents do not edit `lib/docs/pages/legal.ts` or `protocol.ts`; a placeholder is left. | | |
| OD-9 | End date and maximum loss | A date and an amount. | Maximum exposure ≥ 2 × the daily caps per window (IR-07), plus everything in open escrows and streams. | | |
| OD-10 | Authorization | The sentence: "I, Stefan, will deploy OD-1 on Aztec Alpha and Ethereum with the caps above, unaudited, for a closed alpha." | | | |

## Phase 0 decisions also waiting (from the review, §8)

| Id | Decision | Value | Date |
|---|---|---|---|
| B-1 | IR-04: should the guardian cancel queued role and sunset changes? | | |
| B-2 | IR-02 (applied in `d3890e0`): confirm it, or revert it. | | |
| B-3 | IR-05, IR-06, IR-13: retire or fix HumanityIdentityRegistry and StudioProvenance; a pause that expires in LedgerDeadmanSwitch. | | |
| B-4 | Replacement for Aderyn (retired upstream), or Slither alone. | | |
| B-5 | IA-08: the CI authorship checks. | | |
