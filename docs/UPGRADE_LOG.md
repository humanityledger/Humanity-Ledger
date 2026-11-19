# Humanity Ledger Protocol — Upgrade Log

**Documento:** `docs/UPGRADE_LOG.md`
**Propósito:** registro cronológico de todos los cambios realizados por agentes automatizados (Antigravity) sobre el repositorio, con justificación para cada cambio y verificación de que los archivos protegidos no han sido modificados.

---

## Declaración de alineación

**Todos los cambios de esta fase son exclusivamente documentales o de schema preparatorio. Ningún contrato aztec-nr, ninguna función privada, ningún nullifier ni ninguna nota han sido modificados. Se mantiene alineación total con Path A y con las recomendaciones implícitas de Aztec Labs.**

---

## Sesión 1 — 15 noviembre 2026 · Turno 1

**Hora:** ~21:50–22:02 CET
**Agente:** Antigravity (Claude Sonnet 4.6 Thinking)
**Documento de referencia:** `d:\MisArchivos\Desktop\Nuevo documento de texto (2).txt` (plan de madurez)

### Archivos creados

| Archivo | Justificación |
|---|---|
| `docs/AZTEC_DECISIONS.md` | Requerido por el plan § 7 y referenciado en múltiples docs del repo. No existía (`Test-Path` confirmó `False` antes de crearlo). Documenta las 10 preguntas arquitectónicas abiertas a Aztec Labs (Q1–Q10) con posición interim para cada una derivada del código existente. |
| `docs/protocol/FEE_CONTRACT_SPEC.md` | Requerido por el plan § 1.1. El directorio `docs/protocol/` tampoco existía. Spec del fee contract con gate de aprobación (D1–D7 pendientes de Stefan). No contiene código de contrato implementado. |
| `docs/protocol/` (directorio) | Creado como prerequisito de FEE_CONTRACT_SPEC.md. |

### Archivos modificados

| Archivo | Cambio | Justificación | Riesgo |
|---|---|---|---|
| `circuits/escrow/src/main.nr` | Añadido header `STATUS: DEPRECATED` en comentario de cabecera | Plan § 3.1. Ninguna línea de Noir modificada. | Ninguno — solo comentario |
| `circuits/identity/src/main.nr` | Ídem, con referencia a ZK-04, ZK-05, G2, G3 | Plan § 3.1 | Ninguno |
| `circuits/streams/src/main.nr` | Ídem, con referencia a ZK-01 (critical) y test de reproducción | Plan § 3.1 | Ninguno |
| `lib/xmtp/groups.ts` | Corregido `v5.3.0` → `v5.2.0` en comentario JSDoc (línea 19) | `docs/communities/MLS_MIGRATION.md` documenta esta discrepancia explícitamente. Plan § 6. | Ninguno — solo comentario |
| `prisma/schema.prisma` | Añadido `xmtpGroupId String?` en `CommunityChannel` | `MLS_MIGRATION.md` especifica este campo exactamente: "el cliente envía al servidor solo su groupId, que se guarda en CommunityChannel (campo nuevo xmtpGroupId)". Plan § R-17. | Schema validado con `prisma validate` ✅ |
| `prisma/schema.prisma` | Añadido `communityMls Boolean @default(false)` en `Community` | `MLS_MIGRATION.md` especifica: "Bandera `COMMUNITY_MLS` por comunidad". Plan § R-17. | Schema validado ✅ |

### Archivos NO tocados (protegidos)

Verificado explícitamente que los siguientes archivos existen y no fueron modificados:

- `docs/STATUS.md` ✅
- `docs/MAINNET_READINESS.md` ✅
- `docs/TRACEABILITY_MATRIX.md` ✅
- `docs/AZTEC_FOUNDATION_DOSSIER.md` ✅
- `docs/communities/MLS_MIGRATION.md` ✅
- `contracts/aztec/` (directorio completo) ✅
- `lib/aztec/` (directorio completo) ✅
- `components/terminal/LedgerChatV2.tsx` ✅ (verificado: no tiene `@ts-nocheck`)
- `package.json` ✅
- Ningún lockfile ✅

### Verificación post-sesión

```
npx prisma validate (con env vars dummy) → "The schema is valid 🚀" ✅
El error DATABASE_URL_UNPOOLED es preexistente (ítem R9 del plan, pendiente de Stefan en Railway)
```

---

## Sesión 2 — 15 noviembre 2026 · Turno 2

**Hora:** ~22:10–22:18 CET
**Agente:** Antigravity (Claude Sonnet 4.6 Thinking)
**Documento de referencia:** Especificación de fase documental (instrucciones directas del usuario)

### Archivos completados (aditivos — no reescritos)

| Archivo | Cambio | Justificación |
|---|---|---|
| `docs/AZTEC_DECISIONS.md` | Añadida la frase obligatoria al final de cada Q1–Q10: "Posición interim adoptada: se mantiene el patrón actualmente implementado en el código, que sigue Path A (notas + nullifiers de Aztec) y los ejemplos de noir-contracts v6. Cualquier cambio requerirá respuesta explícita de Aztec Labs o nueva decisión documentada." | Requerido literalmente por el documento de referencia § 4.1 |
| `docs/AZTEC_DECISIONS.md` | Añadida sección final: "Decisiones conservadoras adoptadas en ausencia de respuesta de Aztec Labs" con tabla de las 10 decisiones y su justificación conservadora | Requerido por el documento de referencia § 4.1 |
| `docs/protocol/FEE_CONTRACT_SPEC.md` | Añadida sección § 9: "Invariantes de seguridad obligatorias" (doble gasto, front-running, caps, pausa, burn atómico) | Requerido por § 4.2 |
| `docs/protocol/FEE_CONTRACT_SPEC.md` | Añadida sección § 10: "Tests adversariales mínimos" (tabla FA-01 a FA-12) | Requerido por § 4.2 |
| `docs/protocol/FEE_CONTRACT_SPEC.md` | Añadida sección § 11: "Alineación con Aztec Labs" con el texto exacto requerido | Requerido por § 4.2 (texto literal del documento de referencia) |

### Archivos creados (nuevos)

| Archivo | Justificación |
|---|---|
| `docs/communities/R17_ACCEPTANCE.md` | § 4.3: criterios de aceptación de MLS_MIGRATION.md convertidos en checklist verificable (AC-01 a AC-04) con prerequisitos técnicos y tabla de evidencias manuales. |
| `test/communities/r17-acceptance.test.ts` | § 4.3: esqueleto de test con `describe.skip` para AC-01, AC-02, AC-03. Incluye tests de schema (sin skip) que verifican que `communityMls` y `xmtpGroupId` existen en el schema. |
| `test/communities/` (directorio) | Prerequisito del test file. |
| `docs/l1/AUDIT_READY.md` | § 4.4: lista exacta de lo que falta para que `HumanityTimeLockVault.sol` y `LedgerDeadmanSwitch.sol` estén en estado "listo para auditoría". Incluye propiedades de seguridad, items de código y criterio de entrada. |
| `docs/l1/` (directorio) | Prerequisito del AUDIT_READY.md. |
| `docs/UPGRADE_LOG.md` | § 4.5: este documento. |

### Archivos NO tocados (protegidos) — verificación sesión 2

- `docs/STATUS.md` ✅ no modificado
- `docs/MAINNET_READINESS.md` ✅ no modificado
- `docs/TRACEABILITY_MATRIX.md` ✅ no modificado
- `docs/AZTEC_FOUNDATION_DOSSIER.md` ✅ no modificado
- `docs/communities/MLS_MIGRATION.md` ✅ no modificado
- `contracts/aztec/` ✅ cero cambios
- `lib/aztec/` ✅ cero cambios
- `components/terminal/LedgerChatV2.tsx` ✅ no modificado
- `package.json` ✅ no modificado
- Ningún lockfile ✅ no modificado

### Prohibiciones verificadas

| Prohibición (§ 5) | ¿Violada? |
|---|---|
| Modificar contracts/aztec/ | ❌ No violada |
| Modificar lib/aztec/ salvo comentarios | ❌ No violada |
| Modificar componentes de UI | ❌ No violada |
| Generar o ejecutar migraciones de Prisma | ❌ No violada |
| Desplegar nada | ❌ No violada |
| Cambiar dependencias | ❌ No violada |
| Tocar documentos protegidos | ❌ No violada |
| Escribir código de contrato del Fee Contract | ❌ No violada (el sketch del § 3 de FEE_CONTRACT_SPEC es preexistente de la sesión 1; las secciones añadidas en sesión 2 no contienen código Noir ni Solidity) |
| Implementar lógica de R-17 | ❌ No violada (solo skeleton de test y checklist documental) |
| Introducir nuevos patrones criptográficos | ❌ No violada |
| Añadir claims no verificables | ❌ No violada |

---

## Criterio de finalización (§ 7) — estado

| Criterio | Estado |
|---|---|
| Todas las secciones del plan están completas | ✅ |
| `docs/UPGRADE_LOG.md` existe con registro y frase de alineación | ✅ |
| Ningún archivo protegido modificado | ✅ |
| `npx prisma validate` sigue pasando | ✅ (verificado en sesión 1 con env vars dummy) |
| No hay código nuevo de contratos ni lógica de producción | ✅ |

---

---

## Sesión 3 — 15 noviembre 2026 · Turno 3

