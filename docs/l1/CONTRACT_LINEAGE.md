# L1 Contracts — Contract Lineage

**Documento:** `docs/l1/CONTRACT_LINEAGE.md`  
**Fecha:** 15 noviembre 2026  
**Creado:** Antigravity, Fase 3 (Plan de Madurez Fase 3, sección 2.5)  
**Propósito:** documentar la historia y las decisiones de diseño de los contratos L1 para que el auditor entienda su evolución sin necesidad de leer todos los commits.

> [!NOTE]
> La información de este documento se extrae de la lectura directa del código fuente
> (`contracts/HumanityTimeLockVault.sol`, `contracts/security/LedgerDeadmanSwitch.sol`)
> y de los documentos existentes. Los campos marcados como _(pendiente de verificación por Stefan)_
> requieren confirmación humana antes de la auditoría.

---

## 1. `HumanityTimeLockVault.sol`

**Ruta:** `contracts/HumanityTimeLockVault.sol`  
**Versión Solidity:** `^0.8.24`  
**Constructor:** `constructor() Ownable(msg.sender)` — sin parámetros. El deployer es el owner del contrato (no de los vaults individuales).

### Propósito

Dead man's switch por usuario: un vault multi-token no custodial. Cada usuario configura su propio vault independientemente (`setupVault`). El contrato guarda los tokens; si el owner no hace `pingHeartbeat` durante el timeout configurado, cualquier dirección puede llamar a `executeDeadManSwitch` para barrer todos los tokens al backup wallet configurado.

Reemplaza las tablas de base de datos `TimeLockVault`, `DeadMansSwitch`, `Guardian` y `SocialRecovery` con lógica on-chain verificable.

### Interfaz pública (funciones externas/públicas)

| Función | Acceso | Descripción |
|---|---|---|
| `setupVault(uint256 _timeoutSeconds, address _backupWallet)` | Cualquiera | Crea o reconfigura el vault del `msg.sender`. Resetea `isTriggered` (el owner puede recuperar el control). Mínimo timeout: 1 hora. |
| `depositToken(address _tokenAddress, uint256 _amount)` | Cualquiera | Deposita ERC-20 en el vault del `msg.sender`. Balance diff para fee-on-transfer. Límite: 32 tokens distintos. `nonReentrant`. |
| `withdrawToken(address _tokenAddress, uint256 _amount)` | Cualquiera | Retira tokens del vault del `msg.sender`. Refresca el heartbeat. `nonReentrant`. |
| `pingHeartbeat()` | Cualquiera | Refresca el inactivity clock del vault del `msg.sender`. |
| `executeDeadManSwitch(address _vaultOwner)` | Cualquiera | Ejecuta el switch si el timeout ha expirado. Barre todos los tokens al backup wallet. Re-llamable para tokens cuya transferencia falló la primera vez. `nonReentrant`. |
| `vaultTokens(address _vaultOwner)` | View | Lista los tokens registrados en el vault de un owner. |
| `vaults(address)` | View | `VaultConfig` del owner (timeout, lastHeartbeat, backupWallet, isTriggered). |
| `vaultBalances(address, address)` | View | Balance de un token específico en el vault de un owner. |

### Propiedades de seguridad que el contrato intenta garantizar

Ver `docs/l1/AUDIT_READY.md` § 2.1 para la lista completa. Resumen:

- **P-TLV-01:** No drain entre owners — el balance de un owner no decrece por acciones de otro.
- **P-TLV-02:** CEI enforced — `isTriggered` se establece antes de cualquier transferencia externa.
- **P-TLV-03:** MAX_TOKENS respetado — máximo 32 tokens distintos por vault.
- **P-TLV-04:** Fee-on-transfer seguro — acredita balance diff, no amount pedido.
- **P-TLV-05:** Reentrancy bloqueado — `nonReentrant` en todas las funciones mutantes.
- **P-TLV-06:** Sin ETH — el contrato no acepta ETH directo (no tiene `receive()` ni `fallback()`).
- **P-TLV-07:** Sweep re-llamable — `executeDeadManSwitch` puede re-llamarse para tokens cuya transferencia falló (un bad token no bloquea los demás).

