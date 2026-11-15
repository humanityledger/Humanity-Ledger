# L1 Contracts — Threat Model

**Documento:** `docs/l1/THREAT_MODEL.md`  
**Fecha:** 15 noviembre 2026  
**Creado:** Antigravity, Fase 3 (siguiendo Plan de Madurez Fase 3, sección 2.3)  
**Contratos en scope:** `HumanityTimeLockVault.sol`, `LedgerDeadmanSwitch.sol`  
**Estado:** Pre-auditoría. Este documento acompaña a `docs/l1/AUDIT_READY.md`.

> [!IMPORTANT]
> Este documento es descriptivo, no normativo. No modifica el comportamiento de los contratos.
> Los vectores marcados como ⬜ requieren verificación por el auditor externo.
> Los marcados como ✅ tienen test existente referenciado.

---

## 1. Scope

### Contratos en scope

| Contrato | Ruta | Versión Solidity | Propósito |
|---|---|---|---|
| `HumanityTimeLockVault` | `contracts/HumanityTimeLockVault.sol` | `^0.8.24` | Dead man's switch por usuario: multi-token vault que libera tokens al backup wallet tras un timeout de inactividad configurable. No custodial: cada usuario configura su propio vault. Acepta hasta 32 ERC-20 distintos. |
| `LedgerDeadmanSwitch` | `contracts/security/LedgerDeadmanSwitch.sol` | `^0.8.20` | Protocolo de herencia no custodial: el contrato no guarda fondos. Reenvía los allowances ERC-20/721 del owner al backup wallet tras el timeout. `Ownable2Step`, `ReentrancyGuard`, `Pausable`. |

### Contratos explícitamente fuera de scope (esta auditoría inicial)

| Contrato | Motivo |
|---|---|
| `ZKIdentityRegistry.sol` | `verifyCredential` siempre revierte (`VerifierNotConnected`). Decisión: NOT-IN-SCOPE hasta que Path A esté completo. Ver `docs/l1/AUDIT_READY.md` § 3. |
| `ZKVerificationKeyRegistry.sol` | No desplegado. Se auditará junto con el fee contract cuando Path A esté completo. |
| `contracts/aztec/escrow/`, `identity/`, `streams/` | Contratos aztec-nr. Se auditan en un proceso separado con el toolchain de Aztec. Ver `docs/AUDIT_SCOPE.md`. |
| `contracts/mocks/` | Solo tests. No se despliegan en producción. |

---

## 2. Actores y privilegios

### HumanityTimeLockVault

| Actor | Capacidades máximas |
|---|---|
| **Deployer / Contract Owner** (`Ownable`) | Despliega el contrato. No puede acceder a vaults de otros users. No puede drenar fondos de otros owners. |
| **Vault Owner** (cualquier EOA que llame a `setupVault`) | Configura su propio vault (`setupVault`), deposita (`depositToken`), retira (`withdrawToken`), actualiza el heartbeat (`heartbeat` / `withdrawToken`). No puede acceder a vaults de otros. |
| **Backup Wallet** | No tiene permisos directos en el contrato. Recibe los fondos cuando `executeDeadManSwitch` se llama después del timeout. |
| **Cualquier dirección** | Puede llamar a `executeDeadManSwitch` para cualquier vault cuyo timeout haya expirado. Esto es intencional (diseño anti-MEV: sin privileged caller). |
| **Token malicioso** | Un ERC-20 con lógica adversarial puede intentar reentrancy durante `safeTransfer`. Mitigado por `nonReentrant`. |
| **Operador de nodo MEV** | Puede reordenar transacciones en la misma L1 block. No puede manipular el vault directamente. |

### LedgerDeadmanSwitch

| Actor | Capacidades máximas |
|---|---|
| **Owner** (`Ownable2Step`) | Hace `ping()`, propone cambio de backup, confirma cambio de backup (tras cooldown), actualiza timeout, puede pausar el contrato. No puede drenar fondos (el contrato no guarda fondos). |
| **Backup Wallet** | No tiene permisos en el contrato. Recibe los allowances reenvíados cuando el trigger se ejecuta. |
| **Cualquier dirección** | Puede llamar a `triggerInheritance` una vez expirado el timeout. Anti-MEV intencional. |
| **Token malicioso** | Un ERC-20 con `transferFrom` reentrante podría intentar drenar allowances en un loop. Mitigado por `ReentrancyGuard`. |
| **Operador de nodo MEV** | Puede frontrunear el cambio de backup wallet. Mitigado por el cooldown de 72 horas. |