**Hora:** ~22:30–22:38 CET  
**Agente:** Antigravity (Gemini 2.5 Pro)  
**Documento de referencia:** `docs` → Plan de Madurez Fase 3 (artefacto `PLAN_FASE_3.md`, aprobado por Stefan)

### Archivos creados (nuevos, solo adiciones)

| Archivo | Justificación |
|---|---|
| `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` | Plan § 2.1: tests adversariales P-TLV-03/04/05/06 de AUDIT_READY.md. Esqueleto Hardhat/chai. |
| `test/unit/contracts/` (directorio) | Prerequisito del test adversarial. |
| `ignition/modules/HumanityTimeLockVault.ts` | Plan § 2.2: script Ignition para que el auditor reproduzca el despliegue de HumanityTimeLockVault. |
| `ignition/modules/LedgerDeadmanSwitch.ts` | Plan § 2.2: script Ignition para LedgerDeadmanSwitch. Constructor con 3 parámetros obligatorios via `m.getParameter`. |
| `ignition/modules/` (directorio) | Prerequisito de los scripts Ignition. |
| `docs/l1/THREAT_MODEL.md` | Plan § 2.3: modelo de amenaza L1 con 10 vectores TM-L1-01..10, tabla de actores/privilegios, suposiciones y qué queda para el auditor. |
| `docs/l1/CONTRACT_LINEAGE.md` | Plan § 2.5: historia, interfaz pública, decisiones de diseño y dependencias de ambos contratos L1. |
| `test/gate/j-skeleton.test.ts` | Plan § 2.4: esqueletos de test para los 7 items P0 del bloque J sin test existente (J-001..J-005, J-007, J-009, J-010, J-011, J-013, J-020). Todos en `describe.skip` / `it.skip`. |
| `test/gate/` (directorio) | Prerequisito del j-skeleton. |

### Archivos NO tocados (protegidos) — verificación sesión 3

- `docs/STATUS.md` ✅ no modificado
- `docs/MAINNET_READINESS.md` ✅ no modificado
- `docs/TRACEABILITY_MATRIX.md` ✅ no modificado
- `docs/AZTEC_FOUNDATION_DOSSIER.md` ✅ no modificado
- `docs/communities/MLS_MIGRATION.md` ✅ no modificado
- `docs/AUDIT_DOSSIER.md` ✅ no modificado
- `docs/PROTOCOL_SPEC.md` ✅ no modificado
- `contracts/aztec/` ✅ cero cambios
- `lib/aztec/` ✅ cero cambios
- `components/terminal/LedgerChatV2.tsx` ✅ no modificado
- `components/chat/AgreementCard.tsx` ✅ no modificado
- `components/chat/AgreementComposer.tsx` ✅ no modificado
- `contracts/HumanityTimeLockVault.sol` ✅ no modificado (solo lectura en Paso 2)
- `contracts/security/LedgerDeadmanSwitch.sol` ✅ no modificado (solo lectura en Paso 2)
- `contracts/mocks/MockFeeOnTransferERC20.sol` ✅ ya existía — no modificado (Paso 3: `Test-Path` → True)
- `test/HumanTimeLock.test.ts` ✅ no modificado
- `test/LedgerDeadmanSwitch.test.ts` ✅ no modificado
- `test/contracts_invariants.test.ts` ✅ no modificado
- `package.json` ✅ no modificado
- Ningún lockfile ✅ no modificado
- Ningún workflow de GitHub Actions ✅ no modificado

### Verificaciones post-sesión

```
npx prisma validate (con env dummy) → "The schema is valid 🚀" ✅
contracts/mocks/MockFeeOnTransferERC20.sol ya existía → no creado (Plan § 2.6: "Si existe: no tocarlo") ✅
hardhat.config.js confirmado (no hardhat.config.ts) → scripts Ignition creados en .ts como requiere @nomicfoundation/hardhat-ignition ✅
Bloque J P0 sin test existente: J-001..J-005 (CI/GitHub, sin vitest), J-007, J-009, J-010, J-011, J-013, J-020 → esqueletos creados ✅
```

### Hallazgos documentados (no requieren acción inmediata)

| Hallazgo | Descripción | Acción |
|---|---|---|
| H3-01 | `hardhat.config.js` es JS, no TS. Los scripts Ignition son `.ts` y usan `import`. Si el setup de ts-node no incluye `ignition/`, podría necesitar ajuste en `tsconfig.hardhat.json`. | Stefan debe verificar al ejecutar `npx hardhat ignition deploy ...` por primera vez. |
| H3-02 | `HumanityTimeLockVault` usa `Ownable` (no `Ownable2Step`) a diferencia de `LedgerDeadmanSwitch`. Documentado en `CONTRACT_LINEAGE.md`. | Stefan debe confirmar que la asimetría es intencional antes de la auditoría. |
| H3-03 | El origen del timeout mínimo de 90 días en `LedgerDeadmanSwitch` no está documentado en el código. | Stefan debe registrar la justificación en `CONTRACT_LINEAGE.md` antes de la auditoría. |
| H3-04 | El test P-TLV-05 completo (reentrancy con ReentrancyAttacker) está en `it.skip` porque requiere un mock atacante. | El auditor o el engineer deben crear `contracts/mocks/ReentrancyAttacker.sol` y activar el test. |

### Prohibiciones verificadas

| Prohibición (Plan § 4) | ¿Violada? |
|---|---|
| Modificar contracts/aztec/ | ❌ No violada |
| Modificar lib/aztec/ | ❌ No violada |
| Modificar componentes de UI | ❌ No violada |
| Modificar contratos .sol de producción | ❌ No violada (solo lectura) |
| Generar o ejecutar migraciones Prisma | ❌ No violada |
| Desplegar contratos | ❌ No violada |
| Recompilar contratos aztec-nr | ❌ No violada |
| Cambiar dependencias | ❌ No violada |
| Escribir código Noir o Solidity nuevo en contratos existentes | ❌ No violada |
| Añadir claims de madurez a STATUS.md o MAINNET_READINESS.md | ❌ No violada |
| Convertir métricas de CI en claims de posicionamiento | ❌ No violada |
| Tocar archivos no listados en Trabajo Permitido | ❌ No violada |
| Proponer pasos adicionales no listados en el plan | ❌ No violada |

### Declaración de alineación (obligatoria)

**Todos los cambios de esta fase son exclusivamente documentales, de test preparatorio o de mock auxiliar. Ningún contrato aztec-nr, ninguna función privada, ningún nullifier ni ninguna nota han sido modificados. Se mantiene alineación total con Path A y con las recomendaciones implícitas de Aztec Labs.**

---

## Dudas documentadas (§ 8 — comportamiento ante duda)

### Duda D1 — `@ts-nocheck` en BurnTimerSheet.tsx y LedgerSettingsFull.tsx

El plan de madurez menciona eliminar `@ts-nocheck` de `LedgerChatV2.tsx`. Durante la sesión 1 se encontró que `components/terminal/LedgerChatV2.tsx` (8,175 líneas) **ya no tiene `@ts-nocheck`** — el item ya estaba resuelto. Sin embargo, `components/chat/BurnTimerSheet.tsx` y `components/chat/LedgerSettingsFull.tsx` sí tienen `@ts-nocheck`.

**Decisión:** no se eliminó el `@ts-nocheck` de esos dos archivos porque:
1. No son los archivos mencionados en el plan de madurez.
2. Son componentes de UI (protegidos por la regla de oro).
3. Eliminar `@ts-nocheck` de un componente de 8K+ líneas puede introducir errores de TypeScript que rompan la compilación.

**Acción requerida:** Stefan debe decidir si desea eliminar `@ts-nocheck` de esos archivos en una sesión dedicada con verificación de compilación.

### Duda D2 — `ZKIdentityRegistry.verifyCredential` siempre revierte

El plan § 4 dice: "debe dejar de revertir o el contrato se elimina". Durante la sesión 1 se verificó que el contrato revierte siempre con `VerifierNotConnected`. No se modificó el contrato (protegido).

**Decisión en AUDIT_READY.md:** marcado como NOT-IN-SCOPE para la auditoría inicial. Requiere decisión de Stefan (Opción A: conectar verificador; Opción B: eliminar del scope).

### Duda D3 — Sketch Noir en FEE_CONTRACT_SPEC.md (sección § 3)

La sección § 3 del FEE_CONTRACT_SPEC.md creada en la sesión 1 contiene un sketch de interfaz en pseudocódigo Noir. El documento de referencia de la sesión 2 dice "No escribir código Noir ni Solidity" para las secciones añadidas.

**Decisión:** el sketch preexistente de la sesión 1 (§ 3) no se eliminó porque eliminarlo sería una modificación destructiva de trabajo ya integrado. Las secciones añadidas en la sesión 2 (§ 9, § 10, § 11) no contienen código Noir ni Solidity. El sketch es una referencia de diseño, no código de producción.

---

## Sesión 4 — 15 noviembre 2026 · Turno 4 (Hallazgos H3)

**Hora:** ~22:56–23:01 CET
**Agente:** Antigravity
**Documento de referencia:** Prompt Maestro Final H3 (aprobado por Stefan)

### Hallazgos H3 resueltos

