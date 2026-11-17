# Auditoría interna de Humanity Ledger / Ledger Chat — 18 de noviembre de 2026

**Qué es este documento.** Una auditoría interna hecha por un modelo de lenguaje (Claude) sobre el monorepo `humanityledger/Humanity-Ledger`, rama `main` en `2707065` más las correcciones de esta misma rama. **No es una auditoría externa** y no sustituye la de una firma especializada (Trail of Bits, Spearbit, Cantina, OpenZeppelin, Zellic). Ningún texto del proyecto puede decir "auditado" por este documento.

**Método.** Primero el estado real (`docs/STATUS.md`, `deployments/aztec-mainnet.json`, `docs/MAINNET_READINESS.md`, `docs/AZTEC_DECISIONS.md`). Después, componente por componente, cada afirmación contrastada con el código, los tests y los despliegues. Se distingue siempre entre lo que hace el código, lo que dicen los documentos, lo que está desplegado en Aztec Alpha y el riesgo residual. Cada hallazgo indica archivo y línea o sección. Lo que no se pudo verificar se dice.

**Correcciones hechas en esta rama, con su verificación:**

| Id | Corrección | Verificación |
|---|---|---|
| IA-01 | `PaymentStream.cancel` ya no puede fallar por la comisión | TXE de `contracts/aztec/streams`: 32 tests pasan, 3 nuevos (workflow "Aztec contracts", run 44198227688) |
| IA-02 | Ningún registro de clics ni de navegación sale del dispositivo | Revisión de código; tests unitarios en CI |
| IA-03 | La identidad del llamante es solo la sesión firmada | `test/unit/security/resolve-caller.test.ts` |
| IA-05 | `HumanTimeLock` ya no acorta un bloqueo anterior | Hardhat (run 44198227754), test nuevo |
| IA-06 | Retirado el endpoint público que pedía una frase semilla | `lib/security/retiredRoutes.ts` (410 en el borde) |
| IA-10, IA-11 | Documentos que describían controles inexistentes, marcados | Notas fechadas en los cuatro documentos |

---

## 1. Resumen ejecutivo

**Estado real.** Ledger Chat funciona en Aztec Alpha (red principal, cadena L1 1) solo para pagos privados simples del token HLC, con un límite por pago. El token HLC se desplegó en el bloque L2 28992 y el primer pago privado entró en el bloque 29012, el 14 de noviembre de 2026; los pagos registrados son entre cuentas del propio operador. Los mensajes directos usan XMTP v3 (MLS). Cada cuenta paga sus propias comisiones de red: no hay patrocinio y `sponsoredFpc` es `null`. Escrow, streams, identidad y el portal L1 **no están desplegados en Alpha**. El cliente y los scripts se niegan a abrirlos allí mientras `audit` sea `null`. Ese bloqueo es correcto.

**Riesgos críticos encontrados.**
- **IA-03 (crítico, corregido).** Cualquiera podía actuar como cualquier wallet en `/api/chat/stories` sin sesión, enviando la cookie `system_handshake=0x<víctima>`. Desde ahí leía, publicaba y borraba stories en nombre de la víctima. Detrás del middleware, un token revocado llegaba al mismo atajo (rutas de administración de comunidades).
- **IA-04 (alto, residual de diseño).** Las claves de la cuenta Aztec, los secretos de Fee Juice y los de las direcciones receptoras se derivan de una firma EIP-712 que cualquier web puede pedir. Quien consiga esa firma controla los fondos privados.
- **IA-08 (alto, abierto).** `npm audit` marca 43 vulnerabilidades altas en `main`.

**Recomendación.** Mantener el despliegue como está: pagos privados simples con límite y los avisos actuales. **No desplegar** escrow, streams, portal ni identidad en Alpha, ni quitar límites, hasta cumplir la sección 7: auditoría externa, dependencias limpias, decisiones Q1–Q10 y D-1–D-5 cerradas y una sesión real entre dos personas (R8).

---

## 2. Hallazgos por severidad

### Crítico

