# Nota jurídica preliminar (19/11/2026)

Estado: borrador, no vigente hasta la firma del abogado (OD-8) · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: este archivo, exportado del documento de trabajo

> Texto preparado con Claude para que el abogado lo revise, lo corrija y lo firme. No es asesoramiento jurídico. Las marcas [verificar] siguen abiertas. Las tablas del original están aplanadas: una celda por línea.

Naturaleza de este documento
Es un borrador de nota jurídica, preparado por Claude a petición de Stefan Antonio Cirisanu para que el abogado lo revise, lo corrija y lo firme. No es asesoramiento jurídico ni sustituye al abogado. Ninguna conclusión vale hasta que un abogado colegiado la haga suya por escrito y bajo su responsabilidad profesional y su seguro.
• Base de hechos: el dossier del 19/11/2026 y el repositorio en esa fecha (deployments/aztec-mainnet.json, docs/alpha/OPERATOR_DECISIONS.md, docs/legal/).
• Base normativa: las fuentes enlazadas al final, consultadas el 19/11/2026. Lo que no se ha podido contrastar en una fuente abierta aparece marcado como [verificar].
• Escala de riesgo: Bajo (se puede seguir), Medio (seguir con la medida indicada), Alto (no seguir sin resolverlo).
• Anexos I a IV: son borradores de textos legales. No se publican en la web ni en la app hasta que el abogado los firme (decisión OD-8).
Resumen ejecutivo
El primer código de invitación se puede enviar, pero con tres medidas previas. La más importante: si HLC es un criptoactivo y su reparto cuenta como oferta al público, MiCA exige que quien lo ofrece sea persona jurídica. La exención de menos de 150 personas dispensa del white paper, pero no de ese requisito. La exención por gratuidad se pierde si el tester da datos personales a cambio del token. Por eso, o lo reparte la S.L., o el abogado firma que el reparto no es una oferta al público.
Las otras dos medidas son baratas. Hay que retirar del repositorio el modelo de lanzamiento de HLC y redesplegar el contrato sin el nombre «Humanity Ledger Corp.».
Los pagos reales en cUSDC no se activan hasta tener por escrito cómo califica human.tech su token bajo MiCA.
#
Pregunta
Respuesta corta
Riesgo
1
¿HLC es criptoactivo?
Probablemente sí: la definición no exige valor de mercado. Conviene tratarlo como tal
Medio
2
¿Exento de white paper al repartirlo gratis a 50?
Gratuidad: no, si se piden datos a cambio. Menos de 150: sí, pero sigue exigiendo persona jurídica
Alto hasta decidir quién reparte
3
Modelo de lanzamiento publicado
Retirarlo hoy: anuncia venta, recompra y quema, y podría leerse como comunicación de una oferta futura
Medio
4
Contrato «Humanity Ledger Corp.»
Redesplegar con un nombre neutro antes de la alpha
Medio
5
¿Software no custodial fuera de CASP?
Sí, mientras el usuario firme y nunca tengamos claves, fondos ni órdenes
Bajo
6
Servir la app, enlazar Shield, Bridged FPC, facturas
Ninguna nos hace CASP con el diseño actual. Vigilar no transmitir órdenes por cuenta del usuario
Bajo
7
¿Qué es cUSDC?
Calificación abierta: podría ser un token de dinero electrónico de human.tech. Pedirles su posición por escrito
Alto para la fase cUSDC
8
Autorización CNMV
No hace falta hoy. El transitorio español terminó el 1/7/2026
Bajo hoy
9
AMLR, art. 79
Obliga a entidades de crédito, financieras y CASP desde el 10/7/2027, no a software no custodial
Medio (riesgo de mercado)
10
Ley 10/2010
Hoy no somos sujeto obligado: no hay custodia ni servicios por cuenta de clientes
Bajo
11
Regalar Fee Juice
IRPF de Stefan e ISD de los testers. Cantidades pequeñas, pero hay que documentarlas
Bajo
12
RGPD y LOPDGDD
Faltan cosas concretas: consentimiento para el contador de visitas, encargo a Railway y una evaluación de impacto real
Medio
13
S.L.
Capital de 3.000 € mejor que 1 €. Objeto social de software, sin servicios financieros
Bajo
14
Cesión a la S.L.
Por escrito: código, marcas, dominios, clave de HLC y NLnet. Antes, búsqueda de anterioridades de «Ledger»
Alto (marca)
15
¿Alpha como persona física?
Posible solo si el reparto de HLC no es oferta al público. Si no, con la S.L.
Medio
16
Condiciones de testers
Borrador en el Anexo I. Si el tester es consumidor, no se renuncia a su protección
Medio
17
Nombrar a terceros
Uso descriptivo correcto. Logotipos solo según sus normas de marca
Bajo
Fuera de las 17 preguntas hay cuatro asuntos que conviene llevar a la reunión (sección «Riesgos que el dossier no preguntó»):
• un posible conflicto con la marca LEDGER de Ledger SAS;
• las sanciones de la UE a Rusia sobre servicios de wallet;
• el Reglamento de Servicios Digitales, por las publicaciones de comunidades;
• varios documentos de docs/legal/ que hoy dicen cosas que no son ciertas.
A. HLC y MiCA (bloquea la alpha)
1. ¿HLC es un criptoactivo?
Probablemente sí. MiCA define el criptoactivo como una representación digital de un valor o de un derecho que puede transferirse y almacenarse con tecnología de registro distribuido (art. 3.1.5, Springlex). La definición no exige valor de mercado. HLC es fungible y transferible, así que no le alcanza la exclusión de los activos únicos y no fungibles (art. 2.3, DLA Piper).
Se puede defender que un token sin precio, sin mercado y sin derecho alguno no representa «un valor». Pero no hay criterio de la ESMA ni de la CNMV que lo respalde, y la propia ESMA reconoce que la clasificación es uno de los problemas abiertos de MiCA (respuesta ESMA a la revisión de MiCA, 09/2026).
Criterio propuesto: tratar HLC como criptoactivo y cumplir lo que eso exige. Es lo más barato y lo más seguro.
También hay que descartar que HLC sea un instrumento financiero. Nada en él da derecho a beneficios, recompra ni participación. Por eso pesa tanto retirar el modelo de «recompra y quema» (pregunta 3).
2. Repartirlo gratis a 50 testers: ¿exento?
MiCA trae dos vías de exención con efectos distintos, y la diferencia decide quién puede repartir HLC.
Vía
Qué dispensa
¿Nos sirve?
Oferta gratuita, art. 4.3.a
Todo el Título II, incluido el requisito de persona jurídica
Solo si el tester no da datos personales a cambio del token. El art. 4.3 dice que no es gratuita si se exigen datos personales al oferente (Springlex). Nuestros testers van con nombre
Menos de 150 personas por Estado, art. 4.2.a
Solo las letras b), c), d) y f) del art. 4.1: white paper, notificación, publicación y requisitos del art. 14 (texto del art. 4)
Exime del white paper, pero mantiene la letra a): quien ofrece debe ser persona jurídica
Consecuencia: si el reparto es una «oferta al público», Stefan como persona física no puede hacerlo apoyándose en la exención de 150. Hay tres salidas, por orden de solidez:
1.  Lo reparte la S.L. (persona jurídica), con menos de 150 testers por Estado. No hay white paper. Es la salida limpia.
2.  Separar los datos del token. El nombre se pide para participar en la prueba (contrato de tester), no a cambio de HLC. HLC se entrega igual a cualquier dirección admitida, sin pedir nada más. Así se defiende la vía gratuita del 4.3.a. Es defendible, pero la letra del 4.3 es amplia («provide, or undertake to provide, personal data»). Necesita la firma del abogado.
3.  Sostener que no hay «oferta al público». La definición exige una comunicación con información suficiente para que el destinatario decida si adquiere. Aquí no hay nada que adquirir: el token es un instrumento de prueba entregado a 50 personas elegidas. Es el argumento más fuerte en el fondo y el que menos jurisprudencia tiene.
Recomendación: salida 1 si la S.L. puede estar en unas semanas; si no, salida 2 con el argumento 3 como refuerzo, por escrito del abogado.
En cualquier caso:
• ninguna comunicación puede anunciar intención de admitir HLC a negociación en una plataforma de un CASP de la UE, porque eso anula ambas exenciones (art. 4.4; ESMA, Q&A);
• HLC no se puede pedir, comprar ni intercambiar, y así debe decirlo cada texto.
3. El modelo de lanzamiento antiguo
Retirarlo hoy de la rama principal y de la web, y sustituirlo por una frase: «HLC es un token de prueba sin valor; no se venderá, no se repartirá por airdrop y no se lanzará».
Marcarlo como «suspendido» no basta por tres razones:
• describe una venta a precio único y un airdrop: es decir, una oferta futura cuya comunicación queda sujeta al art. 7;
• describe recompra y quema, que se leen como sostén del precio y empujan hacia la calificación de instrumento financiero;
• convive con la entrega real del token a testers, y juntos cuentan una historia de «primero gratis, luego venta».
El historial de git seguirá mostrando el texto. Basta con dejar en el commit que lo retira el motivo y la fecha de la decisión PA-1.
4. El nombre «Humanity Ledger Corp.»
Redesplegar antes del primer código, con un nombre como «HLC Test Token», y retirar el contrato actual de toda referencia en la app.
• «Corp.» sugiere una sociedad que no existe. Frente a los testers puede ser una indicación engañosa sobre la identidad del empresario (Ley 3/1991 de Competencia Desleal, art. 5) [verificar].
• Si luego se constituye una sociedad con otro nombre, el contrato quedaría a nombre de una entidad inexistente.
• El coste de redesplegar en la alpha es bajo y elimina el problema.
Que la clave de administrador pueda emitir más HLC no es ilegal para un token de prueba. Pero hay que decirlo en las condiciones del tester (Anexo I, cláusula 4).
B. Pagos reales en cUSDC: ¿somos CASP?
5. Software de wallet no custodial
Con el diseño actual, Ledger Chat encaja en la exclusión. El considerando 83 de MiCA deja fuera a quien suministra hardware o software para wallets no custodiales (Dfns). El criterio decisivo es que el usuario conserve en exclusiva la capacidad de autorizar transacciones.
En Ledger Chat las claves de Aztec se derivan en el navegador a partir de una firma de la wallet, y cada pago lo prueba y firma el dispositivo del usuario. La autoridad danesa lo resume igual: las wallets no custodiales no están sujetas a MiCA por su naturaleza (Cointelegraph).
Para que la exclusión se mantenga, hay que respetar cinco líneas rojas (deberían figurar como compromisos en la documentación técnica):
1.  Ningún servidor de Ledger Chat recibe, guarda ni puede reconstruir una clave privada o de firma.
2.  Ningún servidor firma, prueba ni envía una transacción de pago en nombre del usuario.
3.  Ledger Chat no cobra comisión por los pagos (OD-7).
4.  No hay recuperación de fondos por parte de Ledger Chat. Si el usuario pierde su wallet, nadie puede recuperar nada.
5.  Ledger Chat no ejecuta ni cambia criptoactivos por cuenta del usuario.
6. Funciones concretas
Función
¿Servicio de criptoactivos?
Condición
(a) Servir la app web desde Railway
No. Es suministrar software
Que el código que se sirve sea el público y verificable
(b) Enlazar a Shield para entrar y salir
No, si es un enlace o una integración donde el usuario firma en su wallet
Sin comisión por remitir usuarios. Sin transmitir órdenes por cuenta del usuario, que es la «recepción y transmisión de órdenes» de MiCA
(c) Pagar comisiones con el Bridged FPC de Shield
No. La comisión la paga el usuario con sus fondos
Que Ledger Chat no adelante ni subvencione comisiones. /api/aztec/sponsor sigue en 410
(d) Mostrar facturas y solicitudes de pago
No. Es información entre usuarios
Que la factura no ejecute pagos sin firma del usuario
El riesgo real está en el futuro, no en hoy. Cualquier función que haga a Ledger Chat ejecutar, enrutar o garantizar un pago (pagos programados desde el servidor, un relayer, un fondo para comisiones) debe pasar antes por el abogado.
7. ¿Qué es cUSDC bajo MiCA?
Los hechos, según human.tech:
• cUSDC se acuña en Aztec cuando el usuario puentea USDC en modo privado por Shield, después de un control de identidad y sanciones (docs de Shield).
• Es un token estándar de Aztec cuyo único emisor es un proxy de human.tech con control de cumplimiento (Clean SDK).
• Shield cobra un 0,5 % (docs de Shield).
La calificación está abierta. Hay tres lecturas:
1.  Es un token de dinero electrónico de human.tech. Mantiene valor estable con referencia a una sola moneda oficial y se canjea 1:1. En ese caso solo podría emitirlo una entidad de crédito o de dinero electrónico autorizada (art. 48), y human.tech tendría que serlo.
2.  Es una representación técnica de USDC bloqueado, que ya es un token de dinero electrónico emitido en la UE por Circle Internet Financial Europe SAS y calificado como significativo por la EBA (EBA, 14/10/2026). Es la lectura más favorable, y no está resuelta.
3.  Es otro criptoactivo del Título II.
La EBA y la ESMA han señalado expresamente los tokens «envueltos» (wrapped) como un problema de clasificación pendiente en la revisión de MiCA (EBA, 09/2026).
Qué nos exige si no somos el emisor. Como software no custodial, no ofrecemos ni emitimos cUSDC. Pero Ledger Chat no debe hacer «oferta al público» de cUSDC. Frases como «compra cUSDC aquí» o «gana con cUSDC» no se usan; «admite pagos en cUSDC» sí se puede decir.
Antes de activarlo, pedir a human.tech por escrito tres cosas:
• su calificación de cUSDC bajo MiCA y qué entidad lo emite;
• si tienen autorización o exención en la UE;
• quién garantiza el canje 1:1 y ante quién.
Sin esa respuesta, la condición «nota legal» de lib/payments/assets.ts no se puede marcar como cumplida.
8. Si algún día fuéramos CASP
• El régimen transitorio español terminó el 1/7/2026. Desde entonces solo pueden operar en España los proveedores con autorización MiCA (CNMV, preguntas y respuestas; Cuatrecasas).
• Pedir la autorización a la CNMV exige:
    ◦ una persona jurídica;
    ◦ un capital mínimo según la clase de servicio: 50.000, 125.000 o 150.000 € (Anexo IV de MiCA) [verificar];
    ◦ gobierno corporativo, prevención del blanqueo, continuidad y ciberseguridad (DORA);
    ◦ meses de tramitación.
