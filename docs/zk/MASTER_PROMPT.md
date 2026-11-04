# Humanity Ledger × Aztec — Prompt maestro verificado (commit 097b51d5)

3 de noviembre de 2026 · Stefan Antonio Cirisanu

Este es el prompt maestro único para el trabajo ZK y de mensajería de Humanity Ledger. Integra los dos prompts del 3 de noviembre, contrastados línea a línea con el commit 097b51d5 de `humanityledger/Humanity-Ledger`. El anexo C muestra dónde quedó cada una de sus secciones. Lo más grave no estaba en ninguno de los dos: el circuito de streams permite cobrar muchas veces el mismo devengo, y la "integridad de VK" no está ligada a las claves reales.

> **Estado de ejecución (4 nov, 09:00):** fases 0 y 0-B hechas y verificadas en CI; fase 1 avanzada. Lo nuevo desde el 3 nov:
> - Los 30 tests TXE de los contratos aztec-nr pasan con Aztec 6.0.0 en CI: escrow 10, identity 11, streams 9. Usan un token solo de pruebas, `contracts/aztec/test_token`.
> - Hay despliegue con claves: `lib/aztec/keyed-deploy.ts` y `scripts/aztec/deploy-keyed.ts`. No se ha ejecutado contra testnet.
> - El registro de VK on-chain con retardo está escrito, con tests de Hardhat, y `verifier.ts` lo consulta (R-19). No está desplegado.
> - Hay probador en Web Worker sin módulos de Node (R-16), y comprobación de salud de testnet a diario (R-15).
> - Se retiraron de la interfaz la solvencia, la ceremonia MPC, la prueba de edad y los streams que eran falsos (R-14).
> - El menú de mensajes ya tiene reacciones, pagos, detalles y teclado, y avisa honestamente al borrar (R-12).
> - Todos los workflows están en verde en `main`: IP Protection, Security & Compliance, Circuit Constraint Coverage, Hardhat (que ahora es una puerta real) y Lighthouse contra la app real.
> - El inicio de sesión SIWE en `/connect` rechazaba carteras válidas: redes como BNB o Linea, `www.`, una escritura de Redis fallida y carteras de contrato. Está corregido y probado con firmas reales (`test/auth/siwe-routes.test.ts`).
> - `middleware.ts` ya no tiene `@ts-nocheck`. Se quitó `backend_barretenberg`, y un workflow regenera el lockfile (R-07, parcial).
>
> Siguen abiertas:
> - R-11: prueba manual en testnet con dos cuentas.
> - R-13: falta el códec de reacciones de XMTP.
> - R-17: necesita una migración de Prisma y decidir la bandera por comunidad.
> - R-07: queda la duplicación de wagmi, viem y `@aztec/*` frente a `@aztec-labs/*`.
> - El `@ts-nocheck` de `LedgerChatV2.tsx`.
>
> El detalle está en `claude/fase1-ci-hardening-2026-11-04.md`, en el proyecto.

## Cómo usarlo

Pégalo entero como instrucción de sistema para el agente que trabaje en el repositorio (Claude, Antigravity o una persona). El agente trabaja por fases, una rama y un PR por tarea, y se detiene con evidencia (salida de comandos) al final de cada una.

**Regla de verdad, por encima de todo lo demás:**

1. Ninguna afirmación sale del repositorio (README, dossier, web, mensajes a terceros) sin un comando reproducible que la demuestre. Si no hay comando, la afirmación no se hace.
2. Vocabulario de estado, sin excepciones: **real en testnet**, **real solo en tests**, **demo local**, **simulado**, **retirado (410)**. Prohibidos: "100 %", "auditado" sin informe externo, "production", "quantum", "nativo" cuando es de un tercero.
3. Las cifras (tests, bytes, rutas) se copian de la salida de un comando de hoy, nunca de un documento anterior.
4. Si el agente encuentra una contradicción entre este documento y el código, gana el código: se detiene y lo dice.

**Método de esta revisión:** lectura directa del commit 097b51d5 (y de b30a3251, que trae los circuitos), análisis de la cabecera binaria de las tres VK y búsqueda de usos en GitHub. No se ejecutó `nargo` ni `bb` en esta sesión; las afirmaciones de que los tests pasan son del mensaje del commit y no se han reproducido aquí.

## Rol y misión del agente

Eres el ingeniero responsable de llevar la parte ZK de Humanity Ledger de "experimental con afirmaciones falsas" a "verificable por cualquiera", y de dar a Ledger Chat un menú de mensajes a la altura de Signal. Trabajas en `humanityledger/Humanity-Ledger`, siempre en una rama creada desde `main`.

**Orden de lectura de este documento:** el estado real (punto de partida), las reglas técnicas (cómo se escribe cada capa), los hallazgos ZK (qué está roto), la arquitectura y el menú (qué se construye), el plan (en qué orden), el bucle de verificación (cómo se demuestra) y el mensaje (qué se dice fuera). Los anexos son contexto para Stefan, no instrucciones.

**Entregables por tarea:** una rama, un PR con descripción, los tests que demuestran el cambio y la fila de la tabla de estado actualizada si el estado de un componente cambia.

**Te detienes y preguntas cuando:**

1. El código contradice este documento (gana el código; lo dices con la línea exacta).
2. La acción no se puede deshacer o sale del repositorio: desplegar un contrato, reescribir el historial, fusionar en `main`, publicar, escribir a terceros. El mensaje a Aztec lo envía Stefan, nunca el agente.
3. Hace falta un secreto o una clave que no está en el entorno.
4. Un comando del bucle de verificación falla por algo que no tocaste.
5. Una tarea obliga a elegir entre dos diseños con consecuencias distintas para el usuario (por ejemplo, custodia privada o pública en el escrow).

**Formato de cada informe:** ficheros cambiados; salida literal de los comandos del bucle (o el que falló y su error); qué hallazgo ZK o tarea R cierra; qué queda abierto; filas de la tabla de estado que cambian. Sin cifras que no salgan de esa salida.

## Estado real por componente

Esta tabla es la única fuente para describir el proyecto hacia fuera; usa el vocabulario de estado de la regla de verdad. Lo único real fuera de los tests es el monedero de testnet y la mensajería directa por XMTP.

