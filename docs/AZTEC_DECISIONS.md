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

---

## Q1 — Shared settlement nullifier (escrow claim / refund)

> *Is the shared settlement nullifier, with those timestamp checks, an idiomatic way to express "claim before the deadline, refund after it"?*

**Context:** `PrivateEscrow` publishes `H(escrow_id, settlement_tag)` as a nullifier from both `claim` and `refund`. Only one of them can land first; the other is refused by the nullifier tree. `claim` enforces inclusion before `deadline`; `refund` enforces inclusion after it. A deposit nullifier `H(escrow_id, sender)` prevents a second deposit under the same `escrow_id` from sharing the settlement path.

**Decision / interim position:** Use the shared settlement nullifier as designed. The deposit nullifier (added after the first version) closes the double-fund vector. This pattern is used in production.

**Consequence if changed:** If Aztec recommends `delayed_public_mutable` or a commitment-based approach, the escrow contract must be rewritten and recompiled, the class ID changes, and all deployed instances become legacy. `docs/AZTEC_TESTNET_DEPLOYMENTS.md` and `deployments/aztec-pending-recompile.json` must be updated.

**Status:** OPEN — awaiting Aztec review.

**Aztec reply:** *(none yet)*

**Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada.**

---

## Q2 — Keyed deployment as a custody pattern

> *Is a keyed deployment whose secret is shared with the parties the pattern you recommend for a contract that holds a private balance, or is there a better one?*

**Context:** `lib/aztec/keyed-deploy.ts` deploys each escrow and stream as a fresh instance with Schnorr keys derived from the conversation secret. The parties hold the secret; neither knows the other's EVM key. The first keyless instances (4 November 2026, `deployments/aztec-testnet.json`) are marked do-not-use.

**Decision / interim position:** Keyed deployment is the current pattern. `lib/aztec/agreement-invite.ts` recomputes the deployment address from the shared secret before the receiver accepts; `confirmAgreement` checks the note against the contract's stored state. Trust on first use for the peer Aztec address (G7 open).

**Consequence if changed:** If Aztec recommends account abstraction, shared nullifier keys, or a different escrow factory, the entire agreement flow (`lib/aztec/agreements.ts`, `lib/aztec/chat-agreements.ts`, `AgreementCard`, `AgreementComposer`) must be reworked. This is a large surface change.

**Status:** OPEN — awaiting Aztec review.

**Aztec reply:** *(none yet)*

**Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada.**

---

## Q3 — Raw selector vs. Token interface dependency

> *Our contracts call the token through a raw `transfer_in_private` selector to avoid depending on a token crate. Is depending on the standard Token contract's interface preferred, and how do you avoid a duplicated `aztec` crate when doing so?*

**Context:** `contracts/aztec/escrow/src/main.nr` and `contracts/aztec/streams/src/main.nr` call the token with `context.call_private_function(token_address, comptime { selector("transfer_in_private(…)") }, …)` to avoid importing the `token` crate and the `aztec` crate duplication it causes.

**Decision / interim position:** Keep raw selector for now. The alternative (depending on the Token crate) fails at compile time due to duplicate `aztec` dependency resolution in the current toolchain version. Document this explicitly.

**Consequence if changed:** If Aztec resolves the dependency duplication or provides an interface crate, switch to the typed interface for safer ABI coupling. All affected contracts must be recompiled (class ID changes).

**Status:** OPEN — depends on Aztec toolchain resolution.

**Aztec reply:** *(none yet)*

**Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada.**

---

## Q4 — Stream cancel: shared per-state nullifier

> *Our stream cancel shares a per-state nullifier between withdraw and cancel and has withdrawals deliver a copy of the next state to the sender. Is that the pattern you would use, or would you reach for something else (for example a delayed public mutable for the cancellation time)?*

**Context:** `PaymentStream` uses `H(stream_id, state_hash)` as a nullifier that is consumed by either a withdrawal (advancing to the next state) or a cancel (finalizing). A cancel from the sender after the last withdrawal cannot be front-run by a stale state because the nullifier for that state is already spent. The sender receives a copy of the next state note to be able to cancel at any future point.

**Decision / interim position:** Current design. No `delayed_public_mutable` used because it would make the cancellation time public before it lands, potentially revealing activity patterns.

**Consequence if changed:** Switching to `delayed_public_mutable` would simplify state handling but leak cancellation timing publicly. Needs explicit privacy trade-off decision.

**Status:** OPEN — awaiting Aztec review.

**Aztec reply:** *(none yet)*

**Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada.**

---

## Q5 — Bounding time-dependent values in private functions

> *A cancel measures accrual at its anchor block, chosen by the sender's PXE; we bound it by expiring the cancel 600 s after its anchor. Is there a better way to bound a time-dependent value in a private function?*

