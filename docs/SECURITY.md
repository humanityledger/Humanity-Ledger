# Resumen de Seguridad y Modelo de Amenazas

> Para el análisis detallado STRIDE, consulte [docs/security/threat-model.md](threat-model.md).

---

## 1. Principios de Seguridad del Sistema

1. **Confianza Cero en el Cliente:**
   - La identidad del usuario **nunca** se lee de encabezados HTTP no verificados (`x-wallet-address`, `x-web3-address`, etc.).
   - La identidad se deriva exclusivamente de la cookie criptográfica de sesión HttpOnly `hl_session` (o sus alias verificados en `lib/security/verifiedCaller.ts`).
   - El middleware depura activamente cualquier intento de inyección de cabeceras de suplantación desde el cliente.

2. **No Custodia Criptográfica:**
   - Las claves privadas de la cartera Ethereum, las claves de instalación de XMTP y las viewing keys de Aztec residen únicamente en el dispositivo del usuario.
   - El servidor de Humanity Ledger no tiene capacidad matemática para descifrar mensajes directos de XMTP ni transferencias privadas de Aztec.

3. **Cero Datos en Claro de Mensajería:**
   - Los mensajes directos viajan por la red de XMTP (E2EE con MLS).
   - Las colas temporales fuera de línea (`PendingChatMessage`) almacenan solo carga cifrada y expiran estrictamente tras 7 días con rate limit en envío.

4. **Protección Robusta de Credenciales:**
   - Los PINs se procesan con Argon2id, utilizando sal aleatoria de 16 bytes por usuario y pimienta a nivel de servidor (`ENCLAVE_PIN_PEPPER`).
   - Comparación en tiempo constante (`crypto.timingSafeEqual`) contra ataques de canal lateral (timing attacks).
   - Límite de intentos estricto: máximo 8 intentos cada 5 minutos por sesión/IP, verificado antes de evaluar el PIN.

5. **Defensa en Profundidad:**
   - Content Security Policy (CSP) estricta con nonces por petición para todas las páginas públicas y autenticadas.
   - Validación integral de esquemas en todas las rutas con `zod`.
   - Sanitización de contenido en servidor con DOMPurify.
   - Limitadores de peticiones (Rate Limiters) de ventana deslizante en Redis por IP y por cuenta.
   - Fail-closed estricto en todos los cron jobs y daemons internos (`lib/security/cronAuth.ts`).

---

## 2. Historial de Vulnerabilidades Críticas y Mitigaciones (Auditoría Octubre 2026)

| Código | Vector de Ataque | Severidad | Mitigación Implementada |
|---|---|---|---|
| **A-018** | `/api/premium/webauthn` firmaba sesiones válidas para cualquier wallet mediante cookie no verificada | **Crítico** | Ruta retirada (410); tokens previamente emitidos revocados por `sessionClaims.ts`. |
| **A-019** | Rutas retiradas e internas accesibles omitiendo el middleware mediante sufijos tipo `.png` | **Alta** | Regex del matcher corregida en `middleware.ts` con anclaje estricto de extensiones estáticas. |
| **A-020** | Inyección de Cypher arbitrario en `/api/graph` | **Alta** | Ruta retirada y bloqueada en el Edge con código 410. |
| **A-021** | Fuerza bruta de PIN en `enclave-pin` DELETE y race condition en POST/PUT | **Alta** | Contador unificado compartido evaluado antes de la comparación (8 por 5 min). |
| **A-022** | Fuga de IP del cliente a servidor HTTP no cifrado `ip-api.com` | **Media** | `GeoLoginTracker` retirado y ruta `/api/geo/login-event` bloqueada (410). |
| **A-023** | Cron jobs fail-open cuando `CRON_SECRET` no estaba definido | **Alta** | Módulo unificado `cronAuth.ts` con `timingSafeEqual` y denegación obligatoria si secret < 16 chars. |
| **A-024** | Exposición de seed QR cifrada cuando `creatorAddress` era nula | **Alta** | Inversión de guarda: si `creatorAddress` es nulo, denegación 403 inmediata. |
| **A-025** | Secrets aleatorios generados en cold-start (`pulse`, `engine/tick`, `notifications/ingest`) | **Alta** | Migración a `cronAuth.ts` y fail-closed si la clave de entorno está ausente o < 16 chars. |
| **A-026** | IDOR en `/api/variables` por fallback a `searchParams.get('wallet')` | **Media** | Eliminado el fallback; solo se acepta `x-verified-session-address` inyectado por Edge middleware. |
| **A-027** | Enumeración de perfiles de usuario sin autenticación en `/api/user/search` | **Media** | Verificación obligatoria de sesión activa antes de consultar la base de datos. |
| **A-028** | Ingesta de notificaciones sin comprobación en tiempo constante y fallback aleatorio | **Alta** | `timingSafeEqual` con SHA-256 digest y fail-closed si `INTERNAL_INGEST_KEY` < 16 chars. |
| **A-029** | Fuga de tiempo en sincronización de bóveda `/api/vault/sync` y auditoría interna | **Media** | Comparación estricta en tiempo constante con `timingSafeEqual`. |
| **A-030** | Denegación de servicio por consultas ilimitadas a bots (`/api/bots/command`) | **Baja** | Rate limiter deslizante por IP (30 req/min) y validación estricta de nombres ENS. |

---

## 3. Estado Real y Transparencia Técnica

1. **Estado de ZK Sequencer y Prover:**
   - La red Aztec Mainnet v5.0.1 requiere sincronización con nodos RPC externos. Si `AZTEC_NODE_URL` no está presente, los endpoints responden con estado `disabled` o `DEMO`. No se utiliza `Math.random` para simular bloques.
2. **WebRTC TURN Relay:**
   - Cuando `NEXT_PUBLIC_TURN_URLS` no está presente en el despliegue, el cliente utiliza el relay público `openrelay.metered.ca` con credenciales comunitarias públicas como contingencia. En entornos de producción empresarial, debe definirse un servidor coturn propio para privacidad estricta de llamadas.
3. **Claves de Cifrado y JWT:**
   - Al desplegar cambios mayores de seguridad, se recomienda rotar `JWT_SECRET` y las claves EdDSA en el proveedor de hosting (Railway/Vercel) para invalidar cualquier sesión previa activa.