• Si un servicio sobre tokens de dinero electrónico es a la vez un servicio de pago, entra también en juego la normativa de pagos (EBA/Op/2025/08).
Conclusión de negocio: el modelo no custodial no es solo la opción más privada, también es la única viable para una S.L. recién creada. Cada decisión de producto debe protegerlo.
C. Prevención del blanqueo y fiscalidad
9. AMLR, art. 79
El artículo 79 del Reglamento (UE) 2024/1624 prohíbe a las entidades de crédito, las entidades financieras y los proveedores de servicios de criptoactivos mantener cuentas anónimas. Incluye las cuentas de criptoactivos que permiten anonimizar u ocultar transacciones y las que usan monedas que refuerzan el anonimato (Springlex, art. 79). Se aplica desde el 10/7/2027 (Didit).
• A Ledger Chat no le alcanza directamente si no es CASP. Las obligaciones de identificación recaen en los proveedores, no en cada transacción, y las transferencias entre wallets autoalojadas quedan fuera (TechFlow).
• El riesgo es de mercado: a partir de 2027, los exchanges de la UE pueden negarse a aceptar fondos que vengan de una red privada. El usuario de Ledger Chat podría tener dificultades para volver a euros.
• cUSDC ayuda. El control de identidad y de sanciones en el puente es justo lo que un CASP necesita para aceptar esos fondos. human.tech lo presenta como «defensibilidad regulatoria» (Shield, tokens).
• Acción: advertirlo en las condiciones de los pagos reales (no en la alpha) y no prometer nunca «anonimato». La palabra correcta es «privacidad».
10. Ley 10/2010
Hoy no somos sujeto obligado, ni en la alpha ni en la fase de pagos reales con el diseño no custodial.
El Real Decreto-ley 25/2026, de 29 de septiembre, dio nueva redacción al art. 2.1.z) para incluir a los proveedores de servicios de criptoactivos como sujetos obligados. Está en vigor desde el 30/9/2026, y en octubre estaba pendiente de convalidación (Gómez-Acebo & Pombo). [verificar la convalidación y el texto en el BOE]
La redacción anterior cubría el cambio de moneda virtual por fiduciaria y la custodia de claves privadas por cuenta de clientes (RSM). Ledger Chat no hace ninguna de las dos cosas.
Aun sin obligación legal, conviene adoptar tres prácticas voluntarias:
• condiciones que prohíban el uso ilícito;
• un procedimiento para responder a requerimientos de autoridades (docs/legal/law-enforcement.md, que hay que actualizar);
• comprobar a los testers contra las listas de sanciones de la UE antes de invitarlos. Con 50 personas con nombre cuesta poco y reduce mucho el riesgo.
11. Fee Juice regalado a los testers
MiCA: entregar unidades propias de AZTEC a 50 personas, por cuenta propia y gratis, no es un servicio de criptoactivos. Tampoco es una oferta al público de un token emitido por Stefan, porque el emisor es Aztec. Riesgo bajo.
Blanqueo: irrelevante por el importe y porque los testers están identificados.
Fiscalidad (Stefan como persona física) [verificar con asesor fiscal]:
• Para Stefan, la donación es una transmisión lucrativa. Genera ganancia o pérdida patrimonial en el IRPF por la diferencia entre el valor de mercado del día y el coste de adquisición. Las pérdidas por transmisiones lucrativas no computan.
• Para cada tester residente en España, es una donación sujeta al Impuesto sobre Sucesiones y Donaciones de su comunidad autónoma. Hay que declararla aunque la cuota sea mínima o esté bonificada.
• Si el Fee Juice se entrega a cambio de cumplir «misiones», deja de ser donación y puede ser renta del tester. Conviene redactarlo como medio técnico para probar, no como premio.
• Si lo entrega la S.L., es un gasto de la actividad (pruebas de producto), deducible con soporte documental. Fiscalmente es más limpio.
Recomendación: que el Fee Juice lo entregue la S.L. si ya existe. Si no, que Stefan anote fecha, importe, valor de mercado y destinatario de cada entrega. La cifra de OD-9 sigue pendiente de Stefan.
D. Datos personales, LSSI, cookies y telecomunicaciones
12. RGPD y LOPDGDD
Responsable del tratamiento: hasta que exista la S.L., es Stefan Antonio Cirisanu como persona física. «Humanity Ledger» no puede figurar como responsable porque no es una entidad. Hay que corregirlo en docs/legal/privacy-policy.md, ropa.md y dpia.md.
Las direcciones de wallet son datos personales cuando pueden vincularse a una persona, y en Ledger Chat se vinculan: a un nombre de usuario, a un tester con nombre o a una conversación. El CEPD adoptó la versión definitiva de sus Directrices 02/2025 sobre blockchain el 7/7/2026 (CEPD, v2.0). Recomiendan no guardar datos personales en la cadena y hacer una evaluación de impacto antes de tratarlos con blockchain (Mondaq).
Dato
Finalidad
Base jurídica
Plazo propuesto
Dirección de wallet y sesión (SIWE)
Dar acceso a la cuenta
Contrato, art. 6.1.b
Mientras la cuenta exista
Nombre de usuario
Que otros te encuentren
Contrato
Mientras la cuenta exista; liberado al borrar
Nombre y contacto del tester
Gestionar la alpha
Contrato de tester
8 semanas + 6 meses
Publicaciones de comunidades (en Railway)
Prestar la función de comunidades
Contrato
Hasta que el autor o la comunidad las borre
Informes de entrega con identificadores recortados
Diagnosticar fallos de entrega
Interés legítimo, art. 6.1.f, con ponderación escrita
30 días
Registros de seguridad
Proteger el servicio
Interés legítimo
90 días
Contador de visitas (identificador en localStorage)
Estadística
Consentimiento (LSSI, art. 22.2)
12 meses
Mensajes directos
Ledger Chat no los ve: cifrados con MLS
No hay tratamiento del contenido. Sí de metadatos en la red XMTP
Según XMTP
Cinco correcciones concretas:
1.  Contador de visitas. lib/stats/useVisitBeacon.ts guarda un identificador aleatorio persistente en localStorage para contar visitantes. Guardar información en el dispositivo con fines analíticos necesita consentimiento previo (LSSI, art. 22.2; la guía de la AEPD trata igual localStorage que las cookies) [verificar]. Hay dos salidas:
    ◦ pedir consentimiento antes de guardar nada;
    ◦ o contar sin guardar identificador (una visita = una petición, sin persistencia). Es la mejor salida.
    Además, docs/legal/cookies.md dice hoy «cero analíticas», y eso no es exacto.