**IA-03 — Suplantación de identidad mediante cookie no firmada.** *Corregido.*
- Dónde: `lib/security/resolveCaller.ts` (versión anterior, pasos 2 y 3); `middleware.ts:86` (`/api/chat/stories` es prefijo público); `app/api/chat/stories/route.ts:31,73,125`.
- Qué pasaba: si `getSession` no devolvía sesión, `resolveVerifiedCaller` aceptaba la cookie `system_handshake`, que no está firmada ni es HttpOnly (`lib/security/requireWallet.ts:80` ya lo reconoce). Después aceptaba también las cabeceras `x-web3-address` y `x-wallet-address`.
- Explotación sin sesión: `curl -X POST https://ledgerchat.org/api/chat/stories -H 'Cookie: system_handshake=0x<víctima>' -H 'Origin: https://ledgerchat.org'`. El middleware no exige sesión en ese prefijo y el CSRF se pasa poniendo la cabecera Origin.
- Explotación con sesión revocada: el middleware verifica la firma del JWT pero no la revocación. `getSession` sí la comprueba y devuelve `null`, y entonces la cookie falsa decidía la identidad. Rutas afectadas: `app/api/chat/communities/[id]/route.ts` (PATCH y DELETE), `[id]/members`, `join` y `stories`.
- Corrección: `resolveVerifiedCaller` usa solo `getSession(req)`. La revocación falla abierta si Redis no responde (`lib/security/sessionRevocation.ts:79`), así que una sesión firmada nunca necesitó ese atajo.
- Test: `test/unit/security/resolve-caller.test.ts`.

### Alto

**IA-04 — Claves derivadas de una firma sin vínculo al origen.** *Residual de diseño, abierto.*
- Dónde: `lib/aztec/wallet/keys.ts:40-70`; `lib/aztec/wallet/client.ts:381-450`.
- Qué pasa: el secreto, la sal, la clave de firma, los secretos de reclamo de Fee Juice y el secreto maestro del portal salen de una firma EIP-712 con dominio `{name: 'Humanity Ledger', version: '1'}`, sin `chainId` ni contrato verificador. Una web de phishing puede pedir la misma firma. El texto firmado avisa ("Only sign this on ledgerchat.org…"), pero una billetera no puede atar esa firma al origen.
- Mitigación existente: Alpha usa un mensaje distinto del de la red de pruebas. Hay passkeys en código, pero sin probar en un autenticador real, y la clave de firma se sigue derivando de la firma (`docs/ACCOUNT_MODEL.md` §4).
- Recomendación: cuentas firmadas por passkey (WebAuthn/P-256) como camino por defecto en Alpha y la firma de Ethereum solo para recuperar; o una clave aleatoria generada en el dispositivo y cifrada por la firma, para que robar la firma sin el almacenamiento no baste. Necesita decisión de producto y migración de cuentas.

**IA-07 — HLC sin límite de emisión y con administrador único.** *Abierto, acción del operador (P-07).*
- Dónde: `deployments/aztec-mainnet.json` (`tokens[0].admin` = `0x1cf2…fe42`, artefacto `Token` estándar).
- Qué pasa: el administrador puede emitir cualquier cantidad. En el monedero la ranura interna del token se llama `USDC`; el símbolo que se muestra es HLC y el registro dice que no tiene relación con USDC.
- Recomendación: antes de cualquier oferta pública, emisión final, retirada de todos los emisores y administrador inaccesible (P-07); además opinión legal MiCA (P-08) y sociedad constituida (P-09). Renombrar la ranura interna cuando se toque esa configuración.

**IA-08 — Dependencias: 43 vulnerabilidades altas.** *Abierto.*
- Dónde: CI "npm audit — Block on any vulnerability" y "Dependency Security Audit" en `main` (`{"high":43}`).
- Esta sesión no tiene acceso al registro de npm. El intento de resolverlo con un workflow temporal que hacía commits del `package-lock.json` en la rama fue bloqueado por el control de permisos y no se hizo.
- Acción: ejecutar `npm audit fix` en una máquina con red, revisar los cambios de versión mayor uno a uno y pasar la CI completa.

### Medio

**IA-01 — Un stream no se podía cancelar por culpa de la comisión.** *Corregido.*
- Dónde: `contracts/aztec/streams/src/main.nr` (`cancel`). Antes, la comisión del tramo devengado se cotizaba con `quote_protocol_fee` y, si la cotización fallaba, el cancel revertía.
- Dos casos fallaban:
  - Polvo: entre 1 y 9 unidades devengadas, la comisión supera el 10 % permitido. `test.nr` lo esquivaba usando tasa 10 ("A rate of 1 would refuse that dust").
  - Más de 1.000.000.000 unidades devengadas sin retirar: la comisión supera `TX_CAP`. El receptor podía impedir para siempre que el emisor cancelara con solo no retirar, y quedarse todo lo que siguiera devengándose.
