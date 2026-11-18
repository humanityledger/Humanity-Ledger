Complementa los prompts 1 (Safari, logo y landing) y 2 (render y landing completa). Este va de que la app aguante y crezca. Cópialo desde "Rol". El agente lo ejecuta por fases, cada fase en su propia PR, y no empieza una fase sin que la anterior cumpla su puerta.
Rol
Eres el agente de ingeniería de Ledger Chat en humanityledger/Humanity-Ledger. Tienes que llevar Ledger Chat de "aguanta cientos de personas" a "aguanta un lanzamiento mundial y crece sola", sin romper ninguna promesa de privacidad.
El punto de partida está en la revisión de escalabilidad del 18/11/2026 (29 puntos), en el documento "Ledger Chat: escalabilidad, revisión externa" y en claude/escalabilidad-ledger-chat-2026-11-18.md del proyecto. Léelo entero antes de empezar.
La regla de oro
Un producto se vuelve viral cuando la primera experiencia funciona a la primera. Ninguna mecánica de crecimiento se activa mientras los mensajes no lleguen de forma fiable. Una campaña que lleve a miles de personas a una app donde no pueden hablar con su familia destruye la reputación que se quiere ganar. Por eso la fase 0 va primero y es una puerta.
Reglas que siguen en vigor
• Cero mock: ninguna cifra de usuarios inventada, ningún "trusted by".
• Los mensajes directos van E2E con MLS a través de XMTP, y el servidor nunca ve su contenido. Las comunidades las lee el servidor y se dice.
• Aztec Alpha: los pagos siguen en alpha cerrada, con invitación, como mucho 20 testers y 100 HLC por pago. El crecimiento abierto es para la mensajería, no para los pagos, hasta que Stefan firme la ola siguiente.
• Nada de analítica de terceros, píxeles de anuncios ni identificadores entre sitios. Las métricas son agregadas y propias.
• Ramas claude/, sin fusionar, sin desplegar, sin cambiar la infraestructura de Railway (eso lo hace Stefan con lo que tú prepares), y las cuatro comprobaciones obligatorias en verde.
Objetivos medibles (los SLO)
Medida
Objetivo
Mensajes directos entregados al otro dispositivo en menos de 5 s (p95)
≥ 99 %
Disponibilidad de la app y de la API
99,9 % mensual
/chat interactivo (p75 móvil 4G)
≤ 3 s
API de presencia, contactos, usernames (p95)
≤ 150 ms en Europa, ≤ 300 ms en América y Asia
Llamadas que conectan al primer intento
≥ 95 %
Primera conversación desde que alguien abre el enlace de un amigo
≤ 60 s
Cada objetivo tiene su métrica en un panel, su alerta y su línea en el runbook. Ninguno se da por cumplido sin datos.
Fase 0. Que los mensajes lleguen siempre (puerta)
1.  Leer los avisos [delivery] de Railway (PR #155): agrupar por tipo, navegador y error. Encontrar la causa real de los mensajes que no llegan y arreglarla. La PR explica la causa con los registros que la prueban.
2.  Prueba de entrega de extremo a extremo que corre cada hora en la CI contra la red de producción de XMTP:
    ◦ dos cuentas de prueba dedicadas, con claves en secretos de GitHub, nunca de Stefan;
    ◦ envía, recibe y mide el tiempo;
    ◦ se combina en Chromium y WebKit;
    ◦ si falla dos veces seguidas, alerta.
3.  El indicador de entrega del mensaje en la app es verdad: enviando, enviado (publicado en la red) y entregado (leído por el otro dispositivo, si hay recibos). Nunca un check que mienta.
4.  Puerta: 7 días seguidos con la prueba horaria en verde y ≥ 99 % de entregas en menos de 5 s en la telemetría.
Fase 1. Cimientos para crecer
1.  Dos réplicas o más, sin estado en memoria.
    ◦ Revisa todo lo que vive en la memoria del proceso: límites de peticiones, colas, cachés, sesiones, sockets.
    ◦ Pásalo a Redis o a Postgres.
    ◦ Un test arranca dos instancias en la CI y comprueba que un límite de peticiones se respeta entre las dos.
    ◦ Deja preparado railway.toml con numReplicas y la región, para que Stefan lo active.
2.  Migraciones fuera del arranque. Un paso de Railway propio (o un job) que migra antes de arrancar las réplicas. start.sh no migra. Si la migración falla, el despliegue se detiene y las réplicas viejas siguen sirviendo.
3.  CDN delante.
    ◦ Cabeceras de caché correctas en todo lo estático (immutable), en la landing estática y en /u/*.
    ◦ Vary y no-store en lo privado.
    ◦ Una guía paso a paso para que Stefan ponga Cloudflare (u otra CDN) delante de Railway, sin romper WebSocket, cookies ni CSP.
4.  Base de datos.
    ◦ Revisa los índices de las 20 consultas más frecuentes (con pg_stat_statements si está disponible; si no, desde el código).
    ◦ Añade los que falten con migraciones sin bloqueo (CREATE INDEX CONCURRENTLY en una migración aparte).
    ◦ Prepara la ruta de lectura para una réplica: DATABASE_READ_URL opcional y las lecturas pesadas (búsqueda, perfiles, estadísticas) yendo a ella.
5.  Observabilidad.
    ◦ OpenTelemetry en el servidor: trazas de las rutas y métricas de latencia, errores y saturación.
    ◦ Logs estructurados en JSON con un id de petición.
    ◦ Un panel con los SLO.
    ◦ Alertas (correo o webhook que Stefan configure) para disponibilidad, errores 5xx, latencia p95 y la prueba de entrega.
    ◦ Nada de contenido de mensajes ni direcciones completas en logs.
6.  Prueba de carga con k6, en el repositorio y en un job manual de la CI:
    ◦ escenarios de inicio de sesión, presencia, contactos, usernames, búsqueda exacta, /api/stats/live, la landing y /u/*;
    ◦ con perfiles de 1.000, 10.000 y 50.000 usuarios virtuales;
    ◦ el informe dice dónde se rompe y por qué.
    Nunca contra producción sin permiso escrito de Stefan; por defecto, contra un entorno de pruebas de Railway.
7.  Puerta: carga sostenida de 10× el pico esperado de lanzamiento sin incumplir los SLO de la API, en el entorno de pruebas.
Fase 2. Tiempo real propio y menos sondeo
1.  Un canal en tiempo real:
    ◦ WebSocket con fallback a SSE, con autenticación por la sesión;
    ◦ escalado horizontal con Redis pub/sub (o Redis Streams);
    ◦ latido de 25 s y reconexión con backoff exponencial y jitter.
2.  Lo que pasa a ese canal:
    ◦ la presencia (sin POST cada 10 s);
    ◦ "escribiendo" (deja de ser un mensaje de XMTP, se vuelve efímero y no se guarda);
    ◦ peticiones de amistad;
    ◦ avisos de comunidades;
    ◦ avisos de estado del servicio.
    El contenido de los mensajes directos sigue yendo solo por XMTP.
3.  Recibos de lectura agrupados: uno por conversación con el último mensaje leído, no uno por mensaje. Compatible con los recibos antiguos.
4.  Sincronización con XMTP inteligente.
    ◦ El sondeo de respaldo solo corre cuando el stream lleva un rato callado o se acaba de reconectar.
    ◦ Con la pestaña oculta, se suspende, y al volver se sincroniza una vez.
    ◦ Comprueba en la documentación de XMTP sus límites de peticiones por cliente y de instalaciones por buzón, y déjalos escritos en docs/ con su fuente.
5.  La pantalla de chat por partes.
    ◦ Estado en un store (por ejemplo Zustand).
    ◦ Mensajes en un Map por conversación.
    ◦ Lista virtualizada para conversaciones largas.
    ◦ Componentes memoizados.
    ◦ LedgerChatV2.tsx se divide en módulos con responsabilidad clara, sin cambiar el comportamiento, con tests de que el envío, la recepción y las llamadas siguen igual.
6.  Puerta: en la prueba de carga, la presencia y "escribiendo" de 10.000 conexiones simultáneas a través del canal, con las peticiones HTTP por usuario y minuto bajando al menos un 80 % frente a hoy.
Fase 3. Global
1.  Segunda región (América) cuando Stefan la active: las réplicas leen de la réplica de Postgres más cercana y escriben en la principal. El canal en tiempo real funciona entre regiones con Redis.
2.  Llamadas.
    ◦ peerjs-server con dos instancias o la señalización en el canal propio.
    ◦ TURN de Cloudflare con credenciales de corta vida.
    ◦ Métrica de llamadas que conectan.
3.  Idiomas.
    ◦ Internacionalización de la app y la landing (por ejemplo next-intl), con inglés primero.
    ◦ Español, portugués, francés, alemán, turco, árabe (derecha a izquierda), hindi, indonesio, japonés, coreano y chino simplificado cuando Stefan apruebe las traducciones.
    ◦ Ningún texto en imágenes.
4.  Modo degradado.
    ◦ Interruptores para apagar funciones pesadas sin desplegar (presencia, globo, GIF, comunidades) si la carga sube.
    ◦ Una sala de espera para el registro si la base de datos se satura, con un mensaje honesto.
Crecimiento viral, sin trucos y sin traicionar la privacidad
Se construye en paralelo a las fases, pero se activa solo cuando la fase 0 esté cumplida y la fase 1 tenga su puerta.
1.  El bucle principal: invitar a alguien es hablar con él.
    ◦ Tu enlace (ledgerchat.org/u#…) y tu QR abren directamente una conversación contigo.
    ◦ Si quien lo abre no tiene cuenta:
        ▪ ve quién le invita (nombre y @username, nunca la dirección);
        ▪ crea la cuenta en el mismo flujo;
        ▪ aterriza en el chat con esa persona.
    ◦ Objetivo: ≤ 60 s desde el enlace hasta el primer mensaje.
2.  Compartir en un toque.
    ◦ Web Share API en móvil y copiar enlace en escritorio, desde el perfil, el QR y un chat vacío ("Invite someone to talk").
    ◦ Texto prellenado en el idioma de quien comparte.
3.  Tarjetas al compartir. Imagen Open Graph generada con next/og para los enlaces de perfil: nombre, @username y QR con marca. Nunca la dirección de la wallet ni nada que permita rastrear. Para la landing y para cada escena, su propia imagen.
4.  Enlaces de invitación a grupos con caducidad y límite de usos, revocables, y con la misma tarjeta al compartir.
5.  Instalar la app. PWA instalable (manifest, iconos, pantalla de inicio, display: standalone), con la invitación a instalar después del primer mensaje enviado, no antes. Notificaciones push solo cuando la persona las pide.
6.  Primera experiencia.
    ◦ Sin pantallas de bienvenida largas: entrar, elegir @username (con sugerencias si está ocupado) y hablar.
    ◦ Estados vacíos que invitan a escribir a alguien, con el QR y el enlace a mano.
7.  Momentos que la gente quiere enseñar. El QR con marca, el primer pago privado y los stickers son bonitos por sí mismos: que se puedan guardar y compartir como imagen limpia, con la marca de Ledger Chat discreta.
8.  Referidos honestos. Si algún día hay recompensas, solo cuando Stefan las decida y el abogado las revise (MiCA). Hasta entonces, el bucle es social, no económico. Nada de prometer tokens.
9.  Métricas de crecimiento, propias y agregadas:
    ◦ activación (cuenta con primer mensaje enviado);
    ◦ retención del día 1, 7 y 30 por cohorte semanal;
    ◦ invitaciones enviadas y abiertas;
    ◦ tiempo hasta el primer mensaje;
    ◦ factor K (invitaciones aceptadas por usuario activo).
    Todo calculado en el servidor a partir de eventos sin contenido, con un panel interno y sin datos personales.
Confianza y seguridad a escala
El crecimiento viral atrae abuso. Tiene que estar listo antes:
• Freno al spam.
    ◦ Límites por cuenta para conversaciones nuevas al día, más estrictos para cuentas nuevas.
    ◦ Peticiones de mensaje separadas de los contactos.
    ◦ Bloquear y denunciar en dos toques.
    ◦ Un usuario bloqueado no ve tu presencia.
• Usernames:
    ◦ lista de nombres reservados ampliada (marcas, cargos, nombres de la propia app);
    ◦ protección contra suplantación por caracteres parecidos (ya existe para ASCII);
    ◦ proceso de reclamación de nombres de marca, escrito.
• Comunidades:
    ◦ moderación (reportar, ocultar, expulsar, límites de publicación), un panel de moderación mínimo y una cola de denuncias;
    ◦ como el servidor las lee, la obligación de responder a denuncias de contenido ilegal es real. Prepara el flujo y la plantilla, y que el abogado (OD-8) confirme lo que pide la DSA en la UE.
• Sybil y bots: alpha de pagos con invitación (ya existe). Para la mensajería abierta, límites por cuenta y por IP en el registro, y un desafío ligero solo cuando haya señales de abuso, sin captchas de terceros que rastreen.
Plan de lanzamiento (lo prepara el agente, lo ejecuta Stefan)
1.  Lista de comprobación del día D:
    ◦ SLO en verde 7 días;
    ◦ prueba de carga a 10×;
    ◦ runbook con la persona de guardia;
    ◦ /status y la franja de avisos listas;
    ◦ interruptores probados;
    ◦ plan de vuelta atrás probado una vez.
2.  Kit de prensa: descripción en 50, 100 y 300 palabras; capturas reales en blanco; logo; el vídeo de la landing; datos con fuente (los del globo en directo); contacto.
3.  Textos de anuncio para X, Farcaster, el foro y el Discord de Aztec, y Product Hunt, en el tono de la landing: frases cortas, verificables, sin superlativos. Cada cifra con su enlace.
4.  Alta en el directorio de ecosistema de Aztec con la ficha completa, si Stefan no la ha pedido ya.
5.  Lanzamiento por olas: primero a las comunidades de Aztec y de privacidad, luego mensajería y web3 en general. Entre ola y ola, 48 h mirando los SLO.
Lo que hace Stefan (fuera del código)
• Activar réplicas, segunda región y réplica de Postgres en Railway, y poner la CDN. El agente le deja la guía y el coste estimado por mes de cada paso, con su fuente.
• Crear las dos cuentas de prueba de entrega y guardar sus claves como secretos de GitHub.
• Aprobar traducciones, textos de moderación y el plan de lanzamiento.
• Consultar con el abogado: DSA para comunidades, contador de visitantes, recompensas y el nombre.
Definición de terminado
[ ] Fase 0: causa de los mensajes perdidos encontrada y arreglada; prueba de entrega horaria en verde 7 días; ≥ 99 % de entregas en menos de 5 s.
[ ] Fase 1: sin estado en memoria; migraciones fuera del arranque; caché y guía de CDN; índices; OpenTelemetry, panel y alertas de los SLO; k6 a 10× en pruebas.
[ ] Fase 2: canal en tiempo real con Redis; "escribiendo" efímero; recibos agrupados; sincronización inteligente; chat por partes con lista virtualizada; − 80 % de peticiones por usuario.
[ ] Fase 3: preparada la segunda región; señalización de llamadas redundante; i18n; interruptores y sala de espera.
[ ] Crecimiento: enlace o QR hasta el primer mensaje en ≤ 60 s; compartir en un toque; tarjetas OG sin direcciones; invitaciones a grupos; PWA; métricas agregadas.
[ ] Confianza y seguridad: límites, bloqueo y denuncia, moderación de comunidades y nombres reservados, listos antes de abrir.
[ ] Plan de lanzamiento, kit de prensa y tareas de Stefan escritos. Cada PR con sus cuatro comprobaciones en verde.