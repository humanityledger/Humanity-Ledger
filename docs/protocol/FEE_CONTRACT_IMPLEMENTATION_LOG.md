# Fee Contract — Implementation Log

**Documento:** `docs/protocol/FEE_CONTRACT_IMPLEMENTATION_LOG.md`
**SPEC de referencia:** `docs/protocol/FEE_CONTRACT_SPEC.md` (única fuente de verdad)
**Estado:** PRE-IMPLEMENTACIÓN — En espera de aprobación D1–D7
**Creado:** 15 noviembre 2026 · 23:10 CET
**Agente:** Antigravity
**Autorizado por:** Stefan Antonio Cirisanu (elección A — solo entregables pre-decisión)

> [!IMPORTANT]
> Este log es un documento preparatorio. **No existe ningún código de contrato implementado.**
> El SPEC prohíbe explícitamente escribir código hasta que D1–D7 estén aprobados por Stefan.
> Cita literal del SPEC § 2: *"None of D1–D7 is decided. Stefan must approve each before implementation begins."*
> Cita literal del encabezado del SPEC: *"No code may be written until the design decisions below are approved by Stefan."*

---

## 1. Anclaje al SPEC — Secciones copiadas textualmente

### SPEC § 1 — Purpose (copia textual)

> The Fee Contract (working name: `HLFeeRouter`) is an aztec-nr contract that:
>
> 1. Accepts protocol fees from `PrivateEscrow` and `PaymentStream` deposits as private notes to the treasury.
> 2. Accumulates fees and, once a threshold is reached, executes a buyback: purchases HLC on the open market over a 7-day TWAP window.
> 3. Burns the purchased HLC.
> 4. Enforces per-transaction and daily caps on the fee charged.
> 5. Is pausable by the multisig owner with a mandatory timelock delay.
>
> This contract is **launch condition #1** for HLC distribution (`docs/TOKENOMICS.md`).

### SPEC § 2 — Design decisions requiring approval (copia textual)

> | # | Decision | Options | Default if not decided |
> |---|---|---|---|
> | D1 | Fee token | Fee Juice only, or HLC, or the transaction token (e.g., HLC in the escrow) | The escrow/stream token (most private) |
> | D2 | Buyback mechanism | On-chain TWAP contract, off-chain multisig action, or hybrid | Off-chain multisig action (simpler, audit scope smaller) |
> | D3 | TWAP oracle | Aztec-native oracle (not available on Alpha today), Chainlink L1 oracle bridged via portal, or time-weighted average over internal records | Decision deferred until oracle landscape on Alpha is clear |
> | D4 | Burn mechanism | Call `burn` on HLC contract (requires admin or burn role), or send to `0x000…dead` | Call `burn`; requires that `HLFeeRouter` holds a burn role |
> | D5 | Cap granularity | Per-transaction cap only, or per-transaction + per-account daily cap + global daily cap | Per-transaction + global daily cap |
> | D6 | Pause authority | 4-of-7 multisig directly, or multisig + timelock | Multisig + 48-hour timelock (consistent with treasury policy) |
> | D7 | Fee extraction point | Inside `deposit` as a private note split, or as a separate `collectFee` step | Inside `deposit` (atomic; reveals no fee amount) |
>
> **None of D1–D7 is decided.** Stefan must approve each before implementation begins.

### SPEC § 3 — Interface sketch (copia textual)

> The following is a sketch, not a final interface. It assumes fee extraction inside `deposit` (D7 = inside deposit) and fee in the escrow/stream token (D1 = transaction token).
>
> ```noir
> // HLFeeRouter — sketch only, not final
> #[aztec]
> pub contract HLFeeRouter {
>     treasury: AztecAddress,
>     fee_params: PublicMutable<FeeParams>,
>     paused: PublicMutable<bool>,
>     accumulated: PublicMutable<u128>,
>
>     fn compute_fee(amount: u128) -> u128;
>     fn collect(token: AztecAddress, fee_note: Note);
>     fn trigger_buyback();
>     fn pause();
>     fn unpause();
>     fn set_fee_params(params: FeeParams);
> }
> ```

### SPEC § 4 — Fee arithmetic (copia textual)