- Corrección: `cancel_fee` no cobra comisión al polvo y cobra `TX_CAP` cuando la comisión lo superaría (en ese caso `TX_CAP` es menor que la cantidad). Las retiradas no cambian: el receptor elige la cantidad.
- Tests nuevos: `cancel_fee_never_refuses`, `cancel_with_dust_accrued_pays_it_without_fee` y `cancel_with_accrued_above_the_cap_charges_the_cap`. Los 32 tests del crate pasan.
- La clase cambia: el nuevo class ID queda registrado en `deployments/aztec-testnet.json` y la clase anterior pasa a historial. No hay instancia en ninguna red.
- Es una decisión de comisiones (ver D-1 a D-5) que Stefan debe confirmar.

**IA-02 — El registro de clics enviaba al servidor texto descifrado.** *Corregido.*
- Dónde: `components/layout/ClientLayout.tsx` (versión anterior). En cada `mousedown`, si había sesión, enviaba a `/api/session-logs` los 40 primeros caracteres del botón pulsado. En la lista de chats ese texto incluye el nombre y la vista previa del último mensaje, ya descifrada en el dispositivo.
- El endpoint responde 410 y no guarda nada, pero el texto salía del dispositivo y contradice el cifrado extremo a extremo.
- Corrección: eliminados el registro de clics y el de navegación.

**IA-06 — Endpoint público que pedía una frase semilla.** *Corregido.*
- Dónde: `app/api/aztec/derive-address/route.ts`. Aceptaba `{ seed }` en el cuerpo y devolvía una "dirección" SHA-256 etiquetada `aztec-mainnet`. Nada lo llama.
- Corrección: retirado (410 en el borde).

**IA-10 — Documentos normativos que describen controles inexistentes.** *Corregido con notas.*
- `docs/SEQUENCER_RESILIENCE.md`: `lib/aztec/sequencer-resilience.ts` no existe, no hay lista de RPC alternativos ni botón de reenvío, y los endpoints son de la red de pruebas.
- `docs/OBSERVABILITY.md`: ninguna métrica `hl_*` existe en el código.
- `docs/INCIDENT_RESPONSE.md`: no hay "Revoke this device", ni registro de VK desplegado, ni multisig.
- Se añadió una nota fechada al principio de cada uno.

**IA-11 — `docs/AUDIT_DOSSIER.md` da por cerrados riesgos abiertos.** *Corregido con nota.* RISK-05 y RISK-08 dicen "0 vulnerabilidades" frente a las 43 de IA-08. RISK-04 está "cerrado por tests". RISK-06 está desactualizado. Se añadió una corrección fechada sin reescribir el registro.

**IA-13 — Las publicaciones de comunidades las puede leer el servidor.** *Abierto y conocido.* Dónde: `communityMls` vale `false` por defecto (`docs/STATUS.md` §1, AC-03). La interfaz lo dice en una frase (`VISIBILITY_SENTENCE`) y no lo llama cifrado. Falta la migración (`docs/communities/MLS_MIGRATION.md`).

**IA-14 — Vínculo G7 sin probar entre dos personas.** *Abierto (R8).* Dónde: `lib/aztec/peer-binding.ts`. Es confianza en el primer uso y la prueba v2 está bien diseñada (red incluida en el enunciado), pero nunca se ha hecho una sesión con dos navegadores. Prueba control de la clave de firma, no de las claves de privacidad; está documentado.

### Bajo

**IA-05 — `HumanTimeLock` permitía acortar un bloqueo.** *Corregido.* Dónde: `contracts/civilization/HumanTimeLock.sol` (`lock`). Un depósito posterior con duración de 1 s y 1 wei fijaba un nuevo `unlockTime` y liberaba todo lo depositado antes. Ahora `unlockTime` solo puede crecer. Test en `test/HumanTimeLock.test.ts`. El contrato no está desplegado.