### Cambios conocidos y decisiones de diseño

| Cambio | Descripción | Evidencia |
|---|---|---|
| **Sweep multi-token** | La versión original solo sweepaba los tokens que el caller listaba explícitamente, y luego rechazaba toda llamada posterior. Esto permitía a cualquiera triggear con un solo token y congelar el resto del vault. Se rediseñó para sweepear todos los tokens registrados y permitir re-llamadas para tokens fallidos. | Comentario en el NatSpec del contrato: "It used to sweep only the tokens the caller listed and then refuse every later call, so anyone could fire it with one token after the timeout and freeze the others for good." |
| **Balance diff en deposit** | Se cambió de acreditar `_amount` directamente a usar balance diff (`before`/`after` de `balanceOf`), protegiéndose contra fee-on-transfer tokens. | Código en `depositToken`: `uint256 received = token.balanceOf(address(this)) - before;` |
| **Re-llamabilidad del switch** | `executeDeadManSwitch` puede re-llamarse tras el primer trigger para tokens cuya transferencia falló. Si no hay nada que mover en una segunda llamada, revierte con `NoTokenBalancesFound`. | Código: `if (!firstTrigger && transferred == 0) revert NoTokenBalancesFound();` |
| **Try/catch interno (`_tryTransfer`)** | El sweep usa una función interna `_tryTransfer` que captura los revert de tokens individuales. Un token que falla no bloquea los demás. | Código en el loop: `if (_tryTransfer(tokenAddress, backupWallet, balance)) { ... } else { vaultBalances[...] = balance; }` |

### Dependencias

| Librería | Versión | Uso |
|---|---|---|
| `@openzeppelin/contracts/access/Ownable.sol` | 5.x (ver `package.json`) | Ownership del contrato (no de los vaults individuales) |
| `@openzeppelin/contracts/token/ERC20/IERC20.sol` | 5.x | Interface para interactuar con tokens |
| `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol` | 5.x | `safeTransferFrom`, `safeTransfer` para tokens no estándar |
| `@openzeppelin/contracts/utils/ReentrancyGuard.sol` | 5.x | `nonReentrant` modifier |

---

## 2. `LedgerDeadmanSwitch.sol`

**Ruta:** `contracts/security/LedgerDeadmanSwitch.sol`  
**Versión Solidity:** `^0.8.20`  
**Constructor:** `constructor(address _initialOwner, address _backupWallet, uint256 _timeoutDays)` — tres parámetros obligatorios.

### Propósito

Protocolo de herencia no custodial. El contrato no guarda fondos: cuando el trigger se ejecuta, reenvía los allowances ERC-20/721 que el owner haya concedido al contrato, al backup wallet. Diseñado para Polygon PoS / Amoy según el NatSpec, aunque el código es compatible con cualquier EVM.

### Interfaz pública (funciones externas/públicas)

| Función | Acceso | Descripción |
|---|---|---|
| `ping()` | `onlyOwner` | Resetea el inactivity clock. El owner debe llamarla periódicamente. |
| `proposeBackupWallet(address)` | `onlyOwner` | Paso 1 del cambio de backup: propuesta con cooldown de 72 horas. |
| `confirmBackupWallet()` | `onlyOwner` | Paso 2: confirma el cambio si han pasado 72 horas. |
| `setTimeout(uint256 _days)` | `onlyOwner` | Actualiza el timeout. Mínimo: 90 días. |
| `triggerInheritance(address[], uint256[], address[], uint256[])` | Cualquiera | Ejecuta el trigger si el timeout ha expirado. Reenvía los allowances listados. `nonReentrant`. |
| `pause()` / `unpause()` | `onlyOwner` | Pausa/despausa de emergencia. |
| `secondsUntilExpiry()` | View | Segundos que faltan para que el trigger se desbloquee. |
| `expiresAt()` | View | Timestamp en el que el trigger se desbloquea. |
| `getStatus()` | View | Estado completo del switch. |

