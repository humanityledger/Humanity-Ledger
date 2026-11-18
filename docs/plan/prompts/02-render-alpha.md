Eres el agente de ingeniería de Ledger Chat en humanityledger/Humanity-Ledger. La landing ya tiene su historia y su sistema de diseño (prompt anterior). Ahora tienes dos trabajos:
• A. Que se pinte de forma impecable: nada borroso, nada que salte, ningún fotograma perdido a la frecuencia de cualquier pantalla, hasta 240 Hz.
• B. Que esté completa: toda la información que Aztec publica para quien usa y construye apps en Aztec Alpha tiene que estar en Ledger Chat, clara, con fuente y aplicada a nuestro caso.
Todas las reglas del prompt anterior siguen en vigor:
• cero mock;
• cifrado con su alcance exacto;
• "internal security review";
• portal como "next";
• archivos que no se tocan;
• ramas claude/ y sin fusionar;
• las cuatro comprobaciones obligatorias en verde;
• white mode.
Parte A. Render impecable
La promesa, dicha con precisión
Ninguna web pinta más rápido que su pantalla. La promesa medible es "cero fotogramas perdidos a la frecuencia de la pantalla, hasta 240 Hz", con las trazas en la PR. Los vídeos son de 25 fps y lo seguirán siendo. Lo que va a 240 es todo lo demás.
Presupuestos por frecuencia
Pantalla
Fotograma
Hilo principal durante el scroll
60 Hz
16,7 ms
≤ 4 ms
120 Hz (ProMotion)
8,3 ms
≤ 2,5 ms
144 Hz
6,9 ms
≤ 2 ms
240 Hz
4,17 ms
≤ 1,5 ms
Cero tareas largas mientras se hace scroll en cualquiera de ellas.
Nitidez: nada borroso
1.  Texto nítido en movimiento.
    ◦ Ningún texto queda en reposo con una transformación fraccional. Al terminar el movimiento de una escena, redondea la traslación a píxeles del dispositivo (Math.round(x * dpr) / dpr) o quita la transformación.
    ◦ Durante la animación se permite subpíxel.
    ◦ No escales texto con transform: scale: anima tamaño con una capa duplicada y opacidad, o escala solo imágenes.
2.  Líneas de 1 px y 0,5 px alineadas a píxel.
    ◦ Bordes con border (no con sombras).
    ◦ En retina, 0,5 px con @media (min-resolution: 2dppx).
    ◦ En SVG, coordenadas en .5 para trazos de 1 px y shape-rendering: geometricPrecision en curvas.
3.  Capas con will-change solo mientras se animan. Una capa que se queda compuesta con escala distinta de 1 se ve borrosa.
4.  Imágenes.
    ◦ Cada imagen se sirve al tamaño exacto de su caja por devicePixelRatio, con srcset y sizes reales (AVIF, WebP y PNG para logos con transparencia).
    ◦ Antes de mostrar una imagen, await img.decode(): nunca aparece a medio decodificar.
5.  Logos de Aztec y de Ethereum en SVG oficial, nunca rasterizados ni reescalados por encima de su tamaño de diseño.
6.  Canvas (globo y QR):
    ◦ tamaño interno igual a la caja × dpr (máximo 2);
    ◦ imageSmoothingQuality: 'high';
    ◦ y el WebGL con antialias: true o MSAA equivalente.
7.  Color.
    ◦ Todo en sRGB.
    ◦ Los pósters y los vídeos con el mismo perfil, para que no haya salto de color al cambiar de uno a otro: comprueba que el primer fotograma del vídeo y el póster coinciden píxel a píxel en una captura.
    ◦ Nada de filter que lave los colores.
8.  Fuentes.
    ◦ Inter variable en woff2, con subconjunto latino y preload.
    ◦ font-display: swap con size-adjust, ascent-override y descent-override en la fuente de respaldo, para que el cambio no mueva nada.
    ◦ -webkit-font-smoothing: antialiased solo sobre fondos de color; sobre blanco, el del sistema.
    ◦ font-optical-sizing: auto.
