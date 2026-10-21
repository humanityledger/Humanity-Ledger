# Humanity Ledger — Backlog de 400 tareas para Antigravity

Generado el 20 de octubre de 2026 sobre el commit `0dae01b`. Estado inicial de todas: Pendiente.

Reglas: una rama y un PR por tarea (`fix/<ID>-<slug>`), prueba que falla antes del cambio y pasa después, salida real de `tsc --noEmit`, `next lint`, `vitest run` y e2e pegada en el PR. Sin datos simulados, sin cabeceras de identidad, sin secretos por defecto, sin criptografía propia. Si una tarea no se puede hacer como está escrita, parar y explicarlo en el PR.

## Cómo se mide la nota

Pilar = hoy + (100 − hoy) × (peso de tareas "Hecha" ÷ peso total del pilar). Pesos: P0 = 4, P1 = 3, P2 = 2, P3 = 1. Nota global = media de SEG (hoy 35), MSG (40), ZK (15), SIM (28) y UI (70). El bloque J es puerta, no pilar. Topes: bloque A abierto → SEG ≤ 40; vulnerabilidad crítica o alta abierta → SEG ≤ 50; CI no verde (J-001 a J-005) → todos ≤ 80; J < 80 % → todos ≤ 85; sin B-039 → SEG ≤ 90; sin H-037 → ZK ≤ 90; sin G-014 → MSG ≤ 90. Recalcular con `python3 docs/antigravity/score.py docs/antigravity/backlog.csv`.

## A. Contención inmediata (25 tareas, pilar SEG)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| A-001 | Crear `requireWallet()`: identidad solo desde la sesión; traduce el UUID de email a la cartera vinculada (patrón de `api/user/profile` L84–94); 403 si no hay cartera | nuevo `lib/security/requireWallet.ts` | Pruebas unitarias: sesión SIWE → dirección; email con cartera → su cartera; email sin cartera → 403; sin sesión → 401 | P0 | Hecha |
| A-002 | N-02 en `chat/direct`: quitar `x-web3-address`, `x-verified-session-address` del cliente y `?address=` | `app/api/chat/direct/route.ts` L15–26, L95 | Con sesión de email y cabecera o `?address=` de otra cartera → 403 | P0 | Hecha |
| A-003 | N-02 en `chat/queue` | `app/api/chat/queue/route.ts` L17 | Misma prueba de suplantación → 403 | P0 | Hecha |
| A-004 | N-02 en `chat/contacts` (incluye `?address=` L34 y L55) | `app/api/chat/contacts/route.ts` | Misma prueba → 403; un usuario solo lee sus contactos | P0 | Hecha |
| A-005 | N-02 en `chat/communities` (`resolveCaller`) | `app/api/chat/communities/route.ts` L7–15 | Misma prueba → 403 | P0 | Hecha |
| A-006 | N-02 en `chat/communities/posts` (GET y POST) | `app/api/chat/communities/posts/route.ts` | No se puede publicar como otra cartera; prueba en CI | P0 | Hecha |
| A-007 | N-02 en `chat/communities/[id]/posts` y `[id]/analytics` | `app/api/chat/communities/[id]/**` | Misma prueba → 403 | P0 | Hecha |
| A-008 | N-02 en `communities/[slug]/join` y `communities/route.ts` | `app/api/communities/**` | Misma prueba → 403; `grep -rn "x-web3-address" app/api` vacío | P0 | Hecha |
| A-009 | N-01: `enclave-pin` resuelve el usuario solo con `getSession()`; quitar JWT sueltos, `x-wallet-address` y `system_handshake` | `app/api/auth/enclave-pin/route.ts` L87–130 | Sin sesión, GET/POST/PUT/DELETE → 401 | P0 | Hecha |
| A-010 | N-01: quitar los 4 secretos de respaldo del PIN; el servidor no arranca sin `ENCLAVE_PIN_PEPPER` y `ENCLAVE_PIN_SECRET` | `enclave-pin/route.ts` L21–34 | `grep "humanity-ledger-enclave"` vacío; arranque sin variables → error explícito | P0 | Hecha |
| A-011 | N-01: `DELETE` del PIN exige el PIN actual o un código de un solo uso enviado por email | `enclave-pin/route.ts` L473–500 | DELETE sin PIN ni código → 403 | P0 | Hecha |
| A-012 | N-01: el POST deja de crear un PIN nuevo cuando la cuenta no tiene ninguno; el alta es un flujo explícito | `enclave-pin/route.ts` L176–200 | POST a cuenta sin PIN → 404 `needsPinSetup` | P0 | Hecha |
| A-013 | N-01: `GET` nunca emite `clearanceToken` | `enclave-pin/route.ts` L277–311 | Respuesta de GET sin campo `clearanceToken` | P0 | Hecha |
| A-014 | Comparar `clearanceToken` en tiempo constante (`timingSafeEqual`) | `enclave-pin/route.ts` L403 | Sin comparaciones `===` de secretos en el archivo | P0 | Hecha |
| A-015 | Dejar de enviar `x-wallet-address` desde el cliente del PIN | `components/auth/TuringShieldGate.tsx` | `grep "x-wallet-address" components/auth` vacío | P0 | Hecha |
| A-016 | Middleware: borrar de toda petición entrante las cabeceras de identidad del cliente (`x-wallet-address`, `x-web3-address`, `x-verified-session-address`), también en rutas públicas | `middleware.ts` L204–212 | Prueba: la cabecera enviada por el cliente no llega al handler | P0 | Hecha |
| A-017 | N-04: quitar el respaldo `prisma db push --accept-data-loss` y salir con código 1 si la migración falla | `scripts/railway-pre-deploy.js` L123–159 | `grep -rn "accept-data-loss"` vacío; migración fallida → despliegue detenido | P0 | Hecha |
| A-018 | Quitar de `start.sh` la segunda ejecución del pre-despliegue, el `\|\| true` y `prisma generate` | `start.sh` | El contenedor solo arranca Next.js | P0 |
| A-019 | Resolver `0_init` en producción (`prisma migrate resolve --applied 0_init`) y sacar `add_clerk_id.sql` y `fix_clerk_id_all.sql` de `prisma/migrations/` | `prisma/migrations/` | `prisma migrate status` en Railway: "up to date" | P0 | Hecha |
| A-020 | Copia de seguridad completa de PostgreSQL y restauración probada antes de tocar migraciones | Railway | Restauración en una base temporal verificada y anotada | P0 | Hecha |
| A-021 | P-03: rotar usuario y contraseña de Redis; `production-pipeline.yml` usa `${{ secrets.REDIS_URL }}` | `.github/workflows/production-pipeline.yml` L135 | YAML válido; credencial nueva en Railway; la antigua deja de funcionar | P0 | Hecha |
| A-022 | Escaneo de secretos de todo el historial (clon completo con `gitleaks detect`) y rotación de todo lo encontrado | repositorio completo | Informe de gitleaks sin hallazgos vigentes | P0 | Hecha |
| A-023 | N-03: comprobar la pertenencia en el GET de mensajes de comunidad | `app/api/chat/communities/posts/route.ts` L84–106 | No miembro → 403 en comunidad privada | P0 | Hecha |
| A-024 | N-03: `orderBy desc`, `take 50` y cursor `before`/`since`; el cliente invierte el orden | `chat/communities/posts/route.ts`, `CommunityChatView.tsx` | El mensaje 201 aparece; prueba con 300 mensajes | P0 | Hecha |
| A-025 | P-02: la presencia usa la dirección de la sesión y solo se devuelve a contactos aceptados | `app/api/chat/presence/route.ts` L12–31 | No se puede marcar en línea a otra dirección; un no contacto recibe 403 | P0 | Hecha |

