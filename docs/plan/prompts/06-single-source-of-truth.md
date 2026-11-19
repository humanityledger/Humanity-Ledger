# Prompt: el repositorio como única fuente de verdad

Estado: vigente como instrucción de trabajo · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: este archivo

Cómo usarlo
1.  Exporta a Markdown la nota jurídica preliminar y el prompt maestro. Un agente de Claude Code no puede abrir esos enlaces.
2.  Abre una sesión nueva de Claude Code sobre humanityledger/Humanity-Ledger. Adjunta los dos archivos y pega el prompt de abajo.
3.  Este prompt sustituye a ejecutar el prompt maestro por separado: lo incluye como fase 2 y no repite su contenido. Así ahorra tokens.
El prompt
Objetivo. Deja el repositorio como única fuente de verdad de Ledger Chat. Cada hecho vive en un solo sitio y todo lo demás lo enlaza o lo lee de ahí. Usa los mismos términos en código, web, documentación y registros, sin ninguna contradicción entre ellos. Entradas:
• NOTA_JURIDICA.md: la nota jurídica preliminar del 19/11/2026;
• PROMPT_MAESTRO.md: sus partes 1 a 5 rigen, incluidos los muros y las decisiones D-1 a D-6;
• main.
Fase 0. Inventario (un solo PR, solo lectura y un mapa)
• Busca con git grep -n (no abras archivos enteros) estos términos: «Humanity Ledger Corp», «Corporation», «ledgeralert», «Real ETH», «audited», «partner», «official», «backed by», «anonymous», «untraceable», «DPO», «consultoría externa», «airdrop», «presale», «buyback», «burn», «staking» y «vesting».
• Lista los documentos de docs/ que tratan el mismo tema.
• Escribe docs/INTEGRATION_MAP.md: una tabla con tema, fuente de verdad, archivos que la repiten y acción (enlazar, leer de la fuente, borrar o mantener como registro histórico).
Fase 1. Documentos (un PR)
• Guarda la nota en docs/legal/NOTA_PRELIMINAR_2026-11-19.md con sus marcas [verificar].
• Guarda los Anexos I a IV en docs/legal/drafts/, cada uno con esta cabecera: «BORRADOR. No vigente hasta la firma del abogado (OD-8)».
• Guarda el prompt maestro en docs/plan/prompts/05-gates-protocol.md.
• Crea docs/GLOSSARY.md con dos listas:
    ◦ términos canónicos: Aztec Network, Alpha, HLC Test Token, cUSDC (Clean USDC, de human.tech), Fee Juice, revisión interna de seguridad, no custodial, alpha cerrada, tester;
    ◦ términos prohibidos: la lista de la fase 0, con una excepción permitida por término si la hay. Por ejemplo, «burn» dentro de código Noir.
• Crea docs/README.md como índice único de documentación, agrupado en decisiones, runbooks, legal, preparación de mainnet, ADR y prompts.
• Cada documento lleva una cabecera de 4 líneas: estado, fecha, dueño y fuente de verdad.
• Crea test/unit/docs/consistency.test.ts. Lee los prohibidos de GLOSSARY.md y recorre app/, components/, lib/ y docs/, excluyendo retiredTokens, el historial y los borradores legales. Falla con archivo y línea.
Fase 2. Código y protocolo
• Ejecuta los paquetes 1 a 10 de PROMPT_MAESTRO.md en su orden, un PR cada uno.
• Antes de cada paquete, comprueba en main qué ya existe. No rehagas lo hecho: compártelo en el PR como «ya cubierto por #…».
Fase 3. Pasada de coherencia (un PR)
• Revisa README.md, SECURITY.md, CHANGELOG.md, lib/landing/content.ts y lib/docs/pages/*.ts. Excluye legal.ts y protocol.ts, que no se tocan.
• Toda cifra, dirección, fecha o estado debe coincidir con deployments/*.json y con docs/alpha/OPERATOR_DECISIONS.md. Donde se repita a mano, que se lea de la fuente.
• El test de consistencia queda en verde.
Reglas de redacción
• Lenguaje llano, frases de menos de 25 palabras, voz activa y una idea por párrafo. Sin adjetivos de marketing ni emojis.
• Cada afirmación es verificable y enlaza a su fuente (archivo, run de CI, transacción). Si no puedes comprobarla, no la escribas: anótala como pendiente.
• Idioma:
    ◦ el que ya tiene cada archivo;
    ◦ el producto y el código, en inglés;
    ◦ los borradores legales, en español.
• Fechas: dd/mm/aaaa en el texto e ISO 8601 en los datos. Números con su unidad.
Reglas de ahorro de tokens
• git grep -n antes de leer. Lee solo rangos de líneas, nunca archivos grandes enteros (por ejemplo LedgerChatV2.tsx).
• Para cambios repetidos, un script en vez de editar archivo por archivo.
• No pegues diffs ni archivos en el chat. No repitas el contexto.
• Espera la CI con un solo bucle de sondeo por PR, no con lecturas sueltas.
• Cada informe ocupa 15 líneas como máximo, en español.
Definición de terminado
[ ] Las fases 0 a 3 están en PRs con los cuatro checks obligatorios y next build en verde. Ningún merge lo hace el agente.
[ ] docs/INTEGRATION_MAP.md no deja ningún tema con dos fuentes de verdad.
[ ] El test de consistencia está en verde y forma parte de Unit Tests (Vitest).
[ ] Se cumple la definición de terminado del prompt maestro.
[ ] Informe final con tres listas: lo hecho, lo que espera la firma de Stefan y lo que espera al abogado.