# Aztec Open Questions — Decisions and Resolutions

**Document:** `docs/AZTEC_DECISIONS.md`
**Status:** Working document — decisions open unless marked RESOLVED.
**Created:** 15 November 2026
**Source questions:** `docs/AZTEC_FOUNDATION_DOSSIER.md` § 5, protocol spec §§ 1.3–1.5

This document records every open architectural question directed to Aztec Labs, the current decision or interim position, and what must change once a definitive answer is received. It is the single source of truth referenced in the maturity spec. Any external reply from the Aztec team is recorded here verbatim, with date.

---

## Instructions for use

Each question has four fields:

| Field | Meaning |
|---|---|
| **Decision / interim position** | What the protocol does today while the question is open |
| **Consequence if changed** | What code and docs must change if Aztec Labs recommends a different approach |
| **Status** | OPEN / RESOLVED / WON'T FIX |
| **Aztec reply** | Verbatim, with date, once received |

No code may be changed in response to an Aztec reply without first updating this document and referencing it in the PR description.

The last section of this file records a recommended posture for each question, dated 16 November 2026. Every status stays **OPEN**. A recommended posture is not an Aztec reply and is not a confirmation by Stefan.

---

## Q1 — Shared settlement nullifier (escrow claim / refund)

> *Is the shared settlement nullifier, with those timestamp checks, an idiomatic way to express "claim before the deadline, refund after it"?*

**Context:** `PrivateEscrow` publishes `H(escrow_id, settlement_tag)` as a nullifier from both `claim` and `refund`. Only one of them can land first; the other is refused by the nullifier tree. `claim` enforces inclusion before `deadline`; `refund` enforces inclusion after it. A deposit nullifier `H(escrow_id, sender)` prevents a second deposit under the same `escrow_id` from sharing the settlement path.

**Decision / interim position:** Use the shared settlement nullifier as designed. The deposit nullifier (added after the first version) closes the double-fund vector. Nothing is deployed on Alpha yet; the pattern runs on the test network.

**Repository evidence (19/11/2026):**
- `contracts/aztec/escrow/src/main.nr`: the deposit nullifier over `(escrow_id, sender)` with `DOM_SEP__ESCROW_DEPOSIT` (line 208); the settlement nullifier with `DOM_SEP__ESCROW_SETTLED`, the same value from `claim` (line 255) and `refund` (line 304); claim expiry capped at the deadline (`set_expiration_timestamp`, line 253).
- TXE tests in `contracts/aztec/escrow/src/test.nr`: `claimed_escrow_cannot_also_be_refunded`, `escrow_cannot_be_claimed_twice`, `early_refund_fails`, `claim_after_the_deadline_fails`, `second_deposit_with_the_same_escrow_id_fails`, `the_same_escrow_id_cannot_be_reused_after_settlement`.

**Consequence if changed:** If Aztec recommends `delayed_public_mutable` or a commitment-based approach, the escrow contract must be rewritten and recompiled, the class ID changes, and all deployed instances become legacy. `docs/AZTEC_TESTNET_DEPLOYMENTS.md` and `deployments/aztec-pending-recompile.json` must be updated.

**Status:** OPEN — awaiting Aztec review.

**Aztec reply:** *(none yet)*

**Interim position adopted:** the pattern implemented in the code stays. It follows Path A (Aztec notes and nullifiers) and the noir-contracts v6 examples. Any change needs an explicit reply from Aztec Labs or a new documented decision.

---

## Q2 — Keyed deployment as a custody pattern

> *Is a keyed deployment whose secret is shared with the parties the pattern you recommend for a contract that holds a private balance, or is there a better one?*

**Context:** `lib/aztec/keyed-deploy.ts` deploys each escrow and stream as a fresh instance whose public keys are derived from a random secret created for that agreement (`randomField()` in `lib/aztec/agreements.ts`). The secret travels to the recipient inside the encrypted chat invitation, so both parties can read the instance's notes; neither knows the other's EVM key. The first keyless instances (4 November 2026, `deployments/aztec-testnet.json`) are marked do-not-use.

**Decision / interim position:** Keyed deployment is the current pattern. `lib/aztec/agreement-invite.ts` recomputes the deployment address from the shared secret before the receiver accepts; `confirmAgreement` checks the note against the contract's stored state. The peer's Aztec address needs a verified proof of control (`lib/aztec/peer-binding.ts`, G7) before value moves.

