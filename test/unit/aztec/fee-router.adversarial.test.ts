// @ts-nocheck
/**
 * test/unit/aztec/fee-router.adversarial.test.ts
 *
 * Tests adversariales para HLFeeRouter (Fee Contract).
 *
 * ESTADO: Todos los tests siguen en it.skip. Describen el boceto HLFeeRouter
 * (fee en el depósito, buyback, pausa, tope diario), no la baseline del 16 de
 * noviembre de 2026. No quitar el skip hasta reescribirlos contra esa baseline.
 * No son una auditoría. La baseline está en PrivateEscrow y PaymentStream.
 *
 * SPEC de referencia: docs/protocol/FEE_CONTRACT_SPEC.md § 10
 * Cita literal del SPEC:
 *   "Los siguientes tests deben existir en test/unit/aztec/fee-router.adversarial.test.ts
 *    antes de cualquier implementación del contrato. Pueden estar en skip hasta que el
 *    contrato exista, pero deben estar escritos como especificación ejecutable."
 *
 * Creado: 15 noviembre 2026 · 23:10 CET por Antigravity (Fee Contract Fase 0).
 * Referencia del plan: docs/protocol/FEE_CONTRACT_IMPLEMENTATION_LOG.md
 *
 * IMPORTANTE: este archivo NO modifica ningún contrato de producción.
 * No importa ni referencia ningún archivo de contracts/aztec/.
 * El propósito es documentar la especificación ejecutable como exige el SPEC § 10.
 *
 * No activar estos casos. Hay que reescribirlos contra la baseline real
 * (liquidación, sin buyback, sin pausa, sin tope diario) antes de quitar el skip.
 */