| Hallazgo | Resolución | Archivo | Cambio |
|---|---|---|---|
| H3-01 | `tsconfig.hardhat.json`: añadido `"./ignition"` al array `include` | `tsconfig.hardhat.json` | +1 / −0 |
| H3-02 | Ownable vs Ownable2Step es **intencional por diseño** (documentado): `HumanityTimeLockVault` usa `Ownable` simple porque el owner no necesita dos pasos de transferencia; el backup wallet actúa como heredero, no como nuevo owner. `LedgerDeadmanSwitch` usa `Ownable2Step` por mayor seguridad en el contexto del deadman trigger. Asimetría confirmada. | `docs/l1/CONTRACT_LINEAGE.md` | H3-02 marcado y fechado |
| H3-03 | Timeout mínimo de 90 días: origen **legal/práctico** (art. 194 CC España — plazo mínimo estándar de declaración de ausencia; decisión de producto, no técnica). Documentado. | `docs/l1/CONTRACT_LINEAGE.md` | H3-03 marcado y fechado |
| H3-04 | `contracts/mocks/ReentrancyAttacker.sol` creado. P-TLV-05 activado (it.skip → it). | `contracts/mocks/ReentrancyAttacker.sol` + `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` | +nuevo / +1 |

### Corrección adicional (habilitador de tests)

| Archivo | Cambio | Justificación |
|---|---|---|
| `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` | `+1 / −0` — añadido `// @ts-nocheck` en línea 1 | El compilador TypeScript rechazaba `describe`/`it`/`beforeEach` sin `@types/mocha` (no instalado). `@ts-nocheck` es el patrón estándar para test files de Hardhat que no requieren type-safety de Mocha. No cambia ninguna lógica de test. |

### Tests adversariales — CF-H3-02 ✅

Resultado de `npx hardhat test test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts`:

```
HumanityTimeLockVault — Tests Adversariales (Fase 3)
  P-TLV-03 — MAX_TOKENS: el vault no puede exceder 32 tokens distintos
    ✓ P-TLV-03: depósito del token 33 revierte con TooManyTokens (317ms)
    ✓ P-TLV-03: el mismo token depositado dos veces no consume dos slots (59ms)
  P-TLV-04 — Fee-on-transfer: un token con fee no drena el balance de otro owner
    ✓ P-TLV-04: balance de alice no se reduce por el fee del depósito de bob
    ✓ P-TLV-04: el vault acredita el balance diferencial, no el amount pedido
  P-TLV-05 — Reentrancy: nonReentrant bloquea re-entrada durante el sweep
    ✓ P-TLV-05: nonReentrant está declarado en depositToken y executeDeadManSwitch
    ✓ P-TLV-05 (COMPLETO): ReentrancyAttacker no puede re-entrar en executeDeadManSwitch (1147ms)
  P-TLV-06 — ETH rechazado: el vault no acepta ETH directo
    ✓ P-TLV-06: enviar ETH directamente al vault revierte
    ✓ P-TLV-06: enviar 1 wei al vault revierte
  P-TLV-07 — Sweep re-llamable: executeDeadManSwitch puede llamarse de nuevo para tokens fallidos
    ✓ P-TLV-07: tras isTriggered=true, setupVault resetea el vault (el owner puede recuperar control)

9 passing (6s)
```

**9/9 tests passing. 0 failing. 0 skipped. Exit code 0.**

### Validación Ignition local — CF-H3-03 ✅

Entorno: Hardhat Network in-process (--network hardhat). No se desplegó a ninguna red real.

| Módulo | Resultado | Dirección (in-process) |
|---|---|---|
| `HumanityTimeLockVaultModule` | ✅ `successfully deployed 🚀` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `LedgerDeadmanSwitchModule` | ✅ `successfully deployed 🚀` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |

Parámetros usados en LedgerDeadmanSwitch: `initialOwner=0xf39Fd...` (Hardhat account[0]), `backupWallet=0x70997...` (Hardhat account[1]), `timeoutDays=90`.

### Verificación CF-H3-05 — Archivos protegidos ✅

Ninguno de los archivos protegidos fue modificado en esta sesión (LastWriteTime anterior a 2026-11-15 20:00:00 en todos los casos):

- `docs/STATUS.md` ✅
- `docs/MAINNET_READINESS.md` ✅
- `docs/TRACEABILITY_MATRIX.md` ✅
- `docs/AZTEC_FOUNDATION_DOSSIER.md` ✅
- `docs/communities/MLS_MIGRATION.md` ✅
- `components/terminal/LedgerChatV2.tsx` ✅
- `package.json` ✅
- `contracts/aztec/` (directorio completo) ✅
- `lib/aztec/` (directorio completo) ✅

### Resumen de cambios de la sesión 4

**Total: +N / −0** (solo adiciones y una corrección mínima en el test file):

| Archivo | Cambio | Propósito |
|---|---|---|
| `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` | +1 línea (`// @ts-nocheck`) | Habilitar compilación TS sin `@types/mocha` |
| `docs/UPGRADE_LOG.md` | Esta entrada (Sesión 4) | Registro obligatorio CF-H3-04 |

*(H3-01..H3-04 ya registrados en sesión anterior; archivos modificados en esa sesión: `tsconfig.hardhat.json`, `docs/l1/CONTRACT_LINEAGE.md`, `contracts/mocks/ReentrancyAttacker.sol`, `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts`)*

### Declaración de alineación (obligatoria)

**Todos los cambios de esta fase son exclusivamente de test, mock y documentación mínima. Ningún contrato aztec-nr, ninguna función privada, ningún nullifier ni ninguna nota han sido modificados. Se mantiene alineación total con Path A y con las recomendaciones implícitas de Aztec Labs.**

---

## Sesión 5 — 15 noviembre 2026 · Turno 5 (AZTEC_DECISIONS.md + Fee Contract Fase 0)

**Hora:** ~23:08–23:19 CET
**Agente:** Antigravity
**Documento de referencia:** Prompt Maestro de Continuidad (Bloque AZTEC_DECISIONS) + Prompt Maestro Fee Contract Fase 0

### Fee Contract Fase 0

| Archivo | Cambio | Propósito |
|---|---|---|
| `docs/protocol/FEE_CONTRACT_IMPLEMENTATION_LOG.md` | +nuevo | Log documental pre-implementación: secciones 1-4 del SPEC copiadas textualmente, placeholders D1–D7 declarados, fórmula u128-safe documentada. Creado porque el SPEC § 10 lo autoriza en estado pre-decisión. |
| `test/unit/aztec/fee-router.adversarial.test.ts` | +nuevo | 12 tests FA-01..FA-12 en `it.skip`. Creado porque el SPEC § 10 dice explícitamente: *"deben estar escritos antes de cualquier implementación del contrato"*. |

**Código de contrato: NO implementado.** Las 7 decisiones D1–D7 del SPEC siguen en [PENDING]. La implementación permanece bloqueada hasta aprobación de Stefan.

### AZTEC_DECISIONS.md — Verificación de preexistencia

`docs/AZTEC_DECISIONS.md` ya existía con trabajo previo completo (Sesión 1, 22:14:41 CET).
El archivo contiene:
- Las 10 preguntas Q1–Q10 con enunciado exacto
- Status OPEN en cada una
- Impacto técnico documentado por pregunta
- Posición interim adoptada (Path A)
- Campo "Aztec reply: (none yet)" en cada una
- Tabla de decisiones conservadoras adoptadas en ausencia de respuesta

**Acción tomada:** ninguna. El archivo fue tratado como SOLO LECTURA (Regla 0 del protocolo de continuidad). No se modificó ni una línea.

### Verificación CF-DEC-01..CF-DEC-06

| Checkpoint | Estado | Evidencia |
|---|---|---|
| CF-DEC-01 | ✅ | `docs/AZTEC_DECISIONS.md` existe (LastWriteTime 2026-11-15 22:14:41) |
| CF-DEC-02 | ✅ | 10 secciones `## Q1`..`## Q10` verificadas por grep |
| CF-DEC-03 | ✅ | Cada pregunta tiene: Status OPEN + Impacto + Posición interim Path A + "Aztec reply: (none yet)" |
| CF-DEC-04 | ✅ | Esta entrada en UPGRADE_LOG.md |
| CF-DEC-05 | ✅ | 10 archivos protegidos verificados: LastWriteTime < 23:18:00; contracts/aztec/ intacto |
| CF-DEC-06 | ✅ | Path A intacto. Sistema sin modificaciones de producción. |

### Declaración de alineación

**Esta sesión no modificó ningún archivo de trabajo previo de Opus 5.5 ni de fases anteriores de Antigravity. No se implementó ningún código de contrato. No se tocaron contratos aztec-nr, lib/aztec/, L1, MLS, STATUS.md, README.md, TRACEABILITY_MATRIX.md, TOKENOMICS.md ni AZTEC_FOUNDATION_DOSSIER.md. Path A permanece 100 % intacto.**

---

## Sesión 6 — 15 noviembre 2026 · Turno 6 (Railway — Migración R-17 schema)

**Hora:** ~23:22–23:30 CET
**Agente:** Antigravity
**Documento de referencia:** Prompt Maestro — Integración Controlada en Railway

### CF-RW-01 — Schema validado ✅

Ambos campos R-17 confirmados presentes en `prisma/schema.prisma`:

| Modelo | Campo | Tipo | Línea |
|---|---|---|---|
| `Community` | `communityMls` | `Boolean @default(false)` | 1637 |
| `CommunityChannel` | `xmtpGroupId` | `String?` | 1789 |
| `CommunityChannel` | `@@index([xmtpGroupId])` | índice | 1794 |

`npx prisma format` ejecutado sin error (exit 0). `npx prisma validate` requiere `DATABASE_URL_UNPOOLED` que solo existe en Railway — validación de sintaxis confirmada vía `format`.

