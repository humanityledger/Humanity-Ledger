# Qué implementación ZK es la canónica

**Respuesta corta:** hoy no hay ninguna en producción. Hay tres piezas, con estados distintos, y solo la primera tiene VK fijada.

| Pieza | Ruta | Estado | Papel |
|---|---|---|---|
| Circuitos v1 | `circuits/escrow`, `circuits/identity`, `circuits/streams` | Real en tests; VK fijadas en `lib/aztec/verifier.ts`; hallazgos ZK-01 a ZK-07 | Referencia histórica y pruebas de CI. No deben custodiar valor |
| Circuitos v2 | `circuits/*_v2`, `circuits/hl_lib` | Experimental; compilados y probados en CI | Corrigen ZK-01 a ZK-05 y G2, G3, G5 en el camino B |
| Contratos aztec-nr | (no existen todavía) | Plan R-08 a R-10 | Destino recomendado (camino A) |

## Corrección al paquete de cierre de gaps

El documento "Dual Implementation Clarification" del paquete del 3 de noviembre decía que había contratos Aztec en `contracts/aztec/` con Poseidon2 y un árbol de profundidad 32. Esa ruta no existe en el repositorio y no hay ningún crate de tipo `contract`. La afirmación venía de una versión anterior del dossier de Aztec, que ya se corrigió.

## Regla para cambiar la canónica

1. Una pieza pasa a canónica solo con: VK (o clase de contrato) fijada en código, tests que incluyan los ataques de los hallazgos ZK y el verificador o contrato que hace las comprobaciones de `V2_CIRCUITS.md`.
2. Cuando eso pase, la pieza anterior se archiva en el mismo PR y todos los documentos (`STATUS.md`, `TRACEABILITY_MATRIX.md`, el dossier, `CONSTRAINT_COMPLETENESS.md`) apuntan a la nueva.
3. Nunca se sustituye `circuits/<c>/src/main.nr` de v1 sin regenerar y fijar su VK en el mismo commit; la CI lo rechaza porque compara el ACIR commiteado con una compilación nueva.
