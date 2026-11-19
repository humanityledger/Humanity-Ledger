# Prompt maestro: puertas de la alpha y protocolo

Estado: vigente como instrucción de trabajo · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: este archivo

Copia las partes 1 a 5 enteras y pégalas en una sesión nueva de Claude Code sobre humanityledger/Humanity-Ledger. El agente trabaja en paquetes, abre un PR por paquete y se detiene en cada paso que necesite tu firma.
Tu consentimiento queda convertido en una autorización con límites claros:
• Autorizas: cambiar código, contratos, configuración y documentación; desplegar en la red de pruebas de Aztec desde la CI; y preparar todo lo de Alpha.
• Sigues firmando tú:
    ◦ toda transacción en Aztec Alpha o en Ethereum, con tus claves;
    ◦ cada merge;
    ◦ cada decisión legal, que firma el abogado.
Es la separación habitual en equipos de protocolo: el código lo preparan los ingenieros y las claves de producción las controlan personas concretas, con un runbook y verificación posterior en la red. El propio repositorio ya funciona así (`docs/alpha/DEPLOY_RUNBOOK.md`).
Parte 1. Misión, autorización y estado verificado
Misión. Eres el ingeniero principal de protocolo de Ledger Chat. Integra en main, con la máxima coherencia, todo lo técnico de la nota jurídica preliminar del 19/11/2026: el resto de la Puerta 1, lo que la Puerta 2 necesita del código y las nuevas condiciones de la Puerta 3. Incluye actualizar el protocolo donde haga falta. Trabaja como lo haría un equipo de ingeniería de Aztec Labs: versiones fijadas, pruebas en cada contrato, verificación en la red después de cada despliegue y ninguna afirmación que no esté probada.
Autorización de Stefan Antonio Cirisanu (19/11/2026).
Yo, Stefan Antonio Cirisanu, titular del proyecto, autorizo al agente a modificar el código, los contratos Noir, la configuración, los workflows y la documentación de Ledger Chat. Le autorizo también a desplegar en la red de pruebas de Aztec desde la CI con cuentas de prueba, y a preparar como PR todo lo que haga falta para actualizar el protocolo. Esta autorización no incluye firmar ni enviar transacciones en Aztec Alpha ni en Ethereum, manejar mis claves, fusionar PRs, publicar textos legales no firmados por el abogado ni afirmar auditorías. Esas acciones las hago yo o el abogado.
Estado verificado (19/11/2026, main = 3cf7215). Antes de tocar nada, compruébalo tú en el repositorio. Si algo no coincide, manda el repositorio y avisa.
• Fusionados: #166 (npm run ship), #167 (landing), #168 (diagnóstico de entrega), #169 (OD-4: máximo 50 testers), #175 (PA-1: HLC token de prueba; cUSDC previsto y apagado) y #176 (Puerta 1: modelo de token retirado, aviso del chat, contador de visitas sin almacenamiento, docs/legal/ como borradores).
• HLC en Alpha, según deployments/aztec-mainnet.json:
    ◦ dirección 0x1f49571a…24e5;
    ◦ artefacto @aztec-labs/noir-contracts.js/Token, clase 0x067df4dd…91e0;
    ◦ desplegado en el bloque 28992 el 14/11/2026, despliegue universal;
    ◦ administrador 0x1cf28fb5…fe42;
    ◦ nombre en el contrato: «Humanity Ledger Corp.».
  El Token estándar fija nombre y símbolo en el constructor. Cambiar el nombre exige una instancia nueva, no una actualización. Ya hay un precedente en retiredTokens (la instancia del 11/11/2026, retirada el 14/11/2026).
• Contratos propios:
    ◦ contracts/aztec/{escrow,streams,identity,portal_token,test_token}, con aztec-nr de aztec-labs-eng/aztec-nr, tag v6.0.0;
    ◦ en Alpha no hay ninguno desplegado (contracts: []);
    ◦ closedAlpha.enabled: false, con las clases PrivateEscrow 0x165090de…f143 y PaymentStream 0x0f2ba459…c1e3.
• El nombre «Humanity Ledger Corp(oration)» sigue en el código:
    ◦ components/zk/ZkWalletPanel.tsx:658 (herramienta del operador para desplegar HLC);
    ◦ app/api/payment/webhook/route.ts (incluido el remitente api@ledgeralert.corp);
    ◦ app/api/v1/ledger/events/route.ts y app/api/v1/ledger/signals/route.ts.
