# Métricas de Rendimiento por Ruta (Prometheus / Railway Metrics)

---

## 1. Métricas Clave Monitorizadas
1. **Throughput (Peticiones/segundo):**
   - `/api/events` (SSE): Media de 15.000 req/s concurrentes.
   - `/api/chat/communities/*`: 4.200 req/s.
   - `/api/auth/siwe/*`: 850 req/s.
2. **Latencia p95 y p99:**
   - Rutas API del núcleo: p95 < 120ms; p99 < 280ms.
   - Verificación de sesión: p95 < 15ms (vía Redis caché).
3. **Tasa de Errores HTTP (Error Rate):**
   - Umbral global: < 0.05% en condiciones normales de tráfico.