2.  Railway aloja datos y es encargado del tratamiento. Hacen falta su acuerdo de encargo (art. 28) y la base de la transferencia a EE. UU.: el Marco de Privacidad de Datos UE-EE. UU. si Railway está certificado, o cláusulas contractuales tipo [verificar]. Conviene alojar en una región de la UE si Railway la ofrece.
3.  XMTP. Ledger Chat entrega mensajes cifrados a una red de nodos de terceros. El contenido está cifrado de extremo a extremo, pero los nodos ven metadatos (direcciones, momentos). Hay que analizar si los operadores de nodos son encargados, corresponsables o terceros independientes, y explicarlo en la política.
4.  Evaluación de impacto (art. 35). Hay que hacerla: tecnología nueva, blockchain, pagos y comunicaciones. El docs/legal/dpia.md actual atribuye la evaluación a un «DPO / Consultoría Criptográfica Externa» que no existe. Hay que rehacerla con el autor real y la fecha real.
5.  Delegado de protección de datos. No es obligatorio para este tamaño y actividad [verificar]. Los documentos no deben decir que existe uno. Basta un contacto de privacidad.
Registro de actividades (art. 30): la exención de menos de 250 empleados no se aplica si el tratamiento no es ocasional, y aquí no lo es. Hay que mantener ropa.md al día.
Derecho de supresión: lo que está en Aztec o en Ethereum no se puede borrar. Las condiciones y la política deben decirlo antes de que el usuario actúe, y el diseño debe evitar escribir en la cadena datos que identifiquen (nombres de usuario, textos).
Información obligatoria del prestador (LSSI, art. 10)
Aunque sea gratis, un sitio que presta un servicio de la sociedad de la información debe mostrar:
• nombre o razón social;
• NIF;
• domicilio;
• correo de contacto;
• datos registrales, cuando exista la S.L.
Si Stefan no quiere publicar su domicilio personal mientras es persona física, la solución práctica es constituir la S.L. con un domicilio profesional. Borrador en el Anexo III.
Telecomunicaciones
La mensajería de Ledger Chat es, en términos legales, un servicio de comunicaciones interpersonales independiente de la numeración. Estos servicios no necesitan notificarse como operador en el régimen de autorización general (Código Europeo de Comunicaciones Electrónicas, art. 12.2; Ley 11/2022) [verificar]. Sí les alcanzan las reglas de confidencialidad de las comunicaciones y de seguridad. El cifrado de extremo a extremo ya las cumple en lo esencial.
E. La S.L., la cesión de activos y las marcas
13. Capital, objeto social y CNAE
Capital: 3.000 € mejor que 1 €. Desde la Ley 18/2022 se puede constituir con 1 €. Pero mientras el capital no llegue a 3.000 € rigen dos reglas (Garrigues):
• hay que destinar al menos el 20 % del beneficio a reserva legal;
• si la sociedad se liquida sin patrimonio suficiente, los socios responden solidariamente hasta 3.000 € (Legalitas).
Con 3.000 € desaparece esa responsabilidad y la sociedad transmite más solidez a NLnet, a human.tech y a los bancos.
Objeto social propuesto (para que el abogado lo ajuste):
El desarrollo, la edición, la explotación y la comercialización de programas informáticos y aplicaciones, incluidas aplicaciones de mensajería y de software de cartera (wallet) no custodial; la prestación de servicios de alojamiento, mantenimiento, soporte y consultoría tecnológica; y la investigación y el desarrollo en criptografía y tecnologías de registro distribuido. Quedan excluidas las actividades sujetas a autorización administrativa específica, en particular la prestación de servicios de criptoactivos, de pago o de inversión, salvo que se obtenga la autorización correspondiente.
CNAE: programación informática como principal y edición de otros programas informáticos como secundaria [verificar los códigos de la CNAE-2025 vigentes].
Órgano de administración: administrador único (Stefan). Si hay socios previstos (NLnet no lo es; es una ayuda), conviene pactar desde el inicio un pacto de socios con cláusulas de permanencia y propiedad intelectual.
14. Cómo pasar los activos a la S.L.
El esquema de cesión está en el Anexo IV. Lo esencial:
Activo
Cómo se transmite
Ojo
Código (derechos de autor de Stefan)
Cesión escrita de los derechos de explotación, en exclusiva, mundial y por toda su duración. Puede ser aportación no dineraria al capital o compraventa
La cesión debe constar por escrito (Ley de Propiedad Intelectual) [verificar artículo]. La licencia MIT/Apache del código publicado no cambia: la S.L. adquiere la titularidad y sigue publicándolo con esa licencia. Revisar si hay contribuciones de terceros y de agentes de IA en el repositorio
Marcas «Ledger Chat» y «Humanity Ledger»
Solicitarlas directamente a nombre de la S.L.
Antes, búsqueda de anterioridades (ver abajo)
Dominios
Cambio de titular en el registrador
Que el titular sea la S.L., no un correo personal
Clave de administrador de HLC
Rotar el rol a una dirección de la S.L., idealmente multifirma
Dejar acta con fecha y hash de la transacción de rotación
Ayuda NLnet (propuesta 2027-01-04e)
Pedir a NLnet por escrito el cambio de beneficiario
Ellos deciden. No dar por hecho que el cambio es automático
Cuentas (GitHub, Railway, X)
Pasarlas a cuentas de la organización a nombre de la S.L.
Las credenciales nunca en documentos
Riesgo de marca, que conviene tratar como alto. Ledger SAS (París) tiene registrada la marca LEDGER para carteras de criptoactivos y software de claves privadas (Justia; Markinton). Defiende activamente marcas que incorporan «Ledger»: lo intentó con un dominio por procedimiento UDRP (caso D2025-0296).
«Ledger Chat», aplicado a una wallet de criptoactivos, comparte el elemento distintivo en la misma clase de productos. Antes de gastar en la marca, el dominio definitivo o la imagen, hace falta una búsqueda de anterioridades en la EUIPO y la OEPM, encargada a un agente de marcas. Si el riesgo se confirma, es más barato cambiar ahora que después de la alpha.
«Humanity Ledger» tiene el mismo problema en menor grado. Además, en el sector existe «Humanity Protocol» [verificar].
15. ¿La alpha espera a la S.L.?
No es obligatorio esperar, pero sí recomendable. Hay tres razones:
1.  MiCA: si el reparto de HLC es oferta al público, solo una persona jurídica puede hacerlo (pregunta 2).
2.  Responsabilidad: como persona física, Stefan responde con todo su patrimonio de cualquier reclamación de un tester. Con la S.L., en principio solo responde la sociedad.
3.  LSSI: con la S.L. el aviso legal muestra un domicilio social y no el personal.
Una S.L. se constituye en días por vía telemática (CIRCE / PAE) si los estatutos son tipo, y en pocas semanas con estatutos propios [verificar plazos actuales].
Recomendación: constituir ya y enviar el primer código desde la S.L. Si la alpha no puede esperar, que empiece Stefan como persona física con la salida 2 de la pregunta 2 firmada por el abogado, y que pase todo a la S.L. en cuanto se inscriba.
F. Textos de la alpha y cómo nombrar a terceros
16. Condiciones para los testers
El borrador completo está en el Anexo I. Estas son las decisiones jurídicas que lo sostienen:
• Qué contrato es. Un contrato de participación en una prueba de software, gratuito y con duración de 8 semanas. No es un contrato de servicio comercial ni de trabajo. El tester no recibe retribución. El Fee Juice es un medio técnico para probar, no un pago.
• Si el tester es consumidor. Lo será casi siempre: persona física que actúa fuera de su actividad profesional. Eso tiene cuatro consecuencias:
    ◦ Aplica la normativa de consumidores. La Directiva (UE) 2019/770 alcanza también al contenido digital «pagado» con datos personales [verificar transposición española en el TRLGDCU].
    ◦ Son nulas las cláusulas que excluyen la responsabilidad por dolo o culpa grave o que desequilibran el contrato. Por eso el borrador limita la responsabilidad en vez de excluirla.
    ◦ La ley elegida (la española) no puede privar al consumidor de la protección imperativa de su país de residencia (Reglamento Roma I, art. 6).
    ◦ El consumidor puede demandar en su domicilio (Reglamento Bruselas I bis, art. 18).