> ```
> fee = max(min_fee, ceil(amount × fee_bps / 10_000))
> ```
>
> In bigint base units (6 decimals for HLC):
> - `fee_bps` default: 30 (0.30 %)
> - `min_fee` default: 1_000 (0.001 HLC)
> - `tx_cap` default: 1_000_000 (1 HLC)
> - `daily_cap` default: 100_000_000 (100 HLC)
>
> These values are set at deployment and updatable by the multisig with a 48-hour timelock delay. They are readable from public storage at `/api/aztec/fee-params` once the contract is deployed.
>
> The fee is taken inside the private deposit as a private note split to the treasury, so it reveals no amount on-chain. The treasury publishes the weekly aggregate when it converts fees to HLC, which is the mechanism that makes protocol revenue verifiable without revealing any individual payment.

---

## 2. Estado de las decisiones D1–D7

Todas las decisiones siguen en estado **[PENDING]**. La implementación de cualquier código de contrato, lógica de fee, integración en escrow/streams o módulo cliente está **bloqueada** hasta que Stefan registre cada decisión en `docs/protocol/FEE_CONTRACT_SPEC.md § 8`.

| Decisión | Estado | Impacto en implementación |
|---|---|---|
| D1 — Fee token | **[PENDING]** | Determina qué token es la nota de fee. Sin esto, `compute_fee` no puede ser correcta. |
| D2 — Buyback mechanism | **[PENDING]** | Determina si `trigger_buyback` llama a un contrato on-chain o dispara acción multisig. Sin esto, FA-09 y FA-10 no pueden activarse. |
| D3 — TWAP oracle | **[PENDING]** | Depende de D2. Si D2 = on-chain, es necesario. |
| D4 — Burn mechanism | **[PENDING]** | Determina si `HLFeeRouter` necesita rol de burn en el contrato HLC. |
| D5 — Cap granularity | **[PENDING]** | Determina si `compute_fee` aplica solo `tx_cap` o también `daily_cap`. Afecta FA-04 directamente. |
| D6 — Pause authority | **[PENDING]** | Determina la interfaz de `pause`/`unpause` y el timelock. Afecta FA-05/FA-06/FA-07. |
| D7 — Fee extraction point | **[PENDING]** | Determina si la fee se cobra en `deposit` o en `claim`/`withdraw`. Afecta toda la integración con escrow y streams. |

---

## 3. Placeholders que se usarán en la implementación futura

Cuando Stefan apruebe las decisiones, los siguientes placeholders deben reemplazarse con valores reales. **Están marcados de forma imposible de ignorar** para prevenir despliegues accidentales.

### Constantes Noir (futuro `contracts/aztec/fee_router/src/main.nr`)

```noir
// ⚠ PLACEHOLDER_PENDING_OPERATOR_DECISION — D1 no decidido
// Reemplazar con la dirección real del treasury cuando D1 sea aprobado por Stefan.
global TREASURY_PLACEHOLDER: AztecAddress = AztecAddress::from_field(0);
// Verificación de seguridad: si TREASURY es zero en producción, el contrato NO debe desplegarse.

// ⚠ PLACEHOLDER_PENDING_OPERATOR_DECISION — D1/D5 no decididos
// fee_bps = 30 es el DEFAULT DEL SPEC si Stefan no decide otro valor.
// NO usar este valor en ningún deploy hasta que D1 y D5 estén aprobados.
global FEE_BPS_PLACEHOLDER: u32 = 30; // 0.30 % — PENDIENTE DE DECISIÓN

// ⚠ PLACEHOLDER_PENDING_OPERATOR_DECISION — D1 no decidido
global MIN_FEE_PLACEHOLDER: u128 = 1_000; // 0.001 HLC en base units — PENDIENTE DE DECISIÓN

// ⚠ PLACEHOLDER_PENDING_OPERATOR_DECISION — D5 no decidido
global TX_CAP_PLACEHOLDER: u128 = 1_000_000; // 1 HLC — PENDIENTE DE DECISIÓN

// ⚠ PLACEHOLDER_PENDING_OPERATOR_DECISION — D5 no decidido
global DAILY_CAP_PLACEHOLDER: u128 = 100_000_000; // 100 HLC — PENDIENTE DE DECISIÓN

// ⚠ PLACEHOLDER_PENDING_OPERATOR_DECISION — D4 no decidido
// Burn mechanism: si D4 = send to 0x000...dead, usar esta constante.
// Si D4 = call burn(), esta constante no se usa.
global BURN_ADDRESS_PLACEHOLDER: AztecAddress = AztecAddress::from_field(0xdead);
```

