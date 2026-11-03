# Comunidades: de PostgreSQL legible a grupos MLS de XMTP (tarea R-17)

**Estado:** diseño, no implementado. Hoy las publicaciones de comunidad se guardan legibles en PostgreSQL (`CommunityPost.content`). El comentario del esquema Prisma que dice "ENCRYPTED CIPHERTEXT" no describe lo que se guarda; se corrige en este mismo cambio.

Integra el documento "Communities → MLS Groups Migration" del paquete de cierre de gaps, corregido contra el código.

## Qué cambia frente al paquete

- **No hace falta una librería MLS nueva.** El repositorio ya usa grupos MLS de XMTP: `lib/xmtp/groups.ts` crea, lista, añade, quita y envía (`createSecureGroup`, `addGroupMember`, `removeGroupMember`, `sendGroupMessage`), y `lib/sync/xmtpSyncChannel.ts` crea grupos de un solo miembro para la sincronización. La migración consiste en usar esas funciones para las comunidades.
- **El servidor no guarda el texto cifrado.** XMTP transporta y almacena los mensajes de grupo. Nuestro servidor deja de recibir el contenido; solo guarda los metadatos que ya tiene (comunidad, canales, miembros, códigos de invitación) y el `groupId` de XMTP de cada canal.
- **La interfaz `CommunityMLSGroup` del paquete (encrypt/decrypt/addMember por índice) no se implementa.** El SDK de XMTP no expone cifrado manual ni índices de hoja; expone grupos, miembros por identificador y envío. Inventar esa capa sería un envoltorio sin efecto.
- **Los tests de `test/mls_post_compromise.test.ts` no sirven como prueba.** Modelan un calendario de claves dentro del propio test. La garantía PCS la da XMTP (OpenMLS).

## Diseño

1. **Un grupo XMTP por canal.** Al crear un canal, el cliente del propietario crea el grupo con `createSecureGroup` y envía al servidor solo su `groupId`, que se guarda en `CommunityChannel` (campo nuevo `xmtpGroupId`).
2. **Unirse.** Al aceptar un miembro (código de invitación o aprobación), un administrador conectado lo añade al grupo con `addGroupMember`. El servidor marca la membresía, pero no puede añadirlo él: no es miembro del grupo. Si no hay administrador conectado, la membresía queda pendiente y el cliente lo muestra.
3. **Salir o expulsar.** `removeGroupMember` cambia de época; el expulsado deja de poder leer lo nuevo.
4. **Publicar y leer.** `sendGroupMessage` y la lectura en streaming de XMTP. El servidor ya no recibe `POST /api/chat/communities/[id]/posts` con contenido.
5. **Transición.** Bandera `COMMUNITY_MLS` por comunidad. Mientras esté apagada, el flujo actual sigue con el aviso de que el servidor puede leer. Al encenderla, la comunidad deja de aceptar publicaciones en claro. Las publicaciones antiguas se exportan para los miembros y se borran del servidor; no se "cifran después".
6. **Apps de comunidad.** `CommunityApp` y `CommunityAppEntry` siguen siendo legibles por el servidor y fuera de este cambio; su interfaz ya lo avisa.

## Criterios de aceptación

- [ ] Con la bandera encendida, un volcado de la base de datos no contiene el contenido de ninguna publicación de esa comunidad (test que crea una publicación y busca su texto en todas las tablas).
- [ ] La ruta de publicaciones devuelve 410 para comunidades migradas.
- [ ] Un miembro expulsado no recibe mensajes posteriores (prueba manual con dos cuentas, documentada).
- [ ] `docs/TRACEABILITY_MATRIX.md`: `CLM-MSG-COMMUNITY` pasa de ASPIRATIONAL a DELEGATED (XMTP) solo cuando lo anterior se cumpla.

## Riesgos y límites

- Metadatos: quién está en qué comunidad, y cuándo se publica, siguen siendo visibles para el servidor y para XMTP.
- Tamaño: los grupos MLS tienen un límite de miembros en XMTP y el coste de cambio de época crece con el grupo. Hay que confirmar el límite vigente en la documentación de XMTP antes de migrar comunidades grandes.
- Moderación: el servidor deja de poder moderar contenido que no ve. Hace falta un flujo de denuncia en el que el cliente que denuncia entrega el mensaje.
- `lib/xmtp/groups.ts` dice "XMTP v5.3.0" en su cabecera; `package.json` fija 5.2.0. Hay que alinearlo.