Estabilidad: nada salta
1.  CLS 0,00. Todo lo que carga después tiene su caja reservada: vídeos, imágenes, el globo, las cifras en directo (ancho tabular reservado para 7 dígitos) y los logos.
2.  Barra de Safari en móvil. Alturas con svh y lvh y nunca vh. Las escenas fijadas no se recalculan cuando la barra aparece o desaparece. Compruébalo con una grabación en un iPhone.
3.  Sin parpadeos entre estados. Al cambiar de escena, el vídeo, el póster y el LivePhone se cruzan con opacidad, nunca con display.
4.  El globo y las cifras en directo no repintan la página: solo su propio canvas y sus nodos de texto.
Fluidez: el pipeline
1.  Landing estática en el build. Si la CSP con nonce lo impide, documenta la alternativa (hashes de los scripts en línea o CSP en el borde) y mide el TTFB.
2.  Animaciones ligadas al scroll con CSS scroll-driven animations (animation-timeline), que el navegador ejecuta en el compositor. Fallback: un solo requestAnimationFrame que escribe --p por escena activa. Ni React ni framer-motion en ese camino.
3.  Solo transform y opacity. Nada de filter: blur, backdrop-filter, box-shadow, clip-path ni border-radius animados. Las máscaras que crecen, con contenedor escalado y contra-escala.
4.  El globo en WebGL2, dentro de un Worker con OffscreenCanvas, en un solo draw call. En pausa fuera de pantalla y con la pestaña oculta.
5.  Vídeo.
    ◦ Avance con el scroll con los archivos all-intra (-scrub), un solo seek en vuelo, requestVideoFrameCallback e interpolación del objetivo.
    ◦ En móvil y con saveData, reproducción normal.
    ◦ Los recursos de la escena siguiente se precargan con requestIdleCallback cuando la actual llega al 50 %.
6.  Aislamiento. contain: layout paint style en cada escena, y content-visibility: auto con contain-intrinsic-size en las que están lejos.
7.  Memoria estable tras diez recorridos completos (heap snapshot antes y después).
Verificación (la parte A no está hecha sin esto)
1.  Prueba de fotogramas en la CI con Playwright y CDP, en Chromium y en WebKit:
    ◦ scroll con la rueda de arriba abajo y de abajo arriba;
    ◦ cuenta los fotogramas cuyo hilo principal pasa de 4 ms y los Long Animation Frames;
    ◦ falla si superan los presupuestos de la tabla.
2.  Regresión visual al píxel.
    ◦ toHaveScreenshot de cada escena al 0, 50 y 100 %, en 390, 1440 y 2560 px.
    ◦ Umbral del 0,1 %.
    ◦ Con fuentes y animaciones deterministas (prefers-reduced-motion desactivado y progreso fijado por URL, por ejemplo ?p=scene:0.5, solo en tests).
3.  Trazas manuales en un monitor de 240 Hz (o la frecuencia máxima disponible), un iPhone ProMotion y un Android de gama media. En la PR van las trazas y las grabaciones a 60 fps.
4.  Lighthouse CI:
    ◦ móvil: rendimiento ≥ 90, accesibilidad 100, CLS 0, LCP ≤ 2 s;
    ◦ escritorio: rendimiento ≥ 95.
5.  Medición con usuarios reales tras desplegar:
    ◦ LCP, CLS, INP y Long Animation Frames, agregados en un endpoint propio, sin identificadores;
    ◦ un panel interno con el percentil 75 por dispositivo.
Parte B. La landing completa para Aztec Alpha
Lo que hay que saber primero
Aztec no publica una lista oficial de lo que una app debe poner en su landing. Lo que sí publica, en su documentación de Alpha y en su ecosistema, es lo que cualquier persona que use una app en Alpha tiene que entender. Ledger Chat lo presenta entero, con sus palabras precisas y aplicado a nuestro caso, cada punto con su fuente.
El agente lee y cita estas fuentes en la PR:
• docs.aztec.network/participate/alpha
• docs.aztec.network/networks
• la página de limitaciones de la documentación
• aztec.network/ecosystem
• el media kit
Comprueba cada dato en la fuente el día del cambio: Aztec actualiza estas páginas.
Qué tiene que contener
Una escena en la landing ("On Aztec Alpha") con lo esencial y un enlace a una página completa, /alpha, con todo. Ambas en la misma gramática de diseño y con el contenido en lib/landing/content.ts.
1.  Red y versión.
    ◦ Qué es Alpha: la red principal de Aztec en su primera fase, sobre Ethereum mainnet.
    ◦ La versión en la que corre Ledger Chat. Según la documentación de Aztec, Alpha corre la línea v6, Aztec Tierra; comprueba que coincide con nuestra configuración (networkLabel(), versión del SDK en package.json).
    ◦ El l1ChainId real.
