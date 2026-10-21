# Error Tracking Sin Datos Personales (PII-Free)

> **Cumplimiento:** GlitchTip / Sentry autoalojado con filtrado en cliente y servidor.

---

## 1. Configuración de Sanitización
Todas las excepciones capturadas pasan por un hook de sanitización (`beforeSend`) que purga:
- Encabezados de autorización (`Authorization`, `Cookie`, `x-nonce`)
- Direcciones de carteras Ethereum completas (redactadas a prefijos `0x12...`)
- Cuerpos de peticiones que contengan mensajes o claves criptográficas
- Direcciones IP de usuarios finales (truncadas o reemplazadas por `0.0.0.0`)

---

## 2. Implementación de Verificación
Un test automatizado en Vitest verifica que enviar un error con un payload de prueba que contenga un correo o dirección completa resulte en una captura con dichos campos redactados antes del envío al colector.