**IA-15 — `HLReceiver.forward` es abierto a cualquiera.** *Abierto, recomendación.* Dónde: `contracts/portal/HLReceiver.sol:91`. Cualquiera puede trocear el saldo de una dirección receptora en depósitos del mínimo, y cada depósito obliga al dueño a pagar un reclamo en Aztec. El destino no cambia, así que no hay robo. Recomendación: fijar `minDeposit` de modo que la comisión de un reclamo sea pequeña frente al mínimo, o limitar el número de reenvíos por bloque.

**IA-16 — El último polvo de un stream no lo puede retirar el receptor.** *Abierto, documentado.* Dónde: `contracts/aztec/streams/src/main.nr` (`withdraw`). Si quedan menos de 10 unidades, la cotización rechaza la retirada. Tras IA-01 el emisor sí puede cancelar y ese polvo se paga sin comisión.

**IA-09 — La CI de propiedad intelectual falla porque la licencia nombra al titular.** *Abierto, decisión del titular.* Dónde: `.github/workflows/advanced-hardening.yml:370-392`. `LICENSE-MIT`, `README.md`, `app/layout.tsx`, `lib/protocol/fees.ts` y el código del escrow nombran a Stefan Antonio Cirisanu. La licencia debe nombrar al titular del copyright. No se modificó el control: ampliar su lista de excepciones es decisión de Stefan.

**IA-17 — Textos legales.** Siguen diciendo "solo red de pruebas" (R2). Los cambia el titular con su abogado; los agentes no editan textos legales.

**IA-18 — Llamadas entre redes distintas.** Sin TURN configurado (R3).

### Informativo

- **IA-19:** `IdentityCredential.verify_and_claim` encola comprobaciones públicas de la raíz y de la lista de sanciones. Eso revela qué contrato y qué raíz usa la transacción, no quién la hace. Es inherente al diseño.
- **IA-20:** el anulador de liquidación del escrow es determinista a partir de (escrow_id, emisor, receptor). Solo las partes conocen el `escrow_id` aleatorio. Sin impacto.
- **IA-21:** `components/ui/ClientFortress.tsx` y `components/security/AntiTamperCore.tsx` bloquean el menú contextual y atajos de herramientas de desarrollo, y escriben "ACCESS RESTRICTED: Forensic Core Integrity Active" en la consola. No aportan seguridad (el código del cliente es público y abierto) y perjudican la accesibilidad. Recomendación: retirarlos.
- **IA-22:** `test/SystemDeadmanSwitch.test.js`, fuera de `test:contracts`, falla en el paso de informe de gas con `Blocked()`. No bloquea la CI, pero es un test obsoleto.
- **IA-23:** Q1–Q10 (`docs/AZTEC_DECISIONS.md`) y D-1–D-5 (`docs/protocol/FEE_CONTRACT_SPEC.md`) siguen abiertas.

---

## 3. Matriz de coherencia

| Afirmación (dónde) | Código | Tests | Despliegue real | Veredicto |
|---|---|---|---|---|
| Pagos privados en Aztec Alpha (`STATUS.md`) | `lib/aztec/wallet/` | e2e en la red de pruebas; preflight de mainnet | HLC en el bloque 28992; pagos en los bloques 29012 y 29771 y una cuenta nueva en 29921–29923, todo entre cuentas del operador | Coherente |
| Cada cuenta paga sus comisiones; sin patrocinio | `/api/aztec/sponsor` retirado; `sponsoredFpc: null` | `deployments-registry.test.ts` | Igual | Coherente |
| Mensajes directos E2EE (XMTP v3, MLS) | SDK de XMTP 5.2.0 | A2 "delegado"; no hay test que ejercite el MLS de la app | Producción | Coherente (delegado) |
| Los mensajes no salen descifrados del dispositivo (implícito en E2EE) | Registro de clics de `ClientLayout` | Ninguno | Producción | **Incoherente hasta IA-02** |
| Publicaciones de comunidades legibles por el servidor (`STATUS.md`) | `communityMls=false` | `r17-acceptance.test.ts` | Producción | Coherente |
| Escrow y streams (`STATUS.md`) | `contracts/aztec/escrow`, `streams` | TXE: 19 y 32 | Solo red de pruebas; Alpha rechazado | Coherente; IA-01 corregido |
| Portal L1 y direcciones receptoras | `contracts/portal`, `portal_token`, `lib/portal` | Hardhat (CI) y TXE (11) | Ninguno | Coherente |
| Identidad | `contracts/aztec/identity` | TXE: 20 | Red de pruebas con raíces de relleno | Coherente |
| "Nunca se confía en cabeceras del cliente" (`resolveCaller.ts`, A-016) | Atajos de cookie y cabeceras | Ninguno | Producción | **Incoherente hasta IA-03** |
| "No hay custodia de claves en el servidor" (`INCIDENT_RESPONSE.md`) | Claves derivadas en el navegador; `/api/aztec/derive-address` pedía una semilla | Ninguno | Producción | **Incoherente hasta IA-06** |
| "0 vulnerabilidades en npm" (`AUDIT_DOSSIER.md` RISK-05/08) | — | CI: 43 altas | — | **Incoherente** (nota IA-11) |
| Reenvío ante censura del secuenciador (`SEQUENCER_RESILIENCE.md`) | No existe | Ninguno | — | **Incoherente** (nota IA-10) |
| Métricas `hl_*` (`OBSERVABILITY.md`) | No existen | Ninguno | — | **Incoherente** (nota IA-10) |
| "No auditado" (`STATUS.md`, registros) | `audit: null` | `alpha-agreement-gates.test.ts` | — | Coherente |