### Fórmula u128-safe (futuro `compute_fee`)

La fórmula del SPEC § 4 implementada en aritmética u128-safe (q y r, sin `amount * feeBps` directo):

```
// SPEC § 4 literal: fee = max(min_fee, ceil(amount × fee_bps / 10_000))
//
// Implementación u128-safe (evita overflow en amount × fee_bps):
//   q = amount / 10_000
//   r = amount % 10_000
//   raw_fee = q * fee_bps + ((r * fee_bps + 9_999) / 10_000)   ← ceil
//   fee = max(min_fee, min(raw_fee, tx_cap))
//
// Prohibido: amount * fee_bps  (puede overflow para amount > u128::MAX / fee_bps)
// Esta fórmula es la ÚNICA autorizada por el SPEC.
// NO implementar hasta que D1–D7 estén aprobados.
```

---

## 4. Tests adversariales (referencia)

Los 12 tests FA-01..FA-12 definidos en el SPEC § 10 han sido creados en:

**`test/unit/aztec/fee-router.adversarial.test.ts`**

Todos están en `it.skip` como especifica el SPEC § 10:
> *"Pueden estar en `skip` hasta que el contrato exista, pero deben estar escritos como especificación ejecutable."*

Ver ese archivo para los tests completos.

---

## 5. Principios Path A declarados

Los siguientes principios de Path A + Aztec Labs se aplicarán en la implementación futura. Se declaran aquí para anclarlos antes de cualquier código:

1. **Todo el estado privado son Notas.** El doble gasto lo impide el árbol de nullifiers de la red.
2. **Funciones privadas se ejecutan en el PXE del cliente.** Nada de lógica de valor en funciones públicas.
3. **Preferencia absoluta por los patrones de los ejemplos oficiales de noir-contracts v6.**
4. **`transfer_in_private` con `authwit_nonce = 0`** cuando el contrato gasta sus propias notas.
5. **Ninguna nueva variable de storage mutable** que pueda ser controlada por el deployer o por un atacante.
6. **Las constantes de fee** (`FEE_BPS`, `MIN_FEE`, `MAX_FEE_SHARE_BPS`, `TREASURY`) serán `global` y marcadas como `PLACEHOLDER_PENDING_OPERATOR_DECISION`.

---

## 6. Gate de implementación

La implementación pasa a estado **ELIGIBLE** cuando Stefan registre en `docs/protocol/FEE_CONTRACT_SPEC.md § 8`:

```
D1 decision: [PENDING]  Decided: [DATE]  By: Stefan
D2 decision: [PENDING]  Decided: [DATE]  By: Stefan
D3 decision: [PENDING]  Decided: [DATE]  By: Stefan
D4 decision: [PENDING]  Decided: [DATE]  By: Stefan
D5 decision: [PENDING]  Decided: [DATE]  By: Stefan
D6 decision: [PENDING]  Decided: [DATE]  By: Stefan
D7 decision: [PENDING]  Decided: [DATE]  By: Stefan
```

Hasta entonces, los únicos entregables autorizados son este log y el archivo de tests adversariales en `it.skip`.

---

## 7. Registro de sesión

| Fecha | Agente | Acción | Archivos | Cambio |
|---|---|---|---|---|
| 2026-11-15 23:10 CET | Antigravity | Crear IMPLEMENTATION_LOG (pre-decisión) | `docs/protocol/FEE_CONTRACT_IMPLEMENTATION_LOG.md` | +nuevo |
| 2026-11-15 23:10 CET | Antigravity | Crear tests adversariales FA-01..FA-12 en it.skip | `test/unit/aztec/fee-router.adversarial.test.ts` | +nuevo |

**Total: +2 archivos nuevos / −0 eliminaciones / 0 archivos de producción modificados.**

---

## 8. Declaración de alineación

**Ningún contrato aztec-nr, ninguna función privada, ningún nullifier, ninguna nota, ningún archivo de producción ni ningún archivo protegido ha sido modificado. Se mantiene alineación total con Path A y con la visión de Aztec Labs. Las decisiones D1–D7 permanecen [PENDING] hasta aprobación explícita de Stefan.**
