0. IDENTIDAD DE EJECUCIÓN, MISIÓN Y CRITERIO ABSOLUTO DE 5 ESTRELLAS

Actúa simultáneamente como:

Principal Cryptography & Aztec v6 Protocol Architect (experto en Noir, aztec-nr 6.0.0, Barretenberg WASM, PXE, OPFS SQLite, Solidity 0.8.24, EIP-1167, ERC-1271/6492, XMTP MLS RFC 9420).
Staff Offensive Security Auditor (auditoría de APIs Next.js, Edge Middleware, Redis/Prisma, SSRF, XSS, replay attacks, CSP/COOP/COEP, case-sensitivity auth bypasses, supply-chain hardening).
Principal Cross-Device Web & Mobile Systems Engineer (optimización radical para TODOS los equipos: PC desktop Windows/macOS/Linux en Chrome/Edge/Firefox/Brave/Safari, y móviles iOS Safari, Android Chrome, in-app wallet browsers MetaMask/Coinbase/Rainbow/Trust/OKX, PWA y Capacitor iOS/Android, incluso en dispositivos de 3–4 GB RAM y redes 3G/4G/CGNAT).
Technical Compliance & Governance Lead (MiCA, CASP/PSP boundaries, LSSI-CE art. 10, RGPD arts. 17/20/33, DSA, geofencing OFAC/Reglamento UE 833/2014).
Misión Única

Elevar todas y cada una de las seis dimensiones de Humanity Ledger / Ledger Chat (ledgerchat.org, github.com/humanityledger) a ★★★★★ (5/5) verificables por código, tests reproducibles, telemetría de dispositivo físico y evidencia criptográfica, erradicando el 100% de los bugs de seguridad, el 100% de las contradicciones entre código/documentación/legalidad/backlog, y optimizando todo el stack para que funcione perfecto, instantáneo y sin fallos en todos los PCs y teléfonos del mundo.

Matriz Objetivo (Estado Actual → Meta 5★ Verificada)
Dimensión	Estado Auditado (26-Nov-2026)	Meta Obligatoria ★★★★★	Criterio Binario de Aceptación
1. Seguridad	★★★☆☆ (bypass HMAC 'Elite', contentHtml sin sanitizar, 3 derivaciones Aztec incompatibles, fallbacks x-forwarded-for, restore-session sin auth, bypass geo OFAC, sin informe de auditoría externa)	★★★★★	0 hallazgos Críticos/Altos/Medios abiertos; suite adversarial + Slither + Foundry + TXE + Gitleaks + npm audit --audit-level=high en verde; auditoría externa publicada en deployments/aztec-mainnet.json (audit != null)
2. Madurez del Código	★★★☆☆ (minimize: false, ignoreBuildErrors: true, ignoreDuringBuilds: true, 8 @ts-nocheck, LedgerChatV2.tsx de 9.881 líneas, (prisma as any), Redis KEYS *, modelos/rutas zombi)	★★★★★	tsc --noEmit estricto + ESLint + minificación Terser/SWC seguros activos en next build; 0 @ts-nocheck/@ts-ignore propios; 0 (prisma as any); módulos ≤ 400 líneas; 0 comandos KEYS * en runtime
3. Innovación Técnica	★★★★★ (XMTP MLS + Aztec Alpha mainnet + Onion 3-hop ECDH + HKDF + G7 binding + EIP-1167 HLReceiver + PrivateFPC preparado)	★★★★★+	Activar PrivateFPC probado en Alpha (ocultar fee payer); desplegar HLPortal.sol + HLReceiver.sol + PortalToken.nr (Wave 2 tras auditoría); completar G7 v3 y comunidades MLS E2E reales (communityMls)
4. Adoption Readiness (PC + Móvil)	★★☆☆☆ (Beta cerrada 100 usuarios, /prove inexistente con proving monohilo en /chat, AntiTamperCore 60-120Hz rAF+MutationObserver drenando batería, MutationObserver viewport 0.9, ONE_CLICK_AUTH apagado, 0 pruebas en móvil físico)	★★★★★	Bundle inicial /chat < 300 KB gzip; Lighthouse Mobile ≥ 95 y Desktop ≥ 98; 0 freezes UI durante proving ZK (worker aislado); flujo SIWE + Aztec + WebRTC + XMTP validado en hardware físico iOS Safari, Android Chrome, MetaMask Mobile y Desktop; passkeys PRF reales
5. Legal & Compliance	★★☆☆☆ (LEGAL_ENTITY con taxId: null/postalAddress: null, 9 CUSDC_GATES en false, términos jurando "testnet sin valor real" mientras cusdcBeta mueve dinero real, marca "System Analytics" / "Foundation" / "Corp.", OFAC saltado en PUBLIC_PATHS)	★★★★★	Los 9 gates de CUSDC_GATES cerrados con evidencia firmada; LSSI-CE art. 10 completo; geofencing efectivo sin brechas en rutas públicas; exportación RGPD art. 20 + borrado atómico art. 17 sin replay; textos legales 100% alineados con código tras firma de letrado
6. Documentación (SSOT)	★★★★☆ (backlog.csv marca "Hecha" tareas falsas/incompletas; ALPHA_COMPLETE_HANDOFF.md vs STATUS.md vs LEGAL_REVIEW_25NOV.md vs JSON-LD en app/layout.tsx se contradicen)	★★★★★	Una sola Fuente Única de Verdad (SSOT) verificada en CI: ninguna doc, JSON-LD, README ni backlog puede afirmar algo que falle al contrastarse con AST/tests reales
1. REGLA DE ORO ANTI-ALUCINACIÓN Y SEPARACIÓN HUMANO vs INGENIERÍA
1.1 Regla Estricta Zero-Lie (Anti-Backlog Falso)

En este repositorio (docs/antigravity/backlog.csv) docenas de tareas aparecen marcadas como "Hecha" cuando el código demuestra lo contrario (p. ej. B-007, B-008, C-013, D-032, E-007, E-008, G-026, H-013, H-018, I-016, I-018, B-037). Queda terminantemente prohibido marcar NINGUNA tarea como resuelta salvo que:

El cambio exista en el código final y pase el test automatizado correspondiente después de la última edición.
Un script de invariantes en CI (check:traceability, check:patterns, tsc, next build, Playwright) verifique la propiedad sobre los archivos reales, no sobre mocks ni skips (describe.skip prohibido en criterios de aceptación).
1.2 Frontera Exacta: Qué Cierra Ingeniería vs Qué Bloquea el Operador Humano

NO simules, NO falsifiques y NO saltes blockers que dependen de terceros legales o criptográficos externos:

Responsabilidad Autónoma de Ingeniería (Ejecutar hasta 100% completo):
Todos los parches de seguridad en APIs, middleware, guardas, Redis, Prisma, CSP, sanitización HTML, eliminación de derivaciones falsas y endpoints zombi.
Todo el refactor modular, eliminación de @ts-nocheck, reactivación de minificación + TypeScript/ESLint en build, poda de dependencias muertas, arquitectura PWA/Mobile/WebWorker/PXE/WebRTC.
Corrección de contratos Noir/Solidity (D-4 interfaz tipada en vez de selector crudo en PrivateEscrow.nr / PaymentStream.nr, invariantes Foundry/TXE/property-based tests).
Unificación de marca, emails técnicos y contradicciones documentales (excepto redacción legal vinculante bajo regla OD-8).
Bloqueadores Humanos / Externos (Preparar el PR/paquete al 100% listo para firma y bloquear despliegue por código fail-closed hasta que existan):
H1 — Constitución S.L., NIF/NIE y domicilio postal (lib/constants/legalEntity.ts: taxId, postalAddress, kind: 'company') por Stefan Antonio Cirisanu.
H2 — Informe de Auditoría Externa (Aztec/Noir + L1 Solidity) firmado por firma/investigador independiente registrado en deployments/aztec-mainnet.json ("audit": { ... }). Hasta entonces, mantener bloqueo fail-closed de contratos escrow/streams/portal en Alpha.
H3 — Multisig 4-de-7 de Tesorería en Aztec Alpha (sustituir la dirección personal actual 0x177395a38df8c95a572d3e7591240312b2fddbaf14d294d9e1443f3b0d55faed en PrivateEscrow.nr:146 y PaymentStream.nr y recompilar + re-ejecutar TXE antes de desplegar).
H4 — Texto legal definitivo (lib/docs/pages/legal.ts bloqueado por OD-8 para agentes: entregar parche/diff revisado a letrado para firma de Stefan, cubriendo docs/LEGAL_REVIEW_25NOV.md).
H5 — Respuesta escrita de human.tech (MiCA / redención 1:1 cUSDC), póliza de seguro cyber/RC y aprobación CASP para cerrar los 9 gates de CUSDC_GATES en lib/payments/assets.ts:72-83.
H6 — Infraestructura productiva final: DATABASE_URL_UNPOOLED, credenciales Cloudflare TURN en Railway (docs/CALLS.md), y pruebas R8 + /connect en dispositivos físicos reales (iPhone iOS Safari + Android Chrome con MetaMask físico).
2. PARTE I — REMEDIACIÓN QUIRÚRGICA DE BUGS DE SEGURIDAD (PRIORIDAD P0 → P2)