| Componente | Estado | Qué falta para subir de estado |
| --- | --- | --- |
| Monedero privado (`lib/aztec/wallet/`): shield, envío privado, unshield con `Token` y `SponsoredFPC` | Real en testnet; comprueba la curva Grumpkin antes del SDK (`lib/aztec/grumpkin.ts`) | Unificar paquetes en `@aztec-labs/*` 6.0.0; publicar la configuración de testnet (R-15) |
| DM 1 a 1 por XMTP v3 (MLS de OpenMLS) | Real, de un tercero | Decir "XMTP (MLS)", no "MLS propio" |
| Publicaciones de comunidad | Texto legible en la base de datos (F2-02) | Grupos MLS de XMTP (R-17, `docs/communities/MLS_MIGRATION.md`) |
| Circuitos v1 (escrow, identity, streams) | Real solo en tests; VK fijadas; fallos ZK-01 a ZK-06 | Sustituir por v2 o por contratos aztec-nr |
| Circuitos v2 (`circuits/*_v2`) | Experimental: compilan y pasan tests en CI; corrigen ZK-01 a ZK-05 y G2, G3, G5 | Pruebas UltraHonk en TypeScript, fijar VK, verificador que guarde estado (R-18) |
| Probador `lib/zk/prover.ts` y `lib/zk/browser-prover.ts` (Web Worker) | Real solo en tests; VK fijada; la versión de navegador no usa módulos de Node (`test/zk/browser-prover.test.ts`) | Probarlo en Safari iOS; no está conectado a ninguna pantalla |
| VK binarias y `*.vk.json` | Reales y fijadas en código | Ninguno |
| `zkMoney.ts` | Demo local | Sustituir por el monedero real o retirar |
| `zkCompliance.ts`, `zkMpc.ts`, Gold Registry, prueba de edad, streams en `localStorage` | Retirados de la UI (R-14); `createShieldedStream` solo funciona en modo demo | — |
| `realTx.ts`, `aztec-zk-engine.ts` | Retirados | — |
| `HumanityTimeLockVault`, `LedgerDeadmanSwitch` | Código Solidity sin auditar ni desplegar | Auditoría (H-037); revisar que `isTriggered` no bloquee el segundo token |
| `ZKIdentityRegistry.sol` | Revierte siempre (`VerifierNotConnected`) | Verificador Honk real |
| Registro de VK on-chain (`contracts/ZKVerificationKeyRegistry.sol`) | Real solo en tests (Hardhat); `assertVKIntegrityOnChain` lo lee y falla si no está configurado | Desplegarlo con una multisig como propietaria (`scripts/zk/deploy-vk-registry.ts`) |
| Sandbox de apps de comunidad | Real (CSP `sandbox allow-scripts`, sin red) | — |
| Menú contextual de mensajes | Real: reacciones, responder, hilo, copiar (aviso en temporales), reenviar, pago privado y pago, detalles, editar, pedir borrado, denunciar; teclado y movimiento reducido | Reacciones como tipo de contenido XMTP (R-13) |

## Reglas técnicas por capa

Estas reglas valen para todo código nuevo o tocado. Integran las capas 1 a 3 del segundo prompt, corregidas donde chocaban con el código o con la seguridad (marcado como *corrige*).

### Circuitos Noir

1. **Visibilidad:** `nombre: pub Tipo` para entradas públicas; sin `pub`, privada. *Corrige:* `pub nombre: Tipo` no es "sintaxis antigua", nunca fue válida.
2. **Qué es público:** solo commitments, nulificadores, raíces, tiempos que el verificador compara con la hora de bloque, la dirección que cobra y el dominio (cadena, contrato y versión del circuito). Secretos, salts, claves e importes, privados. *Corrige:* el segundo prompt no incluía la dirección de cobro ni el dominio, y por eso existe ZK-02.
3. **Separación de dominio:** cada hash con su propio separador; nunca dos usos distintos con el mismo número de entradas y sin separador (ZK-04). Para lo nuevo, Poseidon2 con separador.
4. **Rangos:** tipos `uN` para cantidades y `assert` de los límites del negocio. Noir comprueba el desbordamiento de enteros (la prueba falla, no da la vuelta), así que los máximos protegen la lógica, no la solidez.
5. **Estado entre pruebas:** si un valor cambia de una prueba a la siguiente (lo retirado, un saldo), la prueba consume el estado anterior y lo demuestra. Nunca un estado previo como testigo libre (ZK-01).
6. **Tests:** cada `assert` con su `#[test(should_fail)]`, y cada invariante entre pruebas con un test de secuencia que intente el ataque.
7. **Versión fijada** en `Nargo.toml` (`compiler_version = "1.0.0"`).

### Barretenberg y probador TypeScript

1. **Entradas:** solo `string` o `bigint`. Un `number` por encima de 2^53 ya llegó corrupto antes de validarlo. Campos en \[0, r) con r el módulo escalar de BN254; enteros dentro del rango de su tipo, antes de ejecutar.
2. **Errores sin datos:** el mensaje de error nombra el campo, nunca su valor. *Corrige:* el ejemplo del segundo prompt metía `${val}` en la excepción, que puede ser un secreto y acabar en los logs.
3. **Verificación con VK fijada:** cargar la VK binaria, comprobar su SHA-256 contra una constante del código y verificar con ella; cualquier excepción de WASM devuelve `false` (ZK-07). El `try/catch` del segundo prompt se mantiene, pero solo no basta.
4. **El resultado de la prueba no es la autorización:** quien verifica comprueba además las entradas públicas (hora contra la del bloque, dirección de cobro, dominio, nulificador no usado).
5. **Higiene:** nunca registrar testigos, secretos ni entradas privadas; `destroyZkEngine()` al terminar sesiones largas.
6. **Navegador:** sin `node:fs` ni `node:crypto`; el probador corre en un Web Worker y carga los artefactos como estáticos con hash. Solo hace falta si se mantiene el camino B de la arquitectura.
7. **Una sola cadena de versiones:** nargo, `noir_js` y `bb.js` compatibles entre sí y documentados en el `*.vk.json`.

### Contratos aztec-nr

1. API de v6 (`#[external("private")]`, `self.storage`, `.deliver(MessageDelivery::onchain_constrained())`), compilada con la cadena de Aztec 6.0.0, no con nargo suelto.
2. Estado privado en notas propias dentro de `PrivateSet`; el derecho a gastar una nota lo da la clave de su propietario, nunca un secreto compartido (ZK-03).
3. Tiempo: cota superior con `set_expiration_timestamp`, cota inferior con la cabecera del bloque ancla. Nada de "hora actual" como parámetro.
4. Nulificadores propios con separador de dominio y `push_nullifier`; la unicidad la garantiza la red.
5. Tests en TXE que incluyan los ataques de los hallazgos ZK.
6. *Integra el segundo prompt:* los circuitos sueltos siguen en `circuits/` como pruebas rápidas de CI mientras los contratos no los sustituyan; después se archivan y no se presentan como producto.

### Solidity

1. Nada se despliega en una red pública sin verificador real conectado, tests y revisión externa; mientras tanto se describe como "sin auditar".
2. Un verificador de L1 se genera con `bb` para la VK fijada; nunca una llamada comentada (`ZKIdentityRegistry`).

## Hallazgos criptográficos en los circuitos

Los circuitos compilan, pero tres de ellos aceptan pruebas que no deberían. Un ingeniero de Aztec que lea `circuits/streams/src/main.nr` encontrará el primero en minutos. Ninguno lo detectan los 27 tests, porque todos prueban un solo retiro aislado.

### ZK-01 · Crítico · Streams: el mismo devengo se cobra muchas veces