## B. Seguridad y autenticación (40 tareas, pilar SEG)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| B-001 | Modelo de amenazas (STRIDE) de autenticación, chat, comunidades, llamadas y pagos | nuevo `docs/security/threat-model.md` | Documento revisado; cada amenaza enlaza a una tarea o a un control existente | P1 | Pendiente |
| B-002 | Inventario automático de las 488 rutas: pública o no, mecanismo de auth, tablas que toca | nuevo `scripts/route-inventory.ts` → `docs/security/routes.csv` | La CI falla si aparece una ruta sin clasificar | P0 | Hecha |
| B-003 | Wrapper `withAuth(handler, { wallet, admin })` obligatorio en rutas no públicas, con regla de lint | nuevo `lib/security/withAuth.ts`, `.eslintrc` | La regla falla en una ruta sin wrapper | P1 | Pendiente |
| B-004 | Reducir `PUBLIC_PREFIXES` a rutas exactas (revisar `/api/auth/`, `/api/call/`, `/api/notifications/`, `/api/provenance/`, `/api/registry/`, `/api/humanidfi/`, `/api/settings`, `/api/user/profile`) | `middleware.ts` L40–95 | Cada entrada pública justificada en `routes.csv` | P0 | Pendiente |
| B-005 | `/api/dev/deploy` devuelve 404 en producción | `app/api/dev/deploy/route.ts` | Prueba con `NODE_ENV=production` → 404 | P0 | Hecha |
| B-006 | `/api/aztec/deploy-token`: solo administrador con sesión, comparación en tiempo constante y apagado en producción | `app/api/aztec/deploy-token/route.ts` | Sin sesión de admin → 401/403 | P0 | Hecha |
| B-007 | Una sola cookie de sesión HttpOnly (`hl_session`) en lugar de cinco (`ledger_session`, `human_session`, `humanity_session`, `human.access-token`, `human.session-token`) | `lib/session.ts`, `lib/jwt.ts`, rutas `app/api/auth/*` | `getSession()` lee una sola cookie; migración transparente de sesiones activas | P1 | Pendiente |
| B-008 | Eliminar `system_handshake` (escrituras y las 5 lecturas restantes, WAF incluido) | `verify-session`, `wallet/sync`, `forum/telemetry`, `bridge/generate`, `lib/security/waf-engine.ts` | `grep -rn system_handshake` solo en el borrado de cookies del logout | P0 | Pendiente |
| B-009 | Tokens de refresco rotatorios con detección de reutilización | `lib/session.ts`, Redis | Reutilizar un refresh antiguo revoca toda la familia; prueba | P1 | Pendiente |
| B-010 | Duraciones: acceso 15 min, refresco 30 días; "cerrar sesión en todos los dispositivos" | `lib/session.ts`, Ajustes | Prueba de expiración y revocación global | P1 | Pendiente |
| B-011 | SIWE: nonce en Redis con TTL de 10 min, de un solo uso; validar dominio y `chainId` | `app/api/siwe/nonce`, `app/api/siwe/verify` | Reutilizar un nonce → 401 | P0 | Pendiente |
| B-012 | Unificar las tres rutas de login con cartera (`app/api/siwe/*`, `app/api/auth/siwe/*`, `system-verify`) | `app/api/siwe`, `app/api/auth/siwe`, `app/api/auth/system-verify` | Una sola ruta; las demás devuelven 410 | P1 | Pendiente |
| B-013 | Código por email: hash del código, TTL 10 min, 5 intentos, límite por email e IP en Redis | `app/api/auth/send-code`, `verify-code` | El sexto intento → 429; el código no se guarda en claro | P0 | Pendiente |
| B-014 | Passkeys (WebAuthn) como login y como segundo factor | `app/api/auth/passkey` | Alta y login con passkey en Chrome y Safari | P2 | Pendiente |
| B-015 | CSRF: verificar `Origin` y `Sec-Fetch-Site` en toda mutación autenticada por cookie | `middleware.ts` | POST con `Origin` ajeno → 403 | P0 | Hecha |
| B-016 | N-05: una sola CSP con nonce por petición; el middleware fija `x-nonce`; quitar la CSP de `next.config.js` L385 | `middleware.ts` L300–304, `next.config.js`, `app/layout.tsx` L243 | Una sola cabecera CSP; cero errores de CSP en consola en /, /chat, /connect | P0 | Pendiente |
| B-017 | CSP sin `'unsafe-inline'` en `script-src`, también en rutas públicas como `/chat` | `middleware.ts` | Evaluación con CSP Evaluator sin avisos altos | P1 | Pendiente |
| B-018 | COOP y COEP solo en las rutas del prover | `middleware.ts` | Login con Google y WalletConnect funcionan; `crossOriginIsolated` true en /prove | P1 | Pendiente |
| B-019 | Cabeceras: HSTS con preload, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy` mínimos (cámara y micrófono solo `self`) | `middleware.ts`, `next.config.js` | securityheaders.com: nota A | P1 | Hecha |
| B-020 | N-06: Argon2id nativo (paquete `argon2`) o en `worker_threads`, con límite de concurrencia | `enclave-pin/route.ts` L35–46 | 50 verificaciones simultáneas no bloquean el event loop más de 50 ms | P0 | Pendiente |
| B-021 | Sal aleatoria de 16 bytes por usuario y pimienta como `secret` de Argon2 | `enclave-pin/route.ts`, `schema.prisma` | La pimienta cambia el hash (prueba) | P0 | Pendiente |
| B-022 | Migrar en el siguiente acierto los hashes HMAC antiguos a Argon2id y borrar la ruta antigua a los 30 días | `enclave-pin/route.ts` L50–76 | Contador de hashes antiguos en 0 antes de borrar | P1 | Pendiente |
| B-023 | P-01: decidir si el PIN protege datos (deriva la clave del almacén local cifrado) o se renombra a "bloqueo de pantalla" | `TuringShieldGate.tsx`, textos | Decisión documentada; ningún texto promete "enclave" si no hay cifrado | P0 | Pendiente |
| B-024 | Limitador de peticiones en Redis (ventana deslizante) por IP y por cuenta | `middleware.ts` L100–130 | El límite se cumple con 3 réplicas (prueba) | P0 | Pendiente |
| B-025 | Límites por acción: auth 10/min, envío de mensajes 60/min, creación de comunidades 5/h, PIN 8 cada 5 min | rutas afectadas | Pruebas de 429 por acción | P1 | Pendiente |
| B-026 | Validación con `zod` del body y la query en todas las rutas con entrada | `app/api/**` | Script: ninguna ruta lee `req.json()` sin esquema | P1 | Pendiente |
| B-027 | Límite de tamaño de body por ruta (hoy `chat/direct` acepta 10 MB) | `app/api/**` | Body de 2 MB en ruta de texto → 413 | P1 | Pendiente |
| B-028 | DOMPurify también en SSR (`isomorphic-dompurify`) y hook registrado una sola vez | `hooks/useSanitizer.ts` | `<img/src=x/onerror=alert(1)>` se limpia en servidor (prueba) | P0 | Pendiente |
| B-029 | Mermaid con `securityLevel: 'strict'` | `components/privacy/MermaidDiagram.tsx` L94 | Diagrama con script incrustado no se ejecuta | P1 | Pendiente |
| B-030 | Revisar los 10 usos de `dangerouslySetInnerHTML`: cada uno sanitizado o literal | `components/**`, `app/layout.tsx` | Lista en el PR con la justificación de cada uno | P1 | Pendiente |
| B-031 | Protección SSRF en todo `fetch` a URLs del usuario (vistas previas de enlaces, avatares) | `LedgerLinkPreview.tsx` y su API | URL a `169.254.169.254` o red privada → rechazada | P0 | Hecha |
| B-032 | Subidas: tipo por bytes mágicos, tamaño máximo, nombres aleatorios, nunca servir HTML | rutas de subida | Subir un .html renombrado a .png → rechazado | P1 | Pendiente |
| B-033 | La identidad nunca se lee de cabeceras de entrada; solo la resuelve el servidor | `lib/security/resolveCaller.ts` | `resolveVerifiedCaller` sin rama de cabecera | P0 | Hecha |
| B-034 | Logs sin datos personales: cambiar los 535 `console.log` por un logger con redacción | `app/`, `components/`, `lib/` | `grep -c console.log` < 20; ningún log con email o dirección completa | P1 | Pendiente |
| B-035 | Fusionar o cerrar las 7 PR de Dependabot; `npm audit` sin altas ni críticas | `package.json` | `npm audit --audit-level=high` sale con 0 | P0 | Pendiente |
| B-036 | Versiones exactas (sin `^`) en dependencias de seguridad y en `@aztec/*` | `package.json` | Ninguna nightly con rango | P1 | Pendiente |
| B-037 | `lib/env.ts` con `zod`: el arranque falla si falta un secreto; sin valores por defecto en el código | nuevo `lib/env.ts` | `grep "change-in-prod"` vacío; arranque sin `JWT_SECRET` → error | P0 | Hecha |
| B-038 | Un secreto por propósito (JWT, PIN, salas de llamada, TURN); nunca derivar uno de otro ni de `DATABASE_URL` | `lib/env.ts`, rutas que usan secretos | Revisión: ninguna derivación cruzada | P0 | Pendiente |
| B-039 | Pentest externo de auth, chat, comunidades y pagos antes de la beta pública | proveedor externo | Informe recibido; críticos y altos cerrados y reprobados | P1 | Pendiente |
| B-040 | Programa de divulgación responsable: `SECURITY.md`, `/.well-known/security.txt` y bug bounty | `SECURITY.md`, `public/.well-known/security.txt` | Publicado con correo, plazos y alcance | P1 | Hecha |

## C. Datos y base de datos (20 tareas, pilar SEG)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| C-001 | La CI comprueba que el esquema coincide con las migraciones (`prisma migrate diff --exit-code`) | `.github/workflows/ci.yml` | Un cambio de esquema sin migración hace fallar la CI | P0 | Pendiente |
| C-002 | Borrar las filas en claro antiguas de `DirectMessage` y `PendingChatMessage`, con aviso previo al usuario (decisión del propietario: borrar o exportar y borrar) | migración nueva | 0 filas con contenido en claro | P0 | Pendiente |
| C-003 | Eliminar las tablas `DirectMessage` y `PendingChatMessage` y sus rutas | `schema.prisma`, `app/api/chat/direct`, `app/api/chat/queue` | Las rutas devuelven 410; tablas eliminadas por migración | P1 | Pendiente |
| C-004 | Índice `@@index([communityId, channelId, createdAt])` en `CommunityPost` | `schema.prisma` | `EXPLAIN` de la consulta de mensajes usa el índice | P0 | Pendiente |
| C-005 | Ningún `findMany` sin `take`; máximo 100 por página | `app/api/**` | Script de revisión: 0 `findMany` sin `take` | P1 | Pendiente |
| C-006 | `EXPLAIN ANALYZE` de las 20 consultas más frecuentes; todas usan índice | `docs/db/explain.md` | Informe en el repositorio | P1 | Pendiente |
| C-007 | `connection_limit` y `pool_timeout` en `DATABASE_URL`, con PgBouncer en modo transaction | Railway | Con 10 réplicas, conexiones < 80 % de `max_connections` | P0 | Pendiente |
| C-008 | Réplica de lectura para analíticas e historiales cuando se superen 5.000 usuarios conectados | Railway, `lib/prisma.ts` | Consultas de lectura pesadas enrutadas a la réplica | P2 | Pendiente |
| C-009 | Caducidad automática: notificaciones > 90 días, sesiones expiradas, nonces y códigos de un solo uso | tarea programada | Tablas sin filas caducadas tras la ejecución | P1 | Pendiente |
| C-010 | Copias diarias y restauración de prueba mensual documentada | Railway, `docs/runbooks/backup.md` | Última restauración con fecha en el runbook | P0 | Pendiente |
| C-011 | Cifrado en reposo de volúmenes y copias verificado | Railway | Confirmación por escrito del proveedor | P2 | Pendiente |
| C-012 | Retirar modelos Prisma sin uso (de los 98), empezando por `CosmicEntity` | `schema.prisma`, `lib/prisma.ts` | Informe de uso; modelos sin consumidor eliminados | P2 | Pendiente |
| C-013 | Quitar los casts `(prisma as any)` regenerando y tipando el cliente | `app/api/**` | 0 `(prisma as any)` | P1 | Pendiente |
| C-014 | Transacciones en operaciones de varias tablas (aceptar contacto, unirse a comunidad, borrar cuenta) | rutas afectadas | Fallo a mitad → sin estado parcial (prueba) | P1 | Pendiente |
| C-015 | Idempotencia en altas repetidas (claves únicas + `upsert` o clave de idempotencia) | rutas de creación | Reintento doble → un solo registro | P1 | Pendiente |
| C-016 | Borrado de cuenta en una transacción, con registro de auditoría sin datos personales | `app/api/user/nuke` | Prueba: tras el borrado no queda fila con la dirección | P0 | Pendiente |
| C-017 | Exportación de datos del usuario en JSON (RGPD art. 20) | nueva `app/api/user/export` | Descarga con todos los datos del servidor del usuario | P1 | Pendiente |
| C-018 | Semillas de desarrollo separadas; nunca se ejecutan en producción | `prisma/seed.ts`, scripts | Guardia: el seed aborta si `NODE_ENV=production` | P1 | Pendiente |
| C-019 | Redis: persistencia configurada, claves con prefijo y todas con caducidad | Railway, `lib/redis` | `SCAN` sin claves sin TTL fuera de las listadas | P1 | Pendiente |
| C-020 | Alerta de tamaño de base y crecimiento por tabla | monitor | Alerta al superar el umbral configurado | P2 | Pendiente |

## D. Mensajería cifrada (XMTP) (40 tareas, pilar MSG)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| D-001 | Borrar el bucle de 4 s a `/api/chat/direct` y la función vacía `syncOfflineQueue` | `LedgerChatV2.tsx` L2809–2949, `lib/xmtp/client.ts` L838 | Con el chat abierto, 0 peticiones periódicas a `/api/chat/direct` | P0 | Pendiente |
| D-002 | Entrega solo por el stream de XMTP con reconexión exponencial | `lib/xmtp/client.ts` L693–790, `LedgerChatV2.tsx` L2969 | Un DM llega en < 1 s; tras cortar la red, el stream se recupera solo | P0 | Pendiente |
| D-003 | Al volver la conexión o el foco: `conversations.sync()` y recuperar lo perdido | `lib/xmtp/client.ts` | Mensajes enviados durante 5 min sin red aparecen al volver | P0 | Pendiente |
| D-004 | Fijar la versión exacta de `@xmtp/browser-sdk` y documentar cómo actualizarla | `package.json`, `docs/protocol.md` | Sin `^`; nota de versión | P1 | Pendiente |
| D-005 | Verificar si la versión del SDK protege los mensajes Welcome con criptografía postcuántica y documentar qué es y qué no es postcuántico | `docs/protocol.md` | Documento con la evidencia (changelog o código del SDK) | P1 | Pendiente |
| D-006 | Gestionar instalaciones XMTP desde Ajustes: listar y revocar | `LedgerSettingsFull.tsx`, `revokeXMTPInstallations` | Revocar una instalación la deja sin acceso (prueba con dos navegadores) | P1 | Pendiente |
| D-007 | Mensaje claro al alcanzar el límite de instalaciones de XMTP | `lib/xmtp/client.ts` | Prueba simulando el error | P2 | Pendiente |
| D-008 | Solicitudes de desconocidos en bandeja aparte (estados de consentimiento de XMTP) | lista de conversaciones | Un desconocido no aparece en la bandeja principal | P1 | Pendiente |
| D-009 | Bloquear y denunciar usuario (consentimiento denegado + denuncia local) | perfil de contacto | Un bloqueado no puede escribir (prueba) | P1 | Pendiente |
| D-010 | Cola de salida local en IndexedDB con reintentos y estados (enviando, enviado, fallido) | nuevo `lib/chat/outbox.ts` | Enviar sin red y reconectar → entregado una sola vez | P1 | Pendiente |
| D-011 | Confirmaciones de lectura como tipo de contenido XMTP, desactivables | compositor, Ajustes | Desactivadas → no se envían (prueba) | P2 | Pendiente |
| D-012 | Indicador de escritura efímero por XMTP, sin servidor | `useLedgerChatPresence.ts` | 0 peticiones al servidor al escribir | P2 | Pendiente |
| D-013 | Editar mensaje con marca "editado" | compositor, `MessageBubble.tsx` | Ambos lados ven la versión nueva | P1 | Pendiente |
| D-014 | Borrar para todos, con límite de tiempo | `MessageBubble.tsx` | El receptor deja de ver el mensaje | P1 | Pendiente |
| D-015 | Respuestas citadas coherentes en DM y grupos (tipo de contenido reply) | `MessageBubble.tsx` | Prueba en ambos tipos de chat | P2 | Pendiente |
| D-016 | Reacciones como tipo de contenido XMTP, sin PATCH al servidor | `CommunityMessageReactions.tsx` L115 | 0 peticiones al servidor al reaccionar en privado | P1 | Pendiente |
| D-017 | Adjuntos cifrados en el cliente (remote attachment) en almacenamiento de objetos, máximo 100 MB | nuevo `lib/chat/attachments.ts` | El objeto almacenado no se puede leer sin la clave | P1 | Pendiente |
| D-018 | Onda real en notas de voz: picos calculados al grabar y enviados con la nota | `CustomAudioPlayer.tsx` L113–116, `LedgerChatVoiceNote.tsx` | Dos notas distintas muestran ondas distintas | P1 | Pendiente |
| D-019 | Mensajes efímeros con temporizador: borrado local y aviso de caducidad | `BurnTimerSheet.tsx` | El mensaje desaparece en ambos dispositivos al vencer | P2 | Pendiente |
| D-020 | Búsqueda local de mensajes con índice cifrado en el dispositivo | nuevo `lib/chat/search.ts` | Buscar en 10.000 mensajes en < 200 ms | P2 | Pendiente |
| D-021 | Historial paginado y virtualizado | `VirtualizedMessageList.tsx` | Memoria estable al hacer scroll por 10.000 mensajes | P1 | Pendiente |
| D-022 | Sincronizar historial entre instalaciones (history sync de XMTP) | `lib/xmtp/client.ts` | Un dispositivo nuevo ve el historial | P2 | Pendiente |
| D-023 | Vincular dispositivo por QR sin enviar semilla al servidor (sustituye `qr-sync-seed`) | `app/api/auth/qr-*`, `LedgerSettingsFull.tsx` | El servidor no recibe ningún material de clave | P1 | Pendiente |
| D-024 | Copia de seguridad cifrada del historial local exportable con contraseña | Ajustes | Restaurar en otro navegador recupera el historial | P2 | Pendiente |
| D-025 | Notificaciones push sin contenido (solo despiertan la app) | service worker, `app/api/notifications` | El payload no contiene texto del mensaje | P1 | Pendiente |
| D-026 | Nombres ENS y handles cacheados con caducidad, mostrando la dirección verificada | `LedgerChatProfile.tsx` | Cambiar el ENS se refleja al caducar la caché | P2 | Pendiente |
| D-027 | Verificación de seguridad: comparar huellas de instalación del contacto | `ContactInfoPanel.tsx` | Código mostrado igual en ambos dispositivos | P2 | Pendiente |
| D-028 | Indicador de estado de red XMTP con estados reales | `LedgerChatNetworkBadge.tsx` | Desconectar la red cambia el estado en < 5 s | P2 | Pendiente |
| D-029 | Respetar los límites de XMTP (20.000 lecturas y 3.000 escrituras por 5 min) con backoff y medición | `lib/xmtp/client.ts` | Prueba de carga del cliente sin 429 en uso normal | P1 | Pendiente |
| D-030 | Prueba e2e de DM entre dos navegadores: < 1 s y sin peticiones al servidor propio | `e2e/dm.spec.ts` | Pasa en CI | P0 | Pendiente |
| D-031 | Prueba e2e: ningún texto de mensaje llega a `/api/*` (interceptando la red) | `e2e/no-plaintext.spec.ts` | Pasa en CI | P0 | Pendiente |
| D-032 | Dividir `LedgerChatV2.tsx` (6.982 líneas) en módulos de < 500 líneas | `components/terminal/LedgerChatV2.tsx` | Ningún archivo del chat > 500 líneas; e2e sigue en verde | P1 | Pendiente |
| D-033 | Borrar el código muerto `LedgerChat.tsx` (5.968 líneas) | `components/terminal/LedgerChat.tsx` | Build verde sin el archivo | P0 | Pendiente |
| D-034 | Estado del chat en un store con selectores; sin efectos duplicados | nuevo `store/chat.ts` | React Profiler: un mensaje nuevo re-renderiza solo su hilo | P2 | Pendiente |
| D-035 | Abrir un chat con 10.000 mensajes en < 1 s | lista de mensajes | Medición en CI con datos sintéticos | P2 | Pendiente |
| D-036 | Accesibilidad del chat: roles ARIA, foco y anuncio de mensajes nuevos | componentes del chat | Revisión con VoiceOver y NVDA | P1 | Pendiente |
| D-037 | @menciones con autocompletado y notificación | compositor | La mención notifica al mencionado | P2 | Pendiente |
| D-038 | Fijar mensajes en DM y grupos | `MessageBubble.tsx` | El mensaje fijado aparece arriba en ambos lados | P2 | Pendiente |
| D-039 | Reenviar con marca "reenviado" | `MessageBubble.tsx` | La marca aparece en el destino | P3 | Pendiente |
| D-040 | Mensajes programados desde el dispositivo, avisando si debe estar encendido | `ScheduleMessageSheet.tsx` | Se envía a la hora con la app abierta; aviso visible | P3 | Pendiente |

## E. Comunidades (30 tareas, pilar MSG)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| E-001 | Decisión documentada: comunidades privadas = grupos XMTP (MLS); públicas = servidor, con la etiqueta visible "Pública, no cifrada" | `docs/product/communities.md` | Documento aprobado; etiqueta visible en la UI | P0 | Pendiente |
| E-002 | Crear una comunidad privada crea su grupo XMTP; los miembros entran por su inbox | `CreateGroupModal.tsx`, `CommunityView.tsx` | El servidor no guarda mensajes de comunidades privadas | P0 | Pendiente |
| E-003 | Canales privados como un grupo MLS por canal | `CommunityView.tsx` | Un miembro sin acceso al canal no descifra sus mensajes | P1 | Pendiente |
| E-004 | Documentar el límite de miembros de un grupo XMTP y qué ocurre al superarlo | `docs/product/communities.md` | Límite con fuente y comportamiento definido | P1 | Pendiente |
| E-005 | Comunidades públicas: pertenencia comprobada, paginación por cursor y ninguna etiqueta de "cifrado" falsa | `app/api/chat/communities/**` | Pruebas de pertenencia y paginación | P0 | Pendiente |
| E-006 | Corregir el comentario del esquema `CommunityPost` que dice "ENCRYPTED CIPHERTEXT" | `schema.prisma` L1671–1673 | Comentario fiel a lo que se guarda | P1 | Pendiente |
| E-007 | Un solo campo de contenido sanitizado (quitar `contentHtml` duplicado) | `CommunityChatView.tsx` L761–762, `schema.prisma` | Una sola copia por mensaje | P2 | Pendiente |
| E-008 | Tiempo real por SSE con Redis pub/sub; quitar los sondeos de 3 s y 6 s | `CommunityChatView.tsx` L721, `CommunityView.tsx` L281 | Con la comunidad abierta, 0 GET periódicos | P0 | Pendiente |
| E-009 | Roles en servidor (propietario, admin, moderador, miembro) con matriz de permisos por acción | `schema.prisma`, nuevo `lib/communities/permissions.ts` | Pruebas por rol y acción | P1 | Pendiente |
| E-010 | Comprobar permisos en cada ruta de comunidad (posts, members, invite, gate, proposals, analytics) | `app/api/chat/communities/[id]/**` | Un miembro sin permiso → 403 en cada acción | P0 | Pendiente |
| E-011 | Invitaciones con token firmado, de un solo uso, caducidad y revocación | `app/api/chat/communities/[id]/invite`, `app/join/[code]` | Token usado o revocado → rechazado | P1 | Pendiente |
| E-012 | Expulsar y banear: quita del grupo MLS y del servidor | `CommunityMemberPanel.tsx` | El expulsado deja de recibir mensajes nuevos | P1 | Pendiente |
| E-013 | Registro de moderación visible para administradores | nuevo modelo `ModerationLog` | Cada acción queda registrada con autor y fecha | P2 | Pendiente |
| E-014 | Modo lento por canal | `CommunitySettingsPanel.tsx` | Enviar antes del intervalo → bloqueado en servidor | P2 | Pendiente |
| E-015 | Antispam: límite de altas por minuto y enlaces de miembros nuevos retenidos | rutas de unión y publicación | Prueba de 100 altas por minuto → limitadas | P2 | Pendiente |
| E-016 | Denuncias de contenido con cola de moderación | nuevo `app/api/communities/reports` | Una denuncia llega a la cola de los moderadores | P1 | Pendiente |
| E-017 | Reacciones sin actualización optimista que no se revierte (hoy el error se ignora) | `CommunityMessageReactions.tsx` L105–125 | Fallo del servidor → la reacción se deshace | P2 | Pendiente |
| E-018 | Hilos en comunidades con contador de respuestas | `CommunityChatView.tsx` | Contador correcto tras responder | P2 | Pendiente |
| E-019 | Encuestas con un voto por miembro garantizado en servidor (restricción única) | `PollBubble`, esquema | Votar dos veces → un solo voto | P1 | Pendiente |
| E-020 | Canal de anuncios de solo lectura para miembros | `CommunityView.tsx` | Un miembro no puede publicar en anuncios | P2 | Pendiente |
| E-021 | Arreglar las publicaciones fijadas (`pinned=true`) | `CommunityMessageReactions.tsx` L190, API | Fijar y desfijar funcionan | P2 | Pendiente |
| E-022 | Búsqueda en comunidades públicas con texto completo de PostgreSQL | API de comunidades | Búsqueda en 100.000 mensajes en < 300 ms | P3 | Pendiente |
| E-023 | Descubrimiento de comunidades públicas paginado y moderado | `LedgerCommunitiesTab.tsx` | Paginación y ocultación de comunidades denunciadas | P2 | Pendiente |
| E-024 | Acceso por token verificado en cadena en el servidor, con caché | `app/api/chat/communities/[id]/gate` | Un cliente que miente sobre su saldo no entra | P1 | Pendiente |
| E-025 | Analíticas de comunidad agregadas, sin direcciones individuales | `CommunityAnalytics.tsx`, API | La respuesta no contiene direcciones | P2 | Pendiente |
| E-026 | Notificaciones de comunidad configurables (todas, menciones, ninguna) | Ajustes de comunidad | Respetadas en push y en la app | P2 | Pendiente |
| E-027 | Borrar una comunidad borra sus datos del servidor y disuelve el grupo | API de comunidades | 0 filas tras el borrado | P1 | Pendiente |
| E-028 | Prueba: un no miembro recibe 403 en las 8 rutas de comunidad | `tests/api/communities.test.ts` | Pasa en CI | P0 | Pendiente |
| E-029 | Prueba: una comunidad con 10.000 mensajes carga los últimos 50 en < 300 ms | `tests/perf/communities.test.ts` | Pasa en CI | P1 | Pendiente |
| E-030 | Migración de comunidades privadas existentes con texto en claro: aviso y opción de migrar o archivar | migración + UI | 0 comunidades privadas con texto en claro en el servidor | P0 | Pendiente |

## F. Llamadas (25 tareas, pilar MSG)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| F-001 | Elegir el SFU: LiveKit Cloud o LiveKit propio en un servidor con UDP (Railway no admite UDP entrante) | `docs/infra/calls.md` | Decisión con coste estimado | P0 | Pendiente |
| F-002 | `POST /api/call/token`: sesión + pertenencia + JWT de LiveKit válido 10 min | nueva `app/api/call/token` | Sin sesión → 401; sin pertenencia → 403 | P0 | Pendiente |
| F-003 | Reescribir `GroupPartyCall.tsx` con `livekit-client` (simulcast de 3 capas, orador activo) | `components/chat/GroupPartyCall.tsx` | Se ven y oyen los demás participantes | P0 | Pendiente |
| F-004 | Borrar `/api/chat/group-call/join` y `leave` (solo hacen `console.log`) | `app/api/chat/group-call/**` | Rutas eliminadas | P0 | Pendiente |
| F-005 | Cifrado de extremo a extremo en llamadas (E2EE de LiveKit) con la clave repartida por el grupo XMTP | `GroupPartyCall.tsx` | Un cliente sin clave no decodifica el audio | P1 | Pendiente |
| F-006 | Rotar la clave de la llamada cuando entra o sale alguien | `GroupPartyCall.tsx` | El que sale no descifra lo posterior | P1 | Pendiente |
| F-007 | Reconexión automática al cambiar de Wi-Fi a 4G | `GroupPartyCall.tsx` | La llamada sigue tras el cambio de red | P1 | Pendiente |
| F-008 | Llamadas 1:1 con TURN propio y credenciales HMAC temporales; quitar las 29 referencias a `openrelayproject` | `LedgerChatV2.tsx` L1431–1445, `lib/engine/WebRTCEngine.ts` | `grep openrelay` vacío | P0 | Pendiente |
| F-009 | Ajuste de privacidad: todo por TURN (`iceTransportPolicy: 'relay'`) para no revelar la IP | Ajustes de llamadas | Con el ajuste activo, sin candidatos host ni srflx | P2 | Pendiente |
| F-010 | Compartir pantalla en llamadas de grupo | `GroupPartyCall.tsx` | Pantalla visible para los demás | P2 | Pendiente |
| F-011 | Supresión de ruido y cancelación de eco | restricciones de audio | Prueba manual documentada | P2 | Pendiente |
| F-012 | Indicador de calidad de red por participante | `GroupPartyCall.tsx` | El indicador cambia al limitar el ancho de banda | P3 | Pendiente |
| F-013 | Moderación en llamada (silenciar, expulsar) según permisos de comunidad | `GroupPartyCall.tsx`, token | Solo un moderador puede expulsar | P2 | Pendiente |
| F-014 | Salas de voz permanentes en comunidades | `CommunityView.tsx` | Entrar y salir sin crear sala nueva | P2 | Pendiente |
| F-015 | Límite de participantes configurable y modo escenario para salas grandes | token de LiveKit | Superado el límite, el siguiente entra como oyente | P2 | Pendiente |
| F-016 | Llamada entrante fiable con push y pantalla de llamada | `IncomingCallOverlay.tsx` | La llamada suena con la app en segundo plano (móvil) | P1 | Pendiente |
| F-017 | Historial de llamadas solo local, sin metadatos en el servidor | `LedgerChatCallHistory.tsx` | El servidor no guarda quién llamó a quién | P2 | Pendiente |
| F-018 | Grabación desactivada por defecto; si se activa, aviso a todos | LiveKit | Aviso visible al iniciar una grabación | P3 | Pendiente |
| F-019 | Código de verificación visible en llamadas 1:1 cifradas | pantalla de llamada | Mismo código en ambos lados | P3 | Pendiente |
| F-020 | Prueba: 8 participantes desde 3 redes distintas, 10 min sin cortes | informe de prueba | Informe con fecha y resultados | P0 | Pendiente |
| F-021 | Prueba: conecta detrás de un NAT simétrico (por TURN) | informe de prueba | Conexión establecida | P1 | Pendiente |
| F-022 | Métricas: conexión con éxito > 98 % y tiempo de conexión < 3 s | panel de métricas | Medido durante una semana de beta | P1 | Pendiente |
| F-023 | Presupuesto mensual de minutos de LiveKit con alertas | panel del proveedor | Alerta al 80 % del presupuesto | P2 | Pendiente |
| F-024 | Unificar o borrar `WebRTCEngine` si las llamadas 1:1 pasan a LiveKit | `lib/engine/WebRTCEngine.ts` | Un solo motor de llamadas | P2 | Pendiente |
| F-025 | Unificar `GroupCallRoom`, `GroupPartyCall` y `LedgerCallsTab` en un solo componente de llamada | `components/chat/*Call*` | Un componente; los demás eliminados | P2 | Pendiente |

## G. Escala, tiempo real e infraestructura (30 tareas, pilar MSG)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| G-001 | Canal SSE único por usuario (`/api/events`) para notificaciones, solicitudes y presencia, con Redis pub/sub | nueva `app/api/events`, `lib/realtime` | Un evento publicado llega al cliente en < 1 s | P0 | Pendiente |
| G-002 | Quitar el sondeo de `contacts/request` cada 10 s | `LedgerChatV2.tsx` L3825, `ContactRequestsPanel.tsx` L55 | 0 GET periódicos a esa ruta | P0 | Pendiente |
| G-003 | Quitar el sondeo de `notifications/inbox` cada 30 s | `LedgerChatV2.tsx` L817 | 0 GET periódicos a esa ruta | P0 | Pendiente |
| G-004 | Presencia en Redis con caducidad de 60 s; ninguna escritura en PostgreSQL | `app/api/chat/presence`, `useLedgerChatPresence.ts` | 0 `upsert` de `userMetrics` por presencia | P0 | Pendiente |
| G-005 | Pausar todo trabajo periódico con la pestaña oculta (`visibilitychange`) | hooks y componentes con temporizadores | Pestaña oculta → 0 peticiones periódicas | P1 | Pendiente |
| G-006 | Auditar los 176 `setInterval`: borrar los innecesarios; los que queden, ≥ 60 s y pausables | todo el cliente | Informe; ningún intervalo de red < 60 s | P1 | Pendiente |
| G-007 | Al menos 2 réplicas web con health check y despliegue sin caída | Railway | Desplegar durante una prueba de carga sin errores 5xx | P1 | Pendiente |
| G-008 | Comprobar el comportamiento de SSE con varias réplicas de Railway (afinidad o reconexión) | `lib/realtime` | Prueba con 3 réplicas sin pérdida de eventos | P1 | Pendiente |
| G-009 | Separar los workers (colas, tareas programadas) del servicio web | `ecosystem.config.json`, Railway | Servicio `worker` aparte | P2 | Pendiente |
| G-010 | CDN para estáticos (`/_next/static`) con caché inmutable | Railway / CDN | Cabecera `immutable` y aciertos de caché | P2 | Pendiente |
| G-011 | Imágenes optimizadas con `next/image` y límites de tamaño | componentes con imágenes | 0 `<img>` sin dimensiones en páginas del núcleo | P2 | Pendiente |
| G-012 | Caché en Redis de lecturas públicas (perfiles, comunidades públicas) con invalidación | rutas públicas | Aciertos de caché > 80 % | P2 | Pendiente |
| G-013 | Prueba de carga k6 con 50.000 clientes conectados simulados: p95 < 300 ms | `load/k6/chat.js` | Informe en el repositorio | P0 | Pendiente |
| G-014 | Prueba de carga con 200.000 clientes antes de anunciar el millón | `load/k6/` | Informe con techo medido | P1 | Pendiente |
| G-015 | Presupuesto de rendimiento por ruta en CI (k6 ligero) | `.github/workflows/perf.yml` | Una regresión > 20 % hace fallar la CI | P2 | Pendiente |
| G-016 | Límite de conexiones SSE por réplica y control de presión | `lib/realtime` | Al superar el límite, rechazo ordenado y reconexión | P2 | Pendiente |
| G-017 | Plan de capacidad con techo medido y coste por cada 100.000 usuarios | `docs/infra/capacity.md` | Documento con datos de G-013 | P1 | Pendiente |
| G-018 | Alertas de CPU, memoria y egreso en Railway | Railway | Alerta de prueba recibida | P1 | Pendiente |
| G-019 | Evaluar una segunda región de Railway para latencia en EE. UU. | `docs/infra/regions.md` | Medición de latencia desde ambas regiones | P3 | Pendiente |
| G-020 | Apagado ordenado: cerrar SSE y drenar peticiones con SIGTERM | servidor | Despliegue sin errores visibles para el cliente | P2 | Pendiente |
| G-021 | Timeouts, reintentos y cortacircuitos en llamadas externas (RPC, XMTP, Aztec) | `lib/http` | La caída simulada de un proveedor no bloquea la app | P1 | Pendiente |
| G-022 | Pedir a XMTP por escrito la capacidad y el precio de su red descentralizada para 12 millones de mensajes al día | correo a XMTP | Respuesta archivada | P0 | Pendiente |
| G-023 | Financiar una pasarela XMTP y migrar al SDK compatible con la red descentralizada | `package.json`, configuración | Mensajes enviados por la pasarela en testnet | P1 | Pendiente |
| G-024 | Plan de contingencia si XMTP cae: aviso visible y cola local | `docs/runbooks/xmtp.md`, UI | Simulacro documentado | P2 | Pendiente |
| G-025 | Imagen Docker mínima, usuario no root y sin herramientas de compilación en ejecución | `Dockerfile` | Escáner de imagen sin vulnerabilidades altas | P1 | Pendiente |
| G-026 | Reducir el bundle: análisis y carga diferida de Three.js y de los módulos Aztec | `next.config.js`, imports | Bundle de `/chat` < 300 KB gzip | P1 | Pendiente |
| G-027 | Arranque del contenedor en < 30 s | `start.sh`, `Dockerfile` | Medido en Railway | P2 | Pendiente |
| G-028 | `railway.toml` con un solo `preDeployCommand` y health check que comprueba base y Redis | `railway.toml`, `/api/health` | Health check falla si cae la base | P1 | Pendiente |
| G-029 | Entorno de staging en Railway igual a producción, con datos sintéticos | Railway | Cada PR se despliega en staging | P1 | Pendiente |
| G-030 | Rollback en un clic probado | Railway | Simulacro de rollback documentado | P1 | Pendiente |

## H. Pagos privados con Aztec (40 tareas, pilar ZK)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| H-001 | Decidir dónde viven las claves Aztec: cartera externa o PXE en el navegador | `docs/zk/architecture.md` | Decisión documentada | P0 | Pendiente |
| H-002 | Fijar versiones estables exactas de `@aztec/*` (hoy `^6.0.0-nightly`) | `package.json` | Sin nightly ni rangos | P0 | Pendiente |
| H-003 | Borrar `@noir-lang/backend_barretenberg` y `lib/zk/NoirClientProver.ts` | `package.json`, `lib/zk/` | Build verde sin ellos | P1 | Pendiente |
| H-004 | Borrar `lib/aztec/pxe/sidecar.ts`: un PXE en el servidor contradice la no custodia | `lib/aztec/pxe/sidecar.ts` | Ningún PXE en el servidor | P0 | Pendiente |
| H-005 | Actualizar `aztec-ci.yml` de `@aztec/cli@0.67.0` a la versión fijada, con red local en CI | `.github/workflows/aztec-ci.yml` | El job de Aztec pasa con la versión correcta | P0 | Pendiente |
| H-006 | `lib/aztec/wallet.ts`: conexión de cartera o creación de cuenta | nuevo `lib/aztec/wallet.ts` | Prueba e2e: cuenta nueva con dirección Aztec visible | P0 | Pendiente |
| H-007 | Desplegar la cuenta Schnorr con pago de comisiones patrocinado en testnet | `lib/aztec/wallet.ts` (ver `deploy-token.mjs`) | Cuenta desplegada sin ETH del usuario | P1 | Pendiente |
| H-008 | Saldos reales con `balance_of_private(...).simulate()`; borrar los saldos en localStorage | `lib/zk/zkMoney.ts` L303–400 | Ninguna lectura de saldo usa localStorage | P0 | Pendiente |
| H-009 | Transferencia privada real con `TokenContract.transfer`; el chat solo lleva el txHash | nuevo `lib/aztec/transfer.ts` | Prueba e2e en red local | P0 | Pendiente |
| H-010 | El PXE del receptor descubre la nota y la UI actualiza el saldo | `lib/aztec/` | El saldo de Bob sube tras el pago de Alice | P0 | Pendiente |
| H-011 | Estado real de la transacción (pendiente, minada, fallida) desde el nodo | `lib/aztec/` | Estados reflejados en la UI | P1 | Pendiente |
| H-012 | Progreso honesto de la prueba (tiempo transcurrido); borrar `PROOF_STEPS` | `lib/zk/zkMoney.ts` L38–48 | `grep PROOF_STEPS` vacío | P1 | Pendiente |
| H-013 | Prover en un Web Worker, en una ruta `/prove` con COOP/COEP | nuevo worker | La UI no se congela durante la prueba | P1 | Pendiente |
| H-014 | Medir y publicar tiempos de prueba en 3 dispositivos | `docs/zk/benchmarks.md` | Tabla con dispositivo, hilos y segundos | P2 | Pendiente |
| H-015 | Puente L1→L2 estándar (TokenPortal + TokenBridge, `claim_private`) | contratos estándar | Prueba e2e en red local | P1 | Pendiente |
| H-016 | Retiro L2→L1 con mensaje de salida y consumo en L1 | contratos estándar | Prueba e2e en red local | P2 | Pendiente |
| H-017 | Validar el recibo L1: portal de destino, remitente e importe (cierra C4) | `lib/aztec/bridge.ts` | Un hash L1 inventado se rechaza | P0 | Pendiente |
| H-018 | Borrar las rutas simuladas de `/api/zk/` (transfer, shield, unshield, sequencer, history, pxe-sync, prove, witness, balance) | `app/api/zk/**` | Las rutas devuelven 404 | P0 | Pendiente |
| H-019 | Borrar `lib/zk/aztecPxe.ts` (prover falso) y la parte simulada de `zkMoney.ts` | `lib/zk/` | `grep generateUltraHonkProof` vacío | P0 | Pendiente |
| H-020 | Reescribir `zk_money_vault` con aztec-nr actual, o eliminarlo y usar el Token estándar | `aztec-contracts/zk_money_vault` | Compila con la versión fijada o está eliminado | P1 | Pendiente |
| H-021 | Reescribir `zk_escrow`: notas privadas en poder del contrato, authwit y bloque del contexto | `aztec-contracts/zk_escrow` | Compila; pruebas H-022 en verde | P1 | Pendiente |
| H-022 | Pruebas TXE del escrow: liberación, disputa, expiración y doble liberación | `aztec-contracts/zk_escrow/src/test.nr` | Pasan en CI | P1 | Pendiente |
| H-023 | Streams como contrato que usa el timestamp del bloque; documentar qué metadatos revela | nuevo contrato | Compila; documento de privacidad | P2 | Pendiente |
| H-024 | Pruebas TXE de streams: cancelación + retiradas = depósito exacto | tests del contrato | Prueba de propiedades en verde | P2 | Pendiente |
| H-025 | Facturas: solicitud firmada con referencia; pagada solo al detectar la transferencia | `lib/zk/zkInvoice.ts` | Una factura no se marca pagada sin transferencia | P2 | Pendiente |
| H-026 | Propinas sobre la transferencia real | `SendTipModal.tsx` | La propina mueve fondos reales en testnet | P2 | Pendiente |
| H-027 | Retirar la tesorería de comunidad en localStorage hasta tener una multifirma real | `ZkCommunityTreasury.tsx` | Componente retirado o tras flag apagado | P1 | Pendiente |
| H-028 | Retirar `ZkComplianceModal` simulado hasta tener diseño legal | `components/zk/ZkComplianceModal.tsx` | No visible en producción | P1 | Pendiente |
| H-029 | Retirar `ZkMpcCeremony` (no hay ceremonia real) | `components/zk/ZkMpcCeremony.tsx` | No visible en producción | P1 | Pendiente |
| H-030 | Retirar o conectar a métricas reales el panel del secuenciador | `ZkSequencerDashboard.tsx` | Sin datos aleatorios | P1 | Pendiente |
| H-031 | Retirar la puntuación de privacidad inventada | `ZkPrivacyScore.tsx`, `calculatePrivacyScore` | No visible en producción | P1 | Pendiente |
| H-032 | Identidad ZK: retirar `zkIdentity` simulado o integrar un proveedor real (World ID, ZKPassport) | `lib/zk/zkIdentity.ts` | Sin verificación simulada | P2 | Pendiente |
| H-033 | Retirar el prover falso de nóminas (`zkPayroll`) | `lib/zk/zkPayroll.ts` | No visible en producción | P1 | Pendiente |
| H-034 | Activar `NEXT_PUBLIC_ZK_MODE=testnet` solo cuando H-035 pase en CI | configuración | Puerta documentada | P0 | Pendiente |
| H-035 | Prueba e2e: Alice envía 10 a Bob en red local; un mensaje falsificado no cambia saldos | `e2e/zk-transfer.spec.ts` | Pasa en CI | P0 | Pendiente |
| H-036 | Prueba e2e: puente L1→L2 en red local; un hash inventado se rechaza | `e2e/zk-bridge.spec.ts` | Pasa en CI | P1 | Pendiente |
| H-037 | Auditoría externa de los contratos Noir propios antes de mainnet | proveedor externo | Informe sin críticos ni altos abiertos | P1 | Pendiente |
| H-038 | Límites de importe y avisos en testnet; mainnet solo con auditoría y revisión legal | configuración, UI | Mainnet bloqueado por flag | P0 | Pendiente |
| H-039 | Documentar el protocolo ZK para las conferencias (qué es privado y qué no) | `docs/zk/privacy.md` | Revisado por el equipo | P2 | Pendiente |
| H-040 | Monitor del nodo Aztec (latencia, errores) con RPC de respaldo | `lib/aztec/node.ts` | Caída simulada del nodo → cambio al respaldo | P2 | Pendiente |

## I. Cero simulaciones y limpieza (30 tareas, pilar SIM)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| I-001 | Comprobación en CI que falla si aparece `Math.random` o `randomHex` generando hashes, saldos o métricas | nuevo `scripts/check-no-fake-data.mjs` | La CI falla con un caso de prueba | P0 | Pendiente |
| I-002 | Revisar los 124 archivos con "simulat…": cada uno pasa a real, demo etiquetado o borrado | todo el repositorio | Informe archivo por archivo; 0 simulaciones sin etiqueta | P0 | Pendiente |
| I-003 | `/api/zk/sequencer`: borrar o servir datos reales | `app/api/zk/sequencer/route.ts` L24–32 | Sin `Math.random` | P0 | Pendiente |
| I-004 | Precios desde oráculo o API con caché; borrar los fijos ($2.650, $3.000, $3.400, $3.800) | `zkMoney.ts` L1129, `wallet/estimate-gas`, `network/ledger/top-ledgers`, `network/dark-forest` | `grep` de los cuatro valores vacío | P0 | Pendiente |
| I-005 | P-04: borrar la documentación de relleno o sustituirla por documentación real | `app/developer/content.ts` | 0 frases repetidas | P0 | Pendiente |
| I-006 | Archivar o borrar los scripts sueltos de la raíz (`fix*.js`, `script_*.js`, `test-*.mjs`, `check_*.js`, `patch.diff`) | raíz del repositorio | La raíz solo contiene configuración y documentación | P1 | Pendiente |
| I-007 | Retirar los informes y suites "quantum" con resultados fijos si no ejecutan pruebas reales | `CRYPTO_TEST_REPORT.txt`, `scripts/test-zk-suite.ts` | Toda suite mencionada se ejecuta en CI | P1 | Pendiente |
| I-008 | Páginas de métricas (forum/telemetry, network/*, mempool): datos reales o retiradas | `app/api/network/**`, `app/api/forum/telemetry/**` | Sin series generadas | P1 | Pendiente |
| I-009 | Contador de usuarios de `/connect` desde la base o retirado | página de conexión | El número coincide con una consulta | P1 | Pendiente |
| I-010 | Componente `<DemoBadge/>` uniforme en todo lo que no sea real | nuevo componente | Todas las pantallas demo lo muestran | P0 | Hecha |
| I-011 | Borrar `LEGENDARY_BUILD_777` y ecos similares de los scripts | `package.json` | `grep LEGENDARY` vacío | P2 | Pendiente |
| I-012 | Borrar las rutas de API sin consumidor | `app/api/**` | Informe; rutas huérfanas eliminadas | P1 | Pendiente |
| I-013 | Borrar componentes sin uso (detectados con knip o ts-prune) | `components/**` | Informe de knip sin exportaciones muertas | P1 | Pendiente |
| I-014 | Quitar dependencias sin uso (`libp2p` y otras) | `package.json` | depcheck limpio | P1 | Pendiente |
| I-015 | Reducir `as any` de 1.051 a menos de 100 | `app/`, `components/`, `lib/` | `grep -c "as any"` < 100 | P1 | Pendiente |
| I-016 | Eliminar los 59 `@ts-ignore` y `@ts-nocheck` | todo el código | 0 directivas | P1 | Pendiente |
| I-017 | Dejar de usar `localStorage` como fuente de verdad de datos financieros (claves `ledger_zk_*`) y purgar las claves antiguas en los navegadores | `lib/zk/*.ts`, `components/zk/**` | Ninguna lectura de saldo, nota o stream desde localStorage; purga ejecutada al cargar | P1 | Pendiente |
| I-018 | Activar ESLint en el build (`ignoreDuringBuilds: false`) con lint limpio | `next.config.js` L92 | `next build` falla si hay errores de lint | P0 | Pendiente |
| I-019 | Textos legales coherentes con lo que el producto hace hoy | `app/legal/**` | Ninguna promesa de función inexistente | P1 | Pendiente |
| I-020 | Página pública de estado del producto: qué es real y qué es demo | nueva página | Publicada y enlazada | P1 | Pendiente |
| I-021 | Whitepaper sin afirmaciones no implementadas (postcuántico, 8.000 millones) | `app/whitepaper` | Cada afirmación técnica enlaza a código o se elimina | P1 | Pendiente |
| I-022 | "Quantum Dots": definir con precisión o renombrar; quitar la explicación física | textos, `AztecIdentityCard.tsx` L962 | Sin física inventada | P2 | Pendiente |
| I-023 | README con instalación, arquitectura y comandos reales | `README.md` | Un desarrollador nuevo levanta el proyecto siguiéndolo | P1 | Pendiente |
| I-024 | Borrar ramas obsoletas tras archivarlas (`backup-june-12`) | GitHub | Solo ramas activas | P3 | Pendiente |
| I-025 | Borrar `k8s/` y Helm si el destino es Railway, o documentarlos | `k8s/` | Decisión aplicada | P3 | Pendiente |
| I-026 | `electron/`, `android/` e `ios/`: integrarlos en CI o retirarlos | carpetas nativas | Cada carpeta que queda tiene build en CI | P2 | Pendiente |
| I-027 | Sacar del producto los módulos ajenos al núcleo (terminal, omni-matrix, forge, academia) o ponerlos tras flags | `components/**`, `app/**` | Lista de módulos con decisión | P1 | Pendiente |
| I-028 | Documento de alcance: núcleo = chat, comunidades, llamadas y pagos privados | `docs/product/scope.md` | Aprobado por el propietario | P0 | Pendiente |
| I-029 | Flags de funcionalidad para módulos fuera del núcleo, apagados en producción | nuevo `lib/flags.ts` | Módulos ocultos en producción | P1 | Hecha |
| I-030 | Lista de patrones prohibidos comprobada en CI (cabeceras de identidad, secretos por defecto, datos falsos) | `scripts/forbidden-patterns.mjs` | La CI falla con cada patrón | P0 | Hecha |

## J. Calidad: pruebas y CI (35 tareas, pilar GATE)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| J-001 | CI en verde: arreglar Gitleaks (licencia o CLI directa) | `.github/workflows/ci.yml` L40 | Job en verde | P0 | Pendiente |
| J-002 | Security & Compliance en verde (`--legacy-peer-deps` o resolver dependencias) | `.github/workflows/security.yml` | Workflow en verde | P0 | Pendiente |
| J-003 | System Core Contract Tests: arreglar o retirar Hardhat si esos contratos no se usan | `.github/workflows/system-core.yml` | Workflow en verde o retirado | P0 | Pendiente |
| J-004 | `production-pipeline.yml` válido y ejecutado de principio a fin | `.github/workflows/production-pipeline.yml` | Workflow en verde | P0 | Pendiente |
| J-005 | Proteger `main`: PR obligatorio, CI verde obligatoria y una revisión | GitHub | Push directo a main rechazado | P0 | Pendiente |
| J-006 | Cobertura con umbral del 70 % en `lib/` y en las rutas críticas | `vitest.config.ts` | La CI falla por debajo del umbral | P1 | Pendiente |
| J-007 | Pruebas unitarias de `session`, `jwt` y `requireWallet` | `tests/unit/auth/**` | Cobertura > 90 % en esos módulos | P0 | Pendiente |
| J-008 | Pruebas de integración de cada ruta de chat y comunidad con base de datos de prueba | `tests/api/**` | Pasan en CI | P1 | Pendiente |
| J-009 | Pruebas generadas: cada ruta no pública devuelve 401 sin sesión | `tests/api/auth-matrix.test.ts` (desde `routes.csv`) | Pasa para las rutas clasificadas | P0 | Pendiente |
| J-010 | Pruebas de IDOR: la sesión A no accede a recursos de B en rutas con identificador | `tests/api/idor.test.ts` | Pasa en CI | P0 | Pendiente |
| J-011 | Playwright e2e: registro, login con cartera y email, PIN, DM, comunidad, llamada | `e2e/**` | Pasan en CI | P0 | Pendiente |
| J-012 | e2e en móvil y en WebKit (Safari) | `playwright.config.ts` | Proyectos mobile y webkit en verde | P1 | Pendiente |
| J-013 | Prueba de regresión por cada hallazgo (C1–C6, H1–H8, N-01–N-08, P-01–P-04) | `tests/regression/**` | Una prueba por ID | P0 | Pendiente |
| J-014 | Fuzzing de validadores y parsers de mensajes especiales (`__ZK_*__`) con fast-check | `tests/fuzz/**` | 10.000 casos sin excepción | P1 | Pendiente |
| J-015 | Pruebas de propiedades de streams y escrow con fast-check | `tests/property/**` | Pasan en CI | P2 | Pendiente |
| J-016 | Pruebas TXE de contratos en CI | `.github/workflows/aztec-ci.yml` | Pasan en CI | P1 | Pendiente |
| J-017 | Pruebas visuales de pantallas clave | `e2e/visual/**` | Diferencias revisadas en cada PR | P2 | Pendiente |
| J-018 | Lighthouse CI: rendimiento ≥ 90 y accesibilidad ≥ 95 en `/`, `/chat`, `/connect` | `.github/workflows/lighthouse.yml` | Umbrales cumplidos | P1 | Pendiente |
| J-019 | TypeScript estricto también para el código propio sin `skipLibCheck` (o justificado) | `tsconfig.json` | Decisión documentada | P2 | Pendiente |
| J-020 | Mantener `tsc --noEmit` sin errores en CI | `ci.yml` | Job en verde | P0 | Pendiente |
| J-021 | Reglas de seguridad en ESLint (`eslint-plugin-security`, `no-unsanitized`) | `.eslintrc` | Lint en verde con las reglas | P1 | Pendiente |
| J-022 | Reglas propias en CodeQL o Semgrep (cabeceras de identidad, `Math.random` en tokens) | `.github/codeql/` | Las reglas detectan un caso de prueba | P1 | Pendiente |
| J-023 | CODEOWNERS para archivos sensibles (auth, middleware, zk) | `.github/CODEOWNERS` | Revisión obligatoria en esos archivos | P1 | Pendiente |
| J-024 | Commits convencionales y changelog generado | `commitlint`, `CHANGELOG.md` | Changelog refleja los PR reales | P3 | Pendiente |
| J-025 | Entorno de pruebas reproducible con Docker Compose (Postgres, Redis, red Aztec local) | `docker-compose.test.yml` | `docker compose up` + tests en verde | P1 | Pendiente |
| J-026 | Datos de prueba sintéticos con factories | `tests/factories/**` | Las pruebas no dependen de datos reales | P2 | Pendiente |
| J-027 | Probar migraciones desde cero y desde una copia anonimizada de producción | CI | Ambas pasan | P1 | Pendiente |
| J-028 | Prueba de carga semanal en CI (k6 de humo) | `.github/workflows/perf.yml` | Ejecución semanal en verde | P2 | Pendiente |
| J-029 | Pruebas de mutación (Stryker) en módulos de auth | `stryker.conf.js` | Puntuación de mutación > 70 % | P3 | Pendiente |
| J-030 | SBOM (CycloneDX) generado por versión | CI | SBOM adjunto a cada release | P2 | Pendiente |
| J-031 | Builds reproducibles: imagen por digest y hash publicado | CI, releases | Dos builds del mismo commit dan el mismo hash | P2 | Pendiente |
| J-032 | Comprobar licencias de dependencias compatibles con MIT | CI (`license-checker`) | Ninguna AGPL ni GPL incompatible | P1 | Pendiente |
| J-033 | Plantilla de PR con checklist de seguridad | `.github/pull_request_template.md` | Plantilla activa | P2 | Pendiente |
| J-034 | Hooks de pre-commit con lint-staged y escaneo de secretos | `.husky/` | Un secreto de prueba bloquea el commit | P2 | Pendiente |
| J-035 | Cero pruebas inestables: reintento que las detecta y las marca | configuración de pruebas | Informe semanal sin inestables | P3 | Pendiente |

## K. Interfaz, marca y accesibilidad (30 tareas, pilar UI)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| K-001 | N-07: iconos reales: `apple-touch-icon` 180×180 opaco sobre blanco; `icon-192`, `icon-512`, `favicon-32x32` y `favicon.ico` con sus tamaños | `public/*.png`, `public/favicon.ico` | `file` muestra los tamaños correctos; icono correcto en iOS | P0 | Pendiente |
| K-002 | `manifest.json` coherente con los tamaños reales e icono maskable | `public/manifest.json` | Lighthouse PWA sin avisos de iconos | P1 | Pendiente |
| K-003 | Monograma HL en SVG vectorial en `HLLogo` | `components/shared/HLLogo.tsx` | Sin `<img src="/favicon.png">` en el logo | P1 | Pendiente |
| K-004 | Sistema de diseño documentado (#FFFFFF, #1C1C1E, #25D366, tipografía, espaciado) | `docs/design/tokens.md`, `tailwind.config.ts` | Tokens usados en lugar de colores sueltos | P2 | Pendiente |
| K-005 | Mantener 0 clases `dark:` con comprobación en CI | CI | La CI falla con una clase `dark:` | P1 | Pendiente |
| K-006 | Contraste WCAG AA en todo el texto (el verde #25D366 no sirve para texto sobre blanco) | estilos | Revisión con axe sin fallos de contraste | P1 | Pendiente |
| K-007 | Navegación completa por teclado con foco visible | componentes del núcleo | Recorrido de chat solo con teclado | P1 | Pendiente |
| K-008 | Etiquetas accesibles en todos los botones de icono | componentes del núcleo | axe sin `button-name` | P1 | Pendiente |
| K-009 | Respetar `prefers-reduced-motion` | animaciones | Con la preferencia activa, sin animaciones de desplazamiento | P2 | Pendiente |
| K-010 | Sustituir la jerga de los textos (Legendary, Void, Quantum Onboarding, Syndicate, Ghost, Dark Forest, Elite) | textos de la UI | `grep` de la lista vacío en la UI | P1 | Pendiente |
| K-011 | Internacionalización (español, inglés, rumano) sin textos fijos | `next-intl`, textos | Cambio de idioma completo en el núcleo | P2 | Pendiente |
| K-012 | Estados vacíos, de carga y de error diseñados en chat, comunidades y llamadas | componentes del núcleo | Revisión visual de cada estado | P1 | Pendiente |
| K-013 | Mensajes de error claros, sin códigos internos ni jerga | textos de error | Revisión de los 30 errores más frecuentes | P2 | Pendiente |
| K-014 | Alta en 3 pasos como máximo, con cartera o con email | `LedgerChatOnboarding.tsx`, `/connect` | Prueba con 5 usuarios: < 2 min | P1 | Pendiente |
| K-015 | LCP < 2,5 s, INP < 200 ms y CLS < 0,1 en móvil con 4G | páginas del núcleo | Medido con Lighthouse y datos de campo | P1 | Pendiente |
| K-016 | Presupuesto de bundle en CI: el PR falla si `/chat` crece más de un 10 % | `.github/workflows/ci.yml`, `size-limit` | Un PR que añade una librería pesada falla | P1 | Pendiente |
| K-017 | Fuentes autoalojadas con `font-display: swap` | `app/layout.tsx` | Sin peticiones a fuentes externas | P3 | Pendiente |
| K-018 | Imágenes con dimensiones fijas (sin saltos de diseño) | componentes | CLS < 0,1 | P2 | Pendiente |
| K-019 | Diseño revisado de 360 px a 4K | páginas del núcleo | Capturas en 5 anchos | P2 | Pendiente |
| K-020 | Dividir y memoizar `MessageBubble.tsx` (1.067 líneas) | `components/chat/MessageBubble.tsx` | Archivos < 300 líneas; menos re-renders medidos | P2 | Pendiente |
| K-021 | Ajustes de privacidad claros (presencia, confirmaciones, vistas previas) | Ajustes | Cada ajuste explica qué comparte | P1 | Pendiente |
| K-022 | Páginas 404 y 500 con la marca | `app/not-found.tsx`, `app/error.tsx` | Visibles con la marca | P3 | Pendiente |
| K-023 | Textos legales y de privacidad legibles | `app/legal/**` | Nivel de lectura revisado | P3 | Pendiente |
| K-024 | Tema claro sin parpadeo al cargar | `app/layout.tsx` | Sin cambio visible de colores al cargar | P2 | Pendiente |
| K-025 | Animaciones de Framer Motion acotadas (sin recalcular el diseño) | componentes animados | Perfil de rendimiento sin layout thrashing | P3 | Pendiente |
| K-026 | Paleta de comandos Cmd+K | `LedgerChatSearchModal.tsx` | Abre con Cmd+K y navega a chats y ajustes | P3 | Pendiente |
| K-027 | Atajos de teclado documentados | ayuda en la app | Lista visible con `?` | P3 | Pendiente |
| K-028 | Pruebas de usabilidad con 5 usuarios reales | `docs/research/usability.md` | Informe con problemas y arreglos | P2 | Pendiente |
| K-029 | Analítica de producto sin rastreadores de terceros: eventos agregados y con consentimiento | nuevo `lib/analytics` | Ninguna petición a terceros | P2 | Pendiente |
| K-030 | Revisión de marca de las páginas que queden tras I-027 | `app/**` | Lista revisada | P2 | Pendiente |

## L. Móvil, PWA y escritorio (15 tareas, pilar UI)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| L-001 | PWA instalable: service worker solo para la interfaz, sin cachear datos privados | `public/sw.js`, `manifest.json` | Instalable; la caché no contiene respuestas de `/api` | P2 | Pendiente |
| L-002 | Capacitor iOS: build reproducible y TestFlight | `ios/`, CI | Build en TestFlight | P2 | Pendiente |
| L-003 | Capacitor Android: build y prueba interna en Play | `android/`, CI | Build en prueba interna | P2 | Pendiente |
| L-004 | Push nativo (APNs y FCM) sin contenido del mensaje | plugins de Capacitor | Notificación recibida sin texto en el payload | P2 | Pendiente |
| L-005 | Claves en Keychain o Keystore (plugin de almacenamiento seguro) | app nativa | Las claves no están en el almacenamiento web | P1 | Pendiente |
| L-006 | Bloqueo biométrico nativo | app nativa | Face ID / huella al abrir | P2 | Pendiente |
| L-007 | Bloquear capturas (`FLAG_SECURE`) en chats efímeros en Android | app Android | Captura bloqueada en esos chats | P3 | Pendiente |
| L-008 | Enlaces profundos `/join/[code]` en las apps | configuración nativa | El enlace abre la app en la comunidad | P3 | Pendiente |
| L-009 | Electron: actualizar con `contextIsolation`, sin `nodeIntegration` y con firma, o retirarlo | `electron/` | Auditoría con Electronegativity sin altos | P2 | Pendiente |
| L-010 | Instalador de Windows firmado o retirar la descarga | `DownloadSection.tsx` | SmartScreen sin aviso, o descarga retirada | P2 | Pendiente |
| L-011 | Reconexión de XMTP al volver de segundo plano | app móvil | Mensajes recibidos al volver | P1 | Pendiente |
| L-012 | Tamaño de la app < 50 MB | builds nativos | Medido en las tiendas | P3 | Pendiente |
| L-013 | Pruebas en dispositivos reales (iPhone y Android de gama media) | informe | Informe con fallos y arreglos | P1 | Pendiente |
| L-014 | Etiquetas de privacidad de las tiendas coherentes con los datos reales | App Store Connect, Play Console | Etiquetas revisadas | P2 | Pendiente |
| L-015 | Extensión de navegador: retirar o auditar sus permisos | `scripts/extension-build.js` | Permisos mínimos o retirada | P3 | Pendiente |

## M. Observabilidad y operación (15 tareas, pilar SEG)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| M-001 | Logger estructurado (pino) con niveles y redacción de datos personales | nuevo `lib/logger.ts` | Logs en JSON sin emails ni direcciones completas | P1 | Hecha |
| M-002 | Errores del servidor capturados sin datos de usuario (GlitchTip o Sentry autoalojado) | configuración | Un error de prueba aparece sin datos personales | P1 | Pendiente |
| M-003 | Métricas por ruta: peticiones/s, p95 y tasa de errores | Railway metrics o Prometheus | Panel con las rutas del núcleo | P1 | Pendiente |
| M-004 | `/api/health` real: comprueba base, Redis y alcance de XMTP | `app/api/health` | Falla al caer la base | P0 | Pendiente |
| M-005 | Alertas: errores > 1 %, p95 > 1 s, conexiones a la base > 80 % | monitorización | Alerta de prueba recibida | P1 | Pendiente |
| M-006 | Runbooks: caída de base, Redis, XMTP, LiveKit y despliegue fallido | `docs/runbooks/**` | Cinco runbooks revisados | P1 | Pendiente |
| M-007 | Plantilla y registro de postmortems | `docs/postmortems/` | Plantilla en el repositorio | P2 | Pendiente |
| M-008 | Página de estado pública | proveedor de status | Publicada | P2 | Pendiente |
| M-009 | Registro de auditoría de acciones de administración | nuevo modelo `AdminAudit` | Cada acción admin queda registrada | P1 | Pendiente |
| M-010 | Panel de administración con segundo factor y lista cerrada de administradores | `app/admin/**` | Sin segundo factor → sin acceso | P0 | Pendiente |
| M-011 | Rotación trimestral de secretos documentada | `docs/runbooks/secrets.md` | Primera rotación con fecha | P2 | Pendiente |
| M-012 | SLO de disponibilidad del 99,9 % mensual, definido y medido | monitorización | Informe mensual | P2 | Pendiente |
| M-013 | Responsable de incidentes definido | `docs/runbooks/oncall.md` | Nombre y canal publicados | P2 | Pendiente |
| M-014 | Seguimiento mensual del coste de Railway y LiveKit | panel de costes | Informe mensual | P3 | Pendiente |
| M-015 | Simulacro de incidente trimestral | `docs/runbooks/gameday.md` | Primer simulacro documentado | P3 | Pendiente |

## N. Cumplimiento legal y privacidad (15 tareas, pilar SEG)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| N-001 | Política de privacidad fiel a lo que guarda el servidor tras quitar el texto en claro | `app/legal/privacy` | Cada dato listado coincide con el esquema | P0 | Pendiente |
| N-002 | RGPD: registro de actividades de tratamiento y base legal | `docs/legal/ropa.md` | Documento completo | P1 | Pendiente |
| N-003 | Contratos de encargado de tratamiento con Railway, LiveKit y XMTP | documentación legal | Firmados o aceptados | P1 | Pendiente |
| N-004 | Evaluación de impacto (DPIA) de mensajería y pagos | `docs/legal/dpia.md` | Documento revisado | P2 | Pendiente |
| N-005 | Procedimiento de notificación de brechas en 72 horas (RGPD art. 33) con plantilla | `docs/legal/breach.md` | Procedimiento aprobado y ensayado | P1 | Pendiente |
| N-006 | Edad mínima (16 años en la UE) y su comprobación en el alta | alta | Casilla y texto en el alta | P1 | Pendiente |
| N-007 | Obligaciones de la DSA para comunidades públicas (punto de contacto, notificación y acción) | `docs/legal/dsa.md`, formulario | Formulario de denuncia operativo | P1 | Pendiente |
| N-008 | Análisis MiCA y AML antes de mainnet; sin rampa fiat propia | asesoría externa | Informe legal archivado | P1 | Pendiente |
| N-009 | Comprobación de sanciones en puentes L1 si aplica | `lib/aztec/bridge.ts` | Direcciones sancionadas rechazadas en el puente | P2 | Pendiente |
| N-010 | Términos de servicio actualizados | `app/legal/terms` | Publicados con fecha | P1 | Pendiente |
| N-011 | Transferencias internacionales de datos (proveedores en EE. UU.): cláusulas contractuales tipo y aviso | `docs/legal/transfers.md` | Cláusulas firmadas y aviso en la política de privacidad | P1 | Pendiente |
| N-012 | Política de respuesta a solicitudes de autoridades e informe de transparencia | `docs/legal/law-enforcement.md` | Política publicada | P2 | Pendiente |
| N-013 | Declaración de accesibilidad (Ley Europea de Accesibilidad) | página de accesibilidad | Publicada | P2 | Pendiente |
| N-014 | Retención de logs ≤ 30 días | configuración de logs | Configuración verificada | P2 | Pendiente |
| N-015 | Cookies: solo esenciales y ninguna de terceros; banner solo si hiciera falta | `app/layout.tsx` | Escaneo de cookies limpio | P2 | Pendiente |

## O. Conferencias y documentación (10 tareas, pilar LEC)

| ID | Tarea | Archivos | Prueba de aceptación | Prio. | Estado |
| --- | --- | --- | --- | --- | --- |
| O-001 | Corregir en el material las afirmaciones técnicas (configuración de UltraHonk, ML-KEM, postcuántico) | diapositivas | Revisado contra la sección 7 del plan de Antigravity | P1 | Pendiente |
| O-002 | Diapositivas de 1 hora con casos reales de antes y después (C1, C2, C5, N0) | deck | Deck completo | P1 | Pendiente |
| O-003 | Diapositivas de 2 horas con demo en red local de Aztec | deck | Deck completo | P1 | Pendiente |
| O-004 | Demo grabada de respaldo | vídeo | Vídeo de < 5 min | P2 | Pendiente |
| O-005 | Repositorio de ejercicios para estudiantes con pruebas que fallan | repo aparte | Cuatro ejercicios con solución | P2 | Pendiente |
| O-006 | `docs/architecture.md` con diagrama actualizado | `docs/architecture.md` | Coincide con el código | P2 | Pendiente |
| O-007 | `docs/protocol.md`: qué es privado y qué no | `docs/protocol.md` | Revisado | P1 | Pendiente |
| O-008 | `docs/security.md`: resumen del modelo de amenazas | `docs/security.md` | Publicado | P2 | Pendiente |
| O-009 | Glosario sin jerga | `docs/glossary.md` | Publicado | P3 | Pendiente |
| O-010 | Ensayo con los profesores y cambios incorporados | notas | Notas con cambios aplicados | P2 | Pendiente |
