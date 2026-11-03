# Circuitos v2 (experimentales)

Los circuitos v2 corrigen en los circuitos sueltos los hallazgos ZK-01 a ZK-05 y cierran los gaps G2, G3 y G5 de `circuits/CONSTRAINT_COMPLETENESS.md`. Viven en crates nuevos (`circuits/escrow_v2`, `circuits/identity_v2`, `circuits/streams_v2`, con la librería común `circuits/hl_lib`), así que los circuitos v1 y sus VK fijadas no cambian.

**Estado:** experimentales. Se compilan y se prueban con `nargo test` en la CI (workflow "Noir circuits"), que también deriva sus VK con Barretenberg y las compara con los hashes fijados en `scripts/zk/v2-vks.mjs`. Las VK no están commiteadas, no los usa la app y no hay verificador desplegado. El plan de largo plazo sigue siendo el camino A del prompt maestro: contratos aztec-nr (R-08 a R-10). Los v2 son el camino B, útil para pruebas rápidas y para un verificador fuera de Aztec.

## Resultado en CI (3 nov 2026, run 41713400769, nargo 1.0.0 y bb.js 5.3.0)

| Crate | Tests | Opcodes ACIR | VK SHA-256 (fijada en `scripts/zk/v2-vks.mjs`) | Cabecera VK |
|---|---|---|---|---|
| `hl_lib` | 4 | — | — | — |
| `escrow_v2` | 13 | 43 | `0xb020ec025e2429fd10b56112ffd8b78463931bf479704e8e4dfb51468a7edbf4` | 2^12 filas, 15 entradas públicas (7 + 8) |
| `identity_v2` | 11 | 198 | `0xa8a7a2ba4473803bdcb6c8bd160d95c3fde523510e766952e5563dfd52e96e06` | 2^13 filas, 12 entradas públicas (4 + 8) |
| `streams_v2` | 8 | 78 | `0x58197c394c2db92bf31e5cd3709d2109707362be7cf7bc248785f1afcb043694` | 2^12 filas, 15 entradas públicas (7 + 8) |

En la misma ejecución, los tres circuitos v1 pasaron sus 27 tests, su ACIR commiteado coincidió con una compilación nueva y sus VK re-derivadas coincidieron con las fijadas.

## Qué cambia frente a v1

| Hallazgo o gap | v1 | v2 |
|---|---|---|
| ZK-01 streams cobra varias veces | `withdrawn_amount` libre | Encadena estado: `old_state → new_state` |
| ZK-02 sin dirección de cobro | No se liga | `payout_address` y `domain` son entradas públicas |
| ZK-03 escrow con secreto del emisor | Cobra quien conoce `sender_secret` | El receptor cobra con su secreto; el emisor recupera tras el plazo |
| ZK-04 sin separación de dominio | Pedersen de 2 entradas para hoja y nulificador | Poseidon2 con un separador distinto por uso |
| ZK-05 anonimato 2 | Árbol de profundidad 1 | Profundidad 32 |
| ZK-06 tiempos | `deadline` público libre | `deadline` dentro del commitment del escrow; `current_*` lo comprueba el verificador |
| G1 clave como Field | `recipient_pubkey` sin comprobar | Las partes son hashes de clave (`key_of(secret)`); comprobación Grumpkin en cliente en `lib/aztec/grumpkin.ts` |
| G2 sanciones fijas | `!= 998`, `!= 999` | Lista comprometida por `sanction_root` público y no pertenencia |
| G3 profundidad | 1 | 32 |
| G4 desbordamiento | Tope de ritmo | Además, devengo en u128 |
| G5 hash | Pedersen | Poseidon2 (esponja de `noir-lang/poseidon` sobre la permutación de la librería estándar) |

## Lo que debe hacer el verificador

Un circuito solo prueba relaciones entre números. Estas comprobaciones las tiene que hacer quien verifica la prueba; sin ellas, los v2 no son seguros.

**Todos:**

1. `domain` = hash del identificador de cadena y de la dirección del contrato verificador. Rechazar cualquier otro valor.
2. `current_timestamp` / `current_time` dentro de una ventana corta alrededor de la hora del bloque.
3. Pagar a `payout_address` y a nadie más.

**Escrow v2:**

1. Al crear: guardar `escrow_commitment` e `amount` recibido.
2. Al liquidar: exigir que `escrow_commitment` exista, que `amount` coincida y que `settlement_nullifier` no se haya usado; marcarlo como usado. El mismo nulificador sirve para cobro y devolución, así que solo una de las dos ocurre.

**Streams v2:**

1. Al crear: guardar `stream_commitment` y el estado inicial `H(stream, 0, salt0)` que calcula el emisor. El receptor necesita `salt0` (se le entrega fuera de la cadena).
2. En cada retiro: exigir `old_state == estado guardado`; sustituirlo por `new_state`; pagar `claim_amount`.
3. Un conjunto de nulificadores no basta: hay que guardar el estado actual. Es lo que impide repetir ZK-01.

**Identity v2:**

1. `identity_root` debe ser una raíz publicada por el emisor de identidades.
2. `sanction_root` debe ser la raíz vigente de la lista de sanciones (ver `SANCTION_NON_MEMBERSHIP.md`).
3. Guardar `scoped_nullifier` por `scope` y rechazar repeticiones.

## Límites conocidos

- La esponja Poseidon2 replica la de `noir-lang/poseidon`, pero no se ha comparado con un vector de prueba de Aztec. La solidez no depende de ello; la interoperabilidad con hashes calculados por Aztec sí.
- La lista de sanciones admite 16 entradas. Más entradas exigen recompilar o pasar al árbol disperso (opción A).
- En streams no hay cancelación por el emisor.
- La jurisdicción de una hoja es la que puso el emisor de identidades. El circuito no prueba nada sobre la persona más allá de eso.
- No hay pruebas UltraHonk de extremo a extremo en TypeScript para v2 todavía; solo `nargo test` y la derivación de VK.

## Cómo comprobarlo

```bash
for c in hl_lib escrow_v2 identity_v2 streams_v2; do (cd circuits/$c && nargo test); done
```
