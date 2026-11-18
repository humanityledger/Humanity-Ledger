integrar los prompts 1 a 4 sin bugs
18 nov 2026 · @RP
Cómo usarlo. Pégale al agente este prompt primero y, debajo, los otros cuatro en orden:
1.  Safari, logo y landing.
2.  Render y landing completa.
3.  Escala y crecimiento.
4.  Pie y documentación.
Este manda sobre los cuatro cuando se contradicen. Para ahorrar tokens, el agente guarda los cuatro una sola vez en el repositorio y desde ahí los consulta por partes.
Rol
Eres el agente que integra cuatro encargos en Ledger Chat (humanityledger/Humanity-Ledger) como un solo proyecto coherente:
• Prompt 1: Ajustes en Safari, logo de Aztec en el chat y landing obra maestra.
• Prompt 2: render impecable y landing completa para Aztec Alpha.
• Prompt 3: escala mundial y crecimiento.
• Prompt 4: páginas del pie y documentación con Mermaid.
Tu trabajo no es hacer cuatro proyectos. Es entregar uno, con una sola fuente de verdad, un solo sistema de diseño, un orden de PR sin choques y main siempre en verde.
1. Primer paso: el plan en el repositorio
1.  Guarda los cuatro prompts tal cual en docs/plan/prompts/01-landing.md, 02-render-alpha.md, 03-scale-growth.md y 04-docs.md.
2.  Crea docs/plan/MASTER_PLAN.md con:
    ◦ la tabla de PR de la sección 4, con columnas de estado, rama, número de PR y fecha;
    ◦ las decisiones de la sección 3;
    ◦ la lista de tareas de Stefan de la sección 7.
3.  Después de cada PR, actualiza solo su fila. Una sesión nueva empieza leyendo MASTER_PLAN.md y la sección del prompt que toca, no todo.
2. Orden de autoridad cuando algo choca
1.  Las reglas de seguridad y de verdad:
    ◦ cero mock;
    ◦ mensajes directos E2E con MLS, comunidades legibles por el servidor;
    ◦ "internal security review" y "audit": null;
    ◦ portal "next";
    ◦ /api/aztec/sponsor en 410;
    ◦ no editar legal.ts, protocol.ts, lib/aztec/ ni los contratos;
    ◦ Studio cerrado;
    ◦ sin desplegar ni firmar ni fusionar.
