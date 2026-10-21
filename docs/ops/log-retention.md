# Política y Configuración de Retención de Logs (<= 30 Días)

> **Cumplimiento:** Principio de limitación del plazo de conservación (Art. 5.1.e RGPD).

---

## 1. Alcance
Esta política aplica a todos los registros generados por la infraestructura de Humanity Ledger:
- Logs de peticiones HTTP en Railway / Servidor Next.js
- Logs de base de datos PostgreSQL
- Logs de instancias de Redis
- Logs del logger estructurado (`lib/logger.ts`)

---

## 2. Redacción Previa de Datos Sensibles
Antes de escribir cualquier entrada de log, `lib/logger.ts` rediseñado aplica filtros de ofuscación:
- Cartera de Ethereum: truncada a formato seguro `0x1234...abcd`
- Direcciones de correo electrónico: enmascaradas
- Tokens y secretos: completamente censurados (`[REDACTED]`)

---

## 3. Políticas de Depuración Automática
1. **Logs de Aplicación (Railway):** Retención configurada en 7 días para entornos de desarrollo y 14 días para producción.
2. **Logs de PostgreSQL:** `log_rotation_age = 1d`, `log_rotation_size = 100MB`. Los archivos de log con más de 30 días de antigüedad son eliminados automáticamente por un cronjob programado (`scripts/cleanup-logs.sh`).
3. **Auditoría de Acceso:** No se mantienen volcados ni copias de logs que superen los 30 días naturales.
