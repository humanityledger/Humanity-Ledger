# Cookies y almacenamiento en el navegador

Estado: borrador interno, no vigente hasta la firma del abogado (OD-8) · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: los textos vigentes son las páginas de /docs (`lib/docs/pages/legal.ts`)

> Borrador preparado con Claude, pendiente de revisión por un abogado colegiado. Sustituye la versión anterior, que nombraba un DPO y una consultoría externa que no existen.

**Estado real (19/11/2026):** Ledger Chat solo usa cookies y almacenamiento técnico, necesarios para funcionar. No hay cookies de publicidad ni de analítica. El contador de visitas del mapa en directo ya no guarda nada en el navegador desde el PR #176: cuenta una visita por carga de página, solo con la zona horaria, y borra el identificador que guardaba la versión anterior.

## Cookies (las de la página vigente /docs/cookies)

| Nombre | Para qué | Duración |
| --- | --- | --- |
| `hl_session` | Mantener la sesión. Los scripts no pueden leerla | 7 días |
| `hl_refresh` | Renovar la sesión iniciada con correo | 30 días |
| `human_session`, `ledger_session` | La misma sesión con nombres antiguos | 7 días |

## Almacenamiento local (localStorage, sessionStorage, IndexedDB)

Inventario por categorías, sacado del código con `git grep` el 19/11/2026. Todo es necesario para el servicio o una preferencia que pide el propio usuario. Nada se usa para analítica ni publicidad.

| Categoría | Ejemplos de claves | Por qué es necesario |
| --- | --- | --- |
| Sesión y wallet | `system_session_v2`, `system_wallet_addr`, `wagmi.store` | Mantener la conexión con la wallet |
| Wallet privada de Aztec | reclamaciones de Fee Juice, `hl:hlc-test-token:*`, datos del PXE en IndexedDB | Probar y firmar pagos en el dispositivo |
| Chat en el dispositivo | `ledger_chat_history_*`, `ledger_pinned_*`, `ledger_archived_*`, base de datos local de XMTP | Mostrar las conversaciones sin enviarlas al servidor |
| Preferencias | `theme`, `human_wallet_locale`, `ledger_haptics`, `ledger_conv_wallpapers` | Recordar lo que el usuario eligió |
| Avisos ya vistos | `hl_pwa_dismissed`, `hl_alpha_banner_dismissed_v1` (sesión) | No repetir un aviso cerrado |

**Pendiente:** que el abogado confirme que todo lo anterior entra en la exención del art. 22.2 de la LSSI (estrictamente necesario o pedido por el usuario).
