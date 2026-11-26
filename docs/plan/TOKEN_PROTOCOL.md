MÁXIMA COMPLEJIDAD + MÍNIMO CONSUMO DE TOKENS (0% OMISIONES)

IMPORTANT

Ejecutar el Master Prompt completo en una única conversación larga de Claude desperdicia entre el 70% y el 85% de los tokens (re-envío cuadrático del historial, compactaciones prematuras que borran invariantes y lecturas repetidas de archivos gigantes como LedgerChatV2.tsx de 9.881 líneas o contracts/aztec/*/target/*.json). Esta arquitectura combina Prompt Caching + .claudeignore + CLAUDE.md + Estado Externo (EXECUTION_LEDGER.md) + 7 Micro-Sesiones Deterministas para que Claude integre el 100% de cada ítem del Master Prompt con profundidad criptográfica total y gasto mínimo.

1. POR QUÉ SE QUEMAN LOS TOKENS EN ESTE REPO (Y CÓMO CORTARLO DE RAÍZ)

Trampas reales detectadas directamente en d:\Humanity-Ledger-main:

Artefactos gigantes que NO deben entrar en contexto salvo consulta puntual:
components/terminal/LedgerChatV2.tsx (9.881 líneas)
prisma/schema.prisma (2.012 líneas)
lib/aztec/wallet/client.ts (1.886 líneas)
contracts/aztec/*/target/*.json (ABIs/bytecode Noir enormes)
archive/standalone-circuits/ (código retirado fuera de alcance)
docs/antigravity/backlog.csv (76 KB), docs/verification-logs/, Claude outputs/, public/globe/, public/lottie/
Re-ejecución ciega de suites pesadas: correr npm run build (NODE_OPTIONS="--max-old-space-size=6144") o vitest run entero después de cada micro-edición inunda el contexto con miles de líneas de stdout.
Amnesia por compactación en sesiones únicas: al llegar al 65% de ventana en una sesión única, /compact pierde detalles finos de líneas y obliga a Claude a releer los mismos archivos 3 o 4 veces.
2. PREPARACIÓN OBLIGATORIA PREVIA (AHORRA ~65% DESDE EL MINUTO 0)

Antes de abrir la primera sesión de Claude en d:\Humanity-Ledger-main, crea estos 3 archivos de control en la raíz del proyecto:

2.1 Archivo 1: .claudeignore (Bloqueo físico de ruido)
gitignore
# Dependencias, builds y caches
node_modules/
.next/
out/
cache/
artifacts/
.cache/
tsconfig.tsbuildinfo
# Artefactos compilados enormes (Noir/Solidity ABI JSONs)
contracts/**/target/*.json
contracts/**/target/*.bak
deployments/*.local.json
# Código retirado e histórico obsoleto (no leer salvo orden explícita)
archive/
Claude outputs/
docs/verification-logs/
docs/audit/PROTOCOL_STATE_2026-11-14.md
docs/audit/JANUARY_2027_AUDIT_DOSSIER.md
docs/AUDIT_SCOPE.md
docs/AZTEC_AUDIT_MANIFEST.md
# Medios pesados y binarios estáticos
public/releases/
public/globe/
public/textures/
public/lottie/
public/lotties/
public/stickers/
public/stickers2/
public/stickers3/
public/system-shots/
public/media/
**/*.png
**/*.jpg
**/*.jpeg
**/*.webp
**/*.mp4
**/*.lottie
**/*.exe
**/*.pdf
# Lockfile gigante (consultar solo scripts/package.json salvo npm audit)
package-lock.json
2.2 Archivo 2: CLAUDE.md (Prefix estable con 90% descuento por Prompt Caching)

NOTE

Este archivo tampoco existía todavía en el repo aunque app/layout.tsx:94, 280 cita CLAUDE.md §1. Mantenerlo < 220 líneas y SIN editarlo durante las sesiones garantiza que Anthropic cachee el prefijo completo de cada turno.

markdown
CLAUDE.md — Humanity Ledger / Ledger Chat Execution Rules
§1 Truth & Brand Invariants (Cited by app/layout.tsx)
Every public/UI/SEO claim MUST match live runtime code (README.md, deployments/aztec-mainnet.json, lib/payments/assets.ts).
External audit status stays "audit": null until a signed third-party report is committed. Never invent audit claims, legal entities, tax IDs (taxId: null), or treasury multisig addresses.
Operator legal entity changes (lib/constants/legalEntity.ts) and binding legal copy (lib/docs/pages/legal.ts) obey OD-8: generate diffs/proposals for counsel + Stefan Antonio Cirisanu, NEVER silently rewrite binding legal terms or set CUSDC_GATES to true without real archived evidence.
Single authority on network state: deployments/aztec-mainnet.json and docs/audit/START_HERE.md. Ignore legacy docs listed in START_HERE.md §7.
§2 Token-Saving Execution Protocol (MANDATORY)
Locate-Before-Read: Always locate exact line ranges via git grep -n scoped to target folders (-- app lib components contracts) BEFORE opening a file.
Bounded Slices Only: NEVER read entire files >250 lines (LedgerChatV2.tsx, prisma/schema.prisma, lib/aztec/wallet/client.ts). Read exact offset/limit blocks (<=150 lines per read). Never re-read a file you just edited; inspect changes with git diff -- <file>.
Parallel Batching: Batch independent git grep, file reads, and disjoint file edits in a single turn. Plan the exact diff + regression test BEFORE modifying any file ("Measure twice, edit once").
Compressed Terminal Output: NEVER dump verbose passing logs into context. Always pipe/filter long test/build/lint commands to show ONLY failure lines or the last 25 lines (--reporter=dot in Vitest, redirect full output to /tmp/ only if exit code != 0).
Micro-Test Loop: During edits run ONLY the targeted Vitest/Hardhat/TXE spec for that file. Run tsc --noEmit, eslint, and full next build ONLY ONCE at the end of the phase.
Zero-Drop Checkpointing: Read EXECUTION_LEDGER.md + only the active Phase section from the Master Prompt at session start. Update EXECUTION_LEDGER.md ONLY once right before committing at session end.
§3 Architecture Guardrails
requireWallet(req) & getClientIP(req) (lib/security/rateLimiter.ts) are the ONLY valid auth/IP extractors in API routes. Direct x-forwarded-for parsing or x-web3-address/x-wallet-address trust is forbidden.
Single HTTP session cookie hl_session (+ rotating refresh if used); purge system_handshake, wallet-auth, fake deriveAztecAddress, and legacy simulated QDs routes.
Zero client/build suppressions: work toward removing @ts-nocheck, @ts-ignore, (prisma as any), ignoreBuildErrors, ignoreDuringBuilds, and minimize: false.
2.3 Archivo 3: EXECUTION_LEDGER.md (Memoria de estado entre sesiones < 80 líneas)

Crea este archivo antes de iniciar y úsalo como único relevo de memoria entre sesiones limpias (evitando cargar historiales muertos):

markdown
EXECUTION LEDGER — HUMANITY LEDGER 5★ UPGRADE

Regla: Actualizar SOLO al finalizar cada sesión con commit SHA + comando exacto verificado en verde. Prohibido marcar DONE sin test real ejecutado tras la última edición.

Bloqueadores Humanos Externos (No cerrables por código)
 H1: Constitución S.L. + taxId + postalAddress (lib/constants/legalEntity.ts)
 H2: Informe Auditoría Externa (deployments/aztec-mainnet.json → audit)
 H3: Multisig 4-de-7 TREASURY real en Aztec Alpha
 H4: Firma letrada de lib/docs/pages/legal.ts (OD-8)
 H5: Respuesta human.tech + seguro RC/cyber + CASP (CUSDC_GATES)
 H6: Pruebas físicas iPhone Safari + Android Chrome MetaMask + DATABASE_URL_UNPOOLED + TURN Railway
Checklist Completo del Master Prompt (Estado)
 SESIÓN 1 (Seguridad P0 Auth/Billing/XSS): SEG-C1, SEG-C2, SEG-C3, SEG-H4 | commit: —
 SESIÓN 2 (Seguridad P0 Zombis/Aztec/OFAC/IP/Cookies): SEG-C4, SEG-H1, SEG-H2, SEG-H3, SEG-M1 | commit: —
 SESIÓN 3 (Build Estricto, TS, Poda DB/Deps): CON-08, CON-09, CON-10, III.1, III.3, III.4 | commit: —
 SESIÓN 4 (Refactor Modular LedgerChatV2): III.2 (<350L/módulo, Zustand selectores) | commit: —
 SESIÓN 5 (PC+Móvil Total + /prove Worker/COOP + WebRTC/XMTP): IV.1, IV.2, IV.3, IV.4, CON-11 | commit: —
 SESIÓN 6 (Contratos D-4, PrivateFPC, Portal, R17 MLS): V.1, V.2, V.3, V.4, CON-01, CON-07 | commit: —
 SESIÓN 7 (SSOT Docs, Compliance RGPD/DSA/Legal Diff & Gate Final 5★): CON-02..06, VI.1..7, VII | commit: —
3. LAS 7 REGLAS DE ORO OPERATIVAS DENTRO DE CLAUDE

Aplica estas reglas en tu flujo con Claude Code / CLI:

Enrutamiento por Modelo según Complejidad (Ahorra ~60% de coste sin bajar precisión):
Claude Opus (Extended Thinking / Effort High): Úsalo SOLO en Sesión 1/2 (análisis criptográfico/seguridad), Sesión 5 (bb.js WASM + /prove COOP/COEP + Safari Terser TDZ) y Sesión 6 (Noir PrivateEscrow.nr/PaymentStream.nr D-4, HLPortal.sol, PrivateFPC) + revisión diferencial final.
Claude Sonnet: Úsalo en Sesión 3 (poda + tipos TypeScript + eliminación @ts-nocheck), Sesión 4 (división mecánica de LedgerChatV2.tsx en módulos limpios) y Sesión 7 (unificación SSOT, JSON-LD, RGPD export, suites Playwright/Lighthouse).
Subagentes haiku (si trabajas con Claude Code): Delégales ÚNICAMENTE barridos read-only repetitivos (p. ej. "lista todos los archivos con x-forwarded-for que no usen getClientIP", "lista todos los (prisma as any) en app/api/"), devolviendo solo una tabla compacta de archivo:línea.
Prohibido /compact en mitad de un arreglo crítico: En su lugar, trabaja por sesiones limpias (/clear) al terminar cada Sesión 1→7, haciendo commit atómico antes de limpiar. Si dentro de una sola sesión superas el 55% de contexto, termina el bloque actual, actualiza EXECUTION_LEDGER.md y abre sesión limpia.
Prompt Caching Discipline: En los prompts de sesión de abajo, pega el bloque fijo primero y no cambies CLAUDE.md ni la cabecera del prompt entre iteraciones de la misma sesión.
Compresión Extrema de Comandos en Terminal (PowerShell / Bash): Usa siempre esta plantilla de ejecución para no tragar logs de éxito:
Tests Vitest: npx vitest run <ruta> --reporter=dot 2>&1 | Select-Object -Last 25 (solo lees el log completo si $LASTEXITCODE -ne 0).
TypeScript: npx tsc --noEmit 2>&1 | Select-Object -First 40 (ataca errores de raíz primero; un fix en un tipo compartido suele borrar 30 errores encadenados).
Hardhat/Foundry: forge test --summary en vez de trazas -vvvv salvo en tests fallidos (--match-test <nombre> -vvv).
Lectura Quirúrgica de LedgerChatV2.tsx (9.881 líneas): Jamás ordenes "lee LedgerChatV2.tsx". Ordena primero extraer su índice de símbolos/regiones con git grep -n -E "^(export )?(function|const|class|interface|// ──)" components/terminal/LedgerChatV2.tsx (~120 líneas de mapa) y refactoriza trozo a trozo por rangos exactos.
Subagentes solo cuando el aislamiento ahorra tokens: No lances subagentes para editar 2 archivos (pagas arranque de contexto nuevo); úsalos exclusivamente para búsquedas de barrido >15 archivos o compilaciones paralelas independientes (Hardhat vs Aztec TXE).
Verificación de Cobertura Zero-Drop en Sesión 7: Antes de dar por cerrado el trabajo, exige un diff/tabla automatizada que mapee 1 a 1 cada ID de MASTER_PROMPT_5_ESTRELLAS.md contra su commit SHA o su etiqueta H1..H6.
4. LOS 7 PROMPTS EXACTOS POR SESIÓN (COPIAR Y PEGAR EN ORDEN)

Ejecuta una sesión por bloque, haciendo /clear entre sesiones y commiteando en una rama dedicada (p. ej. feat/protocol-5-star-upgrade). Copia también en docs/plan/MASTER_PROMPT_5_ESTRELLAS.md (o deja en el workspace) el texto de MASTER_PROMPT_5_ESTRELLAS.md para que Claude lea solo la sección indicada por rango de líneas sin que tengas que pegárselo 7 veces.

SESIÓN 1 — Seguridad P0: Auth HMAC, Facturación SEPA/Stripe, XSS Comunidades & CSP (Modelo recomendado: Opus)
text
Lee ÚNICAMENTE:
1) `CLAUDE.md`
2) `EXECUTION_LEDGER.md`
3) La sección `2. PARTE I` (solo `SEG-C1`, `SEG-C2`, `SEG-C3`, `SEG-H4`) de `MASTER_PROMPT_5_ESTRELLAS.md`.
REGLA DE EFICIENCIA: No leas archivos enteros >250 líneas; ubica símbolos exactos con `git grep -n` y lee solo bloques de ±80 líneas. Ejecuta lecturas en paralelo, presenta una mini-especificación (máx 15 líneas) y luego edita en lote.
Objetivos obligatorios de esta sesión:
1. [SEG-C1] En `lib/api-guard.ts` (L112-160) y `app/api/v1/user/keys/update/route.ts` (L28-55):
   - Corrige el bug `'Elite'` vs `'elite'` en `tierLimits` y en la comprobación HMAC.
   - Valida longitud/hex estricto de `signature` y `Number.isFinite` en timestamp.
   - Bloquea `DEV_INTERNAL_WAC` ante cualquier build no local.
   - En `keys/update`: reutiliza la protección SSRF real de `app/api/link-preview/route.ts` sobre `webhookUrl` y valida `ipWhitelist` con Zod (IPv4/IPv6/CIDR, máx 32).
2. [SEG-C2] En `app/api/payment/confirm/route.ts`: revisa su presencia en `lib/security/retiredRoutes.ts`. O retira físicamente el handler si no está en uso productivo, o corrige todas sus brechas (derivar `priceEur` en servidor, arreglar query rate-limit por `walletAddress`+`email` en Redis, escapar HTML en email, eliminar `"System Analytics"`, `"Humanity Ledger Foundation"` y fallbacks dummy).
3. [SEG-C3] Elimina almacenamiento de `contentHtml` sin sanitizar en `app/api/chat/communities/posts/route.ts` y `app/api/chat/communities/[id]/posts/route.ts` (reemplazar o limpiar con `isomorphic-dompurify` `ALLOWED_TAGS: []`), deja de enviar `contentHtml` desde `components/communities/CommunityReader.tsx:303` y revisa `app/api/chat/communities/route.ts:269` (`if (memComm)`).
4. [SEG-H4] Revisa/retira `app/api/payments/checkout/route.ts` y `provision-owner` (quitar redirección a `/terminal` / `/studio/provenance` y VIP backdoor silencioso; o adaptarlo con retorno real a `/settings`), elimina `Content-Security-Policy-Report-Only` conflictivo de `next.config.js:519`, estrecha `connect-src`/`frame-src` en `middleware.ts:365` (cierre R2-6) y purga handlers muertos ya marcados en `retiredRoutes.ts` (`app/api/dev/deploy`, `admin/launch-checklist`).
Crea tests de regresión unitarios en `test/unit/security/session1-critical.test.ts` probando:
- Firma HMAC requerida para tier `'Elite'` y `'elite'`, y rechazo de SSRF en `webhookUrl` (`169.254.169.254`, `127.0.0.1`).
- Inyección `<img src=x onerror=alert(1)>` en posts de comunidad neutralizada antes de DB.
- Precio SEPA manipulado rechazado / ruta retirada `410`.
Corre SOLO `npx vitest run test/unit/security/session1-critical.test.ts --reporter=dot`.
Cuando esté en verde, actualiza únicamente la línea `SESIÓN 1` de `EXECUTION_LEDGER.md`, haz commit en Git y detente sin continuar a Sesión 2.
SESIÓN 2 — Seguridad P0: Zombis Aztec/QDs, 3x deriveAztecAddress, OFAC Geofencing, IP & Cookies (Modelo recomendado: Opus)
text
Lee ÚNICAMENTE:
1) `CLAUDE.md` y `EXECUTION_LEDGER.md`
2) La sección `2. PARTE I` (solo `SEG-C4`, `SEG-H1`, `SEG-H2`, `SEG-H3`, `SEG-M1`) de `MASTER_PROMPT_5_ESTRELLAS.md`.
REGLA DE EFICIENCIA: Para el barrido de `x-forwarded-for` en toda la repo, lanza UN subagente `haiku` de solo lectura que devuelva exclusivamente `ruta:línea:expresión`, y luego edita en lote. No leas archivos enteros innecesarios.
Objetivos obligatorios de esta sesión:
1. [SEG-C4] Unificar identidad Aztec real y eliminar rutas zombi:
   - Retirar/eliminar `app/api/zk/identity/route.ts`, `app/api/zk/treasury/route.ts`, `app/api/zk/sequencer/route.ts`, `app/api/aztec/balance/route.ts`, `app/api/aztec/transactions/route.ts`, `app/api/aztec/derive-address/route.ts`, `app/api/aztec/restore-session/route.ts` (y sacarlas TODAS de `PUBLIC_PREFIXES` en `middleware.ts:103-107`, manteniéndolas 410 en `retiredRoutes.ts`).
   - Eliminar derivaciones falsas en `lib/aztec/zk-identity.ts` (`deriveAztecAddress`) y `lib/zk/zkIdentity.ts`; migrar `lib/identity-gate.ts`, `app/api/chat/contacts/request/route.ts` y `app/api/chat/contacts/request/[action]/route.ts` a EVM canónico de sesión + verificación G7 real (`lib/aztec/peer-binding.ts`).
2. [SEG-H1] En `middleware.ts`: mover la comprobación OFAC/jurisdicción restringida ANTES de permitir `/chat`, `/connect`, `/beta`, `/alpha`, `/api/siwe/*`, `/api/beta/*`, `/api/payments/*`, `/api/aztec/*`, dejando solo páginas legales/documentales/status/estáticos fuera de geobloqueo si aplica legalmente.
3. [SEG-H2] Centralizar toda extracción de IP en `getClientIP(req)` (`lib/security/rateLimiter.ts`) en TODAS las rutas reportadas por `haiku`; añadir regla anti-`x-forwarded-for` directo a `scripts/forbidden-patterns.mjs`. Ajustar `PUBLIC_PREFIXES` en `middleware.ts:138-140` sacando `/api/settings` y `/api/user/register` (ambas exigen sesión).
4. [SEG-H3] Cookies y Redis sin bloqueos:
   - Reemplazar `redis.keys(...)` en `lib/session.ts:133,155` y `app/api/user/nuke/route.ts:112,116` por `Redis Set` por usuario o `SCAN` seguro no bloqueante.
   - En `app/api/siwe/verify/route.ts`, `lib/session.ts` y `ClientLayout.tsx:65`: unificar en `hl_session` HttpOnly (eliminando `system_handshake` y `wallet-auth` legibles por JS; usar `/api/siwe/session` en cliente manteniendo compatibilidad `SameSite` verificada para iOS Safari return flow).
   - En `app/api/user/nuke/route.ts`: validar `address.toLowerCase() === session.userId.toLowerCase()`, añadir nonce single-use en Redis para el mensaje firmado y cambiar mensaje de respuesta al estándar sobrio RGPD art. 17.
5. [SEG-M1] Reforzar `lib/community-apps/validate.ts` + CSP del frame (`worker-src 'none'`, `form-action 'none'`), eliminar `MORALIS_API_KEY` dummy y `'0x1111...'`/`CHAIN_ID='8453'` de `next.config.js:80-81,486-488` creando validación explícita en `lib/env.ts` (`zod`).
Corre tests específicos (`test/auth/`, `test/unit/security/`, nuevo `test/unit/security/session2-ofac-ip-cookies.test.ts`) con `--reporter=dot`.
Actualiza `SESIÓN 2` en `EXECUTION_LEDGER.md`, haz commit y detente.
SESIÓN 3 — Madurez 5★: TypeScript Estricto, Poda de Deuda/Deps/DB y Build Verificado (Modelo recomendado: Sonnet)
text
Lee ÚNICAMENTE:
1) `CLAUDE.md` y `EXECUTION_LEDGER.md`
2) La sección `4. PARTE III` (`III.1`, `III.3`, `III.4`) y `CON-08..10` de `MASTER_PROMPT_5_ESTRELLAS.md`.
REGLA DE EFICIENCIA: NO ejecutes `next build` todavía hasta terminar TODAS las ediciones. Usa un subagente `haiku` si necesitas listar los `(prisma as any)` exactos en `app/api/`. No leas `prisma/schema.prisma` entero: usa `git grep -n "^model "` para inventariar modelos primero.
Objetivos obligatorios:
1. Eliminar los 8 `// @ts-nocheck` (`LedgerSettingsFull.tsx`, `BurnTimerSheet.tsx`, `ZkSequencerDashboard.tsx`, `lib/aztec/client.ts` —integrar utilidades tipadas o retirar—, `lib/settings-validation.ts`, y las rutas API supervivientes), más cualquier `@ts-ignore` propio.
2. Arreglar/retirar `context/AztecContext.tsx` (`CON-08`: corregir `setNodeInfo(tr(info))` y quitarlo del `RootLayout` si nada vivo de producción lo usa tras comprobar con `git grep -n "useAztec"`).
3. Eliminar todos los casts `(prisma as any)` tras regenerar `prisma generate` con esquema tipado; mover/archivar modelos claramente muertos de productos retirados (`Article`, `Sector`, `GoldRegistryAudit`, `EcosystemWarRoomData`) solo tras comprobar con `git grep` que 0 archivos vivos los importan; validar `@@index([communityId, channelId, createdAt])` y `take <= 100`.
4. Auditar `package.json` con `npx depcheck` / `git grep` para retirar dependencias zombi sin consumidores vivos (`@bsv/sdk`, `neo4j-driver`, `@solana/web3.js`, `@worldcoin/idkit`, `@chainsafe/*`, `libp2p`, `@flashbots/ethers-provider-bundle`, etc.) solo si tienen 0 imports reales; mantener `npm audit --audit-level=high` limpio.
5. Añadir cortacircuitos/`AbortSignal.timeout` + shutdown `SIGTERM` ordenado + logger `pino` con redacción PII en rutas core y comprobar `/api/health` (DB + Redis + Aztec node).
6. Poner `eslint.ignoreDuringBuilds: false` y `typescript.ignoreBuildErrors: false` en `next.config.js:91-96`.
Al final (UNA sola vez): corre `npx tsc --noEmit` (filtrando primeros 40 errores si falla), `npm run lint`, y `npm run check:patterns && npm run check:routes`.
Actualiza `SESIÓN 3` en `EXECUTION_LEDGER.md`, haz commit y detente.
SESIÓN 4 — Refactor Modular de LedgerChatV2.tsx (9.881 líneas → Módulos < 350 líneas) (Modelo recomendado: Sonnet)
text
Lee ÚNICAMENTE:
1) `CLAUDE.md` y `EXECUTION_LEDGER.md`
2) La sección `4. PARTE III (III.2)` de `MASTER_PROMPT_5_ESTRELLAS.md`.
REGLA CRÍTICA DE TOKENS: ESTÁ PROHIBIDO leer `components/terminal/LedgerChatV2.tsx` completo en una llamada.
Paso 1: Ejecuta `git grep -n -E "^(export )?(function|const|interface|type|// ──|  const [a-zA-Z0-9_]+ = (useCallback|useState|useEffect|async))" components/terminal/LedgerChatV2.tsx` (o usa un script node corto de AST TypeScript) para imprimir el índice de bloques por líneas en <150 líneas.
Paso 2: Extrae en oleadas ordenadas leyendo SIEMPRE rangos acotados de máx 350 líneas cada vez:
  - Ola A: Estado global de chat en `modules/chat/state/useChatStore.ts` (Zustand con selectores granulares por `conversationId` para evitar re-renders globales).
  - Ola B: Hooks de motor XMTP (`useXmtpSession.ts`, `useMessageSync.ts`, `useMessageSender.ts`) y llamadas (`useCallEngine.ts`).
  - Ola C: Subcomponentes UI (`ConversationSidebar.tsx`, `MessageComposer.tsx`, `ChatThreadView.tsx`, `ChatModalsHost.tsx`) manteniendo `next/dynamic({ ssr: false })` en modales, pickers y paneles de pagos/comunidades.
  - Ola D: `LedgerChatV2.tsx` queda como ensamblador limpio < 300 líneas preservando exactamente todas las props de `ChatSurface.tsx` (`forceAutoInit`, `surfaceVisible`, `onRequestVisible`) y los exports que esperen los tests.
Tras extraer cada ola, valida compilación rápida con `npx tsc --noEmit`. Al terminar todas las olas, corre `npx vitest run test/unit/chat/ test/unit/xmtp/ test/unit/calls/ --reporter=dot`. Verifica que ningún archivo nuevo bajo `modules/chat/` supere las 350 líneas (`wc -l`).
Actualiza `SESIÓN 4` en `EXECUTION_LEDGER.md`, haz commit y detente.
SESIÓN 5 — Optimización Total PC + Móvil + WASM /prove + Minificación + WebRTC/XMTP (Modelo recomendado: Opus)
text
Lee ÚNICAMENTE:
1) `CLAUDE.md` y `EXECUTION_LEDGER.md`
2) La sección `5. PARTE IV` completa y `CON-11` de `MASTER_PROMPT_5_ESTRELLAS.md`.
REGLA DE EFICIENCIA: Aplica cambios por bloques lógicos, lee solo los archivos implicados (`next.config.js`, `app/layout.tsx`, `ClientLayout.tsx`, `MobileEnforcer.tsx`, `AntiTamperCore.tsx`, `lib/aztec/wallet/client.ts` secciones de prover/store, `CommunityReader.tsx`, `lib/calls/media.ts`, `config/appkit.tsx`, `public/sw.js`).
Objetivos obligatorios para que PC (Windows/macOS/Linux) y Móvil (iOS Safari, Android Chrome, MetaMask Mobile, PWA, Capacitor) funcionen 5★ sin fallos:
1. [IV.1 Bundle & CPU/Batería]
   - En `next.config.js:343-346`: re-activa la minificación en producción configurando Terser explícitamente seguro contra el TDZ circular de `wagmi/viem` en WebKit Safari (`safari10: true`, `collapse_vars: false`, `reduce_vars: false`, `concatenateModules: false`). Verifica el build real + bundle size de `/chat`.
   - En `MobileEnforcer.tsx:4`: elimina el import muerto de `MobileLanding`.
   - En `ClientLayout.tsx`: corrige orden/dependencias de `isChat` en `useEffect`, arregla la fuga del listener `battery.removeEventListener` con referencia estable, y separa `<Providers>` pesados para que rutas puramente documentales no los arrastren si no usan Web3.
   - En `AntiTamperCore.tsx`: elimina el loop infinito `requestAnimationFrame`, el `MutationObserver` sobre `style` en todo `document.body`, los cierres de sesión erráticos por mutaciones React y el bloqueo global de `contextmenu`/`dragstart`. Conserva únicamente protección legítima sin impacto en FPS/batería/accesibilidad.
2. [IV.2 WASM/PXE/OPFS Móvil & PC]
   - Implementa la arquitectura real de **Web Worker + ruta `/prove` con COOP/COEP (`app/prove/page.tsx` o worker aislado compatible)** aprovechando `SharedArrayBuffer` / WASM pthreads donde el navegador lo soporte, con fallback single-thread acotado para iOS Safari / in-app WebViews.
   - Asegura serialización strict single-flight, `backend.destroy()` al terminar o al expirar inactividad, Wake Lock API durante proving en móvil, pausa coordinada del dashboard live (`lib/dashboard/live.ts`) durante pruebas, y pre-detección temprana de soporte OPFS/Worker antes de solicitar firma en `lib/aztec/wallet/store.ts`.
   - Implementa `scripts/benchmark-proof-gen.ts` real (contra Aztec v6 / Token) y marca claramente en `docs/PROOF_BENCHMARKS.md` qué cifras son hardware-measured vs pendientes en teléfono físico (`CON-11`).
3. [IV.3 Viewport & Mobile Sign-in]
   - Sustituye el `MutationObserver` sobre `document.head` y el hack `scale=0.9` de `app/layout.tsx:360-382` por CSS responsive nativo (`font-size >= 16px` en inputs móviles, `100dvh`, `env(safe-area-inset-*)`, `KeyboardViewport` con `visualViewport`).
   - Revisa `config/appkit.tsx` para habilitar `ONE_CLICK_AUTH` de forma segura según configuración y asegura 0 bucles al volver de MetaMask Mobile (`metamask://` / `intent://`).
4. [IV.4 XMTP Outbox, Comunidades y WebRTC]
   - Sustituye el polling `setInterval(fetchPosts, 15_000)` en `components/communities/CommunityReader.tsx:268` por stream XMTP MLS (para MLS) + evento pausable/SSE (para legacy) que se detenga al quedar `hidden`.
   - Añade/verifica `iceRestart` automático al detectar cambio de red móvil (`online` / `iceconnectionstatechange` failed/disconnected) y compatibilidad Safari ↔ Chrome en `lib/calls/media.ts`.
   - Verifica `public/sw.js` (0 cacheo de `/api/*`, push ciego sin PII) y estado limpio de Capacitor/Electron.
Corre `npm run build` (comprueba minificación real + 0 errores TS/Lint), `npx vitest run test/unit/aztec/ test/unit/calls/ test/unit/dashboard/ --reporter=dot`, y pruebas WebKit disponibles en scripts (`settings-webkit` / `landing-webkit` si aplican localmente o valida compatibilidad en `playwright`).
Actualiza `SESIÓN 5` en `EXECUTION_LEDGER.md`, haz commit y detente.
SESIÓN 6 — Contratos Noir/Solidity Audit-Ready, PrivateFPC, Portal & R17 MLS (Modelo recomendado: Opus)
text
Lee ÚNICAMENTE:
1) `CLAUDE.md` y `EXECUTION_LEDGER.md`
2) La sección `6. PARTE V` (`V.1..V.4`) y `CON-01`, `CON-07` de `MASTER_PROMPT_5_ESTRELLAS.md`.
REGLA DE EFICIENCIA: No leas archivos JSON compilados en `contracts/**/target/`. Lee únicamente `.nr`, `.sol`, `.test.ts` y `lib/protocol/` / `lib/aztec/private-fees.ts` / `lib/portal/` / `docs/communities/R17_ACCEPTANCE.md`.
Objetivos obligatorios:
1. [V.1 Contratos Noir `contracts/aztec/`]:
   - Cierra pre-requisito auditoría **D-4**: reemplaza llamadas por selector crudo (`transfer_in_private`) en `PrivateEscrow.nr` y `PaymentStream.nr` por una interfaz/trait tipado v6.0.0 (si el toolchain local `aztec` está instalado, recompila desde dentro de cada crate y regenera `pin-artifacts.mjs`; si no hay binary `aztec` en Windows local, prepara el código exacto verificado para que el workflow `aztec-contracts.yml` recompile y documenta exactamente qué queda para CI Linux/Docker).
   - Añade tests property-based (fast-check ≥ 50.000 iteraciones en TypeScript mirroring + invariantes TXE) para `quote_protocol_fee`, unicidad de nulificadores y conservación de fondos.
   - Escribe `docs/audit/REPRODUCE_30MIN.md` (cierre **D-5**) para auditores externos Noir/Solidity y actualiza decisión explícita sobre `contracts/ZKIdentityRegistry.sol` (mover fuera de superficie activa si sigue `VerifierNotConnected()` o conectarle verificador real).
2. [V.2 `PrivateFPC`]: Revisa `lib/aztec/private-fees.ts` y `lib/aztec/wallet/client.ts` para asegurar gas bounds + fallback seguro + tests unitarios completos de flujo con `PrivateFPC` (manteniendo aviso público mientras esté `OFF` en Alpha hasta probarlo en Alpha controlada).
3. [V.3 Portal L1 ↔ L2]: Verifica `contracts/portal/HLPortal.sol`, `HLReceiver.sol`, `PortalToken.nr` con `npm run test:contracts`, `forge test` y `slither` (`npm run audit:prepare`). Completa el wiring UI paso-2 de retiros (`lib/portal/outbox.ts`) con guardas de direcciones sancionadas y mantén el despliegue Wave 2 bloqueado fail-closed hasta cierre de auditoría (`H2`).
4. [V.4 Comunidades R-17 + XMTP 2027]: Cierra los pendientes ingenieriles de `docs/communities/R17_ACCEPTANCE.md` (conectar `removeGroupMember` al expulsar, quitar `.skip` en `AC-03` si es automatizable con dos clientes en test harness, plan real de exportación JSON para miembros de comunidades legacy pre-24-Nov antes de cualquier borrado) y verifica pruebas unitarias de `SELF_HOSTED_MIGRATION` (`auth/jwks`).
Corre `npm run test:contracts`, `forge test --summary` (si está disponible `forge`), `npx vitest run test/unit/portal/ test/communities/ test/unit/aztec/ --reporter=dot`, y guarda resúmenes breves.
Actualiza `SESIÓN 6` en `EXECUTION_LEDGER.md`, haz commit y detente.
SESIÓN 7 — Unificación SSOT Total, Legal/RGPD Package & Gate Final 5★ (Modelo recomendado: Sonnet)
text
Lee ÚNICAMENTE:
1) `CLAUDE.md` y `EXECUTION_LEDGER.md`
2) La sección `3. PARTE II` (`CON-01..CON-11`), `7. PARTE VI` y `8. PARTE VII` de `MASTER_PROMPT_5_ESTRELLAS.md`.
REGLA DE EFICIENCIA: Ejecuta un barrido paralelo de verificación de consistencia y corre la suite gate final UNA SOLA VEZ recogiendo el resultado exacto de cada comando.
Objetivos obligatorios:
1. [SSOT Total (`CON-01..11`)]:
   - Corrige `app/layout.tsx:292,321` (JSON-LD: red Aztec Alpha mainnet real + email unificado).
   - Alinea `docs/ALPHA_COMPLETE_HANDOFF.md`, `docs/STATUS.md`, `docs/AZTEC_FOUNDATION_DOSSIER.md §0`, `deployments/aztec-mainnet.json` y `README.md` sobre comunidades MLS, cupos exactos (`closedAlpha: 50`, `cusdcBeta: 100`), HLC test token vs cUSDC y ausencia de auditoría externa hasta recibir informe (`H2`).
   - Actualiza `docs/antigravity/backlog.csv` generando estados auditables y reales vinculados a los commits y tests de las Sesiones 1–6 (cero `"Hecha"` sin verificación).
   - Construye/actualiza `scripts/verify-truth-consistency.ts` en CI para que falle si el JSON-LD, las marcas `"System Analytics"`/`"Humanity Ledger Foundation"`, cookies retiradas o rutas zombi regresan.
2. [Legal/RGPD/Gates (`VI.1..VI.7`)]:
   - Verifica/implementa `GET /api/user/export` (RGPD art. 20 portabilidad JSON completa autenticada por `requireWallet`).
   - Verifica script/cron de retención de logs ≤ 30 días y limpieza de tokens/notificaciones expiradas.
   - Sin modificar textos vinculantes de `lib/docs/pages/legal.ts` (regla OD-8), genera `docs/LEGAL_PATCH_PROPOSAL_SIGNED_NEEDED.md` con el texto parcheado exacto para cada desajuste listado en `docs/LEGAL_REVIEW_25NOV.md` + checklist accionable para que Stefan/abogado rellenen `H1..H6` y cierren los 9 gates de `CUSDC_GATES`.
3. [Verificación Gate Final 5★ (`PART VII`)]:
   Ejecuta en orden la matriz completa de verificación final (capturando códigos de salida y últimas 20 líneas de cada comando):
   - `npm run check:patterns && npm run check:routes && npm run check:copy && npm run check:artifacts && npx tsx scripts/check-traceability.ts && npx tsx scripts/aztec/check-sdk-single-version.mjs`
   - `npx tsc --noEmit && npm run lint && npm run build`
   - `npm run test:run && npm run test:contracts`
   - `npm audit --audit-level=high` y `gitleaks detect --no-banner`
   - Lighthouse CI Desktop + Mobile (`lighthouserc.json` y `lighthouserc.mobile.json`).
Emite un informe final 1-a-1 mapeando CADA ID de `MASTER_PROMPT_5_ESTRELLAS.md` con su evidencia verificada (`COMMIT + COMANDO PASS`) o bloqueador humano (`H1..H6`). Actualiza `EXECUTION_LEDGER.md` y cierra con el último commit.
5. RESUMEN RÁPIDO DE AHORRO ESPERADO
Práctica aplicada	Tokens sin optimizar	Con este protocolo	Reducción
Leer LedgerChatV2.tsx, target/*.json, archive/ y docs/	~280k tokens/sesión	~15k tokens (.claudeignore + AST slices)	~95%
Ejecutar todo en 1 conversación monolítica	Re-envío de 150k+ × 40 turnos + compactaciones	7 sesiones cortas (~35–55k pico cada una)	~75%
CLAUDE.md cacheable + prefix inmutable	Tarifa completa 100%	Prompt Cache hits (~90% dto. input prefix)	~70–90% en prefix
Tests dirigidos --reporter=dot vs logs completos vitest/build	~40k tokens en logs repetidos	~1.5k tokens	~96%
Resultado total	Alto riesgo de olvidar ítems a mitad	100% cobertura + máxima profundidad Opus solo donde aporta valor criptográfico	~75–85% menos consumo