**Repository evidence (19/11/2026):**
- `lib/aztec/keyed-deploy.ts`: `computeKeyedInstance` (line 58) derives the public keys from the secret; deploys use `universalDeploy: true` (`lib/aztec/agreements.ts`, `DeployMethod.create`).
- `lib/aztec/agreement-invite.ts`: `verifyAgreementInvite` (line 102) recomputes the address and class from the secret, salt and token; `currentClassIds` (line 138) limits accepted classes to the record of the node's network.
- `deployments/aztec-testnet.json`: the keyless instances of 4 November 2026 are `do-not-use`; `test/unit/aztec/deployments-registry.test.ts` refuses a balance-holding contract marked active without keys.

**Consequence if changed:** If Aztec recommends account abstraction, shared nullifier keys, or a different escrow factory, the entire agreement flow (`lib/aztec/agreements.ts`, `lib/aztec/chat-agreements.ts`, `AgreementCard`, `AgreementComposer`) must be reworked. This is a large surface change.

**Status:** OPEN — awaiting Aztec review.

**Aztec reply:** *(none yet)*

**Interim position adopted:** the pattern implemented in the code stays. It follows Path A (Aztec notes and nullifiers) and the noir-contracts v6 examples. Any change needs an explicit reply from Aztec Labs or a new documented decision.

---

## Q3 — Raw selector vs. Token interface dependency

> *Our contracts call the token through a raw `transfer_in_private` selector to avoid depending on a token crate. Is depending on the standard Token contract's interface preferred, and how do you avoid a duplicated `aztec` crate when doing so?*

**Context:** `contracts/aztec/escrow/src/main.nr` and `contracts/aztec/streams/src/main.nr` call the token with `context.call_private_function(token_address, comptime { selector("transfer_in_private(…)") }, …)` to avoid importing the `token` crate and the `aztec` crate duplication it causes.

**Decision / interim position:** Keep raw selector for now. The alternative (depending on the Token crate) fails at compile time due to duplicate `aztec` dependency resolution in the current toolchain version. Document this explicitly.

**Consequence if changed:** If Aztec resolves the dependency duplication or provides an interface crate, switch to the typed interface for safer ABI coupling. All affected contracts must be recompiled (class ID changes).

**Status:** OPEN — depends on Aztec toolchain resolution.

**Aztec reply:** *(none yet)*

**Interim position adopted:** the pattern implemented in the code stays. It follows Path A (Aztec notes and nullifiers) and the noir-contracts v6 examples. Any change needs an explicit reply from Aztec Labs or a new documented decision.

---

## Q4 — Stream cancel: shared per-state nullifier

> *Our stream cancel shares a per-state nullifier between withdraw and cancel and has withdrawals deliver a copy of the next state to the sender. Is that the pattern you would use, or would you reach for something else (for example a delayed public mutable for the cancellation time)?*

**Context:** `PaymentStream` uses `H(stream_id, state_hash)` as a nullifier that is consumed by either a withdrawal (advancing to the next state) or a cancel (finalizing). A cancel from the sender after the last withdrawal cannot be front-run by a stale state because the nullifier for that state is already spent. The sender receives a copy of the next state note to be able to cancel at any future point.

**Decision / interim position:** Current design. No `delayed_public_mutable` used because it would make the cancellation time public before it lands, potentially revealing activity patterns.

**Repository evidence (19/11/2026):**
- `contracts/aztec/streams/src/main.nr`: the state nullifier with `DOM_SEP__STREAM_STATE`, pushed by `withdraw` (line 330) and by `cancel` (line 430); the create nullifier over `(salt, sender)` with `DOM_SEP__STREAM_CREATE` (line 281).
- TXE tests in `contracts/aztec/streams/src/test.nr`: `a_withdrawal_cannot_reuse_an_earlier_accrual`, `a_cancel_from_a_stale_copy_fails_with_funds_left`, `a_withdrawal_after_cancel_fails`, `a_second_cancel_fails`, `stream_view_skips_the_senders_stale_copy`.

**Consequence if changed:** Switching to `delayed_public_mutable` would simplify state handling but leak cancellation timing publicly. Needs explicit privacy trade-off decision.

**Status:** OPEN — awaiting Aztec review.

**Aztec reply:** *(none yet)*

**Interim position adopted:** the pattern implemented in the code stays. It follows Path A (Aztec notes and nullifiers) and the noir-contracts v6 examples. Any change needs an explicit reply from Aztec Labs or a new documented decision.

---

## Q5 — Bounding time-dependent values in private functions

> *A cancel measures accrual at its anchor block, chosen by the sender's PXE; we bound it by expiring the cancel 600 s after its anchor. Is there a better way to bound a time-dependent value in a private function?*

