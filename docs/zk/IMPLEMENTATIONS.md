# Qué implementación ZK es la canónica

**Respuesta corta:** hoy no hay ninguna en producción. Hay tres piezas, con estados distintos, y solo la primera tiene VK fijada.

| Pieza | Ruta | Estado | Papel |
|---|---|---|---|
| Circuitos v1 | `circuits/escrow`, `circuits/identity`, `circuits/streams` | Real en tests; VK fijadas en `lib/aztec/verifier.ts`; hallazgos ZK-01 a ZK-07 | Referencia histórica y pruebas de CI. No deben custodiar valor |
| Circuitos v2 | `circuits/*_v2`, `circuits/hl_lib` | Experimental; compilados y probados en CI | Corrigen ZK-01 a ZK-05 y G2, G3, G5 en el camino B |
| Contratos aztec-nr | `contracts/aztec/escrow`, `streams`, `identity` | Compilan con Aztec 6.0.0 en CI; corregidos tras la revisión `AZTEC_CONTRACTS_REVIEW.md`; sin tests TXE ni despliegue | Destino recomendado (camino A) |

## Corrección al paquete de cierre de gaps

El documento "Dual Implementation Clarification" del paquete del 3 de noviembre daba por hecho que `contracts/aztec/` existía con Poseidon2 y profundidad 32. Cuando se escribió, no existía. El commit `6c009e5a` (3 nov, 19:54) añadió esos contratos; su revisión encontró fallos que bloqueaban fondos (`AZTEC_CONTRACTS_REVIEW.md`), ya corregidos. La "dualidad" queda resuelta así: los contratos son el destino; los circuitos v1 y v2 son pruebas fuera de Aztec.

## Regla para cambiar la canónica

1. Una pieza pasa a canónica solo con: VK (o clase de contrato) fijada en código, tests que incluyan los ataques de los hallazgos ZK y el verificador o contrato que hace las comprobaciones de `V2_CIRCUITS.md`.
2. Cuando eso pase, la pieza anterior se archiva en el mismo PR y todos los documentos (`STATUS.md`, `TRACEABILITY_MATRIX.md`, el dossier, `CONSTRAINT_COMPLETENESS.md`) apuntan a la nueva.
3. Nunca se sustituye `circuits/<c>/src/main.nr` de v1 sin regenerar y fijar su VK en el mismo commit; la CI lo rechaza porque compara el ACIR commiteado con una compilación nueva.