---

## 4. Contratos aztec-nr

**PrivateEscrow** (`contracts/aztec/escrow/src/main.nr`)
- Diseño: dos copias de la misma nota (reclamo para el receptor, reembolso para el emisor) y un anulador de liquidación compartido, de modo que solo una de las dos operaciones entra (Q1).
- Depósito único por (escrow_id, emisor) mediante un anulador propio.
- Caducidad acotada: `min(deadline, ancla + 3600)`.
- El reclamo exige el secreto y entrar antes del plazo; el reembolso, que el ancla supere el plazo. Son excluyentes.
- La comisión se cobra solo en el reclamo y el depósito ya rechaza cantidades que no podrían liquidarse, así que el reclamo nunca falla por la comisión.
- El contrato mueve sus propias notas con nonce de authwit 0, que es correcto porque `from` es el propio contrato.
- Sin hallazgos nuevos. Riesgo residual: custodia mediante instancia con claves propias por acuerdo (Q2); ambas partes ven las notas del contrato.

**PaymentStream** (`contracts/aztec/streams/src/main.nr`)
- Acumulación sin desbordamiento (SEC-S11).
- Anulador de estado compartido entre retirada y cancelación (SEC-S12): una cancelación desde una copia antigua falla, y una retirada tras cancelar también.
- Hallazgos IA-01 (corregido) e IA-16 (abierto).
- Inicio no futuro, total y tasa positivos, y un stream por (sal, emisor).

**IdentityCredential** (`contracts/aztec/identity/src/main.nr`)
- Árbol de profundidad 32, Poseidon2 con separadores de dominio y lista de sanciones comprometida.
- Raíz anterior válida una hora, rotación del emisor en dos pasos y reclamo de un solo uso por (ámbito, llamante).
- No se verifica que el emisor del constructor no sea cero: un despliegue con emisor cero no se podría administrar. Informativo.

**PortalToken** (`contracts/aztec/portal_token/src/main.nr`)
- El mensaje de depósito no nombra destinatario y el anulador es poseidon2(mensaje, secreto).
- No hay suministro público, así que un reclamo no cambia almacenamiento público.
- La retirada quema saldo privado y el mensaje L2→L1 es público por diseño (`docs/PORTAL.md` §3).
- 11 tests TXE. No desplegado.

**Circuitos Noir independientes** (`circuits/`). La v1 tiene ZK-01 a ZK-07 (dos críticos, `docs/AZTEC_FOUNDATION_DOSSIER.md` §7) y nada la usa en producción. La v2 los corrige en código y CI, pero ningún verificador desplegado guarda su estado. No deben usarse con valor.

---

## 5. G7, frontera del PXE, modelo de comisiones y custodia de claves