---

## 3. Vectores de amenaza

| ID | Vector | Contrato afectado | Mitigación actual | Test que lo verifica |
|---|---|---|---|---|
| **TM-L1-01** | Reentrancy durante `executeDeadManSwitch`: un token ERC-20 malicioso llama de vuelta al vault durante `safeTransfer`, intentando modificar balances antes de que se actualice el estado interno. | `HumanityTimeLockVault` | `nonReentrant` modifier en todas las funciones mutantes. CEI: `isTriggered` se establece antes de cualquier transferencia. | P-TLV-05 — `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts`. El test de reentrancy completo requiere `ReentrancyAttacker.sol` (ver it.skip documentado). |
| **TM-L1-02** | Fee-on-transfer drena balances de otros owners: un token que aplica fee en `transfer` podría acreditar más de lo recibido y drenar el balance del vault de otros users. | `HumanityTimeLockVault` | `depositToken` usa balance diff (`before`/`after` de `balanceOf`): acredita solo lo que el vault realmente recibió. | P-TLV-04 — `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` ✅ |
| **TM-L1-03** | Token malicioso que reporta 0 en `balanceOf` tras el depósito (balance snapshot manipulado): el vault acreditaría 0 y el token quedaría registrado consumiendo un slot de los 32. | `HumanityTimeLockVault` | Si `received == 0`, `depositToken` revierte con `InvalidAmount`. | ⬜ No hay test para esta variante específica. El auditor debe verificar con un mock que retorne 0 en `balanceOf`. |
| **TM-L1-04** | Overflow en la acumulación de balances (`vaultBalances[owner][token] += received`). | `HumanityTimeLockVault` | Solidity ≥0.8 tiene aritmética segura por defecto (checked arithmetic). No se necesita `SafeMath`. | Implícito en la versión del compilador (`0.8.24`). |
| **TM-L1-05** | Frontrún del cambio de backup wallet: un atacante que controla brevemente la private key del owner propone un cambio de backup a su dirección antes de que el owner lo note. | `LedgerDeadmanSwitch` | Cooldown de 72 horas entre la propuesta y la confirmación. El owner puede detectar y cancelar durante ese período. | P-DMS-02 — `test/LedgerDeadmanSwitch.test.ts` ✅ |
| **TM-L1-06** | Manipulación de `block.timestamp` por el miner/validator: un validator malicioso avanza artificialmente el timestamp para triggear antes del timeout real. | `LedgerDeadmanSwitch`, `HumanityTimeLockVault` | `block.timestamp` es el único oráculo de tiempo disponible en L1 Ethereum. La manipulación está limitada a ~12 segundos por el protocolo de consenso. Para timeouts de 90+ días, este vector es despreciable. | Documentado como riesgo residual aceptado. No mitigable sin un oráculo de tiempo externo (que introduciría otra dependencia). |
| **TM-L1-07** | DoS del trigger mediante un token que revierte en `safeTransferFrom` / `transferFrom`: si uno de los tokens en la lista de allowances revierte durante el trigger, bloquea todo el sweep para ese trigger call. | `LedgerDeadmanSwitch` | ⬜ No está claro si el contrato tiene try/catch por token o si un revert de un token bloquea toda la tx. El auditor debe verificar si el loop sobre tokens tiene protección de errores individuales. | ⬜ Verificación pendiente de auditor. |
| **TM-L1-08** | Ownership transfer a dirección zero (brick permanente del contrato): el owner transfiere a `address(0)` o a un contrato que no puede aceptar. | `LedgerDeadmanSwitch` | `Ownable2Step`: el receptor debe aceptar explícitamente el ownership. No se puede transferir a `address(0)`. | P-DMS-05 — `test/LedgerDeadmanSwitch.test.ts` ✅ |
| **TM-L1-09** | Re-trigger tras el primer trigger: una segunda llamada a `executeDeadManSwitch` / `triggerInheritance` después de que ya se ejecutó intenta drenar fondos de nuevo. | Ambos | `HumanityTimeLockVault`: `isTriggered` guard en `depositToken` y `withdrawToken`; `executeDeadManSwitch` puede re-llamarse para tokens fallidos (diseño intencional, barre lo que quedó). `LedgerDeadmanSwitch`: `AlreadyTriggered` error previene un segundo trigger. | P-DMS-04, P-TLV-07 — `test/LedgerDeadmanSwitch.test.ts` ✅, `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` ✅ |
| **TM-L1-10** | Drain de múltiples tokens en una sola transacción mediante callback reentrante en el loop de sweep. | `HumanityTimeLockVault` | `nonReentrant` + CEI: `isTriggered` se establece antes del loop de transferencias. | P-TLV-02, P-TLV-05. ✅ (parcial — el test de reentrancy completo está en it.skip). |