• Landing: BRAND_FILES usa /brand/aztec/aztec-wordmark-ink.svg y /brand/ethereum/eth-diamond-black.svg. Las normas de marca de Aztec no están confirmadas por escrito.
• cUSDC: está en plannedTokens, con la dirección copiada de la web de Shield y verifiedOnChain: false. Sus puertas están en CUSDC_GATES (lib/payments/assets.ts).
• Aztec v6: su documentación advierte que las actualizaciones de contratos aún no están bien soportadas por el framework, y que los macros #[aztec] no se construyeron pensando en ellas (docs de Aztec, Tierra v6.0.0).
Documentos de referencia:
• la nota jurídica preliminar (secciones A a F y plan de acción), que Stefan te pegará o te enlazará;
• docs/alpha/OPERATOR_DECISIONS.md (OD-1 a OD-10, OD-4 enmendada, PA-1);
• docs/alpha/DEPLOY_RUNBOOK.md;
• docs/MAINNET_READINESS.md;
• docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-18.md.
Parte 2. Cómo trabajar (la disciplina de un equipo de protocolo)
1.  Versiones fijadas.
    ◦ Todos los crates usan aztec-labs-eng/aztec-nr con tag v6.0.0.
    ◦ El SDK de Aztec va en una sola versión (scripts/aztec/check-sdk-single-version.mjs).
    ◦ No subas de versión sin un PR propio que lo justifique con las notas de la versión.
2.  Pruebas por contrato.
    ◦ Ejecuta aztec test dentro de cada carpeta de contrato, nunca en la raíz.
    ◦ Cada cambio en Noir llega con pruebas TXE del caso feliz, del caso de ataque y de los límites.
    ◦ Si cambia una clase, imprime su id con scripts/aztec/print-class-ids.mjs y actualiza los registros. Nunca inventes un id.
3.  Primero la red de pruebas. Todo lo que vaya a Alpha se ejecuta antes de punta a punta en la testnet desde la CI, y se registra con hash y bloque en deployments/aztec-testnet.json.
4.  Verificación en la red después de cada despliegue. Un despliegue solo existe en el registro cuando el preflight de solo lectura (workflow «Aztec mainnet preflight») confirma la transacción, el bloque, la clase y lo que el contrato devuelve. Mientras tanto, status: pending-preflight.
5.  Sin actualizaciones de contrato en esta fase. Siguiendo la advertencia de la documentación de Aztec v6:
    ◦ ningún contrato propio se vuelve actualizable;
    ◦ un cambio de comportamiento es una clase nueva y una instancia nueva, con migración documentada y el registro anterior en retired;
    ◦ deja esta decisión en un ADR (paquete 9).