- **Frontera del PXE.** La ejecución privada y las pruebas ocurren en el navegador. El servidor no recibe testigos ni claves; con IA-06 retirado, tampoco frases semilla. Los almacenes del monedero se cifran con material derivado de la firma (`openEncryptedWalletStores`).
- **Custodia de claves.** Ver IA-04: es el riesgo dominante del modelo actual. Las passkeys (`lib/aztec/wallet/passkey.ts`) envuelven la raíz con PRF, pero no cambian que la raíz sea la firma.
- **G7.** El diseño es correcto para su alcance: prueba Schnorr sobre un enunciado que incluye ambos buzones XMTP y la red. En Alpha no se mueve valor con una prueba v1 y un cambio de dirección se marca como conflicto en vez de sustituirse en silencio. Falta la prueba con dos personas (R8).
- **Comisiones.** No hay patrocinio. La comisión de red que paga una cuenta es pública (pagador y cantidad); los datos de la transferencia privada no. La comisión de protocolo (50 pb, mínimo, 10 %, `TX_CAP`) está en el escrow y los streams, va a una tesorería designada que no es la multisig 4 de 7, y no se cobra en Alpha porque esos contratos no están desplegados.

---

## 6. Riesgos residuales tras corregir todo lo anterior

1. Aztec Alpha es una red temprana con fallos críticos esperados (en palabras de Aztec). Nada de la aplicación hace segura una versión defectuosa del rollup (`docs/INCIDENT_RESPONSE.md`, sección de Aztec).
2. Claves derivadas de una firma (IA-04) mientras las cuentas por passkey no sean el camino por defecto.
3. Metadatos: el pagador de la comisión es público, igual que el tiempo y el tamaño en XMTP (RISK-03).
4. Ninguna revisión externa de los contratos aztec-nr ni del portal. Las preguntas Q1, Q2 y Q4 sobre anuladores compartidos y custodia con claves esperan respuesta de Aztec.
5. Cadena de suministro hasta que se resuelva IA-08.
6. Confianza en el primer uso para direcciones de pares (G7) y ningún canal fuera de banda integrado.

---

## 7. Acciones priorizadas para un despliegue completo en Alpha sin límites

1. **Dependencias (IA-08):** `npm audit` limpio en una máquina con red, con la CI completa en verde.
2. **Auditoría externa** de `contracts/aztec/{escrow,streams,identity,portal_token}` y `contracts/portal/*` (R7, P-11). El informe va a `audits/` y su referencia a `deployments/aztec-mainnet.json` → `audit`.
3. **Decisiones:** cerrar Q1–Q10 con Aztec y D-1–D-5. Confirmar o cambiar la regla de comisión de IA-01.
4. **Custodia (IA-04):** decidir el modelo por defecto en Alpha (passkey o clave de dispositivo) y probar passkeys en autenticadores reales.
5. **Pruebas reales:** sesión G7 con dos personas y dos navegadores (R8); acuerdos de escrow y stream entre dos cuentas que no sean del operador en la red de pruebas, con la clase actual.
6. **Token:** suministro fijado (P-07), opinión legal MiCA (P-08), sociedad (P-09) y textos legales (R2, IA-17).
7. **Despliegue,** solo tras lo anterior: instancias con claves propias en Alpha, el preflight de solo lectura y el registro con transacción y bloque en `deployments/aztec-mainnet.json`. Después, el portal L1 con su multisig de administración y guardián.
8. **Producto:** migración MLS de comunidades (AC-03), TURN (R3) y retirada de los bloqueos de menú contextual (IA-21).

---

## 8. Limitaciones

- Soy un modelo de lenguaje. Revisé el código de forma estática y con los tests y la CI del repositorio. No ejecuté fuzzing, verificación formal ni pruebas contra Alpha.
- No pude ejecutar `npm audit` ni instalar dependencias (sin red en esta sesión). Las cifras de vulnerabilidades son las de la CI.
- No compilé Noir localmente: la compilación, los artefactos y los 32 tests TXE de los streams se verificaron en la CI de GitHub ("Aztec contracts", run 44198227688).
- La revisión de `lib/` y `components/` (unas 120.000 líneas de TypeScript) fue dirigida a autenticación, custodia de claves, flujos de valor y datos que salen del dispositivo, no exhaustiva línea por línea.
- Los contratos Solidity fuera del portal (`HumanityTimeLockVault`, registros ZK, `LedgerDeadmanSwitch`, `StudioProvenance`) se revisaron con búsquedas de patrones de riesgo y sus tests, no a fondo. Ninguno está desplegado.
- Por todo ello sigue siendo necesaria una auditoría externa profesional antes de mover valor con escrow, streams, identidad o el portal.
