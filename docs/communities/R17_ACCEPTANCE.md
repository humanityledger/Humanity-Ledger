# R-17: MLS Migration — Acceptance Checklist

**Documento:** `docs/communities/R17_ACCEPTANCE.md`
**Fuente:** `docs/communities/MLS_MIGRATION.md` — criterios de aceptación convertidos en checklist verificable.
**Estado:** pendiente — ningún criterio está cerrado. La implementación de R-17 no ha comenzado.
**Creado:** 15 noviembre 2026

> [!IMPORTANT]
> `docs/TRACEABILITY_MATRIX.md` cambia `CLM-MSG-COMMUNITY` de ASPIRATIONAL a DELEGATED (XMTP) **únicamente** cuando los cuatro criterios de esta lista estén marcados como verificados con evidencia. No antes.

---

## Criterios de aceptación (checklist)

### AC-01 — Dump de BD sin contenido de posts cuando `communityMls = true`

- [ ] **Preparación:** existe al menos una comunidad con `communityMls = true` en el entorno de test.
- [ ] **Acción:** se crea una publicación a través del flujo de cliente con la bandera activa.
- [ ] **Verificación:** un dump completo de todas las tablas de PostgreSQL (`pg_dump` o equivalente) no contiene ningún fragmento del texto de la publicación en ninguna tabla (`CommunityPost`, `CommunityChannel`, ni ninguna otra).
- [ ] **Test automatizado:** `test/communities/r17-acceptance.test.ts` → caso `AC-01: no post content in DB when communityMls=true`.
- [ ] **Evidencia:** captura del dump con la búsqueda negativa o salida del test en CI.

**Estado:** ⬜ No verificado

---

### AC-02 — Endpoint devuelve 410 para comunidades migradas

- [ ] **Preparación:** existe al menos una comunidad con `communityMls = true`.
- [ ] **Acción:** se llama a `POST /api/chat/communities/[id]/posts` con la comunidad migrada.
- [ ] **Verificación:** la respuesta HTTP es exactamente `410 Gone`; no `200`, no `403`, no `404`.
- [ ] **Test automatizado:** `test/communities/r17-acceptance.test.ts` → caso `AC-02: POST /posts returns 410 for MLS community`.
- [ ] **Evidencia:** salida del test en CI con el status code verificado.

**Estado:** ⬜ No verificado

---

### AC-03 — Miembro expulsado no recibe mensajes nuevos

- [ ] **Preparación:** dos cuentas reales (A y B) son miembros de una comunidad con `communityMls = true`. El canal tiene un `xmtpGroupId` asignado.
- [ ] **Acción:** un administrador expulsa a B con `removeGroupMember`. A envía un mensaje nuevo.
- [ ] **Verificación:** el cliente de B no recibe el mensaje enviado por A después de la expulsión (el epoch de MLS ha cambiado).
- [ ] **Test:** esta verificación es **manual** (requiere dos dispositivos/cuentas reales). Debe documentarse con fecha, cuentas usadas y capturas de pantalla en este documento.
- [ ] **Evidencia:** registro manual en la sección "Evidencias de verificación manual" de este documento.

**Estado:** ⬜ No verificado (requiere prueba manual con dos cuentas)

---

### AC-04 — Traceability Matrix actualizada

- [ ] Los tres criterios anteriores (AC-01, AC-02, AC-03) están marcados como verificados con evidencia.
- [ ] `docs/TRACEABILITY_MATRIX.md` ha sido actualizado: `CLM-MSG-COMMUNITY` pasa de `ASPIRATIONAL` a `DELEGATED (XMTP)`.
- [ ] El PR que actualiza la matriz referencia este documento y los tests/evidencias correspondientes.

**Estado:** ⬜ Bloqueado por AC-01, AC-02, AC-03

---

## Prerequisitos técnicos (antes de poder verificar AC-01 y AC-02)

Los siguientes elementos deben estar implementados e integrados. Ninguno existe aún:

| Prerequisito | Archivo afectado | Estado |
|---|---|---|
| Lógica de servidor que, cuando `communityMls = true`, devuelve 410 en POST /posts | `app/api/chat/communities/[id]/posts/route.ts` | ⬜ No implementado |
| Lógica de cliente que llama a `createSecureGroup` al crear un canal MLS | `lib/xmtp/groups.ts` (ya existe la función) + UI | ⬜ No integrado |
| Guardado de `xmtpGroupId` en `CommunityChannel` al crear el grupo | `app/api/communities/[id]/channels/route.ts` | ⬜ No implementado |
| Migración Prisma que añada `xmtpGroupId` y `communityMls` a la BD real | `prisma/migrations/` | ⬜ Pendiente de Stefan (requiere DATABASE_URL de producción) |
| Flujo de expulsión que llame a `removeGroupMember` | UI de administración de miembros | ⬜ No implementado |

---

## Evidencias de verificación manual (AC-03)

*(Esta sección se rellena cuando Stefan realiza la prueba manual con dos cuentas reales.)*

| Campo | Valor |
|---|---|
| Fecha de la prueba | — |
| Cuenta A (admin) | — |
| Cuenta B (expulsado) | — |
| Canal/comunidad | — |
| xmtpGroupId | — |
| Mensaje enviado tras expulsión | — |
| B recibió el mensaje | — |
| Capturas | — |

---

## Riesgos documentados (de MLS_MIGRATION.md)

Copiados literalmente para que este checklist sea autosuficiente:

1. **Metadatos visibles:** quién está en qué comunidad, y cuándo se publica, siguen siendo visibles para el servidor y para XMTP.
2. **Límite de miembros:** los grupos MLS tienen un límite de miembros en XMTP y el coste de cambio de época crece con el grupo. Hay que confirmar el límite vigente en la documentación de XMTP antes de migrar comunidades grandes.
3. **Moderación:** el servidor deja de poder moderar contenido que no ve. Hace falta un flujo de denuncia en el que el cliente que denuncia entrega el mensaje.
4. **Apps de comunidad:** `CommunityApp` y `CommunityAppEntry` siguen siendo legibles por el servidor y fuera de este cambio; su interfaz ya lo avisa.