describe("HLFeeRouter — Tests Adversariales (Fee Contract Fase 0)", function () {

  // Mocha sets this.timeout. Vitest calls this function with this === undefined.
  const mochaCtx = this;
  if (mochaCtx != null && typeof mochaCtx.timeout === "function") mochaCtx.timeout(120_000);

  // ---------------------------------------------------------------------------
  // Nota sobre setup:
  // Cuando el contrato exista, el beforeEach desplegará HLFeeRouter via TXE,
  // configurará el multisig owner, el treasury, y los fee params del SPEC § 4.
  // Por ahora el beforeEach está vacío porque no hay contrato que desplegar.
  // ---------------------------------------------------------------------------

  beforeEach(async function () {
    // TODO (post D1–D7): desplegar HLFeeRouter en TXE con:
    //   - treasury = alice.address (test fixture)
    //   - fee_bps = 30
    //   - min_fee = 1_000
    //   - tx_cap = 1_000_000
    //   - daily_cap = 100_000_000
    //   - multisig_owner = multisig.address (test fixture 4-of-7)
  });

  // ===========================================================================
  // FA-01 — Doble nota de fee imposible
  // SPEC § 10: "Un único depósito no produce más de una nota de fee;
  //             el balance del destinatario es siempre amount - fee"
  // ===========================================================================

  it.skip("FA-01: double_fee_note_impossible — un único depósito produce exactamente una nota de fee", async function () {
    // TODO (post D1–D7 aprobados): implementar con TXE
    //
    // Setup:
    //   alice deposita `amount` en PrivateEscrow con bob como beneficiario.
    //   HLFeeRouter está integrado en el deposit path (D7 = inside deposit).
    //
    // Verificaciones:
    //   1. El depósito produce exactamente DOS notas privadas:
    //      - Nota destinatario: amount - compute_fee(amount)
    //      - Nota treasury: compute_fee(amount)
    //   2. No puede existir una tercera nota derivada del mismo depósito.
    //   3. balance(bob) == amount - fee
    //   4. balance(treasury) == fee
    //   5. balance(alice) == balance_antes - amount   (cero residuo)
    //
    // Ref: SPEC § 9.1 — "El note split debe producir exactamente dos notas"
    throw new Error("FA-01: test no implementado — contrato no existe (D1–D7 pendientes)");
  });

  // ===========================================================================
  // FA-02 — Nota de fee siempre va al treasury inmutable
  // SPEC § 10: "La nota de fee siempre va a treasury;
  //             modificar treasury después del init revierte"
  // ===========================================================================

  it.skip("FA-02: fee_note_treasury_immutable — la nota de fee va siempre al treasury; treasury es inmutable", async function () {
    // TODO (post D1–D7 aprobados): implementar con TXE
    //
    // Verificaciones:
    //   1. La nota de fee creada en compute_fee/collect tiene recipient == treasury.
    //   2. Intentar llamar a set_treasury() (o cualquier función que modifique treasury)
    //      REVIERTE — treasury es inmutable tras el initializer.
    //   3. Un atacante que conozca la tx de depósito no puede redirigir la nota de fee
    //      porque treasury se lee del estado inmutable del contrato, no del calldata.
    //
    // Ref: SPEC § 9.2 — "treasury es inmutable tras el initializer"
    throw new Error("FA-02: test no implementado — contrato no existe (D1–D7 pendientes)");
  });

  // ===========================================================================
  // FA-03 — tx_cap aplicado correctamente
  // SPEC § 10: "Para cualquier amount > tx_cap / fee_bps, compute_fee devuelve tx_cap"
  // ===========================================================================

  it.skip("FA-03: tx_cap_enforced — compute_fee(amount) <= tx_cap para cualquier amount", async function () {
    // TODO (post D1–D7 aprobados): implementar con TXE
    //
    // Vectores de test (SPEC § 4 defaults: fee_bps=30, tx_cap=1_000_000):
    //   amount = 0           → fee = 0        (zero deposit, SPEC § 9.3)
    //   amount = 1_000       → fee = 1_000    (min_fee aplicado: ceil(1000*30/10000)=3 < 1000)
    //   amount = 1_000_000   → fee = 1_000    (ceil(1000000*30/10000)=3000 > min_fee, < tx_cap → 3000... esperar D1)
    //   amount = 334_000_000 → fee = 1_000_000 (tx_cap aplicado: ceil(334M*30/10000)=1_002_000 > tx_cap)
    //   amount = u128::MAX   → fee = tx_cap   (no overflow, fórmula u128-safe)
    //
    // Verificación adicional obligatoria (SPEC Prompt Maestro):
    //   grep del bytecode compilado NO debe contener `amount * fee_bps` sin división previa.
    //
    // Ref: SPEC § 9.3 — "result ≤ tx_cap"
    throw new Error("FA-03: test no implementado — contrato no existe (D1–D7 pendientes)");
  });

  // ===========================================================================
  // FA-04 — daily_cap aplicado correctamente
  // SPEC § 10: "Después de N depósitos que agotan daily_cap, el siguiente
  //             depósito cobra fee = 0 o revierte según D5"
  // ===========================================================================

  it.skip("FA-04: daily_cap_enforced — tras agotar daily_cap, el siguiente fee es 0 o revierte (D5 decide)", async function () {
    // TODO (post D5 aprobado + contrato existente): implementar con TXE
    //
    // Nota: este test NO puede implementarse hasta que D5 esté decidido.
    //   D5 = per-transaction cap only → daily_cap no existe, test N/A
    //   D5 = per-tx + global daily cap → fee = 0 cuando accumulated_today >= daily_cap
    //
    // Setup:
    //   Realizar N depósitos de amount tal que sum(fees) == daily_cap.
    //   El siguiente depósito debe cobrar fee = 0 (o revertir, según D5).
    //
    // Verificación:
    //   compute_fee(any_amount) == 0  cuando daily_cap agotado (si D5 permite).
    //   O bien: depósito revierte con DailyCapExhausted (si D5 lo exige).
    //
    // Ref: SPEC § 9.3 — "El cap diario se comprueba antes de acreditar la nota"
    throw new Error("FA-04: test no implementado — D5 pendiente + contrato no existe");
  });

  // ===========================================================================
  // FA-05 — Pausa detiene colección de fees
  // SPEC § 10: "Con paused = true, compute_fee devuelve 0;
  //             sin bloquear claim ni refund"
  // ===========================================================================

  it.skip("FA-05: pause_stops_fee_collection — paused=true → compute_fee=0; claim y refund siguen funcionando", async function () {
    // TODO (post D6 aprobado + contrato existente): implementar con TXE
    //
    // Nota: requiere D6 aprobado (pause authority) para saber quién puede pausar.
    //
    // Setup:
    //   multisig llama a pause().
    //   alice deposita en escrow con bob como beneficiario.
    //
    // Verificaciones:
    //   1. compute_fee(any_amount) == 0  mientras paused=true.
    //   2. No se crea nota de fee en el treasury.
    //   3. bob puede ejecutar claim() sin revert.
    //   4. alice puede ejecutar refund() sin revert.
    //   5. El depósito no revierte; solo se bypasea la fee.
    //
    // Ref: SPEC § 9.4 — "Cuando paused=true, ningún depósito nuevo genera nota de fee"
    throw new Error("FA-05: test no implementado — D6 pendiente + contrato no existe");
  });

  // ===========================================================================
  // FA-06 — Unpause restaura la fee
  // SPEC § 10: "Tras unpause, compute_fee vuelve al valor correcto"
  // ===========================================================================

  it.skip("FA-06: unpause_restores_fee — tras unpause, compute_fee vuelve a los params vigentes", async function () {
    // TODO (post D6 aprobado + contrato existente): implementar con TXE
    //
    // Setup:
    //   multisig pausa → multisig despausa.
    //   alice deposita en escrow.
    //
    // Verificaciones:
    //   1. compute_fee devuelve el valor correcto según fee_params vigentes.
    //   2. No hay estado residual de la pausa (paused_fee_debt = 0, etc.).
    //   3. La nota de fee se crea normalmente al treasury.
    //
    // Ref: SPEC § 9.4 — "Tras unpause, el comportamiento de fee vuelve a los parámetros vigentes;
    //                     no hay estado residual de la pausa"
    throw new Error("FA-06: test no implementado — D6 pendiente + contrato no existe");
  });

  // ===========================================================================
  // FA-07 — Solo la multisig puede pausar
  // SPEC § 10: "Cualquier dirección que no sea la multisig propietaria
  //             recibe revert al llamar pause"
  // ===========================================================================

  it.skip("FA-07: only_multisig_can_pause — cualquier no-multisig recibe revert en pause()", async function () {
    // TODO (post D6 aprobado + contrato existente): implementar con TXE
    //
    // Verificaciones:
    //   1. alice.call(pause()) → revert con NotAuthorized (o equivalente).
    //   2. stranger.call(pause()) → revert.
    //   3. multisig.call(pause()) → OK.
    //
    // Ref: SPEC § 9.4 — "Solo la multisig propietaria puede llamar a pause y unpause"
    throw new Error("FA-07: test no implementado — D6 pendiente + contrato no existe");
  });

  // ===========================================================================
  // FA-08 — Solo la multisig puede cambiar params
  // SPEC § 10: "set_fee_params revierte para cualquier llamante no autorizado"
  // ===========================================================================

  it.skip("FA-08: only_multisig_can_set_params — set_fee_params() revierte para no-multisig", async function () {
    // TODO (post D6 aprobado + contrato existente): implementar con TXE
    //
    // Verificaciones:
    //   1. alice.call(set_fee_params({fee_bps: 100})) → revert con NotAuthorized.
    //   2. multisig.call(set_fee_params({fee_bps: 100})) → OK (con timelock si D6 lo exige).
    //   3. Si D6 incluye timelock: la actualización no es efectiva hasta t + 48h.
    //
    // Ref: SPEC § 9.3 — "updatable por la multisig con 48-hour timelock delay"
    throw new Error("FA-08: test no implementado — D6 pendiente + contrato no existe");
  });

  // ===========================================================================
  // FA-09 — trigger_buyback requiere threshold
  // SPEC § 10: "trigger_buyback revierte si accumulated < threshold"
  // ===========================================================================

  it.skip("FA-09: buyback_trigger_requires_threshold — trigger_buyback revierte si accumulated < threshold", async function () {
    // TODO (post D2 aprobado + contrato existente): implementar con TXE
    //
    // Nota: requiere D2 aprobado (buyback mechanism) para saber qué hace trigger_buyback.
    //
    // Verificaciones:
    //   1. accumulated = threshold - 1 → trigger_buyback() revierte con BelowThreshold.
    //   2. accumulated = threshold → trigger_buyback() OK.
    //   3. accumulated = 0 → trigger_buyback() revierte.
    //
    // Ref: SPEC § 1.2 — "once a threshold is reached, executes a buyback"
    throw new Error("FA-09: test no implementado — D2 pendiente + contrato no existe");
  });

  // ===========================================================================
  // FA-10 — Burn es atómico con el buyback
  // SPEC § 10: "Tras trigger_buyback, los HLC comprados no pueden quedar en
  //             ninguna dirección excepto burn"
  // ===========================================================================

  it.skip("FA-10: burn_is_atomic_with_buyback — HLC comprados se queman atomicamente; no estado intermedio", async function () {
    // TODO (post D2 y D4 aprobados + contrato existente): implementar con TXE
    //
    // Nota: requiere D2 (buyback) y D4 (burn mechanism) aprobados.
    //
    // Verificaciones (si D2=on-chain, D4=call burn):
    //   1. Tras trigger_buyback, HLC comprados tienen balance=0 en cualquier dirección excepto burn.
    //   2. El evento HLCBurned(amount, blockNumber) se emite.
    //   3. No existe estado intermedio donde HLC estén en HLFeeRouter o en un EOA.
    //
    // Verificaciones (si D2=off-chain multisig):
    //   1. La firma multisig incluye compra Y burn en la misma sesión.
    //   2. Transacciones separadas no atadas son rechazadas por el verificador.
    //
    // Ref: SPEC § 9.5 — "Cada HLC comprado se quema en la misma transacción o secuencia atómica"
    throw new Error("FA-10: test no implementado — D2/D4 pendientes + contrato no existe");
  });

  // ===========================================================================
  // FA-11 — Zero deposit no genera fee
  // SPEC § 10: "compute_fee(0) devuelve 0; no se crea nota de fee"
  // ===========================================================================

  it.skip("FA-11: zero_deposit_no_fee — compute_fee(0) == 0; no se crea nota de fee en el treasury", async function () {
    // TODO (post D1–D7 aprobados + contrato existente): implementar con TXE
    //
    // Verificaciones:
    //   1. compute_fee(0) == 0  (sin excepción, sin revert).
    //   2. No se crea nota de fee en el treasury cuando amount=0.
    //   3. No se llama a collect() cuando fee==0.
    //
    // Ref: SPEC § 9.3 — "Si amount = 0, compute_fee devuelve 0 (sin fee en depósitos de cero)"
    throw new Error("FA-11: test no implementado — contrato no existe (D1–D7 pendientes)");
  });

  // ===========================================================================
  // FA-12 — Aritmética de fee no hace overflow
  // SPEC § 10: "Para todos los valores de amount en [0, u128::MAX],
  //             compute_fee no hace overflow"
  // ===========================================================================

  it.skip("FA-12: fee_arithmetic_no_overflow — compute_fee(amount) no hace overflow para todo amount en [0, u128::MAX]", async function () {
    // TODO (post D1–D7 aprobados + contrato existente): implementar con TXE
    //
    // Vectores de overflow (fórmula u128-safe del SPEC):
    //   amount = u128::MAX = 340_282_366_920_938_463_463_374_607_431_768_211_455
    //   fee_bps = 30
    //   Sin fórmula safe: amount * fee_bps OVERFLOWS u128.
    //   Con fórmula safe (q,r):
    //     q = amount / 10_000 = 34_028_236_692_093_846_346_337_460_743_176_821
    //     r = amount % 10_000 = 1_455 (u128::MAX mod 10_000)
    //     raw_fee = q*30 + ceil(r*30/10_000) = 1_020_847_100_762_815_390_390_123_822_295_304_630 + 5
    //     fee = min(raw_fee, tx_cap) = tx_cap = 1_000_000
    //
    // Verificación adicional obligatoria:
    //   grep en el Noir compilado confirma ausencia de `amount * fee_bps` sin división previa.
    //   Esta verificación se documenta en el IMPLEMENTATION_LOG § 5 (auto-auditoría).
    //
    // Ref: SPEC § 6.1 — "Fee arithmetic: cannot overflow; ceil is correct for all amounts"
    // Ref: Prompt Maestro — "Grep obligatorio: ausencia de amount * feeBps"
    throw new Error("FA-12: test no implementado — contrato no existe (D1–D7 pendientes)");
  });

});