**Context:** A private function has no access to the current timestamp; it only knows the anchor block chosen by the prover's PXE. Stream cancel computes accrual as `rate × (cancel_anchor − start)` and sets `tx_context.block_header.global_variables.timestamp` as the expiration window. Any cancel proof older than 600 s from its anchor is rejected by the sequencer.

**Decision / interim position:** 600-second expiry window. This bounds the worst-case over-accrual to `rate × 600`. Documented as a known limitation.

**Consequence if changed:** If Aztec introduces a time oracle or a tighter anchor-to-inclusion SLA, the window and the accrual bound can be tightened. No structural contract change needed; only the constant changes.

**Status:** OPEN — awaiting Aztec guidance on time bounding patterns.

**Aztec reply:** *(none yet)*

**Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada.**

---

## Q6 — Gas padding strategy

> *Is 25 % gas padding (plus a fixed margin) the right heuristic, or does Aztec recommend a different estimation strategy?*

**Context:** `lib/aztec/wallet/` estimates gas for shield, private send, and unshield and adds a 25 % padding plus a fixed buffer to avoid out-of-gas failures. The minimum Fee Juice amount shown to the user before account deployment is computed from the live node estimate.

**Decision / interim position:** 25 % padding. This is a heuristic; no documented Aztec recommendation exists. The padding is surfaced to the user (the wallet shows the estimated fee before each operation).

**Consequence if changed:** If Aztec publishes recommended estimation margins or provides a simulation endpoint, switch to those. UI and fee estimation logic in `lib/aztec/wallet/` must be updated.

**Status:** OPEN.

**Aztec reply:** *(none yet)*

**Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada.**

---

## Q7 — Sponsored FPC availability on Alpha

> *Is there a plan to bring Sponsored FPC to Aztec Alpha, or will it remain fee-juice-only for the foreseeable future?*

**Context:** `lib/aztec/fees.ts` hardcodes the sponsored FPC address only for testnet. Alpha has no sponsored FPC. `docs/MAINNET_READINESS.md` documents R4 (zero-balance onboarding) as open. Proposal P1 (a Humanity Ledger–funded fee-paying contract) is designed but not approved.

**Decision / interim position:** Alpha is fee-juice-only. The user must bridge AZTEC before their first transaction. The UI shows the bridge flow upfront. The wallet panel has an "Add funds" button for Fee Juice.

**Consequence if changed:** If Aztec launches a public Sponsored FPC on Alpha, `fees.ts` must be updated with the new address and `SPONSORED_FPC` map. The onboarding R4 opens alternative paths.

**Status:** OPEN — depends on Aztec roadmap.

**Aztec reply:** *(none yet)*

**Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada.**

---

## Q8 — Fee privacy on Alpha

> *Is there a path to private fee payment on Alpha before Aztec introduces a native FPC mechanism?*

**Context:** On Alpha, all fees are paid publicly in Fee Juice. The fee payer address and amount are visible on-chain. `docs/MAINNET_READINESS.md` documents this explicitly and says "fee payer is public". The UI acknowledges this in the payment confirmation screen ("fee paid publicly in Fee Juice").

**Decision / interim position:** Accept public fee payment on Alpha. No attempt to obscure it. Document it honestly to the user.

**Consequence if changed:** If Aztec introduces `PrivateFeePaymentMethod` for Alpha or a first-party FPC, evaluate and integrate. Until then, the current state is the correct and honest state.

**Status:** OPEN — depends on Aztec roadmap.

**Aztec reply:** *(none yet)*

**Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada.**

---

## Q9 — Peer key control verification (G7)

> *Is there a recommended pattern in Aztec to prove that a peer controls their private key (not just their signing key) without a full ZK credential exchange?*

**Context:** `lib/aztec/peer-binding.ts` pins the peer's Aztec address on first use (trust on first use). The peer announces its address in the XMTP conversation with a signed message (v2 binding). This proves control of the XMTP key (linked to the EVM signing key) but does not prove control of the Aztec nullifier secret key (nsk) or incoming viewing key (IVK). `docs/chat/G6_SESSION_CHECKLIST.md` step 1 lists this as still open.

**Decision / interim position:** Trust on first use with a signed announcement. The UI warns the user that the pinned address is not a proof of nsk control. No deposit or escrow is accepted until the peer's address is pinned.

**Consequence if changed:** If Aztec recommends a lightweight challenge–response or a credential that proves nsk control, integrate it into `peer-binding.ts`. This would change the security model from TOFU to verified binding.

**Status:** OPEN — requires Aztec design input.

**Aztec reply:** *(none yet)*

**Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada.**

---

## Q10 — Note discovery for offline recipients

> *Does Aztec 6.0.0 guarantee note discovery for a recipient that was offline when the note was created? Are there scenarios (pruning, TTL, node restart) where a PXE may miss a note permanently?*

**Context:** `PrivateEscrow` and `PaymentStream` create notes for the recipient. If the recipient's PXE is offline when the note lands, it must sync and discover the note later. The note is committed to the Note Hash Tree on-chain, but the recipient's PXE must decrypt the tagged payload to learn it owns the note. `docs/MAINNET_READINESS.md` does not document a mitigation for long-offline recipients.

