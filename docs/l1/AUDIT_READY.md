# L1 Contracts — Audit Readiness Checklist

**Documento:** `docs/l1/AUDIT_READY.md`
**Fecha:** 15 noviembre 2026
**Contratos en scope:** `HumanityTimeLockVault.sol`, `LedgerDeadmanSwitch.sol`
**Estado actual:** Pre-auditoría. Tests Hardhat existentes. Sin despliegue en mainnet. Sin auditoría externa.

> [!IMPORTANT]
> Ningún contrato L1 se despliega en mainnet hasta que todos los items de esta lista estén marcados como completos y un auditor externo haya firmado el informe. Este documento es el único criterio de entrada al proceso de auditoría para estos dos contratos.

> [!NOTE]
> Los contratos `ZKIdentityRegistry.sol` y `ZKVerificationKeyRegistry.sol` no están en scope de esta auditoría inicial porque `verifyCredential` revierte siempre (`VerifierNotConnected`) y el VK registry no está desplegado. Se auditarán junto con el fee contract cuando Path A esté completo.

---

## Contratos en scope

| Contrato | Ruta | Propósito |
|---|---|---|
| `HumanityTimeLockVault` | `contracts/HumanityTimeLockVault.sol` | Dead man's switch por usuario: libera tokens a un backup wallet tras un timeout de inactividad. Multi-token (hasta 32), no custodial desde el contrato, CEI enforced, nonReentrant. |
| `LedgerDeadmanSwitch` | `contracts/security/LedgerDeadmanSwitch.sol` | Interruptor de herencia: transfiere allowances de ERC-20/721 al backup wallet tras el timeout. Ownable2Step, ReentrancyGuard, Pausable, 90-day minimum timeout, 72h cooldown en cambio de backup. |

---

## 1. Cobertura de tests Hardhat

### Items completados

- [x] `test/HumanTimeLock.test.ts` — cubre `HumanTimeLock.sol` (contrato relacionado): lock, withdraw antes/después del timeout, re-lock, balance check.
- [x] `test/LedgerDeadmanSwitch.test.ts` — 100 % branch coverage declarado: constructor, ping, backup change con cooldown, setTimeout floor, trigger antes/después del timeout, ERC20+ERC721 forwarding, AlreadyTriggered guard, pause/unpause, ETH rechazado, view helpers.
- [x] `test/contracts_invariants.test.ts` — Task T8/A4: invariants de L1, anti-backdoor, ownership, reentrancy.
- [x] `test/SystemDeadmanSwitch.test.js` — Tests de integración del switch a nivel de sistema.
- [x] `scripts/verify-l1-bytecode.ts` — scan de bytecode para patrones de drain conocidos (lint, no auditoría).

### Items pendientes antes de auditoría

- [ ] **Cobertura de coverage verificada con herramienta:** ejecutar `npm run test:contracts` con `hardhat-gas-reporter` y `solidity-coverage` y registrar el % de branch coverage aquí. El número debe venir de la salida de un comando, no de una estimación.
  ```bash
  npx hardhat coverage --testfiles "test/HumanTimeLock.test.ts test/LedgerDeadmanSwitch.test.ts test/contracts_invariants.test.ts"
  ```
  **Coverage obtenida:** _(pendiente de ejecutar y registrar aquí)_

- [ ] **Test: `isTriggered` no bloquea el segundo token en `HumanityTimeLockVault`** — `docs/zk/MASTER_PROMPT.md` menciona: "revisar que `isTriggered` no bloquee el segundo token". Verificar que `executeDeadManSwitch` puede llamarse de nuevo tras el primer trigger para barrer tokens cuya transferencia falló la primera vez. Añadir test específico si no existe.

- [ ] **Test adversarial: fee-on-transfer token en `HumanityTimeLockVault`** — `contracts/mocks/MockFeeOnTransferERC20.sol` existe. Verificar que el balance diff pattern de `deposit` impide que un token fee-on-transfer acredite más de lo recibido y drene balances de otros owners.
  - Test file: `test/HumanTimeLock.test.ts` o test nuevo en `test/unit/contracts/`.

- [ ] **Test: reentrancy cross-function en `HumanityTimeLockVault`** — Verificar que un token malicioso que llama de vuelta a `deposit` o `executeDeadManSwitch` durante una transferencia no puede alterar balances. `nonReentrant` está en todas las funciones mutantes; el test debe demostrarlo con un mock de token reentrante.

- [ ] **Test: ETH enviado directamente a `HumanityTimeLockVault` revierte** — El contrato no debe aceptar ETH. Verificar con `expect(vault.receive({ value: 1 })).to.be.reverted`.

---

## 2. Propiedades de seguridad que el auditor debe verificar

### 2.1 HumanityTimeLockVault