2.  Riesgos de la red, en sus términos. Software temprano en el que se esperan fallos, incluso críticos. Ninguna parte de la pila de Aztec está auditada por completo y las auditorías siguen en curso. Enlace a la página de Alpha de Aztec.
3.  Lo que hacemos nosotros por esos riesgos:
    ◦ topes por pago (100 HLC en la alpha cerrada, de docs/alpha/OPERATOR_DECISIONS.md);
    ◦ HLC sin valor monetario;
    ◦ alpha con invitación y 20 testers como máximo;
    ◦ comisión de protocolo desactivada;
    ◦ pausa de pagos y runbook de incidentes (de la PR #154).
    Que cada dato salga de la configuración o de los documentos, no del copy.
4.  Privacidad: lo que sí y lo que no.
    ◦ En Aztec son privados importes, partes y notas.
    ◦ No lo son:
        ▪ el número de efectos de una transacción (permite huellas, según Aztec);
        ▪ las consultas a nodos de terceros;
        ▪ el pagador de comisiones mientras no haya un FPC privado.
    ◦ En Ledger Chat, los mensajes directos van E2E con MLS y las comunidades las lee el servidor.
5.  Límites técnicos. Aztec tiene topes por transacción (lecturas, escrituras, notas, nullifiers, logs, mensajes). Explica en una línea qué significa para un pago o un escrow y enlaza a la página de limitaciones.
6.  Actualizaciones y migración.
    ◦ Cuando la red se actualiza, un rollup nuevo se vuelve canónico, el estado no pasa solo y las apps se redespliegan.
    ◦ Qué hará Ledger Chat cuando pase: aviso en la franja de estado, plazo, cómo recuperar un escrow o un stream abierto, y dónde se publicarán las clases nuevas.
    ◦ Si no hay plan escrito, se escribe en docs/alpha/ antes de publicar la escena (pide a Stefan que lo apruebe).
7.  Estado de la red y del servicio. Enlace a la página de redes de Aztec y a nuestro /status. El bloque actual de Aztec Alpha en directo, con su hora.
8.  Contratos:
    ◦ nombre, dirección o class id (de deployments/);
    ◦ versión de aztec-nr y de Noir;
    ◦ enlace al código y a sus tests TXE;
    ◦ el número de tests, contado en el build;
    ◦ fecha del despliegue y bloque.
9.  Auditoría: los dos lados.
    ◦ Ledger Chat: revisión interna de seguridad, con enlace al informe del repositorio, y sin auditoría externa.
    ◦ Aztec: enlace a su repositorio de informes de auditoría.
10.  Comisiones. Se pagan en Fee Juice y las paga quien envía. Ledger Chat no patrocina comisiones (/api/aztec/sponsor en 410). Cuánto costó la última medición, si está documentada, con su fecha.
11.  Ethereum.
    ◦ Aztec se asienta en Ethereum, con el chain id real.
    ◦ El portal de Ledger Chat está escrito y probado, no desplegado, y se activará tras una revisión externa.
12.  Seguridad y reporte de fallos.
    ◦ Nuestro canal: SECURITY.md del repositorio o un /security con contacto y tiempos de respuesta. Si no existe, créalo con el texto que apruebe Stefan; no inventes plazos.
    ◦ Para fallos del protocolo de Aztec, su vía oficial: GitHub Private Vulnerability Reporting de aztec-packages y su SECURITY.md.
13.  Camino hacia Beta. Aztec define Beta por métricas sostenidas, no por una fecha: latencia, rendimiento y disponibilidad, según su documentación. Explícalo en una línea y cómo encaja nuestra hoja de ruta, sin fechas inventadas.
14.  Primer pago y cifras en directo, ya presentes en sus escenas, con enlace desde aquí.
15.  Legal y contacto: términos, privacidad, directrices de comunidad, prensa (con nuestro kit de marca descargable: logo, colores, capturas reales) y contacto.
Tono de esta parte
• Frases cortas y exactas, del tipo "Alpha is early software. Critical bugs are expected. We cap every payment at 100 HLC." La transparencia es la mayor muestra de madurez que se le puede dar a un equipo de protocolo.
• Nada de "100 % private", "unhackable", "bank-grade" ni "military-grade".
• Cuando citas a Aztec, enlazas. Si una cifra de Aztec cambia, el test de contenido falla y obliga a revisar: guarda la fecha de comprobación de cada fuente en content.ts.
Fuera del código: para Stefan, no para el agente
• Pedir el alta de Ledger Chat en el directorio oficial de ecosistema de Aztec (aztec.network/ecosystem tiene un formulario para proyectos que faltan). Es el camino real para que Aztec Labs lo tenga en su lista.
• Aprobar los textos de riesgo, migración y seguridad antes de publicarlos.
• Consultar con el abogado (OD-8) el contador de visitantes y el nombre.
Definición de terminado
[ ] Parte A: la prueba de fotogramas pasa en Chromium y WebKit, con regresión visual al píxel, CLS 0,00, Lighthouse dentro de umbrales, trazas en 240 Hz (o la máxima disponible) y en un iPhone ProMotion, y medición con usuarios reales activa.
[ ] Ningún texto borroso en reposo, ninguna línea de 1 px desalineada, ningún salto de color entre póster y vídeo.
[ ] Parte B: la escena "On Aztec Alpha" y la página /alpha con los 15 puntos, cada uno con su fuente y su fecha de comprobación.
[ ] Los datos que dependen de la red (versión, chain id, bloque, topes) salen de la configuración o de la red, nunca escritos a mano.
[ ] La lista de tareas para Stefan está en la descripción de la PR.
[ ] Las cuatro comprobaciones obligatorias en verde.