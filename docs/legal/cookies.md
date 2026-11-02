# Auditoría y Declaración de Cookies

> **Estado:** Cero cookies de rastreo publicitario o analíticas de terceros.

---

## 1. Inventario Exhaustivo de Cookies

Humanity Ledger opera bajo una política estricta de cookies técnicas exclusivamente necesarias para la prestación del servicio:

| Nombre de Cookie | Proveedor | Propósito | Duración | Clasificación |
| :--- | :--- | :--- | :--- | :--- |
| `hl_session` | Humanity Ledger (Propia) | Token de sesión autenticado firmado (JWT HttpOnly, Secure, SameSite=Strict). | 15 min (acceso) / 30 días (refresco) | Esencial / Estrictamente Necesaria |

---

## 2. Exención de Consentimiento Previo
Conforme a la Directiva de Privacidad Electrónica (Directiva ePrivacy 2002/58/CE modificada por la Directiva 2009/136/CE) y las directrices del Comité Europeo de Protección de Datos (EDPB):
- **Las cookies estrictamente necesarias para prestar un servicio expresamente solicitado por el usuario están exentas de requerir consentimiento previo mediante banner.**
- Al no existir cookies de remarketing, píxeles de seguimiento (Facebook, Google Analytics) ni almacenamiento cruzado de terceros, la experiencia de usuario se mantiene limpia y libre de banners obstructivos.

---

## 3. Verificación Automatizada en CI
Un escáner automatizado verifica que ninguna dependencia agregue scripts de seguimiento de terceros ni cree cookies no declaradas en el dominio.
