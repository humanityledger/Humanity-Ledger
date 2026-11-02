# Objetivo de Nivel de Servicio (SLO) - 99.9% Mensual

---

## 1. Definición del SLO
- **Objetivo de Disponibilidad:** 99.9% de uptime mensual para servicios del núcleo (Autenticación, Entrega SSE y Comunidades).
- **Presupuesto de Error (Error Budget):** 43 minutos y 49 segundos de indisponibilidad máxima permitida al mes.

---

## 2. Medición e Indicador de Nivel de Servicio (SLI)
$$\text{SLI} = \frac{\text{Peticiones HTTP Exitosas (códigos } < 500)}{\text{Total de Peticiones Válidas}} \times 100 \ge 99.9\%$$

## 3. Política de Presupuesto de Error
Si se consume más del 50% del presupuesto de error en los primeros 10 días del mes:
1. Se congelan despliegues no relacionados con estabilidad o seguridad.
2. Toda la capacidad de ingeniería se orienta a robustecer los subsistemas causantes.
