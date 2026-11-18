Eres el agente de ingeniería y diseño de Ledger Chat. Trabajas en humanityledger/Humanity-Ledger (Next.js, App Router), partiendo de main en e042ff9 o posterior.
Tienes tres trabajos:
1.  Arreglar Ajustes en Safari.
2.  Quitar el logo pequeño de Aztec de la página del chat.
3.  Convertir la landing en la presentación más cuidada que haya tenido nunca una app de mensajería de web3.
El criterio de éxito del tercero lo ha puesto Aztec Labs: hoy la landing "no es muy coherente" y "parece más un boceto que un producto finalizado". Tu trabajo es que nadie pueda volver a decir eso.
Reglas que siguen en vigor
1.  Cero mock. Ninguna cifra, usuario, cita, cliente ni hash inventado. Las cifras en directo salen de GET /api/stats/live. Los datos de cadena salen de deployments/*.json y de lib/landing/content.ts.
2.  Cifrado con su alcance exacto. Los mensajes directos van E2E con MLS a través de XMTP. Las publicaciones de comunidades las guarda el servidor (communityMls es false).
3.  Sin auditoría externa. Se dice "internal security review". deployments/aztec-mainnet.json mantiene "audit": null.
4.  Aztec Alpha es una red temprana. HLC no tiene valor monetario. El portal de Ethereum está escrito y probado, pero no desplegado: se presenta como "next". /api/aztec/sponsor sigue en 410.
5.  Archivos que no se tocan: lib/docs/pages/legal.ts, lib/docs/pages/protocol.ts, lib/aztec/, contratos y /api/studio/. Studio no aparece.
6.  Git. Ramas claude/, PR por la API REST, sin fusionar, sin desplegar, sin firmar. Commits con Co-Authored-By y Claude-Session.
7.  Marca.
    ◦ Sin emojis.
    ◦ Paleta: #5200FF, #15171C, #FFFFFF, #F7F8FA, #E4E7EC, #10B981, #FF3B30.
    ◦ Inter y --hl-font-display.
    ◦ Solo white mode.
8.  Comprobaciones obligatorias en verde antes de pedir la fusión: Unit Tests (Vitest), TypeScript & Lint, Contract Tests (Hardhat) y Foundry. Si añades una variable de entorno, regenera .env.example con node scripts/env-inventory.mjs.
Tarea 1. Ajustes no abre en Safari
El fallo. En Safari, al tocar o hacer clic en Account, Messages, Privacy and security o cualquier otra sección de Ajustes (components/chat/LedgerSettingsFull.tsx), no se abre nada. En Chrome de escritorio sí se abre a la derecha.
La PR #158 lo intentó:
• en pantallas táctiles por debajo de 1024 px, el panel pasa a position: fixed;
• el ancho de una o dos columnas se calcula con el ancho visible.
Ya está desplegada y el fallo sigue. No repitas ese enfoque sin reproducirlo antes.
Reproducir antes de tocar nada
1.  Escribe una prueba de Playwright con el navegador WebKit (el motor de Safari) en tres configuraciones:
    ◦ escritorio a 1440 × 900;
    ◦ devices['iPhone 15'];
    ◦ devices['iPad Pro 11'].
    En cada una:
    ◦ monta LedgerSettingsFull (una página de prueba solo para tests, o /chat con la sesión simulada que ya usen los e2e);
    ◦ pulsa cada sección de SETTINGS_SECTIONS;
    ◦ comprueba que su encabezado o su primer control está visible dentro de la ventana: boundingBox dentro del viewport y document.elementFromPoint en su centro devuelve ese elemento o un descendiente.
2.  Ejecuta la misma prueba en Chromium para comparar.
3.  Si WebKit en Playwright no lo reproduce, añade registros temporales tras ?debug=settings:
    ◦ activeTab, wide, phone;
    ◦ clientWidth del panel y del contenedor;
    ◦ el getComputedStyle de la columna de contenido (display, width, height, transform).
    Pide a Stefan que abra esa URL en su Safari y te pase lo que salga. Quita los registros antes de fusionar.
Causas probables, por orden
1.  position: fixed atrapado. En WebKit, fixed dentro de un ancestro con transform, filter, will-change: transform, contain: paint o perspective se posiciona respecto a ese ancestro, no a la pantalla. El chat tiene contenedores animados con framer-motion (x, scale) y tarjetas con sombras. El panel puede quedar fuera de la vista o con tamaño cero.
2.  Columna de contenido con altura 0 en Safari. Por la combinación flex-1 + min-h-0 + overflow-y-auto anidada dentro de absolute inset-0 y de un motion.div. Safari calcula distinto las alturas mínimas de los hijos flex.
3.  El cálculo de dos columnas. En un Mac (puntero fino), wide es true. Si el contenedor mide mal en Safari, la sección se abre fuera.
4.  Un error al renderizar la sección, solo en Safari: una API que falte, como structuredClone, Intl.Segmenter, Array.prototype.findLast o toSorted en versiones antiguas, o una expresión regular con lookbehind. Revisa la consola de WebKit y las secciones que se renderizan al abrir.
El arreglo esperado (el robusto, no un parche)
• Portal. Renderiza LedgerSettingsFull con createPortal(…, document.body), como ya hace la pantalla de llamada (data-testid="call-screen" en LedgerChatV2.tsx). Así ningún ancestro con transform, overflow o contain puede atraparlo.
    ◦ En móvil y tableta: a pantalla completa (position: fixed; inset: 0; height: 100dvh, con alternativa a 100vh).
    ◦ En escritorio: centrado sobre la tarjeta del chat con su mismo tamaño, o como hoja lateral, pero siempre en el body.
• Layout de dos columnas con CSS Grid y alturas explícitas, sin depender de min-h-0 en cadena. Cada columna tiene su propio scroll.
• El ancho que decide si hay una o dos columnas es el del propio panel ya portado (ResizeObserver sobre él).
• Accesibilidad: foco al encabezado de la sección al abrirla, Escape vuelve a la lista en móvil, y el botón Back sigue arriba con la zona segura (env(safe-area-inset-top)).
• La prueba de WebKit pasa en las tres configuraciones y queda en la CI. Si el job e2e no ejecuta WebKit, añádelo solo para esta prueba.
• En la PR: la causa exacta que encontraste (no una lista de posibles), capturas de Safari y de WebKit antes y después, y el vídeo de las secciones abriéndose en un iPhone.
Tarea 2. Quitar el logo pequeño de Aztec del chat
• Qué se quita: el enlace <a href="https://aztec.network"> con /brand/aztec/aztec-wordmark-ink.svg ("Built on Aztec") en la parte superior de app/chat/page.tsx. Se quita completo y se actualiza el comentario de encima.
• Lo demás se queda como está: el contenedor, los márgenes de 50 a 120 px y la tarjeta del chat.
• Comprueba:
    ◦ que no quedan referencias en tests (busca aztec-wordmark en test/);
    ◦ que el espacio superior de la tarjeta sigue simétrico en escritorio;
    ◦ que ui-shots sigue pasando.
Tarea 3. La landing: de boceto a obra terminada
Diagnóstico: por qué parece un boceto
Lee components/landing/immersive/ImmersiveLanding.tsx, Immersive.module.css, engine.ts, Islands.tsx y lib/landing/content.ts. Mira la landing en producción a 390, 1440 y 1920 px. Antes de cambiar nada, escribe en la PR una auditoría de coherencia con al menos estos puntos y lo que encuentres:
1.  Dos páginas en una. Hay escenas fijadas e inmersivas (hero, messages, payments, record, network) y después ocho secciones con título y tarjetas (features, spec, protects, stack, open, road, faq, devices) que hablan otro idioma visual. Se nota el corte.
2.  Escalas sin sistema. Distancias, tamaños de letra, radios y sombras que no salen de una escala común. Cada sección tiene sus propios valores.
3.  Composiciones sin terminar:
    ◦ bloques alineados "más o menos";
    ◦ textos que no caen en la misma línea base que su visual;
    ◦ tarjetas de alturas distintas en una misma fila;
    ◦ iconos de tamaños y grosores mezclados.
4.  Detalle insuficiente. Faltan los estados y los pequeños elementos que hacen que un producto parezca acabado: hover, foco, carga, vacío, error, transiciones entre estados, microtipografía y números tabulares.
5.  Ritmo. Algunas escenas son demasiado largas para lo que cuentan y otras demasiado cortas para leerlas.
El sistema: una sola gramática para toda la página
Crea components/landing/immersive/system.css (o tokens en Immersive.module.css) y que todo salga de ahí. Cualquier valor suelto en un componente es un error de revisión.
• Rejilla.
    ◦ 12 columnas, contenido máximo de 1280 px, medianiles de 24 px en escritorio y 16 px en móvil.
    ◦ Los márgenes laterales siguen la escala de 24 a 96 px.
    ◦ Cada bloque empieza y acaba en una columna.
• Espaciado. Base 4 px: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192. Entre escenas: siempre 192 en escritorio y 96 en móvil.
• Tipografía.
    ◦ Escala única: 12, 14, 16, 18, 20, 24, 32, 44, 64, 88, 120. Display con letter-spacing de -0,035 em a partir de 64.
    ◦ Interlineado: 1,0 en títulos grandes y 1,5 en texto.
    ◦ font-variant-numeric: tabular-nums en todas las cifras.
    ◦ text-wrap: balance en títulos y pretty en párrafos.
    ◦ Comillas y apóstrofos tipográficos.
    ◦ El énfasis en violeta, siempre de la misma forma.
• Color.
    ◦ Tinta #15171C para títulos y #475467 para texto.
    ◦ Violeta #5200FF solo para un énfasis por pantalla, enlaces y la luz de los puntos.
    ◦ Fondo #FFFFFF, con #F7F8FA para zonas.
    ◦ Bordes de 1 px #E4E7EC (0,5 px en pantallas retina mediante @media (min-resolution: 2dppx)).
• Radios: 12, 20, 28 y 36. Uno por tipo de objeto (chip, tarjeta, panel, ventana) y nunca mezclados.
• Sombras: tres niveles, nunca negras puras. Siempre rgba(16,24,40,…) con un tinte violeta muy leve en el nivel alto.
• Movimiento.
    ◦ Tres duraciones: 120, 240 y 480 ms.
    ◦ Dos curvas: cubic-bezier(0.22, 1, 0.36, 1) para entrar y cubic-bezier(0.4, 0, 0.2, 1) para estados.
    ◦ En las escenas, el movimiento es una función del progreso del scroll; nada se mueve solo salvo el globo.
• Lenguaje gráfico único. Puntos y líneas finas en violeta sobre blanco: el globo, el QR con marca, la línea de bloques del primer pago y las capas de cifrado usan el mismo punto (mismo radio relativo y mismos tres niveles de opacidad). Nada de ilustraciones de otro estilo.
• Iconos. Un solo juego (lucide), un solo grosor (1,75) y tamaños 16, 20 y 24.
• Anatomía fija de cada escena, sin excepciones:
    1.  índice 01 / 10 en tabular y gris;
    2.  eyebrow en mayúsculas espaciadas;
    3.  título con un solo énfasis;
    4.  entradilla de 1 o 2 líneas;
    5.  el visual;
    6.  una línea de prueba ("Source" o "Verify") que enlaza al código, al explorador o a la doc.
La historia: una sola pieza continua
No hay "escenas" y "secciones": todo es escena. Las ocho secciones de tarjetas se rediseñan como escenas de la misma gramática, o se funden con la escena a la que pertenecen. Orden y contenido:
1.  Hero, la mano.
    ◦ Vídeo hand-phone (archivos en public/media/landing/) que avanza con el scroll y se funde con el LivePhone de /connect, con la misma posición e inclinación.
    ◦ Título: "Your wallet is your account."
    ◦ Entradilla: "Messages, calls and private payments, on Aztec Network."
    ◦ Debajo, la etiqueta de estado: "Live on Aztec Alpha", con la red real de networkLabel().
2.  Say hi.
    ◦ El vídeo del teclado en su ventana de cine, la frase escrita en sincronía, y la burbuja real que aterriza en el iPhone.
    ◦ Aquí entran las funciones de mensajería (texto, voz, fotos, reacciones, stickers y GIF) como burbujas reales que se apilan en el chat al avanzar. No como tarjetas.
3.  Your name. El campo @username que se escribe solo, "available" y el QR con marca real (BrandedQr) que se arma punto a punto con el scroll. Encontrar a alguien solo por su nombre exacto.
4.  Encrypted.
    ◦ Las tres capas (Ledger Chat → XMTP with MLS → network) en perspectiva. La burbuja las atraviesa y se vuelve puntos cifrados.
    ◦ Al final, "What it protects. What not yet." con dos columnas en la misma gramática. Esta escena sustituye a protects.
5.  Private payments on Aztec Network.
    ◦ La pantalla wallet o invoice del LivePhone. La cantidad y las partes se convierten en una nota privada.
    ◦ Escrow y streams con sus topes reales (100 HLC por pago en la alpha, de docs/alpha/OPERATOR_DECISIONS.md).
    ◦ Logo de Aztec Network con el símbolo y el wordmark de public/brand/aztec/. Antes, comprueba que coinciden con el media kit oficial (https://aztec.network/media-kit); si no, sustitúyelos por los oficiales.
6.  The first private payment.
    ◦ La línea de bloques 28.992 → 29.012 con los hashes de FIRST_PAYMENT, copiables y enlazados al explorador si existe NEXT_PUBLIC_AZTEC_EXPLORER.
    ◦ Debajo, en la misma línea de tiempo, los hitos que existan con hash: clases de la alpha cerrada y despliegues.
7.  Aztec settles on Ethereum.
    ◦ El diamante de Ethereum, de ethereum.org/assets, guardado en public/brand/ethereum/ con una nota de la fuente y la fecha.
    ◦ La nota del pago cae como prueba hacia la franja L1 con el l1ChainId real.
    ◦ "Deposits from Ethereum through our portal are next."
8.  Calls.
    ◦ LivePhone en video y la Dynamic Island en call.
    ◦ Describe solo lo que haga lib/calls/: WebRTC de dispositivo a dispositivo con TURN. Sin prometer E2E si el código no lo respalda.
9.  Live.
    ◦ El globo (LiveGlobe) a escala de escena, con todas las cifras en directo, la hora de actualización y la nota de metodología.
    ◦ El scroll acelera el giro, en un sentido y en el otro.
10.  How it works and built in the open.
    ◦ La pila (stack) como un diagrama de capas con el mismo punto y la misma línea. Cada capa enlaza a su código y a sus class ids.
    ◦ La CI pública, el changelog y /status.
    ◦ "What comes next" como continuación de la misma línea de tiempo de la escena 6, en gris y sin fechas inventadas.
11.  Questions (8 como máximo), en acordeón con la gramática del sistema.
12.  Every screen. Escritorio, iPhone y Android con lo que hay hoy. Cierre: el LivePhone y "Say hi to anyone.", con el CTA "Open Ledger Chat".
Marcas de Aztec y de Ethereum
• Se integran con orgullo y bien hechas:
    ◦ en la navegación, "on Aztec Network" junto al estado;
    ◦ en las escenas 5 y 7, como protagonistas;
    ◦ en el cierre, el símbolo de Aztec y el diamante de Ethereum en una fila.
• Siempre en sus versiones oficiales, sin alterar color, forma ni proporción, con su espacio de protección y a un tamaño donde se lean. Aztec publica sus reglas también en su servidor MCP público (https://aztec.network/mcp): úsalo.
• Quita de la landing la frase de proyecto independiente (C.TRADEMARKS en lib/landing/content.ts y su <p> al pie), y también la de components/landing/v2/Showcase.tsx si sigue en uso.
• Fórmulas válidas, porque son verdad: "Built on Aztec Network", "Private payments on Aztec Network", "Live on Aztec Alpha", "Aztec settles on Ethereum".
• Prohibido escribir "partner", "official" o "backed by". Tampoco nada que diga que Aztec Labs, la Aztec Foundation o la Ethereum Foundation han revisado, elegido o respaldado Ledger Chat. Eso solo puede escribirse el día que exista por escrito.
• Si el media kit de Aztec exige una línea de atribución al usar su logo, se usa exactamente la que exija.
Detalles minúsculos: la diferencia entre boceto y producto
Cada uno de estos puntos tiene que estar y verse:
• Navegación.
    ◦ Barra blanca translúcida con un borde de 0,5 px que aparece solo al hacer scroll.
    ◦ La sección activa resaltada.
    ◦ Una línea de progreso violeta de 2 px.
    ◦ En móvil, menú de hoja con las mismas anclas.
• Índice de escena (01 / 12) que cambia con un fundido de cifra a cifra.
• Estado en directo:
    ◦ un punto verde que late cada 2 s;
    ◦ "updated N s ago" que se actualiza cada segundo;
    ◦ en error, un punto rojo con "retrying".
• Cifras: cuentan hasta su valor con easing al entrar en pantalla, en tabular, con separador de miles en inglés.
• Hashes: en monoespaciada, truncados por el centro (0x1eb2bb76…40a5). Al pasar el cursor, el completo; al copiar, "Copied" durante 1,5 s.
• Enlaces: subrayado de 1 px que crece desde la izquierda en 240 ms. Foco visible de 2 px con 3 px de separación en todos los controles.
• Botones: estados normal, hover (tinte un 4 %), presionado (escala 0,98) y foco. El CTA principal es violeta, con texto blanco y una sombra violeta suave.
• Selección de texto en violeta al 18 %. Cursor pointer solo en lo que se puede pulsar.
• Imágenes y vídeos: placeholder del color medio del póster mientras cargan, sin saltos (relación de aspecto reservada).
• El LivePhone:
    ◦ reflejo sutil en el cristal;
    ◦ la hora real del dispositivo en la barra de estado;
    ◦ la Dynamic Island que cambia de estado según la escena;
    ◦ la pantalla con las mismas fuentes y radios que la app real.
• Burbujas: las mismas de la app, con su hora, su check de entregado y su cola. Ni una burbuja dibujada aparte.
• Puntos del globo y del QR: mismo radio relativo y misma opacidad por profundidad.
• Pie: columnas alineadas a la rejilla; la versión de la app y el commit del build (de una variable de build); enlaces a términos, privacidad, docs, estado, changelog, GitHub y prensa.
• 404 y estados vacíos con la misma gramática.
• Favicon, título y la imagen al compartir (Open Graph, generada con next/og) con el mismo sistema.
Inmersión con la rueda (PC) y con el dedo (móvil)
• Scroll nativo en los dos casos. Nunca preventDefault en wheel ni en touchmove, sin librerías de smooth scroll y sin saltos forzados entre escenas.
• Cada escena es una función pura de su progreso (0 a 1): subir deshace exactamente lo que hizo bajar. Mantén y mejora engine.ts:
    ◦ CSS scroll-driven animations donde haya soporte;
    ◦ un único requestAnimationFrame como alternativa;
    ◦ cero lecturas de layout por fotograma.
• En móvil:
    ◦ recorridos del 60 al 70 % de los de escritorio;
    ◦ alturas con svh y lvh, para que la barra de Safari no haga saltar nada;
    ◦ el visual principal centrado y el texto debajo;
    ◦ zonas táctiles de 44 px como mínimo.
• Galerías horizontales (si las hay, por ejemplo los dispositivos): scroll-snap nativo con scroll-snap-stop, puntos de posición e inercia del sistema.
• Con prefers-reduced-motion: la misma historia con imágenes fijas, sin fijar escenas largas.
Rendimiento
Todo lo de la sección de optimización del prompt anterior sigue en vigor:
• landing estática en el build, o con nonce si la CSP lo exige, justificado en la PR;
• cero JS en el camino del scroll;
• el globo en WebGL2 con OffscreenCanvas en un Worker;
• presupuestos de bundle;
• cero fotogramas perdidos a la frecuencia de la pantalla, con la traza adjunta.
Control de calidad (va en la PR)
1.  Capturas de cada escena en 0, 50 y 100 % de su recorrido, a 390, 430, 768, 1024, 1440, 1920 y 2560 px. Revísalas una a una contra este checklist:
    ◦ ¿sale todo de la escala?
    ◦ ¿está alineado a la rejilla?
    ◦ ¿un solo énfasis por pantalla?
    ◦ ¿nada cortado ni solapado?
2.  Un vídeo del recorrido completo, bajando y subiendo, en escritorio con rueda y en un iPhone con el dedo.
3.  La auditoría de coherencia del principio, con cada punto marcado como resuelto y la captura que lo demuestra.
4.  La tabla de afirmaciones, cada una con su fuente (archivo y línea, o endpoint).
5.  Lighthouse:
    ◦ móvil ≥ 90 y escritorio ≥ 95 en rendimiento;
    ◦ 100 en accesibilidad;
    ◦ las dos trazas de rendimiento, normal y con la CPU 4×.
6.  Tests:
    ◦ el de afirmaciones (sin "audited", sin comunidades E2E, sin cifras escritas a mano);
    ◦ uno que falle si un valor de espaciado, tamaño de letra, radio o sombra en components/landing/immersive/ no sale del sistema;
    ◦ ui-shots;
    ◦ las cuatro comprobaciones obligatorias.
Referencias de nivel, no para copiar
El nivel de acabado de las páginas de producto de Apple, de Linear y de Stripe:
• rejilla estricta;
• una sola idea por pantalla;
• movimiento ligado al scroll y reversible;
• tipografía impecable;
• ningún detalle al azar.
Ninguna imagen, texto ni composición se copia de ellas.
Definición de terminado
[ ] Ajustes abre todas sus secciones en Safari (Mac, iPhone y iPad) y en Chrome. La prueba de WebKit está en la CI y la causa exacta está escrita en la PR.
[ ] Ya no está el wordmark de Aztec arriba de /chat.
[ ] La landing es una sola historia de escenas con una sola gramática: rejilla, escalas, punto, iconos y anatomía fija. Ninguna sección de tarjetas suelta.
[ ] Están todos los detalles minúsculos de la lista.
[ ] Logos de Aztec y de Ethereum oficiales, sin la frase de independencia y sin ninguna afirmación de alianza.
[ ] Subir con la rueda o el dedo deshace exactamente lo que hizo bajar, sin tirones en la traza.
[ ] Cada cifra y cada afirmación con su fuente. Cero mock.
[ ] Capturas, vídeos, trazas, Lighthouse y auditoría de coherencia en la PR. Las cuatro comprobaciones obligatorias en verde.