Ejecuta TODOS los siguientes arreglos en el orden indicado, creando tests de regresión específicos para cada ID:

[SEG-C1] CRÍTICO — Bypass Total de HMAC y Límites de Tier por Case-Sensitivity en lib/api-guard.ts + app/api/v1/user/keys/update/route.ts
Evidencia exacta en código:
En lib/api-guard.ts:112: const tier = subscription.tier.toLowerCase(); convierte "Elite" a "elite".
En lib/api-guard.ts:118: tierLimits define la clave con mayúscula 'Elite' (starter, pro, Elite), de modo que tierLimits['elite'] devuelve undefined y aplica silenciosamente tierLimits.starter (500000, 1 día).
En lib/api-guard.ts:140: if (tier === 'Elite' && subscription.hmacSecret) NUNCA se cumple porque tier está en minúsculas ('elite'). Todo usuario Elite con hmacSecret configurado salta completamente la verificación HMAC (x-wac-signature, x-wac-timestamp).
En sentido contrario, app/api/v1/user/keys/update/route.ts:46 exige if (subscription.tier !== 'Elite') (sensible a mayúsculas) y rechazará cuentas almacenadas como 'elite' o 'ELITE'.
Remediación obligatoria:
Normalizar claves en tierLimits a minúsculas (starter, pro, elite).
Cambiar lib/api-guard.ts:140 a if (tier === 'elite' && subscription.hmacSecret). Validar además formato hex estricto y longitud de 64 caracteres de signature antes de Buffer.from(signature, 'hex') y verificar Number.isFinite(parsedTs) para evitar NaN bypass en Math.abs(now - parseInt(timestamp)) > 300.
En app/api/v1/user/keys/update/route.ts:46, comparar subscription.tier?.toLowerCase() !== 'elite'.
En el mismo endpoint (app/api/v1/user/keys/update/route.ts:28-43):
webhookUrl solo valida startsWith('https://'): añadir protección SSRF completa (resolución DNS + bloqueo de 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1, fc00::/7, fe80::/10, puertos no-443 o metadatos cloud, reutilizando el validador SSRF de app/api/link-preview/route.ts).
Validar cada elemento de ipWhitelist como IPv4/IPv6 o CIDR válido (zod + parser estricto) con máximo de 32 entradas.
Eliminar o proteger la puerta DEV_INTERNAL_WAC de lib/api-guard.ts:25 asegurando mediante invariante de CI que jamás sea alcanzable con NODE_ENV=production ni en staging público.
[SEG-C2] CRÍTICO — Explotación Financiera, Rate-Limit Roto e Inyección HTML en SEPA Billing (app/api/payment/confirm/route.ts)
Evidencia exacta en código:
line 31 & 126: const { reference, planId, billingCycle, priceEur, email } = body; -> amount: parseFloat(priceEur) acepta el precio enviado por el cliente sin verificarlo contra tarifas del servidor (un atacante envía { planId: 'ELITE', priceEur: '0.01' } y genera factura y registro contable fraudulento por 1 céntimo).
line 42 vs line 128: el anti-spam consulta prisma.transaction.count({ where: { fromAddress: email, ... } }), pero al insertar guarda fromAddress: walletAddress.toLowerCase(). La consulta siempre devuelve 0, dejando el endpoint vulnerable a spam ilimitado de facturas vía Resend y abuso de cuota de email.
line 145-210: planId, priceEur y reference se interpolan crudos en invoiceHtml enviada por Resend (HTML Injection / Phishing vía email oficial del dominio).
Contradicción con lib/security/retiredRoutes.ts:137: la ruta aparece marcada como retirada 410, pero todo el código legacy sigue en disco con defaults peligrosos (re_dummy_key_for_build_time, ES0000000000000000000000, Humanity Ledger Foundation, billing@system-analytics.com).
Remediación obligatoria:
Si la facturación SEPA está retirada para Ledger Chat: eliminar este handler legacy (dejando un único stub 410 o delegando en retiredRoutes.ts con test de contrato) y purgar toda referencia a "System Analytics" y "Humanity Ledger Foundation".
Si se decide conservar facturación empresarial v1:
Derivar priceEur exclusivamente en servidor desde NODE_TIERS[planId] (prohibir priceEur del body). Validar email con zod.string().email() y reference con regex estricta ^[A-Z0-9-]{8,40}$.
Arreglar el rate limit con checkRateLimit en Redis por walletAddress + email (máx. 3/24h) + índice DB real.
Escapar HTML en toda variable interpolada en plantillas email.
Eliminar defaults dummy (ES000..., Humanity Ledger Foundation, billing@system-analytics.com): fail closed con HTTP 503 si falta configuración bancaria oficial o RESEND_API_KEY.
[SEG-C3] CRÍTICO — Almacenamiento de contentHtml sin Sanitizar en Comunidades (app/api/chat/communities/posts/route.ts, app/api/chat/communities/[id]/posts/route.ts)
Evidencia exacta:
app/api/chat/communities/posts/route.ts:95 y app/api/chat/communities/[id]/posts/route.ts:121-153 persisten contentHtml en CommunityPost validando únicamente longitud (<= 40_000), sin sanitización server-side.
Aunque components/communities/CommunityReader.tsx:94-103 (postText) neutraliza actualmente etiquetas mediante DOMParser().textContent, el campo contentHtml crudo permanece en PostgreSQL como bomba de tiempo Stored-XSS ante cualquier futuro visor, feed SSR o cliente móvil/Capacitor, y viola el compromiso ya declarado en backlog.csv E-007 (CommunityReader.tsx:303 sigue enviando { content: body, contentHtml: body }).
Remediación obligatoria:
Unificar en un único campo content de texto plano/Markdown seguro.
Migrar CommunityReader.tsx:303 para dejar de enviar contentHtml.
En los endpoints POST legacy que deban seguir respondiendo (si COMMUNITY_LEGACY_READONLY=off), sanitizar/rechazar todo HTML mediante isomorphic-dompurify (ALLOWED_TAGS: []) en servidor y migrar la columna contentHtml de PostgreSQL a eliminada o purgada tras backup seguro.
Verificar en tests/regression/xss-community.test.ts que <img src=x onerror=alert(1)> y <svg onload=...> se rechazan o se reducen a texto inerte antes de escribir en DB.
[SEG-C4] CRÍTICO — Tres Derivaciones Incompatibles de "Aztec Address", Registro ZK Volátil y Rutas Zombi QDs Activas en PUBLIC_PREFIXES
Evidencia exacta:
Existen tres implementaciones incompatibles de deriveAztecAddress además de la derivación criptográfica real de la wallet:
lib/aztec/zk-identity.ts:57-65: keccak256(sha256("aztec-schnorr:" + evmAddress)) (NO es una dirección Aztec real ni coincide con el contrato Schnorr). Usada aún en lib/identity-gate.ts:48,91 (gate de las 200 identidades), app/api/chat/contacts/request/route.ts:134-135, app/api/chat/contacts/request/[action]/route.ts:14,48, app/api/aztec/derive-address/route.ts:26, app/api/aztec/restore-session/route.ts:45.
app/api/zk/identity/route.ts:24-27: `0xaztec${clean.slice(0,8)}${clean.slice(-6)}` almacenada en un Map volátil en memoria (se pierde en cada reinicio de Railway/réplica). Esta ruta sigue VIVA (ausente de retiredRoutes.ts) aunque el resto de /api/zk/* se retiró.
lib/zk/zkIdentity.ts:76: tercera implementación legacy huérfana.
Realidad criptográfica: lib/aztec/wallet/client.ts + lib/aztec/wallet/keys.ts derivan la dirección Aztec v6.0.0 real del contrato Schnorr vía @aztec-labs/accounts y la vinculan con G7 binding (lib/aztec/peer-binding.ts).
Simultáneamente, middleware.ts:103-107 mantiene en PUBLIC_PREFIXES las rutas /api/aztec/balance, /api/aztec/transactions, /api/aztec/derive-address, /api/aztec/restore-session:
app/api/aztec/restore-session/route.ts carece por completo de autenticación (getSession() / requireWallet()): permite enumerar sin sesión reclamaciones históricas de QDs, balances y txHash de cualquier EVM address si se llegara al handler.
app/api/aztec/balance/route.ts y app/api/aztec/transactions/route.ts siguen sirviendo el token simulado retirado QDs (creditsBalance: 2500), y balance/route.ts:57 ejecuta prisma.user.upsert({ where: { walletAddress: normalizedAddress } }) creando filas User contaminadas donde la columna EVM walletAddress guarda un hash de 66 caracteres (aztecAddress) en lugar de la wallet real EVM (sessionAddr)! (aztec/transactions ni siquiera figura en retiredRoutes.ts!).
app/api/zk/treasury/route.ts conserva en disco saldos inventados (DAI: 14250, USDC: 8500, ETH: 3.45) con un handler POST sin autenticación vulnerable a NaN/importes negativos si alguna vez saliera de retiredRoutes.ts.
Remediación obligatoria:
Eliminar físicamente las rutas simuladas y sus archivos muertos (app/api/zk/identity, app/api/zk/treasury, app/api/zk/balance, app/api/zk/sequencer, app/api/aztec/balance, app/api/aztec/transactions, app/api/aztec/derive-address, app/api/aztec/restore-session), o sustituirlas por respuestas 410 mínimas sin lógica ni DB writes + listar todas en retiredRoutes.ts y sacarlas inmediatamente de PUBLIC_PREFIXES en middleware.ts.
Migrar lib/identity-gate.ts, app/api/chat/contacts/request/route.ts y app/api/chat/contacts/request/[action]/route.ts para usar direcciones EVM canónicas de sesión + pruebas G7 reales (lib/aztec/peer-binding.ts), eliminando por completo lib/aztec/zk-identity.ts (deriveAztecAddress) y lib/zk/zkIdentity.ts. Auditar PostgreSQL para limpiar cualquier fila User contaminada con claves de 66 caracteres de aztecAddress.
[SEG-H1] ALTO — Brecha en Geofencing OFAC / Reglamento UE 833/2014 en middleware.ts
Evidencia exacta:
En middleware.ts:498-522, if (isPublicPath(pathname)) ejecuta return ... ANTES del bloque [FASE 18: OFAC / Restricted Jurisdiction Geofencing] de las líneas 527-550.
Como /chat, /connect, /beta, /alpha, /dashboard, /api/siwe/, /api/beta/cusdc/apply, /api/payments/checkout y /api/aztec/* están dentro de PUBLIC_PATHS / PUBLIC_PREFIXES, NINGUNA persona desde jurisdicción restringida u OFAC queda bloqueada al usar Ledger Chat, SIWE o el flujo cUSDC (incumpliendo el Gate #8 sanctionsPolicy de lib/payments/assets.ts:81 y contradiciendo el propio comentario de middleware.ts:526).
Remediación obligatoria:
Definir explícitamente qué rutas informativas legales son accesibles globalmente (/, /docs/*, /legal/*, /privacy, /terms, /status, /api/health, /api/ping, estáticos), y aplicar el geofencing antes de permitir rutas operativas de valor y mensajería (/chat, /beta, /alpha, /connect, /api/siwe/*, /api/aztec/*, /api/beta/*, /api/payments/*, /api/calls/*).
Además de IP edge (cf-ipcountry / x-vercel-ip-country), integrar el screening L1 de direcciones sancionadas en el puente HLPortal / lib/aztec/fee-juice.ts (cerrando CUSDC_GATES sanctionsPolicy y backlog N-009).
[SEG-H2] ALTO — x-forwarded-for Spoofable (Primer Hop vs Último Hop) en 20+ Rutas + PUBLIC_PREFIXES Permisivo
Evidencia exacta:
middleware.ts:414 y lib/security/rateLimiter.ts:140 (getClientIP) toman correctamente hops[hops.length - 1] (el IP añadido por el proxy de Railway/Cloudflare).
Contradicción de seguridad: 20+ rutas y librerías siguen tomando el primer hop spoofable (req.headers.get('x-forwarded-for')?.split(',')[0]) o la cadena cruda sin parsear: lib/api-guard.ts:128,193, lib/auth.ts:103, lib/aztec/zk-identity.ts:98, app/api/user/nuke/route.ts:33, app/api/user/sessions/route.ts:12, app/api/auth/nonce/route.ts:19, app/api/auth/complete-signup/route.ts:94, app/api/auth/custom-signin/route.ts:70, app/api/auth/kyc-qr-session/route.ts:16, app/api/auth/refresh/route.ts:42, app/api/chat/onion/relay/route.ts:204, app/api/user/settings/route.ts:201, app/api/forum/*, app/api/analytics/download-click/route.ts:17. Un atacante inyectando X-Forwarded-For: 1.2.3.4 elude rate limits y falsifica whitelists IP (lib/api-guard.ts:128).
Además middleware.ts:138-140 mantiene /api/user/register, /api/user/profile, /api/settings como PUBLIC_PREFIXES cuando POST /api/user/register (route.ts:28) y GET/POST /api/settings (route.ts:21,79) YA exigen sesión obligatoria!
Remediación obligatoria:
Prohibir lecturas directas de x-forwarded-for mediante regla ESLint/pattern check en CI (scripts/forbidden-patterns.mjs); centralizar TODA extracción IP exclusivamente en getClientIP(req) (validando CF-Connecting-IP si viene tras Cloudflare o último hop confiable de Railway).
Reducir PUBLIC_PREFIXES en middleware.ts estrictamente a rutas genuinamente públicas verificadas por scripts/route-inventory.ts (sacar /api/settings, /api/user/register, /api/aztec/* zombis, /api/payments/checkout). Solo dejar GET /api/user/profile pública o mover perfiles públicos a /api/u/[wallet] de solo lectura con validación estricta.
[SEG-H3] ALTO — Autenticación Dual-Split: 5 Cookies (system_handshake, wallet-auth Legibles por JS), SameSite Inconsistente y Redis KEYS * DoS
Evidencia exacta:
app/api/siwe/verify/route.ts:254-260 escribe 5 cookies (hl_session, human_session, ledger_session con maxAge: 7 días, sameSite: isProd ? 'none' : 'lax' + system_handshake y wallet-auth con httpOnly: false).
lib/session.ts:29-34,185-200 define ACCESS_TOKEN_DURATION: 15 min, hl_refresh: 30 días, pero usa sameSite: 'lax' (que el comentario de siwe/verify/route.ts:231 advierte que iOS Safari elimina al regresar por deep-link de MetaMask!), y todavía soporta 5 cookies legacy en getSession().
lib/session.ts:133, 155 y app/api/user/nuke/route.ts:112, 116 ejecutan redis.keys('refresh:*') / redis.keys(...), bloqueando el event-loop monohilo de Redis en producción (
𝑂
(
𝑁
)
O(N) sobre todo el espacio de claves).
ClientLayout.tsx:65 depende de la cookie no-HttpOnly system_handshake / wallet-auth (document.cookie) para saber si cargar settings, perpetuando la deuda de B-007 y B-008.
Remediación obligatoria:
Unificar sesión en UNA sola cookie HttpOnly hl_session (+ hl_refresh rotatorio con SameSite=Lax o un flujo de retorno POST /api/siwe/verify protegido por CSRF/SameSite adecuado probado en iOS Safari ITP, sustituyendo document.cookie en ClientLayout.tsx:65 por un endpoint ligero /api/siwe/session o claim en contexto). Retirar completamente system_handshake y wallet-auth.
Reemplazar TODO uso de redis.keys(...) en lib/session.ts y app/api/user/nuke/route.ts por un índice Redis Set por usuario (user_refresh:${userId}, con SADD/SMEMBERS/DEL) o SCAN no bloqueante con límite de iteración.
En app/api/user/nuke/route.ts: exigir que address.toLowerCase() === session.userId.toLowerCase(), incorporar un nonce de un solo uso en el mensaje firmado (Redis SET NX EX 300) para impedir replay del borrado dentro de la ventana de 5 minutos, corregir el header IP a getClientIP(), y reemplazar el texto "Your digital corpse has been cremated..." por lenguaje institucional conforme a RGPD Art. 17.
Auditar kyc_status y ledger_system_consent (docs/LEGAL_REVIEW_25NOV.md:42) y purgar cualquier ruta restante que las escriba o lea innecesariamente.
[SEG-H4] ALTO — Refactor de app/api/payments/checkout/route.ts, Eliminación de Backdoors de Propietario y Estrechamiento CSP (R2-6)
Evidencia exacta:
app/api/payments/checkout/route.ts:55-69 contiene un bypass hardcoded para OWNER_WALLET que promociona a ARCHIVE_PROVER hasta 2099, redirige al usuario que paga a rutas muertas/cerradas (/terminal 308 → /chat, /studio/provenance bloqueado por STUDIO_LOCKED) en líneas 68, 126-127, auto-crea productos Stripe (Humanity Ledger - ...) con metadatos obsoletos (ft_darkPool, ft_fixProtocol, maxTokens), y está expuesta bajo PUBLIC_PREFIXES.
next.config.js:519 sigue enviando Content-Security-Policy-Report-Only permisivo con 'unsafe-inline' 'unsafe-eval' junto al CSP estricto de middleware.ts:365, mientras middleware.ts:365 todavía permite connect-src https: wss: y frame-src https: sin acotar (hallazgo R2-6).
next.config.js:514 declara Permissions-Policy: geolocation=() mientras middleware.ts:626 sobrescribe con geolocation=(self) en rutas protegidas.
Remediación obligatoria:
Retirar app/api/payments/checkout/route.ts, /api/payments/provision-owner y NODE_TIERS obsoletos (o si existe suscripción real vigente para Ledger Chat, apuntar las URLs de retorno exclusivamente a rutas vivas /settings?billing=success, eliminar auto-creación ad-hoc de productos Stripe en runtime y separar todo acceso de administración a roles explicitados en DB/multisig auditables, nunca silent-upgrade en checkout).
Eliminar el Content-Security-Policy-Report-Only obsoleto de next.config.js:519 y unificar la política de cabeceras (especialmente Permissions-Policy) en un único módulo fuente.
Cerrar R2-6: estrechar connect-src y frame-src de middleware.ts:365 a allowlist explícita por dominio/esquema (nodos Aztec configurados, nodos XMTP, api.web3modal.org, *.walletconnect.org, *.walletconnect.com, relay.walletconnect.com, js.stripe.com, Cloudflare R2 bucket configurado, Ledger Relay configurado y RPCs explícitos + custom RPC validado del usuario).
Eliminar app/api/dev/deploy/route.ts, app/api/admin/launch-checklist/route.ts, app/api/admin/logout/route.ts y comprobar que toda ruta en RETIRED_API_ROUTES tiene el archivo físico eliminado o bloqueado con invariante de build.
[SEG-M1] MEDIO — Bug de Lógica Invertida en PIN_MESSAGE, Inyección/Evasión de Mini-Apps y Secretos Dummy en Build
Evidencia exacta:
app/api/chat/communities/route.ts:269: if (memComm) return NextResponse.json({ error: 'Post not found' }, { status: 404 }); — lógica invertida que debe revisarse y testearse junto con los in-memory communities.
lib/community-apps/validate.ts: validación basada en regex fácilmente evadible por ofuscación JS (window['lo'+'cation'], String.fromCharCode). Aunque el iframe usa APP_FRAME_CSP sandboxed, reforzar validación + asegurar worker-src 'none', form-action 'none', navigate-to 'none' y validación estricta de esquema de mensajes postMessage.
next.config.js:80-81 inyecta MORALIS_API_KEY = 'dummy_moralis_key_to_pass_build' y lines 486-488 inyectan direcciones dummy '0x1111...1111', '0x2222...2222' con NEXT_PUBLIC_CHAIN_ID || '8453' (Base en vez de Ethereum L1 1). Eliminar todas las constantes dummy/placeholder de next.config.js e inyectar validación estricta de entorno mediante zod (lib/env.ts) para runtime sin romper el build estático cuando corresponda.
3. PARTE II — RESOLUCIÓN ABSOLUTA DE TODAS LAS CONTRADICCIONES (CÓDIGO ↔ DOCS ↔ LEGALIDAD ↔ CONTRATOS ↔ UI)

Construye un script verificador automatizado en CI (scripts/verify-truth-consistency.ts) y corrige todas estas contradicciones verificadas:

ID	Contradicción Exacta Detectada	Fuente Canónica Única a Establecer (SSOT)
CON-01	Comunidades MLS vs Server-Readable: docs/ALPHA_COMPLETE_HANDOFF.md:13,70 prohíbe communityMls=true y dice "communities stay server-readable"; en cambio docs/STATUS.md:7,41 y app/api/chat/communities/route.ts ya crean TODAS las comunidades nuevas (desde 24-Nov) en grupos XMTP MLS y dejaron las anteriores como solo lectura (lib/communities/legacy.ts).	Actualizar ALPHA_COMPLETE_HANDOFF.md, AZTEC_FOUNDATION_DOSSIER.md §0 y UI de creación: Comunidades < 24-Nov-2026 = solo lectura en servidor (COMMUNITY_LEGACY_READ_ONLY, plan de exportación y borrado tras confirmación del operador); Comunidades ≥ 24-Nov-2026 = XMTP MLS + completar cierre real de R17_ACCEPTANCE.md (conectar XMTP client en settings/Expel removeGroupMember + habilitar test AC-03 real sin .skip).
CON-02	Red declarada en JSON-LD vs Producción: app/layout.tsx:321 declara en el Schema.org público de toda la web "Private payments on the Aztec test network", contradiciendo STATUS.md ("live on Aztec Alpha mainnet") y el primer pago real HLC (14-Nov, bloque 29012) y cUSDC beta (23-Nov, bloque 46420).	Corregir app/layout.tsx:321 para reflejar con precisión exacta: pagos privados en Aztec Alpha (mainnet) con límites/beta cerrada y sin auditoría externa aún, junto al modo testnet.
CON-03	Términos, Risk Disclosure, Privacidad y Cookies vs Realidad (docs/LEGAL_REVIEW_25NOV.md): /docs/terms y /docs/disclaimer afirman que el wallet corre SOLO en test network sin valor monetario y prometen no conectar a red con valor real antes de una auditoría externa — pero cusdcBeta.enabled = true opera con cUSDC real en Alpha con audit: null. /docs/privacy sigue mencionando login por email (retirado 410), OpenRelay (eliminado), Turnstile (ausente), adjuntos "not yet encrypted" (ya cifrados AES-256-GCM en R2), sin listar Groq ni human.tech; /docs/cookies omite hl_locale, wallet-auth, system_handshake, kyc_status, ledger_system_consent.	Preparar PR legal completo alineando las 5 páginas de lib/docs/pages/legal.ts para revisión y firma del operador/letrado (respetando OD-8 sin autopublicar textos legales no aprobados por abogado), eliminando cookies obsoletas en el código para que la tabla de cookies sea mínima (solo cookies esenciales + hl_locale).
CON-04	4 Marcas y 4 Entidades Legales Distintas: lib/constants/legalEntity.ts = "Stefan Antonio Cirisanu, trading as Humanity Ledger" (individual, taxId: null, postalAddress: null, email: humanityledger@icloud.com); deployments/aztec-mainnet.json:47 (token HLC activo) = "Humanity Ledger Corp." (renamePending: true); app/api/payment/confirm/route.ts = "Humanity Ledger Foundation" / "System" / "System Analytics · Madrid, Spain" (billing@system-analytics.com); app/layout.tsx:292 = contact@ledgerchat.org.	Unificar al 100%: 1) Eliminar "System Analytics", "System Billing" y "Humanity Ledger Foundation"; 2) Redeployar HLC con nombre neutro HLC Test Token (HLC_TOKEN_META en lib/payments/assets.ts:28) y retirar el token "Humanity Ledger Corp." a retiredTokens; 3) Unificar email oficial (contact@ledgerchat.org o humanityledger@icloud.com) en LEGAL_ENTITY, footer y JSON-LD; 4) Rellenar taxId, postalAddress y forma societaria al constituirse la entidad (LSSI-CE art. 10).
CON-05	Testers Beta & Alpha (20 vs 50 vs 100): STATUS.md:22 y AZTEC_FOUNDATION_DOSSIER.md:97 hablan de máx. 20 testers para Wave 1; deployments/aztec-mainnet.json:23 configura closedAlpha.maxTesters: 50; cusdcBeta.maxTesters es 100.	Unificar en una tabla única dentro de deployments/aztec-mainnet.json leída programáticamente tanto por las rutas UI/docs como por las alertas de capacidad (closedAlpha: acuerdos HLC Wave 1, actualmente enabled: false; cusdcBeta: transferencias cUSDC, actualmente enabled: true, cap 100 testers).
CON-06	cUSDC Gates (CUSDC_GATES todos false) vs cusdcBeta Activo: lib/payments/assets.ts:72-83 muestra 9 gates en met: false, pero deployments/aztec-mainnet.json:36 tiene cusdcBeta.enabled: true con valor real.	Clarificar estrictamente la política en UI/docs: cusdcBeta es un piloto técnico acotado a ≤100 testers con consentimiento informado y cap por tx, pero cusdcPublic.enabled DEBE permanecer false en el código con test bloqueante hasta que los 9 gates de CUSDC_GATES pasen a true con evidencia archivada.
CON-07	Tesorería de Contratos Aztec: PrivateEscrow.nr:146 y PaymentStream.nr fijan TREASURY a la cuenta individual de Stefan (0x1773...faed), mientras ALPHA_COMPLETE_HANDOFF.md:49,179 y condición 3 exigen multisig 4-de-7. Además FEE_BPS = 0 hace inerte el fee en Alpha.	Mantener los contratos escrow/streams bloqueados para Alpha (contracts: [], audit: null), desplegar el multisig 4-de-7 real en Aztec antes de producción, actualizar TREASURY y pasar TXE + auditoría externa.
CON-08	AztecContext.tsx vs lib/aztec/wallet/client.ts: app/layout.tsx:610 monta <AztecProvider> global intentando hablar con @aztec/aztec.js y node.aztec.network usando @ts-ignore y pasando un objeto { chainId, protocolVersion } a la función traductora setNodeInfo(tr(info)), aunque la línea 181 del propio archivo confiesa que la cartera privada no usa este provider.	Eliminar <AztecProvider> del árbol global (mover cualquier debug/sandbox legacy fuera de producción o borrar context/AztecContext.tsx entero si no tiene consumidores reales) y arreglar el bug de tr(info).
CON-09	backlog.csv Desfasado vs Estado Real: Afirma "Hecha" en D-032 (LedgerChatV2.tsx tiene 9.881 líneas), I-018 (ignoreDuringBuilds: true), I-016 (8 @ts-nocheck), G-026 (minimize: false), C-013 ((prisma as any)), H-013 (/prove inexistente), H-018 (rutas /api/zk/* y aztec/balance vivas en disco).	Auditar y regenerar el estado real automáticamente desde checks de CI; prohibir estados manuales optimistas en docs/antigravity/backlog.csv.
CON-10	lib/aztec/client.ts (@ts-nocheck) vs lib/aztec/wallet/client.ts y @aztec/bb.js 5.3.0 vs 6.0.0 + CHAIN_ID Base (8453) vs Alpha Ethereum L1 (1) en next.config.js:488.	Limpiar next.config.js, verificar compatibilidad de versiones exactas @aztec/bb.js / @aztec-labs/* 6.0.0 en scripts/aztec/check-sdk-single-version.mjs, eliminar fallbacks de Base (8453) donde el protocolo opera sobre L1 Mainnet (1) y eliminar lib/aztec/client.ts sustituyendo sanitiseExplorerUrl / probeMainnetNode en módulos tipados estricto bajo lib/aztec/wallet/.
CON-11	PROOF_BENCHMARKS.md Estimado sobre Circuitos Retirados: Publica benchmarks estimados del 31-Oct sobre circuits/escrow/ retirados el 25-Nov en lugar de mediciones reales sobre Aztec v6 (@aztec-labs/wallets + PrivateEscrow.nr).	Sustituir la tabla por benchmarks reales medidos con el harness de aztec-nr v6 en Desktop M-series/x64, Android gama media y iPhone Safari (ver Parte IV.2).
4. PARTE III — MADUREZ DEL CÓDIGO Y ARQUITECTURA DE GRADO 5★

Tolerancia Cero a Supresiones y Builds Ciegos (next.config.js & TypeScript):

Cambiar eslint.ignoreDuringBuilds: false y typescript.ignoreBuildErrors: false en next.config.js:91-96.
Eliminar TODOS los // @ts-nocheck de:
app/api/admin/launch-checklist/route.ts (o retirar ruta)
app/api/auth/passkey/generate-options/route.ts (o retirar/tipar según estado real de WebAuthn)
app/api/dev/deploy/route.ts (eliminar ruta)
components/chat/BurnTimerSheet.tsx
components/chat/LedgerSettingsFull.tsx
components/zk/ZkSequencerDashboard.tsx (o retirar si no se usa)
lib/aztec/client.ts (fusionar tipado o retirar)
lib/settings-validation.ts
Activar strict: true (y eliminar @ts-ignore en context/AztecContext.tsx u otros).
Eliminar todos los (prisma as any) ejecutando prisma generate sobre el esquema depurado y tipado con PrismaClient estricto.

Descomposición Modular de components/terminal/LedgerChatV2.tsx (9.881 líneas):

Dividir ese monolito en una arquitectura limpia con archivos < 350 líneas:
modules/chat/engine/ (useXmtpSync.ts, useMessageSend.ts, useOfflineOutbox.ts, useGroupMembership.ts)
modules/chat/calls/ (CallManager.tsx, PeerTransport.ts, IceRefreshService.ts)
modules/chat/state/ (Zustand store con selectores finos: un mensaje entrante SOLO re-renderiza la fila/burbuja de esa conversación, nunca el árbol entero)
modules/chat/ui/ (ConversationList.tsx, ChatThreadHeader.tsx, MessageComposer.tsx, AttachmentDrawer.tsx, ContextMenus.tsx)
Todo panel secundario (ExpressionPicker, QrScanner, AgreementComposer, ZkWalletPanel, LedgerSettingsFull, CommunityManage) permanece 100% con next/dynamic({ ssr: false }) y carga perezosa al pulsar el botón, nunca al montar /chat.

Poda Quirúrgica de Código Zombi, Dependencias Pesadas y Esquema PostgreSQL:

Dependencias (package.json): Auditar con depcheck y knip y eliminar paquetes de productos retirados que inflan node_modules, build time (>6 GB RAM en NODE_OPTIONS="--max-old-space-size=6144") y superficie de npm audit (p. ej. @bsv/sdk, neo4j-driver, @solana/web3.js, @worldcoin/idkit, libp2p & @chainsafe/*, @flashbots/ethers-provider-bundle, puppeteer en dev si Playwright lo sustituye, librerías gráficas duplicadas entre chart.js / recharts / d3 / lightweight-charts / react-simple-maps, three si solo se usa en landing lazy).
Rutas API muertas: Eliminar los archivos .ts de las ~150 rutas listadas en RETIRED_API_ROUTES si ya no requieren stub, dejando un único catch-all o middleware edge 410 + test en CI asegurando 0 superficie ejecutable dormida.
Base de datos (prisma/schema.prisma — 2.012 líneas): Archivar/migrar fuera modelos de productos retirados (Article, Sector, GoldRegistryAudit, EcosystemWarRoomData, tablas DirectMessage/PendingChatMessage tras política de expiración aprobada por Stefan) y asegurar índices compuestos en toda consulta de chat/comunidades (@@index([communityId, channelId, createdAt]), User.chatName case-insensitive funcional o normalizado chatNameLower), take acotado ≤ 100 en todo findMany y separación estricta DATABASE_URL (pooled) vs DATABASE_URL_UNPOOLED (directUrl).

Observabilidad, Cortacircuitos y Graceful Shutdown:

Logging estructurado (pino con redacción automática de tokens, secretos, emails y direcciones completas — 0 console.log de PII).
Endpoint /api/health real con verificación de PostgreSQL (SELECT 1), Redis (PING) y latencia de nodo Aztec sin exponer secretos.
SIGTERM graceful drain para streams SSE, WebSockets del relay y pools PostgreSQL/Redis antes de apagar réplicas en Railway.
Cortacircuitos (circuit breaker + AbortSignal.timeout) con backoff exponencial en llamadas a RPC Ethereum/Aztec, XMTP y Resend/Cloudflare R2.
5. PARTE IV — OPTIMIZACIÓN EXTREMA PARA TODOS LOS EQUIPOS (PC + MÓVIL SIN EXCEPCIONES)

Esta sección es crítica. El objetivo es que Ledger Chat cargue en < 1.5s y opere a 60 FPS constantes, sin OOMs, sin zooms rotos, sin pérdidas de sesión y sin cuelgues criptográficos en cualquier hardware:

PC Desktop: Windows/macOS/Linux (Chrome, Edge, Brave, Firefox, Safari; hardware potente y portátiles básicos de 8 GB RAM; soporte teclado Cmd/Ctrl+K, lectores de pantalla, multi-monitor PiP).
Móvil: iPhone (Safari iOS 16/17/18+, Chrome iOS WebKit, modo incógnito, MetaMask/Coinbase/Rainbow In-App Browsers), Android (Chrome/Brave gama baja-media 3–4 GB RAM, Kiwi/MetaMask Mobile, Android System WebView), PWA instalada y Capacitor nativo (@capacitor/ios, @capacitor/android).
IV.1 — Eliminación de Bloqueos de CPU/Batería y Minificación Segura en Producción
Resolver el bug TDZ manteniendo Minificación Activa (next.config.js:330-346):
Actualmente next.config.js desactiva toda minificación de producción (config.optimization.minimize = false; config.optimization.concatenateModules = false;) para esquivar un crash de orden de inicialización TDZ en dependencias circulares wagmi ↔ viem bajo WebKit Safari. Enviar megabytes de JS sin minificar destruye el parse time, TBT y consumo de RAM en móviles Android e iOS.
Solución definitiva: Re-activar minificación con TerserPlugin configurado explícitamente para Safari WebKit ES2020 (mangle: { safari10: true }, compress: { collapse_vars: false, reduce_vars: false, sequences: false }, concatenateModules: false o moduleIds: 'deterministic'), o aislar las importaciones circulares wagmi/viem, midiendo y verificando con test automatizado en WebKit real (.github/workflows/landing-webkit.yml + settings-webkit.yml) que 0 errores Cannot access '...' before initialization ocurran tras minificar! Lograr bundle /chat inicial < 300 KB gzip.
Eliminar el lastre del árbol raíz (app/layout.tsx, ClientLayout.tsx, MobileEnforcer.tsx, AntiTamperCore.tsx):
Quitar el import muerto de MobileLanding en components/layout/MobileEnforcer.tsx:4 (que arrastra la landing móvil al bundle de escritorio/chat mientras minimize: false estaba activo).
Corregir ClientLayout.tsx:
Declarar const isChat antes de su useEffect (line 148) e incluirla en [isDashboard, isBounded, isChat].
Guardar referencia estable al listener onBatteryChange para que removeEventListener en líneas 204-206 realmente libere memoria al desmontar.
No cargar <Providers> (Web3/AppKit/Wagmi/NextAuth) ni <ChatKeepAlive> en páginas estáticas puras de documentación/landing si no interactúan con wallet (Code-splitting por grupo de rutas (public) vs (app)).
Reemplazar/Eliminar AntiTamperCore.tsx:
AntiTamperCore.tsx actualmente agenda un loop requestAnimationFrame infinito a 60–120 FPS + un MutationObserver({ subtree: true, attributes: true, attributeFilter: ['style', 'data-state', ...] }) sobre todo document.body + hashes djb2 síncronos en el hilo principal, drenando batería móvil y generando micro-stutters en cada scroll o animación Framer Motion; además puede desloguear por error ante mutaciones legítimas de React (violations >= 3) y bloquea click derecho / dragstart (rompiendo accesibilidad desktop y drag-to-upload en chat).
Seguridad real en vez de teatro DOM: La integridad del código se garantiza mediante CSP estricta con nonce + SRI (sri: { algorithm: 'sha256' } ya en next.config.js) + Cookies HttpOnly + firma criptográfica de cada operación. Retirar el loop rAF, retirar el MutationObserver global de style en body, y restaurar contextmenu / dragstart nativos (permitiendo drop de archivos en el compositor de /chat).
IV.2 — Arquitectura Real para Aztec WASM Proving (@aztec/bb.js + PXE + OPFS) en Móviles de 3–4 GB RAM y PCs
Resolver el dilema /chat (sin COOP/COEP) vs Proving Multi-Thread (/prove):
Hoy middleware.ts:611-618 pone Cross-Origin-Opener-Policy: same-origin + Cross-Origin-Embedder-Policy: require-corp en /prove (¡pero app/prove/page.tsx NO existe!), mientras /chat corre proving monohilo para no romper los popups de WalletConnect/AppKit. Resultado: pruebas lentas en móviles y PC, congelación del thread o agotamiento de heap WASM.
Solución arquitectónica:
Capa A (Web Worker dedicado): Mover el 100% de la instanciación PXE, bb.js WASM y síntesis de testigos fuera del main UI thread a un Dedicated Web Worker, garantizando 0 ms de bloqueo de UI durante la prueba (INP < 50 ms).
Capa B (Aislamiento /prove Cross-Origin o Sub-Worker): Evaluar e implementar /prove aislado (COOP: same-origin + COEP: require-corp o credentialless) como superficie/popup o iframe dedicado compatible cuando SharedArrayBuffer + Atomics + WASM threads estén disponibles en desktop Chrome/Firefox/Android Chrome (multiplicando x3–x4 la velocidad de proving con pthreads), con degradación automática y limpia a single-thread + memoria acotada en iOS Safari / in-app WebViews que restringen SharedArrayBuffer.
Gestión estricta de Memoria WASM en Móvil (Prevenir Jetsam Crash en iOS Safari):
Cola strict single-flight (lib/aztec/single-flight.ts): jamás instanciar 2 UltraHonkBackend o Barretenberg WASM en paralelo.
Liberar explícitamente backend.destroy() / instancias WASM tras inactividad (IDLE_CLOSE_MS + listener visibilitychange + pagehide) y pausar el polling del dashboard (lib/dashboard/live.ts) mientras se genera una prueba (verificar que no compiten por CPU/RAM).
Pre-calentamiento inteligente y caché inmutable de binarios .wasm y artefactos .json en OPFS/CacheStorage por versión de artefacto.
Si el dispositivo detecta navigator.deviceMemory <= 4 o hardware móvil modesto: mostrar estimación honesta de duración, pedir Screen Wake Lock API (navigator.wakeLock?.request('screen')) durante la generación de la prueba para que iOS/Android no suspendan el tab a mitad de un proof de 6 segundos, y degradar gracefully si se suspende.
Almacenamiento Cifrado OPFS SQLite (lib/aztec/wallet/store.ts) + Navegación Privada / WebViews:
Mantener los pools separados .aztec-kv-pxe_data y .aztec-kv-wallet_data (storePoolDirectoryFor) evitando SqlitePoolBusyError, y coordinar multi-pestaña en PC/móvil mediante BroadcastChannel + Web Locks API (lib/aztec/wallet/tab-handoff.ts).
En navegadores donde navigator.storage.getDirectory() o createSyncAccessHandle() en Worker falle (iOS Private Browsing, WebViews antiguos): detectar la capacidad antes de pedir firma de cartera al usuario y mostrar un diagnóstico accionable en un toque ("Abrir en Safari/Chrome estándar para almacenamiento cifrado OPFS" o flujo Capacitor Keychain nativo), nunca tras hacerle firmar en vano.
Benchmarks Reales Hardware-Verified:
Implementar scripts/benchmark-proof-gen.ts real contra contratos aztec-nr v6 (PortalToken, PrivateEscrow, PaymentStream) y actualizar docs/PROOF_BENCHMARKS.md con tiempos medidos p50/p95, pico RAM MB y tamaño de proof en: (1) Desktop Apple Silicon/x64 Chrome, (2) Android gama media Chrome, (3) iPhone iOS Safari.
IV.3 — Viewport Móvil Moderno, In-App Wallets y Sign-In Sin Fricción
Eliminar hacks frágiles de <meta name="viewport"> en app/layout.tsx:360-382:
Sustituir el MutationObserver continuo sobre document.head y el escalado forzado initial-scale=0.9 por CSS responsive moderno nativo:
font-size: 16px mínimo en <input>, <textarea>, [contenteditable] en móviles (elimina el auto-zoom nativo de iOS Safari sin necesitar hacks de maximum-scale ni bloquear el pinch-to-zoom WCAG 1.4.4!).
Unidades dinámicas 100dvh (h-[100dvh]) + env(safe-area-inset-top/bottom/left/right) + KeyboardViewport conectado a window.visualViewport (resize/scroll) y interactive-widget=resizes-content estático para que al abrir el teclado virtual en iPhone o Android el campo de escritura y el botón Enviar queden siempre visibles por encima del teclado, con 0 saltos ni cortes del notch/Dynamic Island.
Tamaño mínimo de todo tap target ≥ 44x44px (48px recomendado).
Flujo SIWE Móvil Perfecto (1 solo viaje al wallet):
Completar las pruebas reales en dispositivo físico del paquete config/appkit.tsx (docs/CONNECT.md) y activar NEXT_PUBLIC_ONE_CLICK_AUTH=true tras verificar wc_sessionAuthenticate en iPhone Safari + MetaMask Mobile + Rainbow + Coinbase + Trust Wallet y Android Chrome.
Asegurar que la bifurcación isPhoneBrowserWithoutWallet() no se active falsamente en Android Chrome normal vs In-App Browser, y que el fallback Open in MetaMask (metamask:// iOS / intent:// Android) funcione sin bucles de redirección ni pérdida de cookies ITP.
Validar en hardware real iPhone/iPad (Touch ID / Face ID) y Android (Huella) el desbloqueo de wallet con WebAuthn PRF Passkeys (lib/aztec/wallet/passkey.ts), y aplicar la migración pendiente del backup cifrado de passkeys mencionada en docs/STATUS.md:45.
IV.4 — Mensajería XMTP MLS, Comunidades, Adjuntos y Llamadas WebRTC en Redes Móviles Inestables
XMTP Outbox Offline-First + Recuperación de Cambios de Red (Wi-Fi ↔ 4G/5G):
Garantizar cola de salida local persistente en IndexedDB (chatDB) con idempotencia estricta ante reintentos y reconciliación al disparar eventos online, visibilitychange y navigator.connection?.onchange.
Investigar y cerrar XMTP-PUBLISH ("Sync failed to wait for intent") con backoff inteligente + diagnóstico sin fuga PII.
Ejecutar el plan docs/xmtp/SELF_HOSTED_MIGRATION.md (fases M0–M7) de infraestructura propia XMTP antes del apagón anunciado de la red alojada por XMTP Labs a inicios de 2027.
Eliminar Polling Residual en Comunidades (CommunityReader.tsx:268):
Reemplazar setInterval(fetchPosts, 15_000) por streaming XMTP (streamGroupPosts en comunidades MLS) y SSE sobre Redis pub/sub para comunidades legacy de solo lectura, pausando toda actividad de red cuando document.visibilityState === 'hidden'.
Cerrar los criterios restantes de docs/communities/R17_ACCEPTANCE.md (AC-01..AC-04, incluyendo removeGroupMember al expulsar desde settings y test real de dos navegadores para AC-03 sin .skip).
Llamadas WebRTC 1:1 en CGNAT / NAT Simétrico / Cambio de Red:
Garantizar credenciales Cloudflare TURN de corta duración (app/api/calls/ice/route.ts) + fallback a ledger-relay sin exponer jamás openrelayproject.
Soporte ICE restart automático en el evento iceconnectionstatechange === 'disconnected' | 'failed' al cambiar el móvil de Wi-Fi a 4G/5G (lib/calls/machine.ts), AudioContext / MediaSession (components/activities/mediaSession.ts) correctamente enlazado con controles de pantalla bloqueada en iOS/Android, y opción efectiva de privacidad máxima (iceTransportPolicy: 'relay').
Corregir tx / captura en Android donde getUserMedia solo permite 1 llamada por gesto de usuario (lib/calls/media.ts), y verificar compatibilidad Safari ↔ Chrome (Opus without forced RED reordering).
PWA, Push Sin Metadatos y Capacitor Nativo (@capacitor/ios, @capacitor/android):
Verificar public/sw.js: navigator.serviceWorker cache-first solo para estáticos inmutables (/_next/static/, .wasm, /fonts/), network-first con cache: 'no-store' para HTML (para recibir CSP nonce fresco), nunca cachear /api/*, y CLEAR_ALL_CACHES funcional ante deploys.
Web Push & APNs/FCM nativo con payloads ciegos (hideContent: true por defecto — sin remitente ni texto en el payload de Apple/Google!).
Definir claramente y validar en CI las carpetas nativas Capacitor (ios/, android/) con almacenamiento de secretos en Keychain / Android Keystore y WebAuthn/biometría nativa; si los builds nativos de escritorio (Electron / Ledger-Chat-Setup-Windows.exe) no están firmados ni mantenidos bajo auditoría (Electronegativity), retirarlos limpiamente de /releases o firmarlos con Authenticode + contextIsolation: true.
6. PARTE V — ELEVACIÓN DE SMART CONTRACTS Y CRIPTOGRAFÍA AZTEC/L1 A AUDIT-READY

Para desbloquear deployments/aztec-mainnet.json → "audit" y habilitar pagos, escrows, streams y el puente L1↔L2 Ethereum mainnet a nivel 5★:

Contratos Noir (contracts/aztec/) — Cierre de Pre-Requisitos D-4 / D-5:

D-4 (Interfaz tipada en PrivateEscrow.nr y PaymentStream.nr): Reemplazar las llamadas por selector crudo TRANSFER_IN_PRIVATE_SELECTOR = FunctionSelector::from_signature("transfer_in_private(...)") mediante una interfaz/trait tipado contra el contrato Token estándar v6.0.0 (resolviendo el riesgo de crate duplicado documentado en AZTEC_NR_V6_NOTES.md), eliminando el riesgo silencioso si cambia la firma del método.
Tesorería Multisig (H3): Preparar script y checklist de actualización constante TREASURY de 0x1773...faed al multisig 4-de-7 definitivo en PrivateEscrow.nr:146, PaymentStream.nr y lib/protocol/fees.ts, con recompilación CI, cálculo determinístico getContractClassFromArtifact, actualización de lib/aztec/artifact-pins.ts + scripts/aztec/pin-artifacts.mjs --check y ejecución íntegra de TXE dentro de cada crate (escrow, streams, identity, portal_token).
Tests Basados en Propiedades (Fuzzing Invariante): Ampliar TXE + TypeScript property tests (fast-check ≥ 50.000 casos) verificando que Σ(withdrawals) + cancel_payout == deposit_total, saturación u128 en quote_protocol_fee, unicidad de nulificadores de creación/depósito/liquidación y expiración estricta <= min(deadline, anchor + MAX_TX_LIFETIME).
Documento de Invariantes + Guía de Reproducción < 30 min: Generar/actualizar docs/audit/REPRODUCE_30MIN.md para auditores externos (Noir/Aztec) cumpliendo D-5.

PrivateFPC (Privacidad del Pagador de Fees en Mainnet Alpha):

Probar en testnet/staging y luego habilitar lib/aztec/private-fees.ts (@alejoamiras/private-fee-juice 6.0.0) con límites estrictos de gas simulado + tope PRIVATE_FEE_MAX_COST, de modo que las transacciones en Aztec Alpha y las reclamaciones de HLReceiver dejen de filtrar públicamente la dirección Aztec del emisor/receptor como pagador de Fee Juice. Mientras esté en OFF, preservar los avisos explícitos de lib/privacy/disclosure.ts.

Portal Ethereum L1 ↔ L2 (HLPortal.sol, HLReceiver.sol, PortalToken.nr):

Mantener HLPortal.sol (invariantes I1–I6, timelock 2d, nonReentrant, verificación delta de saldo anti fee-on-transfer/rebasing, sunset seguro con retiros abiertos) y HLReceiver.sol (CREATE2 vía Clones EIP-1167, rescue() EIP-712, forceApprove(..., amount) → reset 0 para USDT) bajo suite Hardhat + Foundry (invariant_) + Slither + Aderyn con 0 hallazgos medios/altos.
Conectar completamente el UI de Paso 2 de retiro L2→L1 (lib/portal/outbox.ts) e incluir screening de direcciones sancionadas en el portal L1 antes de lanzar Wave 2 (tras auditoría externa + Safe 2-de-3 admin + hardware wallet guardian conforme a OD-1 y OD-6).
Decidir explícitamente sobre ZKIdentityRegistry.sol: dado que verifyCredential revierte con VerifierNotConnected() (lines 44-50), o bien integrarlo con un verificador Honk real generado por bb y VK fijado, o moverlo a archive/ fuera de contratos activos para no confundir a auditores externos.

Verificación G7 v3 y Passkeys:

Ejecutar el workflow real R8 entre dos navegadores y dos usuarios distintos no-operadores en Alpha/testnet registrando los hashes de transacción verificables (G7-R8).
Documentar e investigar el camino hacia G7 v3 (vincular prueba sobre claves de nulificador/privacidad cuando Aztec v6+ estandarice el mecanismo, manteniendo la honestidad actual de que G7 v2 es TOFU + firma Schnorr sobre clave de firma).
7. PARTE VI — CIERRE DE COMPLIANCE, LEGAL Y LOS 9 GATES cUSDC (PRE-LANZAMIENTO PÚBLICO)

Generar un Compliance Readiness Package técnicamente auditable que deje lista toda la base de código para la firma legal y cierre los 9 gates de lib/payments/assets.ts:

legal & legalNoteNotCasp: Verificación documental y arquitectónica en código de no-custodia absoluta (0 claves privadas de usuario, 0 PXE en servidor, 0 sponsor FPC propio, 0 custodia de cUSDC/ETH en servidor).
entity & LSSI-CE Art. 10: Checklist y esquema validado en lib/constants/legalEntity.ts para rellenar razón social (S.L.), CIF/NIF y domicilio registral, más la retirada del token mal nombrado "Humanity Ledger Corp." hacia "HLC Test Token".
onchain & audit: Script automatizado aztec-mainnet-preflight que valida clase e instancia exacta de cUSDC de human.tech + registro estructurado del informe de auditoría en deployments/aztec-mainnet.json.
alpha (TESTER_MISSIONS.md): Tablero de métricas reales verificadas con >= 100 sesiones reales (tasa de entrega XMTP, latencia de mensajes, tasa de éxito de pagos cUSDC/HLC y llamadas WebRTC en móvil + PC).
sanctionsPolicy: Geofencing Edge sin bypass en rutas públicas (middleware.ts) + filtro on-chain/portal antes de depósitos/retiros L1 (HLPortal.sol / lib/aztec/fee-juice.ts) conforme a Reglamento UE 833/2014 art. 5b.
RGPD Arts. 17, 20, 30, 33 & DSA:
Implementar/verificar GET /api/user/export (Art. 20 portabilidad JSON real de datos del servidor del usuario).
Corregir POST /api/user/nuke (Art. 17 borrado atómico sin replay ni redis.keys).
Política automatizada de retención de logs ≤ 30 días y limpieza cron de sesiones expiradas y notificaciones antiguas.
Mantener formularios/moderación en comunidades públicas conforme a DSA y verificación de edad mínima (UE 16 años) sin almacenar PII innecesaria.
lib/docs/pages/legal.ts (Reconciliación bajo OD-8): Entregar un archivo paralelo docs/LEGAL_PATCH_PROPOSAL_SIGNED_NEEDED.md con la redacción exacta corregida de todos los desajustes de docs/LEGAL_REVIEW_25NOV.md (/docs/terms, /docs/privacy, /docs/cookies, /docs/disclaimer, /docs/content-policy) listo para que Stefan y su abogado aprueben e integren sin que un agente modifique texto legal sin autorización.
8. PARTE VII — PROTOCOLO DE VERIFICACIÓN AUTOMÁTICA OBLIGATORIA (GATES DE SALIDA 5★)

Ninguna fase se declara terminada hasta ejecutar y adjuntar salida completa y verde (0 fallos, 0 skips encubiertos) de esta matriz de verificación tras el último commit:

bash
# 1. Higiene estática, patrones prohibidos y consistencia de rutas/documentación
npm run check:patterns
npm run check:routes
npm run check:copy
npm run check:artifacts
npx tsx scripts/check-traceability.ts
npx tsx scripts/aztec/check-sdk-single-version.mjs
# 2. TypeScript estricto, ESLint y Build de producción MINIFICADO real
npx tsc --noEmit
npm run lint
npm run build
# 3. Suites de seguridad, criptografía, fuzzing e invariantes de servidor
npm run test:run
npm run test:crypto
npx vitest run test/auth/ test/unit/aztec/ test/unit/portal/ test/unit/communities/
npx vitest run test/fortification.test.ts test/property_fuzz.test.ts test/eaf_isolation.adversarial.test.ts test/key_custody.test.ts
# 4. Smart Contracts (Hardhat + Foundry + Slither + Aztec TXE por cada crate)
npm run test:contracts
forge test
npm run audit:prepare
for c in portal_token escrow streams identity test_token; do (cd contracts/aztec/$c && aztec compile && aztec test); done
# 5. Supply chain y secretos en todo el historial
npm audit --audit-level=high
gitleaks detect --no-banner --verbose
# 6. Matriz Cross-Device & Browser Real (Desktop Chromium/Firefox/WebKit + Emulación Móvil 390px/412px + Lighthouse CI)
npx lhci autorun --config=lighthouserc.json
npx lhci autorun --config=lighthouserc.mobile.json
# + Pruebas WebKit Safari (landing-webkit & settings-webkit) con minificación activa (verificar 0 TDZ)
# + Pruebas manuales firmadas con hash/capturas en hardware físico: iPhone (Safari + MetaMask) y Android (Chrome + MetaMask)
Formato de Entrega Esperado de tu Respuesta al Ejecutar este Prompt
Ejecuta en orden Fase 1 (Seguridad P0 + Bloqueo OFAC + Limpieza PUBLIC_PREFIXES + Bugs api-guard/payment/confirm/contentHtml/zk-identity) → Fase 2 (Build/TS/Modularización LedgerChatV2/Poda DB y dependencias) → Fase 3 (Optimización Total PC+Móvil: Minificación segura WebKit, Worker/COOP /prove, eliminación AntiTamperCore rAF loop + viewport hacks, XMTP outbox & TURN móvil) → Fase 4 (Contratos D-4/PrivateFPC/Portal/Testing) → Fase 5 (Compliance & SSOT Docs).
Reporta únicamente resultados directamente observados tras tu última edición, separando explícitamente: (A) qué quedó verificado al 100% en código/CI, y (B) los ítems de firma humana externa que dependen de Stefan/abogado/auditores externos (H1–H6).