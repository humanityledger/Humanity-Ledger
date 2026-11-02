# Configuración de Alertas de Producción (Incident Alerting)

---

## Reglas de Disparo de Alertas

| Regla de Alerta | Condición de Disparo | Nivel de Severidad | Canal de Notificación |
| :--- | :--- | :--- | :--- |
| **Error Rate Spiking** | Tasa de errores 5xx > 1% durante 3 minutos consecutivos | P1 (Crítica) | PagerDuty / Slack #incidents |
| **Latency Degradation** | Latencia p95 > 1.000 ms durante 5 minutos en rutas core | P2 (Alta) | Slack #incidents |
| **DB Connection Saturation** | Conexiones PostgreSQL activas > 80% de `max_connections` | P1 (Crítica) | PagerDuty / SMS On-Call |
| **Redis Memory Pressure** | Uso de memoria de Redis > 85% de `maxmemory` | P2 (Alta) | Slack #alerts |
| **SSE Reconnection Storm** | Conexiones `/api/events` superan 60.000 req/s | P2 (Alta) | Slack #alerts |