**Context:** A private function has no access to the current timestamp; it only knows the anchor block chosen by the prover's PXE. Stream cancel computes accrual as `rate × (cancel_anchor − start)` and sets the transaction's expiration to the anchor timestamp plus 600 s (`set_expiration_timestamp`). A cancel included later than that is not valid.

**Decision / interim position:** 600-second expiry window. This bounds the worst-case under-payment to the recipient to `rate × 600`. Documented as a known limitation.

**Repository evidence (19/11/2026):**
- `contracts/aztec/streams/src/main.nr`: `CANCEL_MAX_TX_LIFETIME: u64 = 600` (line 213), applied as `set_expiration_timestamp(anchor_ts + CANCEL_MAX_TX_LIFETIME)` (line 418); withdrawals use `anchor_ts + 1800` (line 317); the rationale is in the header comment (SEC-S9, lines 55–67).
- TXE tests: `cancel_mid_stream_splits_accrued_and_the_rest`, `cancel_with_dust_accrued_pays_it_without_fee`, `cancel_fee_never_refuses`.

**Consequence if changed:** If Aztec introduces a time oracle or a tighter anchor-to-inclusion SLA, the window and the accrual bound can be tightened. No structural contract change needed; only the constant changes.

**Status:** OPEN — awaiting Aztec guidance on time bounding patterns.

**Aztec reply:** *(none yet)*

**Interim position adopted:** the pattern implemented in the code stays. It follows Path A (Aztec notes and nullifiers) and the noir-contracts v6 examples. Any change needs an explicit reply from Aztec Labs or a new documented decision.

---

## Q6 — Gas padding strategy

> *Is 25 % gas padding (plus a fixed margin) the right heuristic, or does Aztec recommend a different estimation strategy?*

**Context:** `lib/aztec/wallet/` estimates gas for shield, private send, and unshield and adds a 25 % padding plus a fixed buffer to avoid out-of-gas failures. The minimum Fee Juice amount shown to the user before account deployment is computed from the live node estimate.

**Decision / interim position:** 25 % padding. This is a heuristic; no documented Aztec recommendation exists. The padding is surfaced to the user (the wallet shows the estimated fee before each operation).

**Consequence if changed:** If Aztec publishes recommended estimation margins or provides a simulation endpoint, switch to those. UI and fee estimation logic in `lib/aztec/wallet/` must be updated.

**Status:** OPEN.

**Aztec reply:** *(none yet)*

**Interim position adopted:** the pattern implemented in the code stays. It follows Path A (Aztec notes and nullifiers) and the noir-contracts v6 examples. Any change needs an explicit reply from Aztec Labs or a new documented decision.

---

## Q7 — Sponsored FPC availability on Alpha

> *Is there a plan to bring Sponsored FPC to Aztec Alpha, or will it remain fee-juice-only for the foreseeable future?*

**Context:** `lib/aztec/fees.ts` hardcodes the sponsored FPC address only for testnet. Alpha has no sponsored FPC. `docs/MAINNET_READINESS.md` documents R4 (zero-balance onboarding) as open. Proposal P1 (a Humanity Ledger–funded fee-paying contract) is designed but not approved.

**Decision / interim position:** Alpha is fee-juice-only. The user must bridge AZTEC before their first transaction. The UI shows the bridge flow upfront. The wallet panel has an "Add funds" button for Fee Juice.

**Consequence if changed:** If Aztec launches a public Sponsored FPC on Alpha, `fees.ts` must be updated with the new address and `SPONSORED_FPC` map. The onboarding R4 opens alternative paths.

**Status:** OPEN — depends on Aztec roadmap.

**Aztec reply:** *(none yet)*

**Interim position adopted:** the pattern implemented in the code stays. It follows Path A (Aztec notes and nullifiers) and the noir-contracts v6 examples. Any change needs an explicit reply from Aztec Labs or a new documented decision.

---

## Q8 — Fee privacy on Alpha

> *Is there a path to private fee payment on Alpha before Aztec introduces a native FPC mechanism?*

**Context:** On Alpha, all fees are paid publicly in Fee Juice. The fee payer address and amount are visible on-chain. `docs/MAINNET_READINESS.md` documents this explicitly and says "fee payer is public". The UI acknowledges this in the payment confirmation screen ("fee paid publicly in Fee Juice").

**Decision / interim position:** Accept public fee payment on Alpha. No attempt to obscure it. Document it honestly to the user.

**Consequence if changed:** If Aztec introduces `PrivateFeePaymentMethod` for Alpha or a first-party FPC, evaluate and integrate. Until then, the current state is the correct and honest state.

