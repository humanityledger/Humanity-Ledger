# No pertenencia a la lista de sanciones (gap G2)

**Estado:** opción B implementada en `circuits/identity_v2`. La opción A queda como evolución. Ninguna de las dos está desplegada.

## Problema en v1

`circuits/identity` comprueba `jurisdiction != 998` y `!= 999`. Son dos constantes en el circuito, no corresponden a ningún país (no existen en ISO 3166) y cambiar la lista exige recompilar y cambiar la VK. Además, la jurisdicción es un testigo que elige quien prueba; solo queda ligada si el emisor la puso en la hoja.

## Opciones

| Opción | Qué es | Tamaño | Estado |
|---|---|---|---|
| A · Árbol de Merkle disperso o indexado | La lista es un árbol; el circuito prueba no pertenencia con el camino del hueco o de los vecinos | Ilimitado | No implementada |
| B · Lista acotada comprometida | El circuito recibe la lista completa como testigo privado, comprueba que su hash es la raíz pública y que la jurisdicción no está en ella | 16 entradas (`SANCTION_SLOTS`) | **Implementada en `identity_v2`** |
| C · Híbrida | Núcleo fijo en el circuito y resto en una raíz | Mixto | Descartada: mantiene constantes en el circuito |

## Cómo funciona la opción B

1. La gobernanza publica la lista vigente, rellenada con ceros hasta 16 entradas, y su raíz `sanction_root = H(SEP_SANCTION_LIST, H(lista))`.
2. Quien prueba aporta la lista como testigo privado. El circuito comprueba que hashea a `sanction_root` y que `jurisdiction` no es ninguna entrada. `jurisdiction != 0` evita el relleno.
3. El verificador acepta solo la raíz vigente. Si la lista cambia, cambia la raíz; el circuito y su VK no.

Como la hoja liga la jurisdicción que puso el emisor, la comprobación sí tiene sentido en el circuito: la lista puede cambiar después de emitir la credencial.

## Gobierno de la raíz

El paquete de cierre de gaps proponía actualizar la raíz "con el timelock de 14 días existente". Ese timelock no existe: `HumanityTimeLockVault` es un vault de dead-man switch y no guarda raíces ni VK. Hace falta un registro con retardo antes de que la raíz cuente como gobernada. En Aztec, `DelayedPublicMutable` (retardo mínimo de 3.600 s en v6) es la pieza natural; ver `AZTEC_NR_V6_NOTES.md`.

## Tests

`circuits/identity_v2/src/main.nr`: jurisdicción sancionada falla, lista distinta de la raíz falla, jurisdicción distinta de la de la hoja falla, jurisdicción 0 falla.
