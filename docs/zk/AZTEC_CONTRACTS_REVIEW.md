# Revisión de los contratos aztec-nr (`contracts/aztec/`)

**Fecha:** 3 de noviembre de 2026. **Revisa:** el commit `6c009e5a`, que añadió `PrivateEscrow`, `PaymentStream` e `IdentityCredential` (tareas R-08 a R-10 del prompt maestro). **Estado tras la revisión:** compilan con Aztec 6.0.0 en la CI (workflow "Aztec contracts", que además regenera sus artefactos en ramas `claude/**`). No hay tests TXE todavía, ni despliegue.

## Hallazgos y correcciones

| ID | Contrato | Gravedad | Problema en `6c009e5a` | Corrección |
|---|---|---|---|---|
| AZ-01 | PrivateEscrow | Crítica | `refund` sacaba notas del conjunto del emisor, donde no había ninguna: el reembolso nunca podía funcionar y los fondos no reclamados quedaban bloqueados | `deposit` crea una nota de cobro para el receptor y otra de devolución para el emisor |
| AZ-02 | PrivateEscrow | Crítica | Cobro y devolución no compartían nada que impidiera ambos | Los dos publican el mismo nulificador de liquidación (`push_nullifier_unsafe` con separador propio) |
| AZ-03 | PrivateEscrow, PaymentStream | Crítica | `pop_notes(NoteGetterOptions::new())` sin selector saca hasta 16 notas y usa la primera: anula y pierde los demás escrows o streams del mismo usuario | Selección por `escrow_id` / id del stream con `set_limit(1)` |
| AZ-04 | PrivateEscrow | Alta | `deposit` fijaba la expiración de la transacción en el plazo; Aztec rechaza expiraciones a más de 24 h del bloque ancla, así que cualquier escrow largo fallaba | `deposit` solo exige `deadline > anchor` |
| AZ-05 | PrivateEscrow | Alta | `claim` solo comprobaba la hora del bloque ancla, que es pasada: podía incluirse después del plazo | `claim` fija la expiración en `min(deadline, anchor + 1 h)` |
| AZ-06 | PaymentStream | Alta | `cancel` sacaba notas del conjunto del emisor, donde no había ninguna: nunca podía funcionar | Eliminado. Una cancelación real necesita una nota del emisor y un nulificador compartido con los retiros (pregunta de diseño abierta) |
| AZ-07 | IdentityCredential | Media | `assert_valid_root` era pública y la podía llamar cualquiera | `#[only_self]` |
| AZ-08 | IdentityCredential | Media | Sanciones fijas en el contrato (G2) | Lista comprometida y actualizable por el emisor (`sanction_root`, `update_sanction_root`), además de las cuatro fijas |

## Límites que siguen abiertos

1. **Custodia.** Escrow y streams guardan saldo privado del token. Para gastarlo, el PXE que ejecuta `claim`, `refund` o `withdraw` tiene que poder gastar las notas del contrato. Eso exige desplegar el contrato con claves (`publicKeys` en `deploy`) y compartirlas con las partes, como el Escrow de aztec-standards. No está construido.
2. **Llamadas al token por selector crudo** (`call_private_function` con `transfer_in_private((Field),(Field),u128,Field)`). Funciona si el token de referencia mantiene esa firma; la interfaz tipada `Token::at(..)` sería más robusta (riesgo de crate duplicado, ver `AZTEC_NR_V6_NOTES.md`).
3. **Sin tests TXE.** La CI prueba que compilan, no que se comportan. Los tests deben incluir: dos escrows del mismo receptor (AZ-03), reembolso tras el plazo (AZ-01), cobro y reembolso compitiendo (AZ-02), plazo a más de 24 h (AZ-04).
4. **Afirmaciones del commit original que no se sostienen** ("Production Native", "Lazarus Group adversary", "sanction non-membership" con cuatro constantes, "cancelación en cualquier momento"): retiradas del dossier.
