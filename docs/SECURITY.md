# Resumen de Seguridad y Modelo de Amenazas

> Para el análisis detallado STRIDE, consulte [docs/security/threat-model.md](threat-model.md).

---

## 1. Principios de Seguridad del Sistema

1. **Confianza Cero en el Cliente:**
   - La identidad del usuario **nunca** se lee de encabezados HTTP (`x-wallet-address`, `x-web3-address`, etc.).
   - La identidad se deriva exclusivamente de la cookie criptográfica de sesión HttpOnly `hl_session`.
   - El middleware depura activamente cualquier intento de inyección de cabeceras de suplantación.

2. **No Custodia Criptográfica:**
   - Las claves privadas de la cartera Ethereum, las claves de instalación de XMTP y las viewing keys de Aztec residen únicamente en el dispositivo del usuario.
   - El servidor de Humanity Ledger no tiene capacidad matemática para descifrar mensajes directos de XMTP ni transferencias privadas de Aztec.

3. **Cero Datos en Claro de Mensajería:**
   - Los mensajes directos viajan exclusivamente por la red de XMTP (E2EE con MLS).
   - No existen tablas de mensajes directos en la base de datos PostgreSQL del servidor.

4. **Protección Robusta de Credenciales:**
   - Los PINs se procesan con Argon2id, utilizando sal aleatoria de 16 bytes por usuario y pimienta a nivel de servidor (`ENCLAVE_PIN_PEPPER`).
   - Comparación en tiempo constante (`crypto.timingSafeEqual`) contra ataques de canal lateral (timing attacks).
   - Límite de intentos estricto en Redis: máximo 8 intentos cada 5 minutos.

5. **Defensa en Profundidad:**
   - Content Security Policy (CSP) estricta con nonces por petición.
   - Validación integral de esquemas en todas las rutas con `zod`.
   - Sanitización de contenido en servidor con DOMPurify.
   - Limitadores de peticiones (Rate Limiters) de ventana deslizante en Redis por IP y por cuenta.