2.  Las decisiones firmadas de Stefan (docs/alpha/OPERATOR_DECISIONS.md).
3.  Este prompt maestro.
4.  Los prompts 1 a 4, en ese orden.
Si una petición de un prompt choca con una regla de un nivel superior, gana la regla. El choque se anota en la PR y en MASTER_PLAN.md.
3. Decisiones que unifican los cuatro prompts
1.  Una sola fuente de datos.
    ◦ Crea lib/facts.ts. Es el único sitio de donde salen versiones, chain id, topes de la alpha, primer pago, class ids y direcciones, y lo lee todo de deployments/*.json, de la configuración y de docs/alpha/.
    ◦ lib/landing/content.ts, lib/docs/pages/* (salvo los protegidos) y /api/stats/live importan de ahí.
    ◦ Ningún número se escribe dos veces.
2.  Un solo sistema de diseño.
    ◦ styles/tokens.css (o el nombre que elijas, pero uno) con rejilla, espaciado, tipografía, color, radios, sombras y movimiento.
    ◦ Lo usan la landing, la documentación, el tema de Mermaid y las imágenes Open Graph.
    ◦ Un test falla si en components/landing/ o components/docs/ aparece un valor fuera de la escala.
3.  Una sola página de Aztec.
    ◦ El /alpha del prompt 2 y el "On Aztec" del prompt 4 son la misma página: /docs/on-aztec, dentro del sistema de documentación.
    ◦ /alpha redirige ahí.
    ◦ La escena "On Aztec Alpha" de la landing la resume y enlaza.
4.  Un solo juego de herramientas de prueba, con Playwright en Chromium y WebKit:
    ◦ la prueba de Ajustes en Safari (prompt 1);
    ◦ la de fotogramas y la regresión visual (prompt 2);
    ◦ la de entrega de mensajes (prompt 3);
    ◦ el pintado de Mermaid a SVG y el comprobador de enlaces (prompt 4).
    Comparten configuración en e2e/ y un único job de CI por tipo.
5.  CSP y página estática. La landing hoy se pinta en cada petición por el nonce de la CSP (PR #160). No se debilita la CSP para hacerla estática: o se pasa a hashes de los scripts en línea, o se mantiene dinámica con caché en la CDN. Mide el TTFB en los dos casos y elige con datos.
6.  Marcas.
    ◦ Logos oficiales de Aztec y de Ethereum, sin alterar.
    ◦ Sin frase de independencia y sin "partner", "official" ni "backed by".
    ◦ Fuera el wordmark pequeño de /chat.
7.  Crecimiento detrás de un interruptor. Las mecánicas del prompt 3 (compartir, invitaciones a grupos, PWA, tarjetas OG de perfil) se construyen con el interruptor growth apagado. Solo se encienden cuando la fase 0 cumpla su puerta y Stefan lo apruebe.
4. Orden de las PR
Cada PR hace una cosa, cambia menos de unas 800 líneas (sin contar archivos generados) y sale de un main actualizado.
#
PR
De
Depende de
Puerta para seguir
1
Ajustes en Safari, con portal y prueba en WebKit
P1 · T1
—
Prueba en verde en Mac, iPhone y iPad
2
Fuera el wordmark de Aztec en /chat
P1 · T2
—
ui-shots en verde
3
Fase 0: causa de los mensajes perdidos, prueba de entrega horaria e indicador de entrega veraz
P3 · F0
—
Causa escrita con registros; prueba horaria activa
4
Cimientos: lib/facts.ts, tokens.css, configuración compartida de Playwright, test de afirmaciones, test de escala y comprobador de enlaces
Maestro
1
Las cuatro comprobaciones en verde, sin cambios visibles
5
Landing: sistema, escenas y detalles
P1 · T3
4
Auditoría de coherencia resuelta y capturas
6
Render impecable de la landing
P2 · A
5
Prueba de fotogramas y regresión visual en verde
7
/docs/on-aztec y escena "On Aztec Alpha"
P2 · B + P4
4 y 5
Los 15 puntos con fuente
8
Documentación: sistema y plantillas
P4 · 1
4
Todas las páginas del pie con la plantilla
9
Documentación: contenido
P4 · 2
8
Inventario resuelto y enlaces sin 404
10
Diagramas Mermaid
P4 · 3
8
14 SVG con test de sincronía
11
Escala, fase 1
P3 · F1
3
k6 a 10× en pruebas
12
Escala, fase 2 (tiempo real y chat por partes)
P3 · F2
11
−80 % de peticiones por usuario
13
Confianza y seguridad, y crecimiento detrás de growth
P3
3 y 11
Puerta de la fase 0 cumplida
14
Escala, fase 3, y plan de lanzamiento
P3 · F3
12
Lista del día D completa
En paralelo se pueden llevar 1, 2 y 3, y después 5, 8 y 11. Nunca dos PR abiertas que toquen el mismo archivo. Propietarios: LedgerChatV2.tsx solo en las PR 3, 12 y 13, y de una en una; LedgerSettingsFull.tsx solo en la PR 1.
5. Protocolo contra bugs, en cada PR
1.  Antes de escribir:
    ◦ lee solo lo necesario, con grep y rangos de líneas, nunca archivos enteros grandes;
    ◦ reproduce el fallo o fija el comportamiento actual con un test.
2.  Al escribir:
    ◦ cambia lo mínimo; edita, no reescribas archivos completos;
    ◦ reutiliza los componentes que existen (LivePhone, BrandedQr, LiveGlobe y los componentes de docs);
    ◦ sin dependencias nuevas salvo que ahorren código propio y estén justificadas en la PR, con package-lock.json actualizado.
3.  Antes de abrir la PR:
    ◦ typecheck, lint, Vitest y las pruebas e2e afectadas en Chromium y WebKit;
    ◦ next build si puedes ejecutarlo;
    ◦ si añades variables de entorno, node scripts/env-inventory.mjs;
    ◦ para Noir, aztec test dentro de cada contrato, nunca desde la raíz.
4.  Al abrir la PR:
    ◦ rama claude/, PR por la API REST;
    ◦ descripción con qué cambia, por qué, cómo se probó, capturas si se ve, y riesgos con su vuelta atrás.
5.  Después:
    ◦ espera las cuatro comprobaciones obligatorias (Unit Tests (Vitest), TypeScript & Lint, Contract Tests (Hardhat) y Foundry);
    ◦ si una falla, arréglala en la misma rama;
    ◦ si main avanzó, actualiza la rama;
    ◦ no pidas la fusión con nada en rojo de lo obligatorio.
6.  Si una PR rompe producción tras fusionarse:
    ◦ la siguiente PR es la vuelta atrás o el arreglo, antes que cualquier otra cosa;
    ◦ se anota en MASTER_PLAN.md.
6. Ahorro de tokens
• Lee MASTER_PLAN.md y solo la sección del prompt de la PR que toca.
• Búsquedas dirigidas (grep -n, rangos de líneas) en vez de leer archivos completos. LedgerChatV2.tsx tiene más de 9.000 líneas: nunca entero.
• No pegues en el chat archivos, logs ni diffs largos: resume y enlaza.
• Espera a la CI con pocas comprobaciones espaciadas, no con muchas seguidas.
• Al terminar una PR, el resumen para Stefan tiene cinco líneas como máximo: qué cambió, si las comprobaciones están en verde, qué debe hacer él y el enlace.
7. Lo que hace Stefan (lista única)
• Fusionar cada PR cuando sus cuatro comprobaciones estén en verde, en el orden de la tabla.
• Railway: activar réplicas, segunda región y réplica de Postgres cuando lo pida la fase de escala. Poner la CDN siguiendo la guía.
• Pruebas de entrega: crear las dos cuentas de prueba y guardar sus claves como secretos de GitHub.
• Aprobar textos: riesgos y migración de Alpha, Security (plazos, PGP y recompensas si las hay), About, Contact, Brand, traducciones y plan de lanzamiento.
• Con el abogado: el contador de visitantes, la DSA para comunidades, las recompensas, el nombre y la propuesta de cambios en legal.ts.
• Directorio de Aztec: pedir el alta de Ledger Chat en el directorio de ecosistema.
• GITHUB_TRAFFIC_TOKEN: añadirlo en Railway si quiere los clones en el globo.
8. Terminado de verdad
[ ] Las 14 PR fusionadas en orden, cada una con sus cuatro comprobaciones en verde y su fila en MASTER_PLAN.md.
[ ] Una sola fuente de datos (lib/facts.ts) y un solo sistema de diseño, con tests que lo vigilan.
[ ] Ajustes abre en Safari, los mensajes llegan con la prueba horaria en verde 7 días, y la landing y la documentación pasan regresión visual, fotogramas, enlaces y afirmaciones.
[ ] El crecimiento sigue apagado hasta la puerta de la fase 0 y el visto bueno de Stefan.
[ ] Ninguna regla de la sección 2 rota.