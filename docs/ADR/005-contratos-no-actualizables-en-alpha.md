# ADR 005: Ningún contrato propio es actualizable en la alpha

Estado: aprobada por Stefan Antonio Cirisanu en el prompt `docs/plan/prompts/05-gates-protocol.md` (19/11/2026) · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: este archivo

> Pedida como `docs/adr/0001-…`. El repositorio ya tiene `docs/ADR/`, y en Windows y macOS `adr` y `ADR` son la misma carpeta, así que sigue la numeración existente.

## Contexto

- La documentación de Aztec para Tierra (v6.0.0) dice que las actualizaciones de contratos aún no están bien soportadas por el framework. Son una función de protocolo de bajo nivel, difíciles de ejecutar bien y necesitan muchas pruebas ([Aztec, Contract Upgrades](https://docs.aztec.network/developers/docs/aztec-nr/framework-description/contract_upgrades)).
- La misma página advierte que los macros `#[aztec]` no se construyeron pensando en actualizaciones. El código que generan puede dejar inutilizables para siempre todas las funciones de instancias ya desplegadas, por ejemplo por las comprobaciones de inicialización.
- Su ejemplo de `update_to` no tiene control de acceso, y la página pide autorización adecuada en producción.
- Nuestros contratos (`contracts/aztec/{escrow,streams,identity,portal_token,test_token}`) usan `#[aztec]` con aztec-nr v6.0.0. Ninguno tiene `update_to`. En Alpha no hay ninguno desplegado (`contracts: []`), y no hay auditoría externa (`audit: null`).

## Decisión

En la alpha cerrada, ningún contrato propio es actualizable. Un cambio de comportamiento se hace así:

1. una **clase nueva**, con su id impreso por `scripts/aztec/print-class-ids.mjs` y registrado, nunca inventado;
2. una **instancia nueva**, desplegada primero en la red de pruebas desde la CI y después en Alpha por Stefan con sus claves;
3. el registro anterior pasa a `retiredTokens` o a una lista `retired`, con el motivo y la fecha;
4. un **aviso a los usuarios** en la app y en el changelog, con qué cambia y qué pasa con sus saldos o acuerdos abiertos.

El token HLC es un `Token` estándar de `@aztec-labs/noir-contracts.js` y se rige igual: renombrarlo es una instancia nueva (`docs/alpha/HLC_REDEPLOY_RUNBOOK.md`).

## Consecuencias

- **A favor:** el código de una dirección no cambia nunca. Lo que un tester revisó o aceptó es lo que se ejecuta. No hay clave capaz de cambiar el comportamiento de un contrato con fondos.
- **En contra:** un fallo no se corrige en el sitio. Cada corrección obliga a migrar: los acuerdos abiertos se terminan en la instancia antigua (las salidas nunca se bloquean, `lib/alpha/gate.ts`) y los nuevos van a la nueva.
- **Operación:** cada migración tiene su runbook, su verificación de solo lectura (preflight) y su entrada en `docs/UPGRADE_LOG.md`.

## Opción futura, no implementada

Una función `update_to` restringida a una multifirma de la S.L. Usaría el retraso del `ContractInstanceRegistry`, para que los usuarios vean el cambio antes de que entre en vigor y puedan salir. Llevaría pruebas TXE de que nadie más puede llamarla, de que el retraso se respeta y de que las instancias ya desplegadas siguen funcionando tras actualizar (el riesgo de los macros). Solo se valorará cuando el framework lo soporte bien, con una auditoría externa y con un ADR nuevo que sustituya a este.