| Propiedad | Descripción | Test actual |
|---|---|---|
| **P-TLV-01** No drain entre owners | El balance de un owner no puede decrecer por una acción de otro owner | `contracts_invariants.test.ts` |
| **P-TLV-02** CEI enforced | `isTriggered` se establece antes de cualquier transferencia externa | Revisar código + `contracts_invariants.test.ts` |
| **P-TLV-03** MAX_TOKENS respetado | No puede haber más de 32 tokens distintos en un vault | ⬜ Test pendiente |
| **P-TLV-04** Fee-on-transfer seguro | Un token con fee no puede acreditar más de lo recibido | ⬜ Test pendiente (MockFeeOnTransferERC20 existe) |
| **P-TLV-05** Reentrancy bloqueado | Un token malicioso no puede re-entrar en el contrato | ⬜ Test pendiente |
| **P-TLV-06** Sin ETH | El contrato rechaza ETH directo | ⬜ Test pendiente |
| **P-TLV-07** Sweep re-llamable | Tras el primer trigger, `executeDeadManSwitch` puede llamarse de nuevo para tokens fallidos | ⬜ Verificación pendiente |

### 2.2 LedgerDeadmanSwitch

| Propiedad | Descripción | Test actual |
|---|---|---|
| **P-DMS-01** Min timeout enforced | No puede establecerse un timeout < 90 días | `LedgerDeadmanSwitch.test.ts` |
| **P-DMS-02** Backup cooldown | No puede ejecutarse un cambio de backup en menos de 72h | `LedgerDeadmanSwitch.test.ts` |
| **P-DMS-03** Anti-frontrun | Cualquier dirección puede triggear tras el timeout; no hay MEV advantage | `LedgerDeadmanSwitch.test.ts` |
| **P-DMS-04** AlreadyTriggered guard | No puede triggarse dos veces | `LedgerDeadmanSwitch.test.ts` |
| **P-DMS-05** Ownable2Step | El ownership no puede ser robado en una sola tx | `LedgerDeadmanSwitch.test.ts` |
| **P-DMS-06** Pause no bloquea trigger | El owner puede pausar el contrato pero el trigger ya ejecutado no se revierte | `LedgerDeadmanSwitch.test.ts` |
| **P-DMS-07** ETH rechazado | El contrato no acepta ETH (sólo allowances) | `LedgerDeadmanSwitch.test.ts` |
| **P-DMS-08** ERC721 safe transfer | El forwarding de NFTs usa `safeTransferFrom` o equivalente; no deja NFTs atrapados | ⬜ Verificación pendiente |

---

## 3. Items de código a resolver antes de auditoría

- [ ] **`ZKIdentityRegistry.verifyCredential` siempre revierte (`VerifierNotConnected`).** El plan § 4 dice: "debe dejar de revertir o el contrato se elimina." Decisión binaria pendiente:
  - Opción A: conectar un verificador real (requiere que Path A esté completo).
  - Opción B: eliminar el contrato del scope de auditoría (marcarlo como NOT-IN-SCOPE en este documento).
  - **Decisión actual:** NOT-IN-SCOPE para esta auditoría inicial. Revisar cuando el fee contract esté implementado.

- [ ] **`HumanityTimeLockVault` hereda de `Ownable` pero la función de sweep no requiere que `msg.sender == owner`.** Verificar que esto es intencional (el diseño dice "cualquier dirección puede triggear tras el timeout") y documentarlo explícitamente en el NatSpec del contrato. El auditor necesita saber que es una decisión de diseño, no una omisión.

- [ ] **Versión de Solidity:** ambos contratos usan `^0.8.20` / `^0.8.24`. Fijar a una versión exacta antes de la auditoría (e.g., `0.8.28`) para evitar que el compilador cambie bajo el auditor.

- [ ] **Hardhat Ignition scripts:** `@nomicfoundation/hardhat-ignition` está en `package.json`. Crear scripts de despliegue en `ignition/modules/` para `HumanityTimeLockVault` y `LedgerDeadmanSwitch` antes de la auditoría, para que el auditor pueda reproducir el despliegue exactamente.

---

## 4. Documentación requerida por el auditor

- [ ] **Threat model específico para L1:** `docs/SECURITY.md` cubre el modelo de amenaza del protocolo completo. Crear `docs/l1/THREAT_MODEL.md` que se centre en los vectores específicos de estos contratos (reentrancy, MEV, front-running del backup change, token malicioso).
  - **Decisión de Antigravity:** este documento puede crearse en una sesión posterior. Se lista aquí para que no se olvide.

- [ ] **NatSpec completo** en ambos contratos: todas las funciones públicas y externas deben tener `@notice`, `@param`, `@return` y `@dev` donde aplique. Verificar con `npx hardhat docgen` o equivalente.

- [ ] **Changelog de cambios desde el primer commit:** qué fixes se han aplicado y por qué. `docs/CHANGELOG.md` existe; verificar que los cambios a estos contratos están registrados allí.

---

## 5. Criterio de entrada a la auditoría

El contrato está listo para auditoría externa cuando:

1. Todos los items de la sección 2 con ⬜ están marcados como ✅ con evidencia de test.
2. Todos los items de la sección 3 están resueltos con decisión documentada.
3. `npm run test:contracts` pasa con coverage ≥ 90 % de branches.
4. `scripts/verify-l1-bytecode.ts` no reporta patrones de drain.
5. Los scripts de Ignition existen y `npx hardhat ignition deploy` reproduce el despliegue.
6. Stefan ha revisado y aprobado este documento.
7. El auditor ha recibido este documento, `docs/AUDIT_SCOPE.md` y `docs/SECURITY.md`.

**Fecha objetivo para la auditoría:** _(pendiente de Stefan)_
**Auditor seleccionado:** _(pendiente de Stefan)_