**Status:** OPEN — depends on Aztec roadmap.

**Aztec reply:** *(none yet)*

**Interim position adopted:** the pattern implemented in the code stays. It follows Path A (Aztec notes and nullifiers) and the noir-contracts v6 examples. Any change needs an explicit reply from Aztec Labs or a new documented decision.

---

## Q9 — Peer key control verification (G7)

> *Is there a recommended pattern in Aztec to prove that a peer controls their private key (not just their signing key) without a full ZK credential exchange?*

**Context:** `lib/aztec/peer-binding.ts` pins the peer's Aztec address on first use (trust on first use). The peer announces its address in the XMTP conversation with a signed message (v2 binding). This proves control of the XMTP key (linked to the EVM signing key) but does not prove control of the Aztec nullifier secret key (nsk) or incoming viewing key (IVK). `docs/chat/G6_SESSION_CHECKLIST.md` step 1 lists this as still open.

**Decision / interim position:** Trust on first use with a signed announcement. The UI warns the user that the pinned address is not a proof of nsk control. No deposit or escrow is accepted until the peer's address is pinned.

**Consequence if changed:** If Aztec recommends a lightweight challenge–response or a credential that proves nsk control, integrate it into `peer-binding.ts`. This would change the security model from TOFU to verified binding.

**Status:** OPEN — requires Aztec design input.

**Aztec reply:** *(none yet)*

**Interim position adopted:** the pattern implemented in the code stays. It follows Path A (Aztec notes and nullifiers) and the noir-contracts v6 examples. Any change needs an explicit reply from Aztec Labs or a new documented decision.

---

## Q10 — Note discovery for offline recipients

> *Does Aztec 6.0.0 guarantee note discovery for a recipient that was offline when the note was created? Are there scenarios (pruning, TTL, node restart) where a PXE may miss a note permanently?*

**Context:** `PrivateEscrow` and `PaymentStream` create notes for the recipient. If the recipient's PXE is offline when the note lands, it must sync and discover the note later. The note is committed to the Note Hash Tree on-chain, but the recipient's PXE must decrypt the tagged payload to learn it owns the note. `docs/MAINNET_READINESS.md` does not document a mitigation for long-offline recipients.

**Decision / interim position:** Rely on the standard Aztec PXE sync mechanism. No additional tagging or backup discovery is implemented. The UI shows a "Sync wallet" action if the balance appears stale.

**Consequence if changed:** If Aztec documents a scenario where notes are unrecoverable, implement note tagging or an alternative delivery mechanism (e.g., XMTP-delivered encrypted note hint). This would affect `lib/aztec/agreements.ts` and potentially the XMTP message schema.

**Status:** OPEN — awaiting Aztec documentation or reply.

**Aztec reply:** *(none yet)*

**Interim position adopted:** the pattern implemented in the code stays. It follows Path A (Aztec notes and nullifiers) and the noir-contracts v6 examples. Any change needs an explicit reply from Aztec Labs or a new documented decision.

---

## Checklist of completeness

All ten questions from `docs/AZTEC_FOUNDATION_DOSSIER.md` § 5 and the protocol maturity spec are covered above. When an Aztec reply is received for any question:

1. Update the **Aztec reply** field with the reply verbatim and the date.
2. Set **Status** to RESOLVED or WON'T FIX.
3. If the reply requires a code change, open a task in the appropriate tracking document and reference this entry.
4. Update `docs/STATUS.md` to reflect the resolution.

No architectural claim about the Aztec integration may be made in public materials until the relevant questions here are RESOLVED or Stefan states the interim position as the definitive one. The recommended postures below are not that statement.


---

## Conservative decisions adopted while Aztec Labs has not replied

This section records the design decisions taken while a reply is awaited. Each is conservative in one sense: it keeps the behaviour already implemented, adds no new cryptographic pattern and stays with Path A (Aztec notes and nullifiers).