`withdrawn_amount` es una entrada privada que nada liga a un estado anterior, y el nulificador es `H(commitment, withdrawn + claim)`. Basta con declarar siempre `withdrawn = 0` y cambiar `claim`.

Ejemplo con los valores del propio test: ritmo 10/s, inicio 1000, ahora 1060 → devengo 600, asignación 10.000.

1. Retiro 1: `withdrawn = 0`, `claim = 600` → nulificador `H(c, 600)`. Válido.
2. Retiro 2: `withdrawn = 0`, `claim = 599` → nulificador `H(c, 599)`, distinto. Válido.
3. Y así hasta `claim = 1`: 600 pruebas válidas que suman 180.300 unidades, 18 veces la asignación entera.

**Corrección:** el estado del stream tiene que ser una nota que se consume y se recrea. Cada retiro nulifica el estado anterior (`H(c, withdrawn_viejo)`, con prueba de pertenencia de ese estado) y publica el nuevo. Es exactamente el modelo de notas de Aztec, por eso la sección de arquitectura propone escribirlo como contrato aztec-nr en vez de como circuito suelto.

### ZK-02 · Crítico · Escrow y streams: la prueba no está ligada a quién cobra

Las entradas públicas son el commitment, el nulificador y los tiempos. No hay dirección de cobro. Si un verificador on-chain paga a `msg.sender` o a un parámetro, cualquiera que vea la prueba en el mempool la copia y cobra él.

**Corrección:** la dirección de cobro (y la cadena y el contrato, para evitar repeticiones entre despliegues) entra como entrada pública ligada dentro del circuito.

### ZK-03 · Alto · Escrow: para cobrar hay que conocer el secreto del emisor

La prueba demuestra conocer `sender_secret`; `recipient_pubkey` es privada y no se autentica. El receptor solo puede cobrar si el emisor le entrega su secreto, que además es el mismo en todos sus escrows y streams. Es un título al portador que expone el resto de operaciones del emisor. Tampoco hay devolución al emisor después del plazo.

**Corrección:** el derecho de cobro se prueba con la clave del receptor (en Aztec, la nota es suya y el nulificador usa su clave `nsk_app`), y se añade la ruta de devolución tras el plazo.

### ZK-04 · Alto · Identity: el nulificador puede revelar la hoja

La hoja es `pedersen_hash([secret, jurisdiction])` y el nulificador `pedersen_hash([secret, scope])`, ambos de dos elementos y sin separador de dominio. Si una aplicación usa un `scope` igual al código de jurisdicción (por ejemplo, 840), el nulificador publicado es la hoja, y la hoja está en el árbol público: la prueba deja de ser anónima.

**Corrección:** separadores de dominio distintos para hoja, nulificador y commitment (Aztec usa `poseidon2_hash_with_separator` y constantes `GENERATOR_INDEX__*`).

### ZK-05 · Alto · Identity: anonimato de 2 y cumplimiento autodeclarado

Con profundidad 1, el conjunto de anonimato de cada prueba es de 2 hojas. La jurisdicción es un testigo privado que elige quien prueba; el control de sanciones (`!= 998`, `!= 999`, códigos que no existen en ISO 3166) solo tiene sentido si el emisor de la identidad ya fijó la jurisdicción al crear la hoja, y entonces sobra en el circuito.

**Corrección:** árbol incremental de profundidad fija (por ejemplo, LeanIMT de 20 a 32 niveles) con Poseidon2; las sanciones se aplican en la emisión, o como raíz pública de una lista de exclusión con prueba de no pertenencia.

### ZK-06 · Medio · Tiempos que pone quien prueba

`current_timestamp` y `current_time` son públicos pero los elige quien prueba. Solo valen si el verificador los compara con la hora de bloque. Ningún verificador del repositorio lo hace todavía.

### ZK-07 · Medio · El verificador no fija la clave

`verifyProof` crea el backend a partir del bytecode que encuentre en disco. Si alguien cambia `zk_escrow.json`, el verificador acepta pruebas del circuito nuevo. Debe cargar la VK binaria fijada, comprobar su SHA-256 contra una constante en el código y verificar con ella.

### Menores

- `Nargo.toml` declara `compiler_version = ">=0.30.0"`; debe fijar `1.0.0`.
- Versiones mezcladas: nargo 1.0.0 compila, `@noir-lang/noir_js` 1.0.0-beta.22 ejecuta y bb.js 5.3.0 prueba, mientras el SDK de Aztec va por 6.0.0. Sobra `@noir-lang/backend_barretenberg` 0.36.0.
- Comentario de `MAX_ESCROW_AMOUNT`: dice "1 Billion" y el valor es 10^15.
- Pedersen funciona, pero el ecosistema Aztec v6 usa Poseidon2; alinearse abarata la integración.

## Arquitectura objetivo: contratos aztec-nr v6

Escrow y streams deben reescribirse como contratos aztec-nr, no envolver los circuitos actuales. El modelo de notas y nulificadores de Aztec resuelve por construcción ZK-01, ZK-02 y ZK-03, y el kernel ya demuestra que la nota existe, así que no hay árbol Merkle propio que mantener.

### Tres caminos posibles

| Camino | Qué es | Cuándo usarlo |
| --- | --- | --- |
| A · Contrato aztec-nr | La lógica vive en funciones privadas; el estado son notas; el doble gasto lo impide el árbol de nulificadores de la red | Escrow, streams e identidad. **Recomendado** |
| B · Verificación recursiva | Una función privada verifica una prueba UltraHonk del circuito suelto | Solo si el circuito debe existir fuera de Aztec. Exige alinear versiones de bb con el SDK v6 y fijar el hash de la VK; caro en tiempo de prueba |
| C · Verificador Solidity en L1 | `bb` genera un verificador Honk para Ethereum | Solo para lógica que viva en L1. No sustituye a A |

### Por qué el código del prompt no sirve