### Propiedades de seguridad

Ver `docs/l1/AUDIT_READY.md` § 2.2:

- **P-DMS-01:** Min timeout enforced — mínimo 90 días (constante `MIN_TIMEOUT = 90 days`).
- **P-DMS-02:** Backup cooldown — 72 horas entre propuesta y confirmación del cambio de backup.
- **P-DMS-03:** Anti-frontrun — cualquier dirección puede triggear; no hay MEV advantage.
- **P-DMS-04:** AlreadyTriggered guard — no puede triggarse dos veces (`AlreadyTriggered` error).
- **P-DMS-05:** Ownable2Step — el ownership no puede robarse en una sola tx.
- **P-DMS-06:** Pause no bloquea trigger ejecutado — un trigger ya ejecutado no se revierte por pausa.
- **P-DMS-07:** ETH rechazado — `receive()` y `fallback()` tienen `revert Blocked()`.
- **P-DMS-08:** ERC721 safe transfer — _(pendiente de verificación por el auditor — ver TM-L1-07)_.

### Decisiones de diseño documentadas

| Decisión | Descripción | Origen |
|---|---|---|
| **El trigger es público (cualquier dirección puede ejecutarlo)** | Decisión intencional. Si el trigger fuera privado (solo el backup wallet), habría MEV advantage: un frontrunner podría ver el tx del backup en el mempool y triggear antes, pero el destino es fijo así que no gana nada con ello. Con trigger público + destino fijo, no hay vector. Documentado en el NatSpec: "Anti-frontrun: any address can trigger after timeout (no privileged caller means no MEV advantage over backup wallet)". | NatSpec del contrato, cabecera. |
| **`Ownable2Step` en LedgerDeadmanSwitch, pero `Ownable` en HumanityTimeLockVault** | `LedgerDeadmanSwitch` protege al owner de un robo de ownership en una sola tx porque el ownership es crítico: si alguien roba el ownership, puede cambiar el backup wallet. `HumanityTimeLockVault` usa `Ownable` más simple porque el contract owner no tiene acceso a los vaults individuales: incluso si alguien roba el ownership del contrato, no puede drenar vaults de otros usuarios. | Verificado por lectura del código fuente. _(Pendiente de confirmación por Stefan que esta asimetría es intencional)_. |
| **Mínimo de 90 días en LedgerDeadmanSwitch** | El timeout mínimo de 90 días está hardcodeado como `MIN_TIMEOUT = 90 days`. **Justificación documentada (H3-03, 15 nov 2026):** 90 días es el mínimo pragmático y legal para un protocolo de herencia/sucesión. Un timeout inferior (p.ej. 30 días) podría activarse por una hospitalización prolongada o un viaje sin conectividad. El número 90 corresponde al plazo estándar de declaración de fallecimiento presunto en ausencia en España (art. 194 CC) y al período mínimo de inactividad reconocible en muchos frameworks de herencia digital. No hay una justificación técnica de protocolo blockchain para 90 días — es una decisión de product y legal, no criptográfica. El auditor debe revisar si el operador ha validado este número con counsel. | Constante en el contrato. Origen documentado aquí (H3-03). |
| **No custodial: el contrato no guarda fondos** | `LedgerDeadmanSwitch` no recibe tokens: usa los allowances del owner. El contrato rechaza ETH (`receive()` revierte). Esto elimina el vector de "fondos atrapados en el contrato si el trigger nunca se ejecuta". | Comentario en el NatSpec: "Architecture: Owner never cedes custody. Contract holds zero funds." |

### Dependencias