**Decision / interim position:** Rely on the standard Aztec PXE sync mechanism. No additional tagging or backup discovery is implemented. The UI shows a "Sync wallet" action if the balance appears stale.

**Consequence if changed:** If Aztec documents a scenario where notes are unrecoverable, implement note tagging or an alternative delivery mechanism (e.g., XMTP-delivered encrypted note hint). This would affect `lib/aztec/agreements.ts` and potentially the XMTP message schema.

**Status:** OPEN — awaiting Aztec documentation or reply.

**Aztec reply:** *(none yet)*

**Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada.**

---

## Checklist of completeness

All ten questions from `docs/AZTEC_FOUNDATION_DOSSIER.md` § 5 and the protocol maturity spec are covered above. When an Aztec reply is received for any question:

1. Update the **Aztec reply** field with the reply verbatim and the date.
2. Set **Status** to RESOLVED or WON'T FIX.
3. If the reply requires a code change, open a task in the appropriate tracking document and reference this entry.
4. Update `docs/STATUS.md` to reflect the resolution.

No architectural claim about the Aztec integration may be made in public materials until the relevant questions here are RESOLVED or the interim position is explicitly stated as the definitive position.


---

## Decisiones conservadoras adoptadas en ausencia de respuesta de Aztec Labs

Este apartado recoge las decisiones de diseño que el protocolo ha tomado unilateralmente mientras espera respuesta de Aztec Labs. Todas ellas son conservadoras en el siguiente sentido: mantienen el comportamiento ya implementado, evitan introducir nuevos patrones criptográficos y preservan la alineación con Path A (notas + nullifiers de la red Aztec).

| Decisión | Justificación conservadora | Riesgo si Aztec recomienda otra cosa |
|---|---|---|
| **Q1:** Nullifier de liquidación compartido entre `claim` y `refund` | Es el patrón más directo con notas Aztec; el árbol de nullifiers garantiza unicidad sin lógica custom | El contrato debe recompilarse; el class ID cambia; las instancias desplegadas quedan como legacy |
| **Q2:** Despliegue con clave derivada del secreto de conversación | Mantiene la custodia en las partes; no introduce un tercero custodio | Si Aztec recomienda account abstraction o factory pattern, el flujo de acuerdos completo debe rediseñarse |
| **Q3:** Raw selector para llamadas al token | Evita la duplicación de crates que falla en la versión actual del toolchain | Si Aztec resuelve la duplicación, cambiar al interface tipado; es un cambio menor sin impacto en nullifiers ni notas |
| **Q4:** Nullifier de estado compartido entre withdraw y cancel | Preserva la privacidad del momento de cancelación; `delayed_public_mutable` la expondría | Si Aztec recomienda `delayed_public_mutable`, se acepta la revelación pública del momento de cancelación |
| **Q5:** Ventana de expiración de 600 s para pruebas de cancelación | Acota el sobre-accrual máximo a `rate × 600`; es un límite documentado y honesto | Si Aztec introduce un oráculo de tiempo o una SLA más ajustada, solo cambia la constante; sin cambio estructural |
| **Q6:** Padding de gas del 25 % | Heurístico conservador; sin estimación oficial de Aztec | Si Aztec publica márgenes recomendados, actualizar `lib/aztec/wallet/`; sin impacto en contratos |
| **Q7:** Alpha sin Sponsored FPC | Refleja la realidad documentada de Aztec Alpha hoy; no se oculta al usuario | Si Aztec lanza un FPC público en Alpha, actualizar `fees.ts` con la nueva dirección |
| **Q8:** Fee payer público en Alpha | Honestidad técnica; el UI lo informa explícitamente; no se intenta disimular | Si Aztec introduce `PrivateFeePaymentMethod` para Alpha, evaluar e integrar |
| **Q9:** Trust on first use para el Aztec address del peer | Mínimo viable sin introducir un protocolo de desafío-respuesta no especificado por Aztec | Si Aztec recomienda un patrón ligero de prueba de control de nsk, integrarlo en `peer-binding.ts` |
| **Q10:** Dependencia del mecanismo estándar de sync del PXE para note discovery | No se añade tagging extra sin saber si Aztec ya lo garantiza; el UI muestra "Sync wallet" si el balance parece desfasado | Si Aztec documenta escenarios de nota irrecuperable, implementar tagging XMTP como mecanismo de entrega alternativo |

**Principio rector de esta sección:** ninguna de estas decisiones introduce un nuevo patrón criptográfico. Todas se apoyan en mecanismos ya presentes en el código de producción actual (`contracts/aztec/`, `lib/aztec/`) o en ejemplos de `noir-contracts` v6. Esta tabla se actualiza cada vez que llega respuesta de Aztec Labs para alguna de las preguntas Q1–Q10.
