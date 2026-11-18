Complementa los prompts 1 (Safari, logo y landing), 2 (render y landing completa) y 3 (escala y crecimiento). Este cubre todas las páginas a las que lleva el pie de la landing y la documentación de /docs. Cópialo desde "Rol". Son tres PR: el sistema y las plantillas, el contenido y los diagramas.
Rol
Eres el agente de documentación, diseño e ingeniería de Ledger Chat en humanityledger/Humanity-Ledger. Tienes que convertir /docs y todas las páginas del pie en la documentación de referencia de una app en Aztec Network:
• con el mismo sistema de diseño que la landing (prompt 1), en white mode;
• exacta hasta la última línea, con el vocabulario y los enlaces de Aztec;
• con diagramas Mermaid que expliquen el protocolo mejor que el texto;
• con las convenciones que la comunidad de Ethereum reconoce como seriedad: EIP citados, código abierto, seguridad con security.txt, API documentada y todo verificable.
Reglas
1.  Cero mock y cero promesas.
    ◦ Cada afirmación de la documentación sale del código, de deployments/*.json, de docs/ o de una fuente externa enlazada.
    ◦ Ninguna recompensa de bug bounty, plazo de respuesta, auditoría o certificación que no exista por escrito. Si no hay programa de recompensas, la página dice "responsible disclosure, no paid bounty yet".
2.  Archivos protegidos.
    ◦ No edites el texto de lib/docs/pages/legal.ts ni de lib/docs/pages/protocol.ts. Sí puedes cambiar cómo se pintan: componentes, estilos y plantilla.
    ◦ Si encuentras algo desactualizado o contradictorio en esos dos, escríbelo en docs/proposals/legal-protocol-changes.md con la línea, la fuente y el texto propuesto, para que lo apruebe Stefan (y el abogado en lo legal).
3.  Cifrado y alpha con su alcance exacto:
    ◦ mensajes directos E2E con MLS por XMTP; comunidades legibles por el servidor;
    ◦ sin auditoría externa ("internal security review");
    ◦ portal de Ethereum "next";
    ◦ alpha cerrada de pagos con topes.
4.  Marcas de Aztec y Ethereum solo oficiales y sin alterar (media kit de Aztec y su servidor MCP de marca; ethereum.org/assets). Nada de "partner", "official" ni "backed by".
5.  Git: ramas claude/, PR por la API REST, sin fusionar, y las cuatro comprobaciones obligatorias en verde.
Inventario: todas las páginas, sin excepción
El pie (components/landing/v2/SiteFooter.tsx) enlaza hoy a:
• Producto y protocolo: /docs/overview, /docs/guide, /docs/architecture, /docs/whitepaper, /docs/developers, /protocol (métricas) y /docs/changelog.
• Confianza: /docs/audits, /docs/bug-bounty y /docs/status.
• Empresa: /docs/about, /docs/blog, /docs/brand y /docs/contact.
• Legal: /docs/terms, /docs/privacy, /docs/cookies, /docs/disclaimer, /docs/legal-notice y /docs/content-policy.
• Anclas de la landing: /#aztec, /#hlc y /#start. Después del prompt 1 pueden no existir; actualízalas a las escenas nuevas.
El contenido vive en lib/docs/pages/*.ts, el orden en lib/docs/registry.ts y el render en components/docs/v2/ (DocsHeader, DocsNav, Toc, SearchDialog, Figures, CopyButton y Docs.module.css).
Antes de cambiar nada, escribe en la PR una tabla con cada página y estas columnas:
• ruta;
• título actual;
• última actualización;
• ¿enlaces rotos?;
• ¿afirmaciones sin fuente?;
• ¿se contradice con otra página?;
• ¿usa el sistema de diseño?
Ninguna página del pie puede dar 404, quedarse en un texto provisional ni salir con otro estilo.
El diseño: una sola casa
La documentación usa los mismos tokens que la landing (rejilla, espaciado, tipografía, color, radios, sombras e iconos del prompt 1). Encima, su propia anatomía.
1.  Cabecera:
    ◦ logo de Ledger Chat;
    ◦ buscador (⌘K y /);
    ◦ pestañas de sección (Product, Protocol, Developers, Trust, Company, Legal);
    ◦ el estado "Live on Aztec Alpha" con la red real;
    ◦ botón "Open Ledger Chat".
2.  Tres columnas en escritorio:
    ◦ navegación a la izquierda, con la sección activa;
    ◦ contenido de 680 a 760 px de medida;
    ◦ "On this page" a la derecha, que sigue el scroll.
    En móvil, una columna con el menú en hoja y el índice plegable.
3.  Anatomía de cada página:
    ◦ migas;
    ◦ título;
    ◦ entradilla de una frase;
    ◦ una línea de metadatos: "Updated", fecha real del último commit del archivo, sacada en el build con git; tiempo de lectura; "Edit on GitHub";
    ◦ el contenido;
    ◦ al pie, "Was this page accurate?" con un enlace a un issue prellenado, y "Previous / Next".
4.  Componentes de contenido, todos en la misma gramática:
    ◦ Avisos: Note, Important, Risk y Not yet, cada uno con icono propio. Not yet es para lo que viene.
    ◦ Bloques de código: con lenguaje, copiar y resaltado (Shiki en el build, sin JS en el cliente).
    ◦ Tablas: con cabecera fija y scroll horizontal en móvil.
    ◦ Fichas de dato verificable: dirección o class id truncados por el centro, copiar y enlace al explorador.
    ◦ Pestañas de código (TypeScript y Noir) y pasos numerados.
    ◦ Glosario en línea: el término subrayado con puntos y su definición al pasar o tocar.
5.  Páginas legales: medida estrecha de 640 px, numeración de secciones, índice arriba, fecha de vigencia y versión, imprimibles (hoja de estilo de impresión limpia).
6.  Accesibilidad: AA, foco visible, anclas de encabezado copiables (#), lang y navegación con teclado en todo, incluido el buscador.
El contenido: la documentación de referencia
En inglés, con frases cortas y voz activa. Cada página responde a una pregunta y lo dice en su entradilla.
Producto
• Overview: qué es Ledger Chat en un párrafo; qué funciona hoy y qué no (tabla con estado y fuente); en qué red corre.
• Guide: de cero a tu primer mensaje y a tu primer pago en la alpha. Una sección por tarea:
    ◦ entrar con tu wallet;
    ◦ elegir @username;
    ◦ compartir tu QR;
    ◦ escribir;
    ◦ llamar;
    ◦ pagar con HLC (solo con invitación);
    ◦ escrow y streams;
    ◦ multidispositivo;
    ◦ borrar y exportar.
  Capturas reales de la app en blanco.
• Changelog: el de lib/docs/pages/changelog.ts, con filtros por tipo, enlace permanente a cada versión y feed RSS o Atom (/docs/changelog.xml).
Protocolo (aquí se gana a Aztec Labs)
• Architecture: las capas (dispositivo, XMTP con MLS, servidor de Ledger Chat, Aztec Network y Ethereum). Qué sabe cada una y qué no, con un diagrama de límites de confianza.
• On Aztec (página nueva, o el /alpha del prompt 2 si ya existe):
    ◦ cómo usa Ledger Chat las piezas de Aztec: cuentas, PXE en el navegador, funciones privadas y públicas, notas, nullifiers, pruebas en el dispositivo, Fee Juice, y portales para lo que viene;
    ◦ cada concepto enlaza a su página en docs.aztec.network;
    ◦ comprueba cada definición contra la documentación de Aztec de la versión que usamos (v6, Aztec Tierra, según su página de Alpha) y anota la fecha.
• Contracts: PrivateEscrow, PaymentStream e IdentityCredential (si sigue en uso), cada uno con:
    ◦ propósito;
    ◦ funciones, privadas y públicas;
    ◦ estados, en un diagrama;
    ◦ invariantes;
    ◦ topes de la alpha;
    ◦ class id y dirección de deployments/;
    ◦ versión de aztec-nr y de Noir;
    ◦ enlace al código y a sus tests TXE, con el número de tests contado en el build.
• Ethereum:
    ◦ el portal (HLPortal, PortalToken y receptoras): diseño, límites, revisión interna (Slither, Halmos, fuzzing, cobertura y mutación, con los números reales de la CI) y por qué no está desplegado;
    ◦ los EIP que usa la app, cada uno enlazado: EIP-4361 (Sign-In with Ethereum), EIP-681 (los QR de pago), EIP-1193 (proveedores de wallet) y cualquier otro que aparezca en el código.
• Whitepaper: revisado para que no prometa nada que el código no haga. Si hay diferencias con el texto protegido, van a la propuesta de cambios.
Desarrolladores
• Developers:
    ◦ cómo ejecutar el repositorio en local;
    ◦ la estructura de carpetas;
    ◦ cómo correr las pruebas (Vitest, Hardhat, Foundry, y TXE con aztec test dentro de cada contrato, nunca desde la raíz);
    ◦ cómo se despliega y quién firma.
• Public API (página nueva): las rutas públicas (/api/stats/live, /api/protocol/metrics, /api/health y las que haya), con una especificación OpenAPI 3.1 generada desde el código o escrita y validada en la CI contra las respuestas reales, ejemplos con curl y límites de peticiones.
• Para agentes y herramientas:
    ◦ cada página también en Markdown en /docs/<slug>.md;
    ◦ un /llms.txt con el índice;
    ◦ sitemap.xml con fechas reales.
Confianza
• Security (/docs/bug-bounty, o /security si se crea):
    ◦ cómo reportar, qué entra en el alcance y qué no, y qué cuenta como crítico;
    ◦ el canal real (correo o GitHub Private Vulnerability Reporting del repositorio, si está activo);
    ◦ la clave PGP si existe;
    ◦ y /.well-known/security.txt según RFC 9116, con fecha de caducidad.
  Para fallos del protocolo de Aztec, su vía oficial. Plazos y recompensas, solo los que Stefan escriba.
• Audits:
    ◦ la revisión interna del 18/11/2026 (docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-18.md), con sus hallazgos y su estado;
    ◦ la frase "no external audit yet";
    ◦ el enlace al repositorio de informes de auditoría de Aztec para la red.
• Status: el estado real de la app, de la API y de la red de Aztec (bloque actual), la prueba de entrega del prompt 3 cuando exista, y el historial de incidencias publicado.
• Protocol metrics (/protocol): las métricas reales con su fuente y su hora.
Empresa y legal
• About: quién construye Ledger Chat y por qué, con lo que Stefan apruebe. Sin equipo inventado.
• Brand:
    ◦ el kit descargable de Ledger Chat: logo en SVG y PNG, colores, tipografía, el QR con marca y capturas reales;
    ◦ las reglas de uso;
    ◦ cómo citar el proyecto.
• Blog: solo entradas reales; si no hay, la página dice que el changelog es la fuente de novedades.
• Contact: canales reales.
• Legal (terms, privacy, cookies, disclaimer, legal notice, content policy): nueva presentación sin tocar el texto protegido. Las diferencias que encuentres con lo que hace el código van a la propuesta. Por ejemplo, el contador de visitantes y su almacenamiento local, o las comunidades legibles por el servidor.
Los diagramas Mermaid
Cómo se hacen
1.  Fuente y SVG en el repositorio.
    ◦ Cada diagrama es un archivo .mmd en docs/diagrams/.
    ◦ Se pinta a SVG en el build, o con un script que usa el Chromium de Playwright y la versión de mermaid del package.json, a public/docs/diagrams/<nombre>.svg.
    ◦ La página muestra el SVG: cero JavaScript de Mermaid en el cliente, nada que se reordene al cargar.
    ◦ Un test de la CI falla si un .mmd cambia y su SVG no.
2.  Tema propio:
    ◦ theme: 'base' con themeVariables del sistema: fondo #FFFFFF, nodos #F7F8FA con borde #E4E7EC, texto #15171C, líneas #475467 y un solo acento #5200FF para el camino que importa;
    ◦ fuente Inter;
    ◦ esquinas de 12 px;
    ◦ grosor de línea de 1,5;
    ◦ securityLevel: 'strict' y htmlLabels: false: con htmlLabels las etiquetas desaparecían, como ya pasó en components/privacy/MermaidDiagram.tsx.
3.  En la página, cada diagrama va en una figura con:
    ◦ título;
    ◦ pie de una línea;
    ◦ botón de pantalla completa con zoom y desplazamiento;
    ◦ "View source" (el .mmd en GitHub);
    ◦ descripción accesible (accTitle y accDescr dentro del diagrama, y un <figcaption>).
    En móvil se puede desplazar en horizontal sin romper la página.
4.  Verdad en cada flecha. Cada nodo y cada paso corresponde a código que existe. Al lado de cada diagrama, la lista de archivos que representa. Lo que aún no existe va en gris y con la etiqueta "next".
Qué diagramas, como mínimo
Diagrama
Tipo
Página
Las capas y quién ve qué (límites de confianza)
flowchart
Architecture
Enviar un mensaje directo: dispositivo → XMTP con MLS → dispositivo del otro
sequence
Architecture
Encontrar a alguien por @username o por QR
sequence
Guide y Architecture
Un pago privado con HLC: PXE, prueba en el dispositivo, nodo, secuenciador, bloque L2 y asiento en Ethereum
sequence
On Aztec
Estados de un escrow (abierto, reclamado, reembolsado) y su nullifier compartido
stateDiagram
Contracts
Ciclo de vida de un stream (abierto, retirada, cancelación)
stateDiagram
Contracts
Comisiones con Fee Juice: quién paga y qué es público
flowchart
On Aztec
Depósito desde Ethereum por el portal (next): L1 → mensaje L1 a L2 → reclamo
sequence, en gris
Ethereum
Una llamada: señalización, TURN y WebRTC de dispositivo a dispositivo
sequence
Architecture
Multidispositivo: instalaciones de XMTP y sincronización
flowchart
Guide
La alpha cerrada: invitación, consentimiento, topes y pausa
flowchart
On Aztec
De un commit a producción: CI, comprobaciones obligatorias, despliegue en Railway y migraciones
flowchart
Developers
Respuesta a un incidente (runbook de la alpha)
flowchart
Security
Hoja de ruta: ola 1, ola 2 y después, sin fechas inventadas
timeline
Overview
Alineamiento con Aztec, en concreto
• Un glosario (/docs/glossary) con los términos de Aztec y de Ledger Chat:
    ◦ Account, PXE, Note, Nullifier, Private function, Public function, Fee Juice, FPC, Portal, L1 → L2 message, Aztec Alpha, Noir, aztec-nr, TXE;
    ◦ y de Ledger Chat: HLC, escrow, stream, @username, MLS.
  Cada uno con una definición de una línea y el enlace a docs.aztec.network o a la fuente.
• Versiones visibles en el pie de cada página del protocolo: versión de la red y del SDK de Aztec, versión de aztec-nr y de Noir, y fecha de comprobación. Si el package.json cambia de versión de Aztec, un test obliga a revisar la página.
• Los riesgos de Alpha que publica Aztec, enlazados desde Overview, On Aztec y Security (los mismos 15 puntos del prompt 2).
• Distinguir siempre Aztec Network, Aztec Labs, Aztec Foundation, Noir y el token.
Para destacar en la comunidad de Ethereum
• Todo verificable: cada dirección con enlace al explorador, cada número de test con enlace a la ejecución de la CI, y cada afirmación de seguridad con enlace al informe.
• Código abierto bien hecho. En el repositorio:
    ◦ README que lleva a la documentación;
    ◦ CONTRIBUTING.md;
    ◦ SECURITY.md;
    ◦ licencia clara;
    ◦ plantillas de issue y de PR;
    ◦ etiquetas "good first issue" en tareas reales.
• Rendimiento de la documentación: páginas estáticas, búsqueda con índice generado en el build (lib/docs/searchIndex.ts), Lighthouse ≥ 95 en todo y cero JavaScript para leer.
• Imagen al compartir por página (Open Graph con título y sección), para que cada enlace en X, Farcaster o el foro de Aztec se vea cuidado.
Control de calidad
1.  Enlaces. Un comprobador en la CI recorre todas las páginas y falla con cualquier 404, interno o externo (los externos, con reintento y lista de excepciones justificadas).
2.  Contenido. Un test de afirmaciones falla si aparecen:
    ◦ "audited" sin "internal";
    ◦ "end-to-end" junto a comunidades;
    ◦ "partner" junto a Aztec o Ethereum;
    ◦ una dirección que no esté en deployments/.
3.  Diagramas. Cada .mmd tiene su SVG actualizado, su accDescr y su lista de archivos.
4.  Capturas de cada página a 390, 1024 y 1440 px en la PR, revisadas contra el sistema de diseño.
5.  La tabla del inventario, con cada fila marcada como resuelta.
Lo que hace Stefan
• Aprobar los textos de About, Contact, Security (plazos, PGP y, si los hay, recompensas) y Brand.
• Revisar con el abogado la propuesta de cambios en lo legal.
• Activar GitHub Private Vulnerability Reporting en el repositorio si quiere ese canal.
Definición de terminado
[ ] Todas las páginas del pie existen, usan el sistema de diseño y tienen fecha real de actualización. Ningún 404.
[ ] Documentación de producto, protocolo (con On Aztec, Contracts y Ethereum), desarrolladores (con OpenAPI y Markdown para agentes), confianza y empresa, todo con fuente.
[ ] Los 14 diagramas Mermaid como mínimo, pintados a SVG en el build, con el tema del sistema, accesibles y con su lista de archivos.
[ ] Glosario de Aztec, versiones visibles y riesgos de Alpha enlazados.
[ ] security.txt, SECURITY.md, CONTRIBUTING.md, plantillas, sitemap.xml, llms.txt y RSS del changelog.
[ ] Comprobador de enlaces, test de afirmaciones y test de diagramas en la CI. Las cuatro comprobaciones obligatorias en verde.
[ ] Propuesta de cambios para legal.ts y protocol.ts escrita para Stefan, sin editar esos archivos.