---

## 4. Suposiciones de seguridad

Este modelo de amenaza asume lo siguiente. Si alguna suposición es falsa, los vectores correspondientes deben reevaluarse:

1. **El nodo Ethereum es honesto para `block.timestamp`:** la manipulación máxima es ~12 segundos, despreciable para timeouts de días/meses.
2. **El owner de ambos contratos es una EOA segura o una multisig:** si el owner es un contrato con lógica adversarial, el modelo cambia completamente.
3. **El deployer no conserva privilegios post-despliegue para drenar vaults de otros usuarios:** verificado en el código fuente — `HumanityTimeLockVault` hereda `Ownable` pero ninguna función del contrato permite al `owner` acceder a vaults de otros users. El auditor debe confirmar que no existe ninguna función `rescue` o `emergencyWithdraw` que pueda drenar fondos de un vault ajeno.
4. **OpenZeppelin 5.x es la versión en uso:** el contrato importa `@openzeppelin/contracts`. La versión exacta está en `package.json`. Los contratos OZ de esta versión no tienen vulnerabilidades conocidas que afecten a `Ownable`, `Ownable2Step`, `ReentrancyGuard`, `Pausable`, o `SafeERC20`.
5. **La red L1 no tiene tiempos de bloque anormalmente largos:** si la red L1 experimenta finalization delays, el timeout real podría superar el configurado. Esto es un riesgo de red, no de contrato.

---

## 5. Qué queda para el auditor externo

Los siguientes vectores no pueden verificarse solo con el código del repositorio y requieren revisión manual o una herramienta de análisis formal:

| Vector | Acción requerida por el auditor |
|---|---|
| **TM-L1-03** — Token con `balanceOf` manipulado | Desplegar un mock que retorne valores inconsistentes en `balanceOf` y verificar que `depositToken` revierte. |
| **TM-L1-07** — Token que revierte durante el loop de trigger en `LedgerDeadmanSwitch` | Revisar el código del loop de sweep: ¿tiene try/catch por token? Si no, un token que revierte bloquea toda la herencia. |
| **TM-L1-10 completo** — Reentrancy con `ReentrancyAttacker.sol` | Desplegar un ERC-20 mock que llame de vuelta al vault durante `safeTransfer` y verificar que `nonReentrant` bloquea el ataque. |
| **Suposición 3** — Sin función `rescue` del owner | Revisar exhaustivamente que ninguna función del contrato permite al `contract owner` acceder a fondos de un `vault owner` ajeno. |

**Referencias cruzadas:**
- `docs/l1/AUDIT_READY.md` — criterios de aceptación para la auditoría
- `docs/AUDIT_SCOPE.md` — scope completo del protocolo para auditores
- `docs/SECURITY.md` — modelo de amenaza del protocolo completo
- `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` — tests adversariales Fase 3
- `test/LedgerDeadmanSwitch.test.ts` — tests de cobertura completa (Claude Opus, protegido)
- `test/contracts_invariants.test.ts` — invariants de L1 (Claude Opus, protegido)