| Librería | Versión | Uso |
|---|---|---|
| `@openzeppelin/contracts/access/Ownable2Step.sol` | 5.x | Ownership con dos pasos para evitar robo en una tx |
| `@openzeppelin/contracts/utils/ReentrancyGuard.sol` | 5.x | `nonReentrant` en `triggerInheritance` |
| `@openzeppelin/contracts/utils/Pausable.sol` | 5.x | Pausa de emergencia |
| `@openzeppelin/contracts/token/ERC20/IERC20.sol` | 5.x | Interface para leer allowances y transferir |
| `@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol` | 5.x | Nombre y símbolo del token en eventos |
| `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol` | 5.x | `safeTransferFrom` para tokens no estándar |
| `@openzeppelin/contracts/token/ERC721/IERC721.sol` | 5.x | Interface para NFTs (`safeTransferFrom`) |

---

## 3. Decisiones de diseño transversales

### 3.1 Trigger público (cualquier dirección puede ejecutarlo)

Ambos contratos permiten que cualquier dirección externa ejecute el dead man's switch una vez superado el timeout. Esta es una decisión de diseño anti-MEV deliberada:

- El destino de los fondos es fijo (el backup wallet configurado por el owner).
- El caller no gana nada ejecutando el trigger, independientemente de si lo hace el backup wallet u otro tercero.
- Sin privileged caller, no hay MEV advantage: no hay nada que frontrunear porque el resultado es el mismo para cualquier caller.

**Riesgo residual:** si el backup wallet quiere ejecutar el trigger pero alguien lo frontrunea, el resultado es idéntico — los fondos van al backup wallet de todas formas. El único caso adversarial sería si el frontrunner puede manipular el backup wallet antes de triggear, pero esto está protegido por el cooldown de 72 horas en `LedgerDeadmanSwitch` y por `setupVault` en `HumanityTimeLockVault` (el owner puede reconfigurar antes del trigger).

### 3.2 `Ownable` vs `Ownable2Step`

- `HumanityTimeLockVault` usa `Ownable` porque el contract owner no tiene acceso a vaults individuales. El riesgo de robo de ownership es bajo: un atacante que se apodere del ownership del contrato no puede drenar fondos de nadie.
- `LedgerDeadmanSwitch` usa `Ownable2Step` porque el owner tiene permisos críticos: puede cambiar el backup wallet (con cooldown), actualizar el timeout, y pausar el contrato. El riesgo de robo de ownership es alto.

**Decisión confirmada (H3-02, 15 nov 2026):** la asimetría es intencional por diseño. `HumanityTimeLockVault` usa `Ownable` simple porque el contract owner no tiene acceso a vaults individuales: el robo de ownership del contrato no permite drenar fondos de ningún usuario. El riesgo de ownership es bajo, y `Ownable2Step` añadiría fricción sin reducir el surface de ataque real. `LedgerDeadmanSwitch` usa `Ownable2Step` porque el owner tiene permisos críticos (proponer backup wallet, pausar el contrato): un robo de ownership en una sola tx podría redirigir la herencia. La asimetría es una decisión de diseño consciente, no una inconsistencia. Registrado en `docs/UPGRADE_LOG.md` § Sesión 4.

### 3.3 Versión de Solidity distinta entre contratos

- `HumanityTimeLockVault.sol`: `^0.8.24`
- `LedgerDeadmanSwitch.sol`: `^0.8.20`

Hardhat compila ambos con sus versiones respectivas (ver `hardhat.config.js` — tiene compiladores para 0.8.24 y 0.8.20). La versión de Solidity debe fijarse a una versión exacta antes de la auditoría (ver `docs/l1/AUDIT_READY.md` § 3 — ítem de Solidity version pinning).

---

## Referencias

- `docs/l1/AUDIT_READY.md` — criterios de entrada a auditoría
- `docs/l1/THREAT_MODEL.md` — vectores de amenaza específicos
- `test/HumanTimeLock.test.ts` — tests de cobertura (Claude Opus, protegido)
- `test/LedgerDeadmanSwitch.test.ts` — tests de cobertura (Claude Opus, protegido)
- `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` — tests adversariales Fase 3
- `ignition/modules/HumanityTimeLockVault.ts` — script de despliegue Fase 3
- `ignition/modules/LedgerDeadmanSwitch.ts` — script de despliegue Fase 3