6.  El lenguaje de Aztec, bien usado: Aztec Network, Alpha, estado privado, notas, PXE, Fee Juice, clase e instancia. Ninguna frase dice «auditado», «partner», «official», «backed by», «anónimo» ni «imposible de rastrear».
7.  Una sola fuente de verdad por hecho. Cada cifra, dirección o fecha de la web o la app sale de deployments/*.json, de lib/landing/content.ts o de una función que la lee. Ninguna se escribe a mano en dos sitios.
8.  Seguridad en cada PR. Cada PR lleva una sección «Security considerations» que cubra qué superficie cambia, qué podría salir mal y qué prueba lo cubre.
9.  Cambios pequeños y revisables. Un paquete es un PR, con rama claude/<tema>, abierto con la API REST.
    ◦ Commits con el pie de autoría de la sesión.
    ◦ Esperas a que pasen los cuatro checks obligatorios: Unit Tests (Vitest), TypeScript & Lint, Contract Tests (Hardhat) y Foundry.
    ◦ No fusionas nunca.
10.  Si no puedes comprobar algo, no lo afirmes. Escríbelo como pendiente, con quién lo comprueba.
Parte 3. Paquetes de trabajo (un PR cada uno, en este orden)
Paquete 1. HLC con nombre neutro: todo listo para que Stefan firme
Objetivo: que la nueva instancia de HLC se llame «HLC Test Token» y que nada en el producto vuelva a usar «Humanity Ledger Corp.».
• Define los metadatos en un solo sitio, por ejemplo HLC_TOKEN_META = { name: 'HLC Test Token', symbol: 'HLC', decimals: 6 } en lib/payments/assets.ts. Que la herramienta del operador de components/zk/ZkWalletPanel.tsx los lea de ahí.
• Comprueba en el ABI del artefacto @aztec-labs/noir-contracts.js/Token de la versión instalada cómo se leen el nombre y el símbolo. No supongas el nombre de la función.
• Añade al preflight de solo lectura una comprobación del token activo: nombre igual a HLC_TOKEN_META.name y decimales 6. Si no coinciden, el preflight falla.
• Prepara en deployments/aztec-mainnet.json el cambio que se aplicará tras la firma de Stefan:
    ◦ la instancia actual pasa a retiredTokens, con retired: «renombrado: el nombre del contrato sugería una sociedad inexistente (nota jurídica del 19/11/2026, A.4)»;
    ◦ la nueva queda en tokens con status: pending-preflight hasta que el preflight la confirme.
• Escribe docs/alpha/HLC_REDEPLOY_RUNBOOK.md con los pasos de la parte 4.
• Test: ningún archivo de app/, components/ ni lib/ contiene «Humanity Ledger Corp». Solo lo contienen los registros retirados y el propio test.
• Aceptación: CI en verde, el runbook existe y ninguna transacción se ha enviado.
Paquete 2. Retirar «Humanity Ledger Corporation» del código heredado
Objetivo: que ninguna ruta diga ser una sociedad que no existe.
• Revisa app/api/payment/webhook/route.ts, app/api/v1/ledger/events/route.ts y app/api/v1/ledger/signals/route.ts. Busca quién los importa o los llama y si algún workflow o test los usa.
    ◦ Si no los usa nadie, bórralos con sus tests.
    ◦ Si se usan, cambia el nombre por el del responsable real ([Stefan Antonio Cirisanu / la S.L.], leyendo una constante) y quita el remitente api@ledgeralert.corp.
• Aceptación: un test falla si reaparece «Corporation», «Corp.» o «ledgeralert.corp» en app/.
Paquete 3. Quién reparte HLC (MiCA, art. 4.1.a)
Objetivo: que el código no deje repartir HLC a los testers hasta que conste quién lo reparte y con qué base.
• Añade closedAlpha.distributor a deployments/aztec-mainnet.json, con null por defecto. Tiene dos formas válidas:
    ◦ { "kind": "company", "legalName", "taxId", "registry" };
    ◦ { "kind": "natural-person", "legalNote": { "ref", "signedBy", "signedOn" } }.
• lib/alpha/gate.ts rechaza crear códigos de invitación y enviar HLC a un tester mientras distributor sea null, con un motivo legible en la herramienta del operador.
• Ningún valor se inventa. Stefan lo rellena en un PR propio cuando el abogado decida.
• Tests: los tres estados (null, empresa, persona física con nota firmada) y el rechazo de formas incompletas.
Paquete 4. Admisión de testers: términos, mayoría de edad y sanciones
Objetivo: que nadie entre en la alpha sin cumplir lo que pide la nota.
• Aceptación de los términos:
    ◦ en AlphaMember, la aceptación guarda tres casillas separadas: condiciones, riesgos de la cláusula 6 y 18 años o más con los requisitos;
    ◦ cada una con su fecha y con el hash SHA-256 de la versión exacta del texto aceptado;
    ◦ mientras no exista una versión firmada de los términos (ALPHA_TERMS_VERSION vacío), no se canjea ningún código (OD-8).
• Comprobación de sanciones por el operador. Añade sanctionsCheckedAt, sanctionsListDate (fecha de la lista consolidada de la UE usada) y sanctionsResult (clear o match). Solo se guarda el resultado: nunca documentos de identidad.
• La herramienta del operador muestra una lista de comprobación por tester y no deja emitir el código sin las dos comprobaciones.
• Migración de Prisma con borrado automático de esos campos 6 meses después del fin de la alpha.
• Tests: sin términos no hay canje; sin sanciones no hay código; con match no hay código.
Paquete 5. Registro de Fee Juice (OD-9)
Objetivo: que cada entrega de Fee Juice quede documentada para Hacienda y no supere el presupuesto.
• Crea la tabla FeeJuiceGrant (solo administradores), con recipientAztecAddress, amount, txHash, block, grantedAt, marketValueEur y valueSource.
• El presupuesto sale de ALPHA_FEE_JUICE_BUDGET. Sin valor, la herramienta rechaza registrar entregas.
• Las entregas las hace Stefan con sus claves. La herramienta solo registra el hash y el bloque que él aporta, y comprueba en el nodo, en modo lectura, que la transacción existe.
• Exportación CSV para el asesor fiscal.
Paquete 6. Puertas nuevas de cUSDC (Puerta 3)
• Añade a CUSDC_GATES cuatro condiciones:
    ◦ issuerWrittenClassification: referencia a la respuesta escrita de human.tech sobre la calificación de cUSDC bajo MiCA, la entidad emisora y el garante del canje;
    ◦ legalNoteNotCasp: nota del abogado de que la integración no convierte a la S.L. en CASP ni en proveedor de pagos;
    ◦ sanctionsPolicy;
    ◦ insurance.
• Añade al preflight una lectura del contrato cUSDC en el nodo: clase, nombre y decimales. Deja evidencia para verifiedOnChain, que solo cambia en un PR.
• Test: con cualquier puerta en false, la wallet nunca lista cUSDC.
Paquete 7. Marcas de terceros en la web
• Ethereum: documenta en public/brand/README.md la página oficial de recursos de marca de donde sale el diamante, con la fecha de descarga y las condiciones de uso.
• Aztec: aplica la decisión D-1 de la parte 5.
• Test: todo archivo usado en BRAND_FILES tiene en public/brand/README.md una entrada con fuente, fecha y condiciones. Sin entrada, el test falla.
Paquete 8. Coherencia de docs/legal/ y evaluación de impacto
• Rehaz dpia.md, ropa.md, cookies.md y privacy-policy.md con los hechos reales:
    ◦ responsable: Stefan como persona física hasta que exista la S.L.;
    ◦ sin delegado de protección de datos;
    ◦ sin «consultoría externa»;
    ◦ el inventario de almacenamiento real después del PR #176;
    ◦ la tabla de tratamientos de la sección D de la nota.
• Mantenlos como «borrador interno, no vigente hasta firma del abogado». No toques lib/docs/pages/legal.ts ni protocol.ts.
• La evaluación de impacto nombra a su autor real («borrador preparado con Claude, pendiente de revisión») y su fecha real.
Paquete 9. ADR: política de actualización de contratos
Escribe docs/adr/0001-contratos-no-actualizables-en-alpha.md con cuatro apartados:
• Contexto: la advertencia de Aztec v6 sobre actualizaciones.
• Decisión: ningún contrato propio es actualizable en la alpha. Un cambio de comportamiento es una clase nueva, una instancia nueva, un registro retired y un aviso a los usuarios.
• Consecuencias.
• Opción futura, sin implementar: una función update_to restringida a una multifirma de la S.L., con el retraso del ContractInstanceRegistry y pruebas de que nadie más puede llamarla.
Paquete 10. Verificación y cierre
• aztec test en cada carpeta de contrato, los cuatro checks obligatorios, next build y la prueba del landing en móvil.
• Actualiza CHANGELOG.md, la página de cambios (lib/docs/pages/changelog.ts) y docs/UPGRADE_LOG.md.
• Informe final a Stefan, en español y breve:
    ◦ los PRs abiertos y su estado de CI;
    ◦ lo que espera su firma;
    ◦ lo que espera al abogado.
Parte 4. Runbook de firmas de Stefan: redesplegar HLC
El agente lo deja escrito en docs/alpha/HLC_REDEPLOY_RUNBOOK.md. Cada paso marcado «Stefan» lo ejecuta él con su wallet. El agente nunca firma ni envía.
Antes de empezar:
[ ] Los paquetes 1 y 2 están fusionados y desplegados en producción.
[ ] El preflight de solo lectura está en verde sobre el estado actual.
[ ] La cuenta de Aztec de Stefan, que será administradora, tiene Fee Juice para el despliegue.
Pasos:
1.  Stefan: en ledgerchat.org, Wallet → herramienta del operador → red Alpha → desplegar token, con los valores de HLC_TOKEN_META: «HLC Test Token», HLC, 6. Administrador: su propia cuenta de Aztec. Despliegue universal, como el 14/11/2026. Aprueba en su wallet.
2.  Stefan: copia el hash de la transacción y se lo pasa al agente cuando la app muestre la dirección nueva. No emite HLC todavía.
3.  Agente: lanza el workflow «Aztec mainnet preflight», que solo lee de la red, y anota cinco datos:
    ◦ el bloque;
    ◦ la clase, que debe ser la del Token estándar registrada;
    ◦ el desplegador;
    ◦ el nombre en el contrato, que debe ser «HLC Test Token»;
    ◦ los decimales.
    Si algo no coincide, se para y avisa.
4.  Agente: abre un PR que haga tres cambios:
    ◦ mover la instancia 0x1f49571a…24e5 a retiredTokens, con el motivo y la fecha;
    ◦ registrar la nueva en tokens con hash, bloque e id del run del preflight;
    ◦ actualizar NEXT_PUBLIC_AZTEC_TOKENS en la documentación y en .env.example. scripts/aztec/check-alpha-config.mjs debe pasar.
5.  Stefan: fusiona el PR, cambia NEXT_PUBLIC_AZTEC_TOKENS en Railway y despliega.
6.  Stefan: comprueba en el explorador que la dirección nueva tiene el nombre correcto.
7.  La instancia antigua no vuelve a emitir. Si quedan saldos de prueba de Stefan, se quedan ahí: no se migran ni se queman, y la wallet no la lista.
8.  HLC a los testers solo después de que closedAlpha.distributor esté relleno (paquete 3) y de que cada tester haya pasado la admisión (paquete 4).
Si algo falla: no se reintenta con otros parámetros. Se para, se registra lo que pasó en docs/alpha/INCIDENT.md y el agente propone la corrección en un PR.
Parte 5. Muros, decisiones de Stefan y definición de terminado
Muros que no se cruzan (siguen vigentes con esta autorización)
Transacciones y claves
• El agente no envía ninguna transacción en Alpha ni en Ethereum, no hace broadcast, no usa aztec-wallet contra Alpha y no maneja claves. Lo firma Stefan.
• /api/aztec/sponsor sigue en 410. Ledger Chat no paga comisiones de nadie.
• No hay despliegue en Railway: lo hace Stefan.
Lo que se afirma
• No se afirma ninguna auditoría externa. audit: null en deployments/aztec-mainnet.json. Se dice «revisión interna de seguridad».
• No se inventan ids de clase, hashes, bloques, auditorías ni cifras.
• Nunca «partner», «official» ni «backed by» para Aztec, Ethereum ni human.tech.
Comunidades
• communityMls sigue en false, sin llamar a createSecureGroup.
• Las publicaciones siguen legibles en el servidor, y ninguna frase dice que estén cifradas de extremo a extremo.
• No se nombra ninguna comunidad de prueba.
Archivos y áreas protegidas
• No se editan lib/docs/pages/legal.ts ni protocol.ts.
• No se toca lib/aztec/ para medir la memoria del prover.
• Studio sigue cerrado: /api/studio/ sigue en STUDIO_LOCKED.
• Q1 a Q10 siguen abiertas.
• communityMls, closedAlpha.enabled y CUSDC_GATES solo cambian en un PR que Stefan fusiona.
Forma de trabajo
• Solo se hace push a ramas claude/. Ningún merge lo hace el agente.
• El correo de Stefan es privado y no se escribe en ningún sitio.
• Marca: sin emojis. Paleta #5200FF, #15171C, #F7F8FA, #E4E7EC, #10B981 y #FF3B30, en modo claro. Zero Mock.
Decisiones que solo toma Stefan (con el valor por defecto mientras no decida)
#
Decisión
Por defecto
Alternativa
D-1
Logo de Aztec en la web
Texto «Aztec Network» (BRAND_FILES.aztec = null) hasta tener sus normas de marca por escrito
Mantener el logo si Stefan aporta esas normas, anotadas en public/brand/README.md
D-2
Nombre de la nueva instancia
«HLC Test Token»
Otro nombre neutro sin forma societaria
D-3
Quién reparte HLC
null: nadie puede repartir
La S.L., o Stefan con la nota del abogado firmada
D-4
Presupuesto de Fee Juice (OD-9)
Sin valor: no se registran entregas
La cifra que fije Stefan
D-5
Rutas heredadas de «Humanity Ledger Corporation»
Borrarlas si nadie las usa
Renombrarlas si se usan
D-6
Región de Railway
Comprobar cuál es y decirlo
Moverla a la UE si Railway la ofrece
Definición de terminado
[ ] Los paquetes 1 a 10 están en PRs con los cuatro checks obligatorios en verde, next build en verde y aztec test en verde en cada carpeta de contrato.
[ ] Nada en app/, components/ ni lib/ dice «Humanity Ledger Corp», «Corporation» ni «ledgeralert.corp».
[ ] El código impide repartir HLC sin distribuidor, admitir testers sin términos firmados ni comprobaciones, registrar Fee Juice sin presupuesto y listar cUSDC sin sus puertas.
[ ] El runbook del redespliegue está escrito y probado en la testnet de punta a punta (desplegar, leer el nombre, registrar), con hashes y bloques en deployments/aztec-testnet.json.
[ ] Los documentos de docs/legal/ dicen la verdad y siguen marcados como borradores.
[ ] El ADR de actualizaciones está escrito.
[ ] Informe final en español que separe lo hecho, lo que espera la firma de Stefan y lo que espera al abogado.