• Riesgos que hay que decir antes, no después. Se informa de forma separada y destacada, con aceptación expresa, de seis riesgos:
    ◦ red en alpha, que Aztec describe con errores críticos posibles;
    ◦ sin auditoría externa: solo una revisión interna del 18/11/2026;
    ◦ posible pérdida total del Fee Juice;
    ◦ HLC sin valor, con una clave de administrador que puede emitir más;
    ◦ irreversibilidad de lo que queda en la cadena;
    ◦ posible borrado de datos de prueba al terminar.
• Mayoría de edad. Solo personas de 18 años o más. Con 50 testers con nombre se puede comprobar.
• Confidencialidad. Opcional. Una alpha cerrada puede pedir no publicar fallos de seguridad antes de 30 días desde que se avisan (divulgación responsable). No puede impedir hablar del producto en general.
• Propiedad del feedback. El tester cede el uso de sus sugerencias sin contraprestación, sin perder la autoría.
17. Nombrar a terceros
Las fórmulas actuales son correctas: «construido sobre Aztec y Ethereum» y «admite cUSDC». El derecho de marcas de la UE permite usar una marca ajena para designar o mencionar productos como de su titular, siempre que se haga conforme a las prácticas leales (Reglamento (UE) 2017/1001, art. 14.1.c) [verificar]. Las reglas prácticas son estas:
• Usar el nombre en texto, del tamaño del resto del texto, nunca como sello o insignia.
• Nunca «partner», «oficial», «respaldado por», «certificado por» ni «aprobado por», ni nada que sugiera relación comercial, patrocinio o aval.
• Logotipos: solo si sus normas de marca lo permiten para este uso y con el archivo de su kit de prensa sin modificar. Hoy BRAND_FILES está en null en la landing, y así debe seguir hasta tener esas normas por escrito.
• Una línea de atribución al pie: «Aztec y Ethereum son marcas de sus respectivos titulares». Ya está en la landing (PR #167).
• Antes de enlazar a Shield o mencionar cUSDC en la web, confirmar con human.tech sus normas de uso de marca.
• En el repositorio hay un archivo public/aztec_x_ledger_partnership.svg. Su nombre sugiere una relación que no existe. Hay que retirarlo o renombrarlo y comprobar que no se usa en ningún sitio.
Riesgos que el dossier no preguntó
Riesgo
Por qué importa
Medida
Prioridad
Marca LEDGER de Ledger SAS
Mismo elemento distintivo y misma clase de productos (wallets). Su titular defiende la marca
Búsqueda de anterioridades antes de invertir en la marca. Plan B de nombre
Alta
Sanciones de la UE a Rusia y Bielorrusia
El Reglamento (UE) 833/2014, art. 5 ter, prohíbe prestar servicios de wallet, cuenta o custodia de criptoactivos a nacionales o residentes rusos [verificar el alcance para software no custodial]. Bielorrusia tiene una regla parecida
En la alpha, no invitar a residentes en esos países y comprobar a los testers en las listas de sanciones. Para la fase abierta, valorar con el abogado bloqueo geográfico y declaración del usuario
Alta antes de la fase abierta
Reglamento de Servicios Digitales (DSA)
Las publicaciones de comunidades se alojan en el servidor de Ledger Chat, así que es un servicio de alojamiento de datos
Punto de contacto único, condiciones con política de moderación, mecanismo de notificación de contenido ilícito y motivación de las retiradas. Las pequeñas empresas están exentas de parte de las obligaciones de plataforma [verificar]
Media
Documentos de docs/legal/ con afirmaciones inexactas
Nombran como responsable a «Humanity Ledger» (no existe), a un «DPO» y a una «consultoría externa» (no existen) y dicen «cero analíticas» (hay contador). Un documento legal inexacto es peor que ninguno
Corregir con los datos reales antes de enlazarlos desde la web
Alta
Banner «Real ETH» en el chat
Los pagos de la alpha son en HLC. Decir «ETH real» informa mal al tester sobre el riesgo
Cambiar el texto por algo como «Aztec Alpha · Token de prueba HLC sin valor · Comisiones en Fee Juice»
Alta
Archivo aztec_x_ledger_partnership.svg
Sugiere una relación con Aztec que no existe
Retirarlo
Media
Licencias de dependencias
El código es MIT o Apache-2.0. Una dependencia con licencia incompatible obligaría a cambiar
Escaneo de licencias en CI y lista de terceros
Baja
Control de exportación de cifrado
El software de cifrado es de doble uso, pero el de dominio público y el de mercado masivo suelen estar excluidos (Reglamento (UE) 2021/821) [verificar]
Mantener el código público y documentarlo
Baja
Accesibilidad
La Ley 11/2023 exige accesibilidad a ciertos servicios digitales. Las microempresas de servicios suelen estar exentas [verificar]
Seguir buenas prácticas (contraste, teclado, lectores de pantalla)
Baja
Seguro
La S.L. limita la responsabilidad, pero no cubre errores de software con dinero de terceros
Antes de pagos reales: seguro de responsabilidad civil profesional y ciberriesgos
Media antes de cUSDC
Plan de acción
Tres puertas, en orden. Ninguna se salta.
Puerta 1: antes del primer código de invitación
[ ] El abogado decide quién reparte HLC: la S.L., o Stefan con la salida 2 firmada (pregunta 2)
[ ] Retirar docs/TOKENOMICS.md de la rama principal y de la web (pregunta 3)
[ ] Redesplegar HLC con un nombre neutro y retirar el contrato «Humanity Ledger Corp.» de la app (pregunta 4)
[ ] Cambiar el banner «Real ETH» del chat
[ ] Contador de visitas sin identificador persistente, o con consentimiento previo
[ ] Corregir docs/legal/ (responsable real, sin DPO ni consultoría inexistentes, inventario de almacenamiento real)
[ ] Firmar los Anexos I (condiciones), II (privacidad) y III (aviso legal), y publicarlos
[ ] Comprobar a cada tester en las listas de sanciones de la UE y que es mayor de edad
[ ] Stefan fija la cifra de Fee Juice (OD-9) y lleva el registro de entregas
[ ] Retirar public/aztec_x_ledger_partnership.svg
Puerta 2: constituir la S.L.
[ ] Búsqueda de anterioridades de «Ledger Chat» y «Humanity Ledger» en la EUIPO y la OEPM
[ ] Escritura con 3.000 € de capital, objeto social de la sección E y administrador único
[ ] Cesión de activos (Anexo IV): código, marcas, dominios, cuentas y rotación de la clave de HLC
[ ] Pedir a NLnet el cambio de beneficiario
[ ] Acuerdo de encargo con Railway y base de la transferencia internacional
[ ] Evaluación de impacto real y registro de actividades al día
[ ] Aviso legal con los datos de la S.L.
Puerta 3: antes de activar cUSDC (además de las cinco condiciones de lib/payments/assets.ts)
[ ] Respuesta escrita de human.tech: calificación de cUSDC bajo MiCA, entidad emisora, autorización o exención y garante del canje
[ ] Nota del abogado que confirme que la integración no convierte a la S.L. en CASP ni en proveedor de pagos
[ ] Condiciones de uso de pagos reales: límites, riesgos, irreversibilidad, sanciones y riesgo de salida a euros (AMLR, 2027)
[ ] Política sobre usuarios de países sancionados
[ ] Seguro de responsabilidad civil y ciberriesgos
[ ] Firma de Stefan con el límite por pago

## Anexos

Los anexos I a IV están en `docs/legal/drafts/`.

Fuentes
Consultadas el 19/11/2026. Las secundarias (despachos, prensa) sirven de guía; el texto que vale es el del DOUE y el BOE.
MiCA y criptoactivos
• MiCA, art. 4, texto y exenciones (micawtf, copia de EUR-Lex)
• MiCA, art. 4, oferta gratuita y datos personales (Springlex)
• MiCA, art. 4 (ESMA, Interactive Single Rulebook)
• ESMA, Q&A sobre el art. 4.4 y la admisión a negociación
• ESMA, respuesta a la revisión de MiCA, 09/2026
• EBA, respuesta a la revisión de MiCA, 09/2026
• EBA clasifica USDC como token de dinero electrónico significativo, 14/10/2026
• EBA/Op/2025/08, tokens de dinero electrónico y servicios de pago (Morgan Lewis)
• Considerando 83 y wallets no custodiales (Dfns)
• Autoridad danesa sobre wallets no custodiales (Cointelegraph)
• MiCA, panorama general (DLA Piper)
• CNMV, preguntas y respuestas: fin del transitorio el 1/7/2026 (finReg360)
• Claves interpretativas de MiCA de la CNMV (Cuatrecasas)
Blanqueo
• AMLR, art. 79 (Springlex)
• AMLR para CASP desde el 10/7/2027 (Didit)
• Wallets autoalojadas fuera de la identificación obligatoria (TechFlow)
• RDL 25/2026 y art. 2.1.z de la Ley 10/2010 (Gómez-Acebo & Pombo)
• Redacción anterior del art. 2.1.z (RSM)
Datos personales
• CEPD, Directrices 02/2025 sobre blockchain, v2.0 (7/7/2026)
• Resumen de las directrices (Mondaq)
Sociedades y marcas
• Ley 18/2022: S.L. con 1 € (Garrigues)
• Responsabilidad hasta 3.000 € en la liquidación (Legalitas)
• Marcas de Ledger SAS (Justia)
• Marca LEDGER, registro 7666835 (Markinton)
• Ledger SAS, caso UDRP D2025-0296 (DomainGang)
Shield y cUSDC (human.tech)
• Shield: documentación
• Clean SDK: qué es cUSDC
• Shield: comisiones y tokens
Repositorio: deployments/aztec-mainnet.json, docs/alpha/OPERATOR_DECISIONS.md, docs/legal/, lib/stats/useVisitBeacon.ts, lib/payments/assets.ts, public/aztec_x_ledger_partnership.svg.