- Usa una API anterior a v6. En v6 las funciones se marcan `#[external("private")]`, el estado se lee con `self.storage` y las notas se entregan con `.deliver(MessageDelivery::onchain_constrained())` ([documentación de entrega de notas, v6.0.0-rc.1](https://docs.aztec.network/developers/v6.0.0-rc.1/docs/aztec-nr/framework-description/note_delivery)). `encode_and_encrypt_note`, `#[private]` y el prefijo `dep::` son anteriores.
- `Map<AztecAddress, PrivateMutable<ValueNote>>` guarda una sola nota por dirección: un segundo escrow al mismo receptor sustituiría al primero. Hace falta un conjunto de notas propias (`PrivateSet<EscrowNote>`).
- `claim_escrow(sender_secret, …)` reproduce ZK-03 dentro del contrato.
- La ampliación de identity a profundidad 32 con Pedersen no hace falta en Aztec: si la credencial es una nota emitida por el emisor, el kernel prueba su existencia en el árbol de notas de toda la red, y el conjunto de anonimato pasa a ser todas las notas, no 2 ni 2^32.

**Correcciones de API tras la investigación del 3 de noviembre** (detalle y fuentes en `docs/zk/AZTEC_NR_V6_NOTES.md`): el estado privado por usuario es `Owned<PrivateSet<Nota, Context>, Context>` con `.at(owner)`; el nulificador manual es `push_nullifier_unsafe`; la clave de nulificador se pide con `request_nhk_app` (antes `nsk`); para "una vez por ámbito" existe `SingleUseClaim`; un contrato con claves se despliega con `publicKeys` en `deploy` (ya no hay `deployWithPublicKeys`); aztec-nr v6 se toma de `aztec-labs-eng/aztec-nr` y se compila y prueba con `aztec compile` y `aztec test`.

### Diseño del escrow

Cada escrow crea dos notas con el mismo `escrow_id` secreto: una de cobro para el receptor y otra de devolución para el emisor. Cobrar y devolver publican el mismo nulificador de liquidación, así que solo uno de los dos puede ocurrir.

```mermaid
flowchart TD
  C["deposit · emisor<br/>Token pasa al contrato (authwit)"] --> N1["Nota de cobro<br/>propietario: receptor"]
  C --> N2["Nota de devolución<br/>propietario: emisor"]
  N1 --> CL["claim · receptor<br/>la transacción expira en el plazo"]
  N2 --> RF["refund · emisor<br/>bloque ancla ≥ plazo"]
  CL -- antes del plazo --> S["Nulificador de liquidación<br/>el segundo en llegar falla"]
  RF -- después del plazo --> S
```

El receptor solo puede cobrar mientras la transacción entre antes del plazo; el emisor solo puede recuperar después. Si los dos lo intentan cerca del plazo, gana el primero que publica el nulificador.

- **Plazo como cota superior (cobro):** `set_expiration_timestamp(deadline)` en el contexto privado; la red no incluye la transacción después de esa hora ([documentación del contexto, v6.0.0-rc.1](https://docs.aztec.network/developers/v6.0.0-rc.1/docs/aztec-nr/framework-description/functions/context)).
- **Plazo como cota inferior (devolución):** comprobar que la marca de tiempo de la cabecera del bloque ancla es mayor o igual que el plazo. El bloque ancla es pasado, así que la hora real también lo es. El accesor exacto a la cabecera hay que confirmarlo en la versión fijada.
- **Custodia:** el contrato debe poder tener saldo privado (contrato con claves propias) o custodiar en público, que revela el importe al cobrar. Confirmar el patrón en los contratos de ejemplo de `noir-contracts` v6 antes de elegir.

```rust
// Esqueleto con la API de aztec-nr v6.0.0 (docs/zk/AZTEC_NR_V6_NOTES.md). NO compilado.
// Sin confirmar: campo del timestamp en BlockHeader y nombres de transferencia del token.
use aztec::macros::aztec;

#[aztec]
pub contract PrivateEscrow {
    use aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        messages::delivery::MessageDelivery,
        protocol::{address::AztecAddress, hash::poseidon2_hash_with_separator},
        state_vars::{Owned, PrivateSet},
    };

    global SEP_SETTLED: u32 = 0x45534331; // separador propio

    #[storage]
    struct Storage<Context> {
        claims: Owned<PrivateSet<EscrowNote, Context>, Context>,
        refunds: Owned<PrivateSet<EscrowNote, Context>, Context>,
    }

    #[external("private")]
    fn create(recipient: AztecAddress, token: AztecAddress, amount: u128, deadline: u64, authwit_nonce: Field) {
        let sender = self.msg_sender();
        // 1. self.call(Token::at(token).transfer_in_private(sender, self.address, amount, authwit_nonce));
        // 2. escrow_id aleatorio; notas con el mismo escrow_id:
        //    self.storage.claims.at(recipient).insert(nota).deliver(MessageDelivery::onchain_constrained());
        //    self.storage.refunds.at(sender).insert(nota).deliver(MessageDelivery::onchain_constrained());
    }

    #[external("private")]
    fn claim(escrow_id: Field) {
        // pop_notes en claims.at(self.msg_sender()) filtrando por escrow_id
        // self.context.set_expiration_timestamp(note.deadline);
        // self.context.push_nullifier_unsafe(poseidon2_hash_with_separator([escrow_id], SEP_SETTLED));
        // transferencia privada al receptor
    }

    #[external("private")]
    fn refund(escrow_id: Field) {
        // pop_notes en refunds.at(self.msg_sender())
        // assert(timestamp de self.context.get_anchor_block_header() >= note.deadline);
        // mismo nulificador de liquidación; transferencia privada de vuelta al emisor
    }
}
```

### Diseño del stream

El estado es una nota `StreamNote { receptor, emisor, ritmo, inicio, total, retirado, aleatoriedad }`. Cada retiro consume la nota y crea otra con `retirado` actualizado, de modo que el estado anterior queda nulificado y ZK-01 desaparece. El devengo se calcula con la hora del bloque ancla, que nunca adelanta la hora real. La cancelación por el emisor necesita su propia nota y un nulificador compartido por versión del stream; es la primera pregunta de diseño para el equipo de Aztec.

### Identidad

Credencial = nota emitida por el emisor de identidad en `Owned<PrivateImmutable<CredentialNote>>`, que se lee sin anularse. El uso único por ámbito se hace con `Map<Scope, Owned<SingleUseClaim>>` y `.claim()`, que emite un nulificador derivado de la clave del usuario y del ámbito, sin esquema propio. Las sanciones se comprueban al emitir y, si la lista cambia después, con la lista comprometida de `identity_v2` (`docs/zk/SANCTION_NON_MEMBERSHIP.md`).

## Menú contextual de mensajes, nivel Signal

El menú se construye sobre `@radix-ui/react-context-menu`, con los tokens claros del proyecto y sin emojis en el cromo. Las partes criptográficas del prompt (época MLS, índice de ratchet, "marca de tiempo certificada", nulificador de revocación) se eliminan porque la app no las tiene y no puede mostrarlas con verdad.

### Qué se corrige del prompt

| Prompt | Problema | Especificación |
| --- | --- | --- |
| Vidrio oscuro `rgba(24,24,27,.88)` | Contradice la regla "sin modo oscuro" de `CLAUDE.md` y la capa de tokens (`app/ledger-tokens.css`) | Superficie blanca, borde de la rampa neutra, sombra de un nivel; variante oscura solo por tokens |
| Iconos emoji en cada fila | El rediseño del 3-nov quitó los emojis del cromo (`npm run check:chrome`) | Iconos lucide de 16 px; los emojis solo en la fila de reacciones, que es contenido |
| `onContextMenu` + `useLongPress` 500 ms + `navigator.vibrate` | Radix ya abre con pulsación larga en táctil; un segundo detector dispara dos veces. `vibrate` no existe en Safari iOS | Solo Radix; vibración detrás de `'vibrate' in navigator` |
| Animación de 0,12 s siempre | Ignora movimiento reducido | Framer Motion con `forceMount` + `AnimatePresence`; nada si `prefers-reduced-motion` |
| "Copiar del búfer descifrado, nunca toca almacenamiento sin cifrar" | El portapapeles del sistema es texto plano | Copiar el texto ya mostrado; aviso única vez en chats con mensajes temporales |
| Detalles: época MLS, ratchet, timestamp certificado | XMTP no expone ratchet por mensaje; `sentAt` lo declara el emisor | Detalles: ID, hora de envío "según el remitente", estado de entrega, conversación XMTP; época solo si `debugInfo()` del SDK la da; enlace a AztecScan solo si el mensaje lleva un `txHash` devuelto por el SDK |
| Eliminar para todos en 60 s "desde la confirmación del bloque" con nulificador MLS | Los mensajes no van en bloques; nada garantiza el borrado remoto | Tipo de contenido "petición de borrado" que cumplen los clientes honestos; texto: "Se pedirá a los otros dispositivos que lo borren. No se puede garantizar." |
| Reacciones con "attestation firmada por la clave MLS" (GAP-10) | MLS ya autentica al remitente de cada mensaje; una firma extra no añade nada | Tipo de contenido de reacción de XMTP |
| Mensajes temporales "con nulificadores locales" (GAP-11) | Un nulificador no borra nada | Partir de la clave `disappearing` que ya sincroniza `lib/sync`; temporizador y borrado local; aviso de que el otro lado puede guardar copia |

### Contenido del menú

1. Fila de reacciones rápidas (6 emojis + "más").
2. Responder, Reaccionar, Reenviar, Seleccionar, Copiar texto, Fijar mensaje, Detalles.
3. Separador y Eliminar (para mí / pedir borrado a todos, este último solo en mensajes propios).

**Decisiones previas:** "Fijar mensaje" no existe hoy (solo se fijan chats). Hay que decidir si es local, sincronizado entre tus dispositivos por el grupo `hl.device-sync.v1`, o visible para el otro como tipo de contenido. "Reenviar" siempre vuelve a enviar por XMTP a la conversación destino, nunca copia en servidor.

**Accesibilidad:** foco atrapado, flechas, Esc, Inicio/Fin, `aria-label` por acción, objetivo táctil de 44 px, posición que se invierte junto a los bordes (Radix `collisionPadding`).

**Aceptación:** test de Playwright a 1280 y 390 px (abrir con clic derecho y pulsación larga, navegar con teclado, Esc), `npm run check:chrome` en verde y ninguna acción que llame a una ruta retirada.

## Plan de ejecución por severidad

Sustituye a GAP-01…GAP-12 y encaja en las puertas del backlog de 400 tareas. Las fechas son propuestas:

- **Fase 0, hasta el 10 de noviembre:** quitar lo que un revisor encontraría en el primer minuto. Va antes de escribir a nadie de Aztec.
- **Fase 1, hasta el 7 de diciembre (Puerta 2):** contratos aztec-nr que cierran los hallazgos ZK.
- **Fase 2, hasta el 18 de enero (Puerta 3):** producto encima de lo anterior.

GAP-03 (desplegar `ZKIdentityRegistry` para anclar VK) se descarta: ese contrato no guarda VK y no verifica pruebas. La columna "Cierra" liga cada tarea con los hallazgos y las reglas técnicas.

| ID | Fase | Tarea | Hecho cuando | Cierra | Sustituye a |
| --- | --- | --- | --- | --- | --- |
| R-01 | 0 | Quitar del dossier, README y web: "MLS propio", "auditados", "production", "quantum", "100 %", la matriz de Nyx | `scripts/check-forbidden-copy.mjs` (que hoy sale siempre con 0) falla con esas palabras y pasa sin ellas | Regla de verdad; anexos A y B | — |
| R-02 | 0 | Reescribir `*.vk.json` solo con datos reales (circuito, versiones de nargo y bb, nº de entradas públicas de la VK) y quitar `l1Anchoring`. `lib/aztec/verifier.ts` hashea `target/vk`. Nuevo `scripts/zk/check-artifacts.mjs` | El script recalcula la VK con bb.js, la compara con `target/vk` y con el hash fijado | Anexo A (JSON inventados, enforcer) | — |
| R-03 | 0 | `verifyProof` con VK fijada; entradas solo `string` o `bigint`; errores sin valores | Tests: bytecode cambiado en disco → `false`; `number` → error; ningún valor en el mensaje | ZK-07; reglas del probador 1 a 3 | — |
| R-04 | 0 | Borrar `realTx.ts` y `aztec-zk-engine.ts` con sus consumidores (`qd-sequencer`, `provenanceIndexer`, `/api/passport`, `AztecPrivacyTerminal`) o recablearlos al monedero | `rg "realTx\|aztec-zk-engine"` vacío; build en verde | Estado real | GAP-04, GAP-05 |
| R-05 | 0 | `ZKIdentityRegistry.verifyCredential` revierte siempre hasta tener verificador, o se borra | Test de Hardhat | Regla Solidity 2 | GAP-03 |
| R-06 | 0 | Test que reproduce ZK-01 (dos pruebas con `withdrawn = 0`, claims 600 y 599, ambas válidas) y README que marca los circuitos como experimentales | El test documenta el fallo | ZK-01 (documentado) | — |
| R-07 | 1 | Fijar la cadena: `compiler_version = "1.0.0"`, `noir_js` acorde, quitar `backend_barretenberg` 0.36, un solo juego de paquetes `@aztec-labs/*` 6.0.0 | `npm ls` sin duplicados de Aztec | Menores; regla Noir 7; regla del probador 7 | — |
| R-08 | 1 | Contrato `PrivateEscrow` en aztec-nr v6 (sección de arquitectura) | Tests de TXE: cobro antes del plazo, devolución después, ninguna doble liquidación, nadie más cobra | ZK-02, ZK-03, ZK-06 | GAP-01 |
| R-09 | 1 | Contrato de streams con nota de estado | El ataque de R-06 falla en el contrato | ZK-01, ZK-02, ZK-06 | — |
| R-10 | 1 | Identidad como nota credencial con nulificador por ámbito | Test de anonimato y de doble uso | ZK-04, ZK-05 | GAP-02 |
| R-11 | 2 | Pago privado desde el compositor con el monedero de `lib/aztec/wallet/` (no existe `PrivateWallet.send()`); el mensaje lleva el `txHash` que devuelve el SDK | Prueba manual en testnet con dos cuentas; el hash abre en el explorador | Estado real (`zkMoney` demo) | GAP-06 |
| R-12 | 2 | Menú contextual (sección del menú) | Criterios de aceptación de esa sección | — | GAP-09 |
| R-13 | 2 | Reacciones como tipo de contenido XMTP; mensajes temporales sobre `lib/sync` | Tests de sync entre dos instalaciones | — | GAP-10, GAP-11 |
| R-14 | 2 | Quitar la "prueba de solvencia" falsa de la UI; diseñarla después como función privada sobre notas de saldo | Ningún `0xsolv_` en el código | Estado real (`zkCompliance`) | GAP-07 |
| R-15 | 2 | Script reproducible contra testnet que imprime hashes comprobables | Cualquiera lo ejecuta con una cuenta nueva | Mensaje a Aztec | GAP-12 |
| R-16 | 2 | Probador en Web Worker, solo si se mantiene el camino B | Prueba en Safari iOS sin bloquear la interfaz | Regla del probador 6 | GAP-08 |

Si se elige el camino B (mantener los circuitos sueltos), R-08 a R-10 se aplican a ellos con las mismas pruebas de ataque, y R-16 pasa a fase 1.

**Tareas añadidas el 3 de noviembre (noche), con el paquete de cierre de gaps:**

| ID | Fase | Tarea | Hecho cuando | Cierra | Estado |
| --- | --- | --- | --- | --- | --- |
| R-17 | 2 | Comunidades en grupos MLS de XMTP, un grupo por canal, bandera por comunidad (`docs/communities/MLS_MIGRATION.md`) | Un volcado de la base no contiene publicaciones de comunidades migradas | F2-02; `CLM-MSG-COMMUNITY` | Diseño |
| R-18 | 1 | Circuitos v2 (`circuits/*_v2`, `circuits/hl_lib`): Poseidon2, identidad de profundidad 32 con sanciones comprometidas, escrow con cobro y devolución, streams con estado encadenado | `nargo test` en CI; después, pruebas UltraHonk en TypeScript y VK fijadas | ZK-01 a ZK-05; G2, G3, G5 | Compila y pasa 36 tests en CI |
| R-19 | 2 | Registro de VK on-chain con retardo, solo si se mantiene el camino B | El cliente lee el registro antes de probar | `docs/VK_MONITORING.md` §4 | Contrato y lectura hechos, con tests; sin desplegar |

Fuera de ZK siguen abiertos y bloquean el lanzamiento de enero: F2-02 (comunidades en texto legible), `@ts-nocheck` en `LedgerChatV2.tsx` y la rotación de los secretos expuestos en el historial público (nota del 3-nov), incluidas las contraseñas de base de datos que estaban en `docker-compose.yml`.

## Bucle de verificación antes de cada commit

El checklist del segundo prompt tiene tres instrucciones peligrosas: `git commit --no-verify`, `git add -A` y empujar directamente a `main` en dos remotos. El 3 de noviembre se añadió `check-staged-secrets.mjs` al pre-commit precisamente porque el historial público tenía contraseñas; `--no-verify` lo desactiva. Si Husky falla, se arregla Husky.

Otras correcciones: rutas relativas en vez de `/mnt/d/Projects/Wallet Human Polymarket ID`; Node 22 (el `package.json` exige `>=22.22.2`, no Node 20); en Node 22.12 o posterior `--experimental-require-module` ya no hace falta.

```bash
# Desde la raiz del repo (en Windows, los pasos de nargo dentro de WSL con la misma ruta relativa)

# 1. Circuitos: tipos, tests y artefactos al dia
for c in escrow identity streams; do (cd circuits/$c && nargo check && nargo test && nargo compile); done
git diff --exit-code -- circuits/*/target/*.json   # el bytecode commiteado es el compilado (si file_map trae rutas absolutas, comparar solo bytecode)
node scripts/zk/check-artifacts.mjs               # nuevo (R-02): VK de bb.js == target/vk == hash fijado

# 2. Contratos aztec-nr (cuando existan, R-08)
#    compilar y testear con la cadena de Aztec 6.0.0, no con nargo suelto

# 3. Calidad
npx tsc --noEmit
npx vitest run
npm run check:patterns && npm run check:chrome
node scripts/check-staged-secrets.mjs
npx next build

# 4. Publicar
git add <rutas concretas>        # nunca -A
git commit -m "feat(scope): que cambia y por que"
git push origin <rama>           # PR a main; se fusiona con la CI en verde
```

Cada informe del agente termina con la salida real de estos comandos (o con el comando que falló y por qué), nunca con un resumen de cifras.

## Mensaje para Alejo y Hazbobo

Enviarlo solo cuando la fase 0 (R-01 a R-06) esté en `main` y el commit citado sea ese. El mensaje del prompt no se debe enviar: afirma "brecha cerrada al 100 %", "VK reales" junto a JSON inventados y una verificación de "45 segundos" que empieza con `npm install` de un monorepo de miles de paquetes. Quien lo compruebe encontrará ZK-01 en el primer circuito que abra.

El mensaje nuevo reconoce el error sin dramatizarlo, ofrece lo que es verificable en dos comandos y pide criterio concreto, que es lo que una persona del ecosistema puede dar en pocos minutos.

```text
Hola Alejo, Hazbobo:

Os debo una corrección. El commit que os pasé (783df711) decía tener
circuitos Noir de producción y no compilaban. Lo he revisado a fondo y
os cuento dónde estamos de verdad, sin adornos.

Lo que se puede comprobar hoy (commit <hash de la fase 0>):
- Los 3 circuitos compilan con nargo 1.0.0:
    cd circuits/escrow && nargo test
- Monedero en testnet con Token y SponsoredFPC desde el navegador
  (shield, envío privado, unshield):
    npx tsx scripts/aztec-pxe-e2e.ts

Lo que hemos encontrado al revisarlos, y está documentado en el repo:
el circuito de streams no encadena estado (se puede cobrar el mismo
devengo varias veces) y ni escrow ni streams ligan la prueba a quien
cobra. Creemos que lo correcto no es parchearlos sino escribirlos como
contratos aztec-nr v6 con notas.

Dos preguntas concretas, por si tenéis cinco minutos:
1. Para un escrow con cobro antes del plazo y devolución después,
   ¿es razonable usar set_expiration_timestamp para el cobro y la
   marca de tiempo del bloque ancla como cota inferior de la devolución?
2. ¿Qué patrón recomendáis para que el contrato custodie el saldo en
   privado?

Si preferís verlo en una llamada de 15 minutos, me adapto.

Un abrazo,
Stefan
```

No se menciona Nyx, MLS ni la cifra de tests. Antes de enviarlo, ejecutar los dos comandos en un clon limpio y comprobar que el script de testnet funciona sin variables privadas (la clave del faucet es pública a propósito; el secreto de administración no debe hacer falta).

## Anexo A · Veredicto sobre los dos prompts originales

El avance de b30a3251 es real: los tres circuitos ya compilan con nargo 1.0.0 y producen bytecode ACIR y VK de Barretenberg auténticos. Pero de las 26 afirmaciones comprobables de los dos prompts, 7 se sostienen, 6 lo hacen a medias y 13 son falsas o engañosas.

| Afirmación del prompt | Qué dice el código en 097b51d5 | Estado |
| --- | --- | --- |
| Los 3 circuitos compilan con Noir 1.0.0 | `zk_*.json` declara `noir_version 1.0.0+275d3ab1`; las entradas `pub` están en el tipo | Cierto |
| 28 tests de nargo (7 + 8 + 13) | Hay 7 en escrow, 7 en identity y 13 en streams: 27, no 28. No se han ejecutado aquí | A medias |
| VK reales de bb 5.3.0, 3.680 bytes, con esos hashes | El SHA-256 de los tres ficheros `target/vk` coincide con los hashes del prompt | Cierto |
| "Adiós a los JSON hand-crafted" | El commit solo cambió la línea `vkHash` de los `*.vk.json`. El resto (`circuitSize: 1024`, `numPublicInputs: 4`, `qM`, `sigma1`…) es el contenido inventado de antes. La VK binaria dice 2^15 filas y 12 entradas públicas | Falso |
| `l1Anchoring: ACTIVE_REGISTERED` en los JSON | No hay registro desplegado; el propio prompt lo pone como GAP-03 | Falso |
| "VK Lifecycle Enforcer" garantiza la integridad | `lib/aztec/verifier.ts` hace SHA-256 del JSON inventado, no de la VK binaria. El test compara el hash local con un "registro" construido con ese mismo hash | Falso |
| `lib/zk/prover.ts` "en producción" | Usa `node:fs` y `node:crypto`; solo lo importan 4 ficheros de test. No puede correr en el navegador | Falso |
| `verifyProof` valida contra la VK canónica | Reconstruye la VK desde el bytecode que encuentre en disco; no compara con la VK fijada | Falso |
| `verifyProof` devuelve `false` ante bytes alterados | Tiene `try/catch` que devuelve `false` | Cierto |
| Validación del módulo BN254 antes de probar | Existe, pero acepta `number`, que pierde precisión por encima de 2^53 antes de llegar a `BigInt` | A medias |
| "Quantum-aware defense-in-depth" (cabecera de `prover.ts`) | Pedersen sobre BN254 no es poscuántico | Falso |
| Monedero PXE real en testnet (`lib/aztec/wallet/client.ts`) | `EmbeddedWallet`, `SponsoredFPC` y `Token` reales, cargados de forma dinámica | Cierto |
| Usa `@aztec/wallets/embedded` | Sí, pero `package.json` tiene a la vez `@aztec/*` nightly y `@aztec-labs/*` 6.0.0; el 23-oct se cambió a `@aztec-labs` porque las nightly no casan con la testnet | A medias |
| `zkMoney.ts` en modo demo | Confirmado: exige `NEXT_PUBLIC_ZK_MODE=demo` | Cierto |
| `realTx.ts` genera hashes keccak sintéticos | Confirmado. Lo importan `lib/provenance/qd-sequencer.ts` (usado por `/api/passport`), `lib/aztec/provenanceIndexer.ts` y `app/api/projects/[id]` | Cierto |
| `aztec-zk-engine.ts` es Aztec Connect de 2023 | Confirmado (`0xFF1F…0455`). Lo importa `components/portfolio/AztecPrivacyTerminal.tsx`: hay UI viva sobre él | Cierto |
| "MLS RFC 9420 completo" en `lib/crypto.ts` + `test/mls` | `lib/crypto.ts` es AES-GCM con clave maestra. `test/mls_post_compromise.test.ts` define su propio HKDF de juguete dentro del test y no importa nada de la app. El MLS real es el de XMTP (OpenMLS), no propio | Falso |
| EAF con tests de aislamiento adversarial | El test comprueba la CSP del iframe de apps de comunidad (`framePolicy`). Es real, pero es una CSP de sandbox, no un "framework" | A medias |
| Contratos L1 "auditados" | No hay auditoría externa (backlog H-037 y nota del 3-nov) | Falso |
| `HumanityTimeLockVault` ancla VK con timelock de 14 días | Es un vault de dead-man switch por usuario; no guarda VK | Falso |
| `ZKIdentityRegistry.sol` listo para desplegar (GAP-03) | La llamada al verificador está comentada: `verifyCredential` emite `CredentialVerified` con cualquier prueba | Falso |
| 362 rutas compilando a producción | Lo afirma el commit fd44c486; `next build` fallaba desde el 31-oct. No verificado aquí | A medias |
| 1.280 tests | El mensaje del commit dice 1.280 con 2 fallos preexistentes, no "todos en verde" | A medias |
| `PrivateWallet.ts` con `TokenContract` | No existe ningún fichero con ese nombre en el commit | Falso |
| "Error: Expected a pattern but found 'pub'" por "sintaxis antigua" | `pub nombre: Tipo` nunca fue sintaxis válida de Noir. No hubo cambio de versión: los circuitos no se habían compilado nunca | Engañoso |
| Los circuitos son "producción" y cierran la brecha "al 100 %" | Ver la sección siguiente: hay fallos de solidez en los tres | Falso |

## Anexo B · Nyx y cómo presentarse ante Aztec

La matriz "superioridad frente a Nyx" hay que eliminarla entera. Nyx es la cartera de Aztec Labs: [Cryptobriefing](https://cryptobriefing.com/aztec-labs-relaunches-zk-money-privacy-wallet/) la presenta como el lanzamiento de Aztec Labs junto al relanzamiento de zk.money, que [según KuCoin News](https://www.kucoin.com/news/flash/aztec-labs-relaunches-zk-money-after-3-year-hiatus-plans-mobile-and-defi-integration-in-q4) fue el 30 de septiembre de 2026, con nombres de usuario, pagos por enlace y app móvil prevista para el cuarto trimestre. Decirle a gente del ecosistema Aztec que eres superior a su propia cartera, con afirmaciones que no resisten un `git clone`, cierra la conversación.

Además, 5 de las 8 filas de esa matriz no se sostienen según el anexo A: MLS "nativo", contratos "auditados", VK con "verificación dinámica", circuitos "de producción" y amplitud por "362 rutas".

**Posicionamiento que sí se sostiene:** Humanity Ledger no compite con Nyx; es una aplicación de mensajería que usa Aztec para pagar dentro de la conversación. Lo que puede aportar al ecosistema es un caso de uso (pagos privados entre contactos de chat, escrow y streams entre personas que se conocen) y lo que necesita de Aztec es criterio técnico sobre cómo expresarlo bien. Esa es la petición honesta: consejo de diseño, no validación.

| Qué decir | Qué no decir |
| --- | --- |
| "Monedero en testnet con Token y SponsoredFPC, verificable con este script" | "Paridad técnica con Nyx" |
| "Mensajes directos sobre XMTP, que usa MLS" | "Protocolo MLS RFC 9420 completo propio" |
| "Tres circuitos Noir experimentales; buscamos el diseño correcto como contratos" | "3 Production Noir Circuits", "superioridad" |
| "Contratos Solidity sin auditar" | "Contratos L1 propios auditados" |

## Anexo C · Trazabilidad de los prompts originales

Cada sección de los dos prompts del 3 de noviembre está integrada aquí, corregida o descartada con su motivo. Nada se ha perdido sin decirlo. P1 es el "Master prompt Humanity Ledger × Aztec Protocol Foundation"; P2, el checklist por capas.

| Origen | Contenido | Dónde está ahora | Cómo quedó |
| --- | --- | --- | --- |
| P1, cabecera | Regla de oro de transparencia | Cómo usarlo, regla de verdad | Integrada y endurecida (vocabulario, comando por afirmación) |
| P1 §1 | Diagnóstico del incidente con Alejo (783df711 no compilaba) | Anexo A | Integrado. Corregido: no fue "sintaxis antigua"; tests 27, no 28 |
| P1 §1 | Cambios de 097b51d5 (ACIR, VK, prover, 16 tests E2E) | Anexo A y estado real | Integrado. VK reales; JSON y "producción" corregidos |
| P1 §2 | Matriz real / mock / stub | Estado real por componente | Rehecha: 15 componentes, vocabulario único |
| P1 §2 | Detalle de `client.ts`, `prover.ts`, `realTx.ts`, `aztec-zk-engine.ts` | Estado real; R-03, R-04 | Integrado con sus consumidores reales |
| P1 §3 | Matriz de superioridad frente a Nyx | Anexo B | Descartada: Nyx es de Aztec Labs y 5 de 8 filas no se sostienen |
| P1 §4.1 | `EscrowContract.nr` con `#[aztec]` | Arquitectura; R-08 | Reescrito para la API v6 y sin secreto compartido |
| P1 §4.2 | Identity a profundidad 32 con Pedersen | Arquitectura (identidad); R-10 | Sustituido por credencial como nota |
| P1 §5.1–5.2 | Menú contextual: activación, posición, estructura | Menú contextual | Integrado con Radix y tokens claros |
| P1 §5.1 | Vidrio oscuro, animación de resorte | Menú contextual | Sustituido por la regla visual del proyecto y movimiento reducido |
| P1 §5.3 | Copiar del búfer, detalles MLS, borrado en 60 s | Menú contextual | Corregido a lo que la app puede mostrar con verdad |
| P1 §6 | GAP-01 a GAP-12 | Plan por severidad, columna "Sustituye a" | Los 12 mapeados; GAP-03 descartado |
| P1 §7 | Mensaje a Alejo y Hazbobo | Mensaje | Reescrito; se envía tras la fase 0 |
| P2 §1A | Visibilidad `pub` en el tipo | Reglas Noir 1 | Integrada, con el matiz histórico |
| P2 §1B | Cero fuga en entradas públicas | Reglas Noir 2 | Ampliada: dirección de cobro y dominio públicos |
| P2 §1C | Límites BN254 y desbordamiento | Reglas Noir 4; reglas del probador 1 | Integrada; el error ya no incluye el valor |
| P2 §2A | Guarda contra pánicos de WASM | Reglas del probador 3; R-03 | Integrada y completada con la VK fijada |
| P2 §2B | Sin registrar testigos; `destroyZkEngine()` | Reglas del probador 5 | Integrada tal cual |
| P2 §3 | Separar circuitos puros de contratos | Reglas aztec-nr 6; arquitectura | Integrada; los circuitos quedan solo para CI |
| P2 §3 | `PrivateMutable<ValueNote>`, `encode_and_encrypt_note` | Arquitectura, "por qué el código del prompt no sirve" | Sustituido por `PrivateSet` y la entrega de v6 |
| P2 §4A | Radix para el menú | Menú contextual | Integrada; Radix también gestiona la pulsación larga |
| P2 §4B | Estética oscura y física de entrada | Menú contextual | Sustituida por tokens claros |
| P2 §4C | Privacidad en las acciones del menú | Menú contextual | Corregida (portapapeles, detalles reales) |
| P2 §5 | Checklist de 6 comandos | Bucle de verificación | Integrado con rutas relativas, Node 22 y comprobación de artefactos |
| P2 §5 | `--no-verify`, `git add -A`, push a `main` en dos remotos | Bucle de verificación | Descartado: desactiva el escaneo de secretos; rama y PR |

## Anexo D · Paquete de cierre de gaps (3 nov, noche)

Cada elemento del paquete "Production Gap Closure Package" quedó integrado en el repositorio; los que chocaban con el código se integraron corregidos.

| Elemento del paquete | Dónde está ahora | Cómo quedó |
| --- | --- | --- |
| `identity/src/main_v2_depth32.nr` (G3) | `circuits/identity_v2` | Corregido: el original quitaba las sanciones y dejaba `sanction_root` sin usar, sus tests estaban vacíos y el `should_fail` vacío habría fallado. Ahora: profundidad 32, lista comprometida, separación de dominio y 11 tests reales |
| `escrow/src/main_poseidon2.nr` (G5) | `circuits/escrow_v2` + `circuits/hl_lib` | Corregido: dependía de una librería no declarada y mantenía ZK-02 y ZK-03. Ahora: Poseidon2 sobre la permutación de la librería estándar, cobro del receptor, devolución, liquidación única; 13 tests |
| `streams/src/main_poseidon2.nr` (G5) | `circuits/streams_v2` | No venía en el paquete; escrito con el estado encadenado que corrige ZK-01; 8 tests |
| `lib/aztec/grumpkin_validation.ts` (G1) | `lib/aztec/grumpkin.ts` + monedero | No venía en el paquete; implementado con la ecuación real (y² = x³ − 17) y conectado a la validación de direcciones |
| `SANCTION_NON_MEMBERSHIP_DESIGN.md` (G2) | `docs/zk/SANCTION_NON_MEMBERSHIP.md` | Opción B implementada; el "timelock de 14 días existente" no existe y se corrige |
| `COMMUNITIES_MLS_MIGRATION.md` | `docs/communities/MLS_MIGRATION.md` (R-17) | Corregido: usa los grupos de XMTP que ya existen en `lib/xmtp/groups.ts`; la interfaz encrypt/decrypt del paquete no existe en el SDK |
| `DUAL_IMPLEMENTATION_CLARIFICATION.md` | `docs/zk/IMPLEMENTATIONS.md` | Corregido: `contracts/aztec/` no existe; la dualidad era una afirmación del dossier antiguo |
| `STATUS_UPDATE_SNIPPET.md` | `docs/STATUS.md` | Corregido: el fragmento declaraba G3 y G5 cerrados sin compilar. `STATUS.md` se reescribió y A2 pasa a "delegado en XMTP" |
| Checklist: `TRACEABILITY_MATRIX.md`, `VK_MONITORING.md`, `CONSTRAINT_COMPLETENESS.md`, dossier | Actualizados | La matriz pasa `check:traceability`; `VK_MONITORING.md` deja de describir un registro inexistente |
| G6 equivalencia Noir ↔ ACIR | CI "Noir circuits" | El ACIR commiteado se compara con una compilación nueva; la equivalencia formal sigue abierta |
| `additional_tests_and_helpers.ts` | — | No venía en el paquete |
| No-afirmaciones (auditoría, verificación formal, cuántica, tráfico, mainnet) | README, `STATUS.md` | Se mantienen como no-afirmaciones |
