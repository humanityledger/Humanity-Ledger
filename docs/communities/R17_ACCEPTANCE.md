# R-17: MLS Migration — Acceptance Checklist

**Documento:** `docs/communities/R17_ACCEPTANCE.md`
**Fuente:** `docs/communities/MLS_MIGRATION.md` — criterios de aceptación convertidos en checklist verificable.
**Estado:** parcial, 16 noviembre 2026. AC-01 y AC-02 tienen test de ruta con Prisma simulado: `communityMls = true` responde 410 y no llama a `communityPost.create`. No sustituyen un `pg_dump` real. AC-03 sigue manual y sin cablear. Las comunidades existentes siguen en `false`.
**Creado:** 15 noviembre 2026

> [!IMPORTANT]
> `docs/TRACEABILITY_MATRIX.md` cambia `CLM-MSG-COMMUNITY` de ASPIRATIONAL a DELEGATED (XMTP) **únicamente** cuando los cuatro criterios de esta lista estén marcados como verificados con evidencia. No antes.

## Lista de bloqueo antes de `communityMls = true` (16 noviembre 2026)

Propuesta operativa. No activa el flag. Stefan tiene que autorizar una comunidad de prueba por su nombre. Hasta entonces toda comunidad permanece en `false`, incluidas las ya existentes.

Todos los puntos siguientes tienen que cumplirse. Hoy solo se cumplen el default del esquema y el comportamiento 410 cuando el flag ya es true en un mock.

1. La pantalla que crea canales tiene un cliente XMTP. Desde el 17 de noviembre de 2026 es Manage → Channels (`components/communities/CommunityManage.tsx`); `CommunitySettingsPanel.tsx` se borró. Hoy no importa ningún cliente XMTP.
2. Al crear un canal, ese panel llama a `createSecureGroup` (`lib/xmtp/groups.ts`) y el servidor guarda solo el `groupId` devuelto en `CommunityChannel.xmtpGroupId`. Hoy el panel no llama a esa función.
3. AC-01: un volcado de la base de una comunidad con el flag en true no contiene el texto del post.
4. AC-02: `POST /api/chat/communities/[id]/posts` responde 410. La ruta ya lo hace si el flag es true. Nada escribe el flag.
5. La expulsión llama a `removeGroupMember`. AC-03 queda anotado con dos cuentas reales, en la tabla de evidencias de este archivo. El test sigue en `describe.skip`.
6. Ninguna migración ni ningún `update` pone filas existentes en true. `prisma/schema.prisma` sigue en `@default(false)`. La migración `20261115230000_r17_mls_fields` sigue en `DEFAULT false`.
7. Stefan nombra una sola comunidad de prueba. El resto no se migra en el mismo cambio.
8. El mismo cambio que escriba `communityMls: true` actualiza la guarda de `test/communities/r17-acceptance.test.ts`. La guarda actual no tiene excepción: falla si `app/`, `components/` o `lib/` asignan el flag a true, aunque el panel mencione `createSecureGroup`.

`CLM-MSG-COMMUNITY` no pasa a DELEGATED hasta AC-04.

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

**Qué falta para cablear AC-03 (16 noviembre 2026).** `removeGroupMember` existe en `lib/xmtp/groups.ts` y no lo llama ninguna ruta ni el panel de ajustes. Manage → Channels no tiene cliente XMTP. No hay expulsión que rote el epoch. El test `AC-03` sigue en `describe.skip`. No poner `communityMls = true` hasta que el panel cree el grupo con `createSecureGroup`, guarde `xmtpGroupId`, y la expulsión llame a `removeGroupMember`. Con el default `false`, las rutas de posts escriben el texto como antes.

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