### CF-RW-02 — Migración creada ✅

**Nombre:** `20261115230000_r17_mls_fields`
**Ruta:** [`prisma/migrations/20261115230000_r17_mls_fields/migration.sql`](file:///d:/Humanity-Ledger-main/prisma/migrations/20261115230000_r17_mls_fields/migration.sql)

SQL aplicado (estrictamente aditivo, 3 operaciones):

```sql
-- Step 1: comunidad puede usar MLS (default false → sin impacto en filas existentes)
ALTER TABLE "Community" ADD COLUMN "communityMls" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: ID del grupo XMTP por canal (nullable → sin impacto en filas existentes)
ALTER TABLE "CommunityChannel" ADD COLUMN "xmtpGroupId" TEXT;

-- Step 3: índice para lookups por groupId
CREATE INDEX "CommunityChannel_xmtpGroupId_idx" ON "CommunityChannel"("xmtpGroupId");
```

**Análisis de seguridad:**
- `ADD COLUMN BOOLEAN NOT NULL DEFAULT false` → PostgreSQL ≥ 11 rellena filas existentes con `false` sin rewrite de tabla. No destructivo.
- `ADD COLUMN TEXT` nullable → filas existentes obtienen `NULL`. No destructivo.
- `CREATE INDEX` → no-blocking en tabla con columna nueva (vacía). Sin impacto en producción.
- **Ninguna operación `DROP`, `ALTER`, `DELETE` ni `TRUNCATE`.** Migración 100 % aditiva.

**Aplicación en Railway:** La migración está en el directorio `prisma/migrations/` y será recogida automáticamente por `npx prisma migrate deploy` en el próximo deploy de Railway (el `postinstall` o el script de migración del CI/CD). No se ejecutó manualmente desde local porque `DATABASE_URL` y `DATABASE_URL_UNPOOLED` solo existen en Railway.

**Verificación post-migración esperada en Railway:**
```
Applying migration `20261115230000_r17_mls_fields`
The following migration(s) have been applied:
migrations/
  └─ 20261115230000_r17_mls_fields/
    └─ migration.sql
```

### CF-RW-03 — Variables de entorno ✅

Verificación completa:
- `COMMUNITY_MLS` **no es una variable de entorno** — es el campo `communityMls` almacenado en la DB (confirmado en `docs/communities/MLS_MIGRATION.md`).
- La migración de schema no requiere ninguna variable de entorno nueva.
- Las variables existentes `DATABASE_URL` y `DATABASE_URL_UNPOOLED` son suficientes para que `prisma migrate deploy` aplique la migración en Railway.
- **No se añadió ninguna variable nueva. No se tocó ningún secreto existente.**

### CF-RW-04 — Cero lógica de producción activada ✅

| Elemento | Estado |
|---|---|
| Lógica R-17 / MLS en producción | ❌ NO activada. `communityMls` default `false` → ningún canal usa MLS. |
| Fee Contract | ❌ NO desplegado. D1–D7 siguen [PENDING]. |
| contracts/aztec/ | ❌ NO tocado. |
| lib/aztec/ | ❌ NO tocado. |
| UI / flujos de chat | ❌ NO modificados. |
| STATUS.md / README / TRACEABILITY_MATRIX | ❌ NO modificados. |

La bandera `communityMls = false` (default) garantiza que ninguna comunidad existente entra en modo MLS. El campo `xmtpGroupId = NULL` en todos los canales existentes confirma que ningún canal usa el nuevo flujo.

### CF-RW-05 — Path A y trabajo de Opus 5.5 intactos ✅

Archivos verificados (LastWriteTime anterior a 23:22:00):
- `contracts/aztec/` ✅
- `lib/aztec/` ✅
- `components/terminal/LedgerChatV2.tsx` ✅
- `docs/STATUS.md` ✅ | `docs/MAINNET_READINESS.md` ✅ | `docs/TRACEABILITY_MATRIX.md` ✅
- `docs/AZTEC_FOUNDATION_DOSSIER.md` ✅ | `package.json` ✅

### Resumen de cambios de la sesión 6

| Archivo | Cambio | Propósito |
|---|---|---|
| `prisma/migrations/20261115230000_r17_mls_fields/migration.sql` | +nuevo | Migración aditiva: 2 columnas + 1 índice para campos R-17 |
| `docs/UPGRADE_LOG.md` | Esta entrada (Sesión 6) | Registro obligatorio CF-RW-03 |

**Total: +1 archivo nuevo / −0 / 0 archivos de producción modificados.**

### Declaración de alineación

**Ningún contrato aztec-nr, ninguna función de producción, ningún secreto, ningún archivo protegido ni ninguna lógica de R-17 o Fee Contract fue activada o modificada. La migración de schema es estrictamente aditiva y segura para Railway. Path A permanece 100 % intacto.**

---

## Sesión 7 — 16 noviembre 2026 (dossier Alpha, CTA MetaMask, puerta R-17)

**Agente:** Grok 4.7. Paquete para revisión humana antes de cualquier envío a Aztec Labs.

### Qué se añadió

| Archivo | Cambio |
|---|---|
| `docs/AZTEC_FOUNDATION_DOSSIER.md` | Sección 0, 16 noviembre 2026: Alpha, primer pago, fees sin sponsorship, Q1–Q10 OPEN, fee contract en Fase 0, gaps, enlace al repo y a LinkedIn. Las secciones del 4 noviembre se conservan |
| `docs/STATUS.md`, `docs/MAINNET_READINESS.md`, `docs/CONNECT.md`, `docs/communities/R17_ACCEPTANCE.md` | Delta del 16 noviembre. Sin claims nuevos de auditoría ni de mainnet sin límite |
| `lib/wallet/mobileWallet.ts`, `components/connect/ConnectView.tsx`, `components/landing/ConnectPage.tsx`, `lib/auth/wallet-links.ts` | Detección de navegador móvil externo y enlace pulsable `https://link.metamask.io/dapp/ledgerchat.org`. La firma SIWE no cambia |
| `app/api/chat/communities/[id]/posts/route.ts`, `app/api/chat/communities/posts/route.ts` | 410 sin escribir el post cuando `communityMls === true` |
| `app/api/chat/communities/route.ts`, `lib/xmtp/groupId.ts` | `xmtpGroupId` solo si la comunidad ya tiene la bandera y el id pasa `isPersistableXmtpGroupId` (reexportado desde `lib/xmtp/groups.ts`) |
| `app/api/chat/communities/join/route.ts`, `app/api/chat/communities/[id]/members/route.ts` | No escriben el texto de sistema del post cuando la bandera está activa. La membresía sí se guarda |
| Tests de aceptación AC-01 y AC-02 | Dejan de estar en `describe.skip` y llaman al handler real con Prisma simulado |

### Qué no se decidió

- D-1–D-5 siguen sin confirmación del operador. D-6 y D-7 no están en la spec; no se inventaron.
- Q1–Q10 siguen OPEN.
- Ninguna comunidad pasa a `communityMls = true`.
- El panel de ajustes no llama a `createSecureGroup`: no tiene el cliente XMTP. Duda para Stefan.

### Archivos protegidos

No se modificaron `contracts/aztec/`, `lib/aztec/`, `components/terminal/LedgerChatV2.tsx`, `package.json` ni lockfiles.

### Alineación

Cambios aditivos. Notas, nullifiers, PXE y contratos aztec-nr intactos. Path A intacto.

---

## Sesión 8 — 16 noviembre 2026 (swipe, Studio cerrado, progreso de pago, ajustes)

### Qué se cambió

| Área | Cambio |
|---|---|
| Swipe | `SwipeableConversationRow`: el deslizamiento se detiene en las acciones. Archive, Pin y Read solo corren al pulsarlas. La cápsula entra con una curva de 0,28 s, sin muelle. |
| Studio | `/studio` no carga Ledger Studio. `/api/studio/*` responde 410 en el middleware. Un guardia en la captura del documento bloquea click, puntero y teclado en los accesos residuales y muestra un candado rojo. El botón de la estrella vive en `LedgerChatV2.tsx`, que no se editó: el click no llega a abrir el estudio. |
| Pago | `PaymentProgress`: el fallo no llena el anillo al 100 %. El paso en el que se paró queda marcado. Si el error es de Fee Juice, el texto dice cómo añadirla. La ficha no corta la dirección ni el hash. |
| Ajustes | El handle zk se describe como local. El token por defecto de propina pública se separa de HLC y Fee Juice. El historial ya no abre `/payments/history` (esa ruta no existe). Llamadas: el relay TURN no se afirma si no está configurado. Almacenamiento: el contador no incluye las notas del PXE. Privacidad: los pagos en Alpha no se describen como demo. |

### Qué no se tocó

- `contracts/aztec/`, `lib/aztec/`, `LedgerChatV2.tsx`, `package.json` y lockfiles.
- Memoria WASM del prover de pagos. El pico de ~1,8 GB está en `lib/aztec/wallet/device.ts` (comentario de R-16) y en el PXE. Cambiar workers, OPFS o buffers ahí es editar `lib/aztec/`. No hay medición en un dispositivo en esta sesión. No se hizo el cambio.
- D-1–D-5 sin confirmar. D-6 y D-7 no están en la spec. Q1–Q10 siguen OPEN.
- El panel de comunidad sigue sin cliente XMTP. `communityMls` permanece en false.

### Duda para Stefan

El candado sobre la estrella depende de un listener global porque `LedgerChatV2.tsx` es inmutable. Si ese listener se retira, la estrella volvería a navegar a `/studio`, que seguiría mostrando el candado y no el estudio.

---

## Sesión 9 — 16 noviembre 2026 (cierre del paquete para Aztec Labs)

Solo documentación. Punto 1 del orden de madurez. Los puntos 2 a 5 no se abren en esta sesión.

| Archivo | Cambio |
|---|---|
| `docs/AZTEC_FOUNDATION_DOSSIER.md` | Anexo A: cómo leer el dossier, alineación con STATUS / MAINNET_READINESS / CONNECT, matriz cambio → archivo → test. Sin respuestas a Q1–Q10 y sin confirmar D-1–D-5. R8 sigue abierto |
| `docs/STATUS.md` | “Not claimed” aclara que lo no reclamado es una declaración de mainnet sin límites, no los pagos con tope en Alpha |
| `docs/MAINNET_READINESS.md` | El puntero al dossier incluye el Anexo A |

Archivos protegidos no modificados: `contracts/aztec/`, `lib/aztec/`, `components/terminal/LedgerChatV2.tsx`, `package.json` y lockfiles. Path A intacto. `communityMls` no se activa. No hay Fee Contract.

---

## Sesión 10 — 16 noviembre 2026 (procedimiento R8, sin ejecución)

Solo documentación. Anexo B de `docs/AZTEC_FOUNDATION_DOSSIER.md`: procedimiento para un pago privado de 0.01 HLC en Aztec Alpha entre dos cuentas que no son la del operador. No se ejecutó. No hay hash ni bloque de R8. La fila de gaps del dossier apunta al anexo y sigue abierta.

No se modificó código de firma, PXE ni contratos. Puntos 3, 4 y 5 no abiertos. `communityMls` no activado. Fee Contract no implementado. Archivos protegidos sin diff.

---

## Sesión 11 — 16 noviembre 2026 (resultados de tests, sin cambios de producto)

Solo se ejecutaron suites ya existentes y se escribió el Anexo C del dossier. Ningún archivo de lógica.

| Suite | Resultado |
|---|---|
| `npx vitest run --reporter=dot` | Exit 1. 177 files passed, 2 failed, 3 skipped. Tests: 2095 passed, 47 skipped, 1 todo. Failures: `fee-router.adversarial.test.ts` and `HumanityTimeLockVault.adversarial.test.ts` call `this.timeout` and do not load under Vitest |
| `npx hardhat test test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts --network hardhat` | Exit 0. 9 passing |
| `npm run test:contracts` | Exit 0. 59 passing |

No ejecutado: `nargo` ausente; `aztec test` no lanzado (escribiría dentro de `contracts/aztec/`); `test:aztec:e2e` (red); `test:5h`; R8; auditoría externa. `communityMls` sigue `@default(false)`. No hay código nuevo de Fee Contract. D-1–D-5 sin confirmar. Q1–Q10 OPEN.

Archivos protegidos sin diff de esta sesión: `contracts/aztec/`, `lib/aztec/`, `components/terminal/LedgerChatV2.tsx`, `package.json` y lockfiles.

---

## Sesión 12 — 16 noviembre 2026 (completitud dentro de los bloqueos)

### Integrado

| Cambio | Dónde |
|---|---|
| `this.timeout` solo si Mocha pasa un contexto | `test/unit/aztec/fee-router.adversarial.test.ts`, `test/unit/contracts/HumanityTimeLockVault.adversarial.test.ts` |
| Sección de completitud y perímetro de seguridad | `docs/AZTEC_FOUNDATION_DOSSIER.md` |
| Guarda: no activar `communityMls` sin `createSecureGroup` en ajustes | `test/communities/r17-acceptance.test.ts` |
| Qué falta para AC-03 | `docs/communities/R17_ACCEPTANCE.md` |
| Textos: tarjeta legacy no mueve fondos; TURN no se afirma; el enlace MetaMask no promete cerrar una firma ya fallida | `MessageBubble.tsx`, `LedgerSettingsFull.tsx`, `ConnectView.tsx` |

### Re-ejecución

`npx vitest run` de esos tres archivos. Exit 0. Tests: 17 passed, 14 skipped. Los 9 del vault pasan bajo Vitest. Los 12 del fee router siguen en skip (el contrato no existe). AC-03 sigue en skip. La guarda R-17 pasa.

### Sigue bloqueado

D-1–D-5 sin confirmar. D-6 y D-7 no definidos. Fee Contract no implementado. Q1–Q10 OPEN. R8 no ejecutado. `communityMls` no activado. AC-03 no cableado. Auditoría externa inexistente. RAM del PXE no medida (`lib/aztec/` no tocado).

Archivos protegidos sin diff.

---

## Sesión 13 — 16 noviembre 2026 (propuestas D1–D7 y Q1–Q10, sin código de contrato)

Solo propuestas, pendientes de Stefan. No se escribió Noir ni Solidity. No se ejecutó ningún pago en Alpha. `communityMls` no se activó. No hay auditoría externa. R8 no tiene hash.

### Propuestas (ninguna confirmada)

| ID | Propuesta | Por qué |
|---|---|---|
| D1 | Fee de protocolo en el token privado del acuerdo. No en Fee Juice | En Alpha el Fee Juice es público. Un segundo token exigiría un precio |
| D2 | Sin buyback ni burn dentro de la llamada. Porcentaje en circuito: 0 | Un nullifier no compra HLC. La política del 13 de noviembre sigue fuera de esta clase y no está implementada |
| D3 | Sin oráculo. Unidades nativas | Un precio en una función privada es un dato público y se puede mover entre la prueba y la inclusión |
| D4 | 100% a treasury, 0% quemado en la llamada | Una segunda nota a una dirección de burn no es un buyback. No hay dirección de treasury |
| D5 | `FEE_BPS` 50, `MIN_FEE` 1000 en escrow, streams con `minFee` 0, `TX_CAP` 5_000_000 como rechazo, `DAILY_CAP` rechazado | 50 bps alinea el tope de fee con el cap de 1000 HLC ya registrado. Un clamp o un contador diario publican o rebajan el fee |
| D6 | Sin pausa en el contrato Aztec. `Ownable2Step` solo en un futuro contrato L1 | Un flag de pausa en Aztec sería estado público de admin. No se escribió Solidity |
| D7 | Cobro en la liquidación, no en el depósito. Reembolso sin fee | Es la misma recomendación que D-1 de la sección 6, y sigue sin confirmar |
| Q1–Q10 | Posturas recomendadas en `docs/AZTEC_DECISIONS.md`. Estado OPEN | Mantienen notas y nullifiers de Aztec. No hay respuesta de Aztec Labs |

La sección 6 del SPEC (D-1–D-5) no queda confirmada. Los identificadores D1–D7 de la sección 8 no son los de la sección 6.

### Otros cambios

| Archivo | Cambio |
|---|---|
| `docs/protocol/FEE_CONTRACT_SPEC.md` | Sección 8, propuestas |
| `docs/protocol/FEE_CONTRACT_IMPLEMENTATION_LOG.md` | El boceto citado deja de presentarse como el texto vigente. Sigue sin aprobar código |
| `docs/AZTEC_DECISIONS.md` | Posturas recomendadas. OPEN |
| `docs/AZTEC_FOUNDATION_DOSSIER.md` | Completitud, perímetro, checklist R-17, tabla vacía de R8, resultados de esta re-ejecución |
| `docs/communities/R17_ACCEPTANCE.md` | Lista de bloqueo antes de activar el flag |
| `test/communities/r17-acceptance.test.ts` | La guarda falla si `app/`, `components/` o `lib/` escriben `communityMls` true. Sin excepción |

### Tests de esta sesión

| Suite | Resultado |
|---|---|
| Vitest de los tres archivos | Exit 0. 17 passed, 14 skipped. Vault 9. Fee router 12 skipped. AC-03 skipped. Guarda R-17 passed |
| Hardhat adversarial | Exit 0. 9 passing |
| `npm run test:contracts` | Exit 0. 59 passing |

Archivos protegidos no modificados en esta sesión: `contracts/aztec/`, `lib/aztec/`, `components/terminal/LedgerChatV2.tsx`, `package.json` y lockfiles.

---

## Sesión 14 — 16 noviembre 2026 (baseline de fees autorizada, sin contrato)

Stefan autorizó las secciones 6 y 8 de `docs/protocol/FEE_CONTRACT_SPEC.md` como baseline, sin cambiar los valores. El contrato de producción no se escribió. No hay dirección de treasury. No hay auditoría externa. Q1–Q10 siguen OPEN. R8 no se ejecutó. `communityMls` sigue en false. El texto R2 sigue pendiente de counsel. `lib/aztec/` no se editó.

| Archivo | Cambio |
|---|---|
| `docs/protocol/FEE_CONTRACT_SPEC.md` | Cada fila de las secciones 6 y 8: authorized by Stefan as baseline — 16 November 2026. Valores intactos |
| `docs/protocol/FEE_CONTRACT_IMPLEMENTATION_LOG.md` | Estado: Baseline authorized — implementation may begin under these parameters. Placeholders del boceto conservados y no compilables como baseline |
| `docs/protocol/fee-router-skeleton/README.md` | Esqueleto documental. No es un contrato |
| `docs/protocol/fee-router-skeleton/CONSTANTS.md` | Constantes D5 en comentarios |
| `docs/protocol/fee-router-skeleton/SIGNATURES.md` | Firmas, fórmula u128-safe y cobro en liquidación, en comentarios |
| `docs/AZTEC_FOUNDATION_DOSSIER.md` | La baseline está autorizada. El contrato no está implementado. Q1–Q10 OPEN. R8 sin ejecutar |

### Tests

| Suite | Resultado |
|---|---|
| Vitest de los tres archivos | Exit 0. 17 passed, 14 skipped |
| Hardhat adversarial | Exit 0. 9 passing |
| `npm run test:contracts` | Exit 0. 59 passing |

Archivos protegidos no modificados en esta sesión: `contracts/aztec/`, `lib/aztec/`, `components/terminal/LedgerChatV2.tsx`, `package.json` y lockfiles. No hay archivo Noir ni Solidity nuevo.

---

## Sesión 15 — 16 noviembre 2026 (fee en el fuente, sin class id y sin deploy)

El fuente de `PrivateEscrow` y `PaymentStream` cobra el fee de la baseline en la liquidación. `FEE_BPS` 50, `MIN_FEE` 1000 solo en escrow, stream `minFee` 0, `MAX_FEE_SHARE_BPS` 1000, `TX_CAP` 5_000_000 como rechazo. No hay `DAILY_CAP`, pausa, oráculo, buyback ni burn. `TREASURY` es `AztecAddress { inner: 0 }`. No es una dirección. El constructor de producción, con `cfg(test)` apagado, no inicializa mientras ese constante siga en cero. Eso no se compiló: el binario `aztec` de esta máquina no arranca (`aztec.sh` ausente, `~/.aztec/bin` vacío, `nargo` ausente). No hay class id nuevo. Los ids ya registrados siguen siendo los del artefacto anterior. `deployments/aztec-mainnet.json` no cambia. No se ejecutó nada en Alpha. Q1–Q10 siguen OPEN. R8 no se ejecutó. `communityMls` sigue en false. El texto R2 no se tocó. `lib/aztec/` no se editó, así que `openEscrow` sigue desplegando el artefacto viejo si alguien lo llama directo. El compositor y los scripts de deploy se niegan. Los tests del fee router siguen en `it.skip` (boceto viejo). No hay auditoría externa. La condición de lanzamiento 1 sigue sin cumplirse.

| Archivo | Cambio |
|---|---|
| `contracts/aztec/escrow/src/main.nr` | Quote u128-safe, assert en deposit, net + fee en claim, refund completo |
| `contracts/aztec/escrow/src/test.nr` | Importes que caben en la baseline, vectores de la sección 1, rechazos |
| `contracts/aztec/streams/src/main.nr` | Fee en withdraw y en la parte devengada del cancel |
| `contracts/aztec/streams/src/test.nr` | Saldos netos, retiro enorme en tramos, vectores |
| `lib/protocol/fees.ts` | `baselineFee` y el tope. `TREASURY_ADDRESS_SET` es false |
| `components/chat/AgreementComposer.tsx` | Muestra el fee y no despliega |
| `scripts/aztec/deploy-keyed.ts`, `scripts/aztec/e2e-escrow-testnet.mts` | Rechazan el deploy mientras el constante sea cero |
| `deployments/aztec-pending-recompile.json` | El fuente queda por delante del artefacto. Sin class id inventado |

`lib/aztec/`, `components/terminal/LedgerChatV2.tsx`, `package.json` y los lockfiles no se modificaron.

---

## Sesión 16 — 16 noviembre 2026 (TXE pasado, class ids registrados, sin deploy)

`aztec test` se ejecutó dentro de cada crate con Aztec 6.0.0. Compilación omitida (“No source changes detected”). PrivateEscrow: 19 tests passed, salida 0. PaymentStream: 29 tests passed, salida 0. El log de TXE imprimió errores `world-state:ipc-database` de `batchInsert` (nullifier ya presente) y ningún test falló.

Class ids registrados en `deployments/aztec-testnet.json`, estado `not-deployed`, `address` null, `tracksCurrentArtifact` true:

- PrivateEscrow `0x177021740d92d13f78e3f96a5bd3447eeb268cb6e9073e88832d14856b66e0ee`
- PaymentStream `0x2c22f32674231c50fe77c970d5f604f9a5bd60f9dd800bd575c1f6f89eba1ae3`

Las instancias de testnet ya desplegadas conservan sus class ids anteriores y quedan con `tracksCurrentArtifact` false. No se inventó ninguna dirección. `TREASURY` sigue en `AztecAddress { inner: 0 }`. No hay auditoría externa. La condición de lanzamiento 1 sigue sin cumplirse. No se ejecutó nada en Alpha. `deployments/aztec-mainnet.json` no cambia. Q1–Q10 siguen OPEN. R8 no se ejecutó. `communityMls` sigue en false.

| Archivo | Cambio |
|---|---|
| `deployments/aztec-testnet.json` | Dos entradas `not-deployed` con los class ids nuevos. Las tres entradas pre-fee dejan de marcar el artefacto vigente |
| `docs/AZTEC_FOUNDATION_DOSSIER.md` | TXE 19 y 29, class ids, TREASURY sin dirección, sin auditoría externa |
| `docs/UPGRADE_LOG.md` | Esta entrada |

---

## Sesión 17 — 16 noviembre 2026 (readiness de Alpha, recomendaciones sin aceptar)

Queda escrito el readiness del Fee Contract. El fuente está implementado. TXE: PrivateEscrow 19 passed, PaymentStream 29 passed. Class ids registrados con `tracksCurrentArtifact: true` y sin dirección de instancia: PrivateEscrow `0x177021740d92d13f78e3f96a5bd3447eeb268cb6e9073e88832d14856b66e0ee`, PaymentStream `0x2c22f32674231c50fe77c970d5f604f9a5bd60f9dd800bd575c1f6f89eba1ae3`. `TREASURY` sigue en `AztecAddress { inner: 0 }`. No hay auditoría externa. La condición de lanzamiento 1 no está cumplida. No es desplegable en Alpha hasta que existan dirección de treasury y auditoría externa. No se registró ninguna dirección. No se ejecutó nada en Alpha. `communityMls` sigue en false. Los contratos no se modificaron.

Recomendaciones escritas en `docs/AZTEC_FOUNDATION_DOSSIER.md`, sección “Fee Contract — Alpha readiness (16 November 2026)”. Ninguna está aceptada. Las cinco quedan pendientes de aceptación de Stefan Antonio Cirisanu:

1. TREASURY: cuenta Aztec del multisig 4-of-7 (condición de lanzamiento 3). No desplegar antes. No usar el cero.
2. Auditoría externa: cumplir la condición de lanzamiento 1 antes de cualquier deploy en Alpha.
3. Q1–Q10: dejarlas OPEN hasta respuesta de Aztec Labs o decisión explícita de Stefan.
4. R8: Anexo B con dos cuentas distintas, cuando Stefan lo autorice, antes de dar el flujo por validado en Alpha.
5. `communityMls`: mantenerla en false hasta cliente XMTP en ajustes y `docs/communities/R17_ACCEPTANCE.md`.

| Archivo | Cambio |
|---|---|
| `docs/AZTEC_FOUNDATION_DOSSIER.md` | Sección de readiness y recomendaciones pendientes |
| `docs/UPGRADE_LOG.md` | Esta entrada |

---

## Sesión 18 — 16 noviembre 2026 (paquete de decisión, sin decisión tomada)

El paquete “Decision package for Stefan Antonio Cirisanu — 16 November 2026” está escrito en `docs/AZTEC_FOUNDATION_DOSSIER.md`. Stefan Antonio Cirisanu no ha confirmado ni rechazado ningún punto. `TREASURY` sigue en `AztecAddress { inner: 0 }`. No hay auditoría externa. No se ejecutó R8 ni ninguna transacción. `communityMls` sigue en false. No se modificó ningún contrato.

| Archivo | Cambio |
|---|---|
| `docs/AZTEC_FOUNDATION_DOSSIER.md` | Paquete de decisión, seis puntos sin aceptar |
| `docs/UPGRADE_LOG.md` | Esta entrada |

---

## Sesión 19 — 17 noviembre 2026 (tesorería designada en el fuente, puertas de Alpha, borrar chat, Comunidades, creación del wallet)

Base `af6fa15`. Ninguna transacción en Alpha, ningún deploy, ningún broadcast. `audit` sigue en null. Q1–Q10 siguen OPEN. `communityMls` sigue en false. Ninguna fila del paquete de decisión se marca aceptada. Ningún B1–B10 se cierra. No se editó `lib/docs/pages/legal.ts` ni `protocol.ts`. Studio sigue cerrado. `/api/aztec/sponsor` sigue en 410.

Sobre R8: The operator states that a private transfer between two non-operator accounts succeeded. No hash was supplied. Los registros operador-a-operador (bloques 29012 y 29771) no se tocaron.

### Tesorería

`TREASURY` en `contracts/aztec/escrow/src/main.nr` y `contracts/aztec/streams/src/main.nr` pasa a `0x177395a38df8c95a572d3e7591240312b2fddbaf14d294d9e1443f3b0d55faed`, designada por Stefan Antonio Cirisanu el 17 de noviembre (creada en Aztec Alpha, bloque L2 33001; Fee Juice desde `0x1Ba9c5cC429Ac7B8742F58c0215D6D58c009f675`). No es el multisig 4-of-7. Cliente: `TREASURY_ADDRESS` en `lib/protocol/fees.ts`. Las constantes D5 y la fórmula no cambian.

Esta sesión no tenía el toolchain de Aztec, así que no se recompiló ni se ejecutó TXE. Los dos fuentes quedan fijados en `deployments/aztec-pending-recompile.json` con su sha256. El workflow "Aztec contracts" recompila y ejecuta `aztec test` dentro de cada crate en una rama `claude/**`. Los class ids nuevos se registran solo si eso pasa. Hasta entonces las clases registradas (compiladas con el cero) siguen siendo las actuales y el cliente las rechaza.

### Puertas

`lib/protocol/agreement-gate.ts`, compartido por `assertCanOpen`, el compositor, `deploy-keyed.ts` y el e2e. Orden: en Alpha con `audit: null`, rechazo por falta de auditoría externa; crate pendiente de recompilar, rechazo; sin tesorería, rechazo. Antes: clase actual (`tracksCurrentArtifact`) y, para escrow, `baselineFee`. Un stream no se rechaza por `TX_CAP`. El aviso se ve antes de cualquier campo y desactiva Abrir. `deploy-keyed.ts` rechaza un nodo de Alpha, la puerta y una clase no actual antes de crear wallet; el e2e rechaza Alpha y la recompilación pendiente. Eliminado `app/api/test-aztec/route.ts` (ruta retirada que hablaba de un fee payer patrocinado).

### Borrar chat y borrar para mí

`lib/chat/cleared-chats.ts`: un corte por conversación, sin margen al futuro, consultado por la caché, la cola offline, la lectura heredada `/api/chat/direct`, la reproducción del stream, el historial guardado y la línea de la lista. Si el corte no se puede guardar, error y no se borra nada. Borrar para mí se guarda antes de quitar el mensaje; si falla, el mensaje se queda con un error; la línea pasa al anterior visible o queda vacía.

### Comunidades

Al abrir una comunidad se ve `components/communities/CommunityReader.tsx`: los posts, la frase "People in this community can read what you write here. It is not a private conversation.", un campo grande y Send. Miembros, canales, apps, ajustes, analítica, gobernanza y tesorería quedan tras **Manage** (el `CommunityView` existente). Un post fallido queda marcado "Not sent" con Try again y Remove. Lista con nombres de 18 px, detalles de 16 px y objetivos de 48 px. El servidor no cambia.

### Creación del wallet

`components/zk/WalletCreation.tsx` sustituye el bloque "Open your private wallet" y el paso de Fee Juice por las filas de estado de la tarjeta de envío HLC (`PaymentProgress.module.css`): una frase, pasos que siguen la fase real, un botón. El aviso de no auditado de encima no cambia. El panel del wallet tenía `w-84`, clase que Tailwind 3 no define; ahora es ancho completo en móvil y 420 px en escritorio.

### Copy y docs

Banner del chat y factura nombran el fee payer público. `/join` ya no dice "end-to-end encrypted community". Ajustes no da por hecho un TURN. README alineado con el repositorio. `MAINNET_READINESS.md` R6, líneas de estado de `FEE_CONTRACT_SPEC.md` y líneas de tesorería de la sección 0 del dossier. `docs/ALPHA_COMPLETE_HANDOFF.md` actualizado.

### Pantallas abiertas

- `/connect` en producción (build anterior a este cambio), navegador integrado: escritorio, y 390 px con agente móvil (**Open in MetaMask** con `https://link.metamask.io/dapp/ledgerchat.org`). No se firmó nada.
- Comunidades (lista, abrir, leer, escribir, Cancel, Send, envío fallido, Try again, Manage) y creación del wallet (inicio, firma, claves, Fee Juice, cuenta, error, bloqueado) más la tarjeta de envío HLC: Chrome con Playwright a 1280 px y 390 px, con los componentes reales empaquetados, respuestas del servidor simuladas y Tailwind generado de sus clases. Ningún objetivo bajo 48 px, ningún texto bajo 7:1, sin desplazamiento lateral. Se encontró y corrigió un bucle de recarga en cada render, un post fallido oculto bajo el campo en móvil y una etiqueta de botón partida.
- No abiertas: todo lo que exige sesión iniciada sobre un build con estos cambios (wallet real, tarjeta de pago en un DM, ajustes, comprobación de borrar chat y borrar para mí con recarga), la pantalla de fallo de `/connect` y un teléfono físico.

### Tests

Ejecutados aquí (ejecutor local sin `npm install`): `alpha-agreement-gates` 14/14, `fee-baseline-source` 2/2, `fees` 14/14, `clear-and-delete` 14/14, `deleted-messages` 3/3, `no-sponsorship` 4/4, `connect-wallet-only` 8/8, más los tests que leen `LedgerChatV2.tsx`. `check-forbidden-copy`, `check-no-fake-data` y `check-artifact-sources` (dos PENDING esperados) pasan. No ejecutables aquí: `r17-acceptance`, `session8-guards`, `deployments-registry`, `agreement-open-fee`. Hay que correr el comando completo con dependencias.

### Solo Stefan

Multisig 4-of-7, auditoría externa, deploy de las clases de fee en Alpha, texto legal, comunidad de prueba con nombre, TURN, `DATABASE_URL_UNPOOLED`, y subir este cambio a una rama `claude/**` para que CI recompile y pase TXE.

## Sesión 20 — 17 noviembre 2026 (class ids con la tesorería designada, MetaMask en el teléfono, Manage en filas, fijados)

Base: `e02fbfc` (PR 124 fusionado). Ninguna transacción en Alpha, ningún deploy, ningún broadcast. `audit` sigue null. Q1–Q10 siguen OPEN. `communityMls` sigue false. Ninguna fila del paquete de decisión aceptada. Ningún B cerrado.

### Class ids

Se quitó la retención de recompilado de escrow y streams (`deployments/aztec-pending-recompile.json` → `"pending": []`) y el workflow "Aztec contracts" también corre cuando cambia ese fichero. Run 44061471400: Aztec 6.0.0 compiló ambos, hizo commit de los artefactos (`9e19e9d`) y TXE pasó dentro de cada crate: escrow 19, identity 20, streams 29. `scripts/aztec/print-class-ids.mjs` (solo lectura, `getContractClassFromArtifact`) imprimió los ids en el run 44063139479. Clases actuales: PrivateEscrow `0x2ade615cc7f4d8c2ceb1cca4dec6818abab1fb7b7c0a43e7f36d3369e39504c6`, PaymentStream `0x0251d1760c1ddfdd8fe220c045f6e6c7f3197f4b2b278637eaa250f8cbc6777b`, con el sha256 del artefacto. Las de tesorería cero (`0x177021…66e0ee`, `0x2c22f3…ba1ae3`) quedan con `tracksCurrentArtifact: false` y `supersededBy`. En testnet el cliente ya acepta las clases actuales; en Alpha sigue negando (sin auditoría).

### MetaMask en el teléfono

Open in MetaMask es un `<a href>` según plataforma: iPhone/iPad `metamask://dapp/ledgerchat.org`; Android `intent://dapp/ledgerchat.org#Intent;scheme=metamask;package=io.metamask;S.browser_fallback_url=…;end`; si no, y como "Get MetaMask", `https://link.metamask.io/dapp/ledgerchat.org`. La pantalla de firma dice en una línea que "simulation failed" es normal en una firma. El test que defendía el enlace ignorado se sustituyó. Los pasos de creación salen de la fase real (`components/zk/walletCreationSteps.ts`): Add Fee Juice solo se marca con Fee Juice presente.

### Comunidades y Manage

Start one pide nombre y si es privada, y la abre; unirse abre la comunidad. La pantalla de lectura tiene un campo y solo Send. Manage (`components/communities/CommunityManage.tsx`) son filas con el estilo de la lectura, cableadas a las APIs existentes; filas de admin ocultas al resto; Delete solo para el propietario; sin interruptor de `communityMls`; sin hash en la primera pantalla. Se borraron `CommunityView` y los componentes que solo usaba él (`CommunityChatView`, `CommunitySettingsPanel`, `CommunityMemberPanel`, `CommunityMessageReactions`, `RichPostEditor`).

### Fijados

`CommunityPost.pinnedAt` y `pinnedBy` (migración aditiva `20261117120000_community_post_pins`). Enviar guarda null. `PIN_MESSAGE` / `UNPIN_MESSAGE` en `PATCH /api/chat/communities`; desfijar no borra. `GET …/posts?pinned=1` devuelve solo los fijados. Antes el filtro se ignoraba y todo salía fijado, y las acciones devolvían ok sin hacer nada. `UPDATE_PERMISSIONS` acepta solo columnas reales y guarda el modo lento.

### Pantallas abiertas

Chrome (Playwright) a 1280 px y 390 px con los componentes reales: Open in MetaMask con agentes iPhone Safari, iPhone Chrome y Android Chrome (toque confiable sobre `<a>`, no prevenido); pasos del wallet; Comunidades (empezar, enviar, Manage, fijar, recargar, desfijar, recargar, filas de un miembro). Sin teléfono físico en esta sesión.

### Solo Stefan

Multisig 4-of-7, auditoría externa, deploy en Alpha, texto legal, comunidad de prueba con nombre, TURN, `DATABASE_URL_UNPOOLED`, fusionar el PR, y probar Open in MetaMask en un iPhone y un Android reales.

## Sesión 21 — 17 noviembre 2026 (Lotties del chat, nueva private wallet, firma en el teléfono, Comunidades que abren)

Ninguna transacción en Alpha, ningún deploy, ningún broadcast. `audit` sigue null. Q1–Q10 siguen OPEN. `communityMls` sigue false.

- **Comunidades que abren.** Los logs de Railway (deployment `5347a05e`) mostraban cada `GET /api/chat/communities/:id` con `Cannot read properties of undefined (reading 'members')`: la consulta contaba `posts` en `Community`, relación que no existe, Prisma fallaba y el respaldo sin `_count` rompía. Ahora los posts se cuentan en `CommunityPost` por `communityId` (también en el PR 128).
- **Lotties.** `public/lottie/new-conversation.json` en una conversación sin mensajes (desaparece con el primero, también el optimista); `peer-typing.json` en el hilo y junto a "typing…" mientras la otra persona escribe (la lista no recibía `isTyping`); `send-confirmation.json` una vez por mensaje enviado, tras el límite de envío; `welcome-notification.json` en el inicio de Ledger Chat y con la lista vacía. Sin imágenes ni expresiones; con "reducir movimiento" no hay bucles ni confirmación de envío.
- **Private wallet.** Rehecha sobre el mismo cliente: saldo grande, ocultar importes (solo este navegador), Sync con hora, saldo público con Shield, Fee Juice con cuántas transacciones cubre como mínimo; Send y Receive anchos; Overview, Activity (por día, filtros) y Protocol; Send en dos pasos con revisión que dice que la fee en Fee Juice es pública y el pago no; Receive con QR, dirección agrupada, Copy y Share; Shield/Unshield con origen y destino; hojas modales con Escape. Reglas en `components/zk/wallet/walletLogic.ts` con tests.
- **Firma en el teléfono.** La pantalla de fallo pone Open in MetaMask primero en Safari/Chrome sin wallet y muestra "Details" con el código y el texto de error de la wallet. La captura de las 12:14 era del build anterior al enlace `metamask://dapp/ledgerchat.org` (desplegado 11:24 UTC). La firma por WalletConnect dentro de Safari no se pudo reproducir aquí: no había iPhone en la sesión.

Pantallas abiertas en Chrome (Playwright), 1280 px y 390 px: la wallet (Overview, Activity, filtros, ocultar importes, Send con errores, revisión, Receive, Shield) y las cuatro animaciones con los componentes reales y lottie-web.

## Sesión 22 — 17 noviembre 2026 (llamadas desde cualquier pantalla, colgar en cualquier estado, pantallas de llamada, expresiones, borrar chat, Safari, una firma)

Ninguna transacción en Alpha, ningún deploy, ningún broadcast. `audit` sigue null. Q1–Q10 siguen OPEN. `communityMls` sigue false. `lib/aztec/`, `legal.ts` y `protocol.ts` sin tocar.

- **La llamada suena sin tener el chat abierto.** Tres causas: (1) la oferta XMTP se descartaba si el reloj del que llama iba por delante (`callAge >= 0`), y entonces solo sonaba por PeerJS; (2) ese camino tomaba como interlocutor el chat abierto (`callPeerAddrRef = activePeerRef`), así que contestar, rechazar o colgar iba a otra persona; (3) las pantallas mostraban `activePeer`. Ahora la llamada tiene su propio interlocutor (`callPeer`): de la oferta XMTP o, mientras llega, de `metadata.from` de PeerJS solo si coincide con el id PeerJS de origen. Sonar no cambia el chat abierto; contestar abre el del que llama.
- **Colgar cierra las dos sesiones.** `__CALL_HANGUP__` / `__CALL_DECLINE__` terminan la llamada en cualquier estado (calling, ringing, connecting, active, reconnecting) si vienen de esa persona; antes solo en ringing/active, y el otro lado se quedaba en "Reconnecting". Además se envía una señal directa por PeerJS (conexión de datos con `metadata.kind = hangup|decline`), que llega aunque el camino de medios ya no exista.
- **Pantallas de llamada.** Entrante, saliente y de voz rehechas: tarjeta sobre el chat en ordenador, pantalla completa en el teléfono, halo del color de la persona, dirección en píldora, estado vivo, un solo toque en Answer, cámara propia a pantalla completa en videollamada saliente.
- **Compartir pantalla.** `getDisplayMedia({ video: true })` (Safari rechazaba algunas restricciones), frecuencia después; errores con causa (permiso de macOS, otra app grabando); el botón solo donde el navegador puede capturar; `display-capture=(self)` en Permissions-Policy.
- **Emojis, stickers y GIFs.** Las pestañas quedan montadas (antes Emojis se recargaba en cada cambio); deslizar con el dedo entre pestañas con resistencia en los extremos; deslizar con dos dedos en el trackpad, sin que el navegador lo lea como "atrás"; sin teclado al abrir; GIPHY dentro de su pestaña; reintento de GIFs.
- **Borrar chat.** La línea de la lista caía en el último mensaje en memoria sin mirar el corte; ahora lo mira, y el corte incluye la hora de la línea mostrada.
- **Confirmación de envío.** Se reproduce en el hueco del botón de enviar, recortada a su forma, 0,8 s; antes flotaba sobre los mensajes y fuera del chat, 12 s.
- **Audios en Safari.** Si `<audio>` no puede reproducir el archivo, se decodifica con Web Audio; si tampoco, lo dice y ofrece guardarlo.
- **Una firma para entrar.** La clave de la base de datos XMTP ya no se pide con una segunda firma en cada carga: se guarda en este dispositivo envuelta por una clave AES no extraíble en IndexedDB (`lib/xmtp/device-key-vault.ts`). Cuenta nueva en el dispositivo: ninguna firma extra. Base de datos bloqueada por la firma anterior: se pide una última vez. Sin almacén disponible: el camino anterior. Contrapartida: la copia local queda protegida por el perfil del navegador, no por una firma en cada carga. XMTP sigue pidiendo su propia firma la primera vez que un dispositivo se registra; no se puede unir con la de entrada.

Pantallas abiertas en Chrome (Playwright), 1280 px y 390 px con los componentes reales: llamada entrante, saliente y de voz; expresiones con deslizamiento táctil (CDP), trackpad y pestañas; confirmación de envío en el hueco del botón. Sin teléfono físico ni Safari real en esta sesión: Safari, compartir pantalla y la llamada entre dos dispositivos quedan por probar a mano (checklist en `docs/CALLS.md`, puntos 13–15).

---

## Sesión 19 noviembre 2026 · Puertas de la alpha y fuente única de verdad

Prompts `docs/plan/prompts/05-gates-protocol.md` y `06-single-source-of-truth.md`. Un PR por paquete, apilados en este orden:

| PR | Paquete | Qué cambia |
| --- | --- | --- |
| #177 | Fases 0-1 | Mapa de integración, glosario con términos prohibidos, índice, nota jurídica y anexos como borradores |
| #178 | 1 | `HLC_TOKEN_META`, despliegue solo de token para el operador, nombre comprobado por el preflight, runbook |
| #179 | 2 | Fuera «Humanity Ledger Corporation» y las rutas de API de pago sin uso |
| #180 | 3 | `closedAlpha.distributor` obligatorio para códigos, canje y emisión |
| #181 | 4 | Admisión: términos firmados con hash, sanciones y edad, borrado a 6 meses |
| #182 | 5 | Registro de Fee Juice con presupuesto, comprobación en red y CSV |
| #183 | 6 | Cuatro puertas nuevas de cUSDC y filtro en la wallet |
| #184 | 7 | Marcas de terceros con fuente; Aztec en texto (D-1) |
| #185 | 8 | `docs/legal/` con hechos reales; test de consistencia en CI |
| #186 | 9 | ADR 005: contratos no actualizables |
| este | 10 | Changelog, README, cierre |

Archivos protegidos: `lib/docs/pages/legal.ts` y `protocol.ts` no se han modificado. Ninguna transacción se ha firmado ni enviado. `audit` sigue en `null`. `communityMls`, `closedAlpha.enabled` y `CUSDC_GATES` no se han activado.

## Session 19 November 2026 · Mature protocol (packages 0-10)

Prompt `docs/plan/prompts/07-protocolo-maduro.md`. One PR per package, stacked in this order. Stefan merges them in order.

| PR | Package | What changes |
| --- | --- | --- |
| #192 | 0 (root cause) | `/` scrolls the document, not a nested `main` in a fixed body (merged) |
| #193 | 0 | Scroll debug overlay; pixel, touch-flick and browser-bar checks |
| #194 | 1 | Health: running commit, latest applied and expected migration |
| — | 2 | HLC rehearsal dispatched on `main`, queued behind the CI backlog; nothing to record yet |
| #195 | 3 | Payment events, purge cron, terms procedure, invitation rehearsal, first-code checklist |
| #196 | 4 | Wave 1 classes test, exit TXE tests, runbook order |
| #197 | 5 | `FEE_PRIVACY`, FPC evaluation |
| #198 | 6 | Alerts, measured status page, incident drill 1 |
| #199 | 7 | Internal security review 2 and its fixes |
| #200 | 8 | Aztec questions with evidence, forum draft |
| #201 | 9 | cUSDC slot behind its gates |
| this | 10 | Changelog, integration map, index, report |

Protected files: `lib/docs/pages/legal.ts` and `protocol.ts` are not modified. No transaction was signed or sent. `audit` stays `null`. `communityMls`, `closedAlpha.enabled`, `closedAlpha.distributor`, `CUSDC_GATES` and `verifiedOnChain` are unchanged.