| Decision | Conservative rationale | Risk if Aztec recommends otherwise |
|---|---|---|
| **Q1:** Settlement nullifier shared by `claim` and `refund` | The most direct pattern with Aztec notes: the nullifier tree guarantees uniqueness without custom logic | The contract is recompiled, the class id changes, deployed instances become legacy |
| **Q2:** Deployment keyed by a per-agreement secret shared with the recipient | Custody stays with the parties; no third-party custodian | If Aztec recommends account abstraction or a factory, the whole agreement flow is redesigned |
| **Q3:** Raw selector for token calls | Avoids the crate duplication that fails with the current toolchain | If Aztec resolves the duplication, switch to the typed interface; a small change with no effect on nullifiers or notes |
| **Q4:** State nullifier shared by withdraw and cancel | Keeps the cancellation time private; `delayed_public_mutable` would expose it | If Aztec recommends `delayed_public_mutable`, the public cancellation time is accepted |
| **Q5:** 600 s expiry for cancel proofs | Bounds the worst case to `rate × 600`, a documented limit | If Aztec offers a time oracle or a tighter inclusion bound, only the constant changes |
| **Q6:** 25 % gas padding | Conservative heuristic; no Aztec estimate published | If Aztec publishes margins, update `lib/aztec/wallet/`; no contract impact |
| **Q7:** Alpha without a sponsored FPC | Reflects Aztec Alpha today; the user is told | If Aztec launches a public FPC on Alpha, update `fees.ts` with its address |
| **Q8:** Public fee payer on Alpha | Technical honesty; the interface says so (`FEE_PRIVACY`) | If Aztec offers private fee payment on Alpha, evaluate it (`docs/aztec/FPC_EVALUATION.md`) |
| **Q9:** Verified proof of control of the peer's Aztec address | Minimum viable without a challenge-response Aztec has not specified | If Aztec recommends a lighter proof of nsk control, adopt it in `peer-binding.ts` |
| **Q10:** The PXE's standard sync for note discovery | No extra tagging without knowing whether Aztec already guarantees it; the interface offers "Sync wallet" | If Aztec documents unrecoverable-note cases, add XMTP tagging as a fallback delivery |

**Guiding principle:** none of these decisions introduces a new cryptographic pattern. Each rests on mechanisms already in `contracts/aztec/` and `lib/aztec/`, or in the `noir-contracts` v6 examples. This table is updated whenever Aztec Labs replies to one of Q1–Q10.

---

## Recommended postures — 16 November 2026

Proposal for Stefan to keep or replace. **Status of Q1–Q10 remains OPEN.** There is no Aztec reply. Nothing here is a resolution, and nothing here authorises a change under `contracts/aztec/` or `lib/aztec/`.

| ID | Recommended posture | Why this one |
|---|---|---|
| Q1 | Keep the shared settlement nullifier for claim and refund, and keep the deposit nullifier | One nullifier in Aztec’s tree makes the two endings mutually exclusive without public state. `delayed_public_mutable` would publish the check |
| Q2 | Keep keyed deployment from the conversation secret. The parties hold it. Trust on first use stays a separate, open check (G7) | A protocol-held factory or a custodial account would put the private balance’s keys outside the two parties |
| Q3 | Keep the raw `transfer_in_private` selector | The Token crate duplicates the `aztec` crate on this toolchain and does not compile. A typed interface waits until Aztec ships one that does. Do not fork the token |
| Q4 | Keep the per-state nullifier shared by withdraw and cancel, and the sender’s copy of the next state | `delayed_public_mutable` for the cancel time would show when a cancel is prepared |
| Q5 | Keep the 600-second expiry measured from the cancel’s anchor block | It bounds over-accrual at `rate × 600` without a time oracle. A tighter Aztec inclusion rule, if one is published, changes the constant only |
| Q6 | Keep 25% padding (`gasLimitsFromSimulation` factor 1.25) and the margin the wallet already shows before the action | The figure is a heuristic. It is not a second, hidden fee. A published Aztec estimator would replace it in the wallet only |
| Q7 | Alpha stays Fee Juice paid by the account. Do not restore sponsorship. `/api/aztec/sponsor` stays 410 | That is the product decision of 15 November 2026 and the network as it is. An Aztec-operated sponsored payer, if it appears, is a new decision |
| Q8 | The fee payer and the fee amount stay public, and the UI keeps saying so. Do not add a private fee-paying contract | Hiding the fee payer needs a mechanism Aztec has not shipped on Alpha. A private FPC we operated would be a new custodian |
| Q9 | Keep the signed announcement and the first pin. The send stays off until that card says verified. The pin is not a proof of the nullifier secret key | Aztec has not specified a lighter proof of nullifier-key control. Inventing one would be a new cryptographic pattern |
| Q10 | Standard PXE sync only. Do not put a note hint in the XMTP message. If the sender is settled and the recipient still has no note after a full sync, record that once and do not send the payment again | A hint in the message store would copy payment metadata into a second system. The miss is the open discovery case, not a second transfer |

These ten lines are the interim positions already in this file, stated as the posture to hold until Aztec Labs answers. They introduce no new cryptographic pattern.
