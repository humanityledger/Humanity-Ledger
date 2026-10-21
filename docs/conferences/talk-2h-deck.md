# Diapositivas Taller Técnico: 2 Horas
## Cero Conocimiento Práctico: Aztec Sandbox, Circuitos Noir y Verificación en Ethereum L1

---

### Bloque 1: Fundamentos de Cero Conocimiento y Aztec L2 (30 min)
1. **El Problema del Estado Privado:**
   - En Ethereum público, todo estado es visible. En zk-SNARKs estándar, el estado privado distribuido es un desafío computacional.
   - La solución de Aztec: Modelo UTXO de notas privadas cifradas con árboles de Merkle de notas y nullifiers.
2. **El Ciclo de Vida de una Nota Privada:**
   - Emisión: Se crea un compromiso de la nota y se inserta en el Note Hash Tree.
   - Consumo: Para gastar una nota, se publica su nullifier determinista sin revelar qué nota se gastó.
   - Prueba de pertenencia mediante testigos en el Private eXecution Environment (PXE).

---

### Bloque 2: Entorno Local (Aztec Sandbox) y Herramientas (30 min)
1. **Puesta en marcha del Sandbox:**
   ```bash
   aztec start --sandbox
   ```
2. **Anatomía del PXE del Cliente:**
   - Base de datos IndexedDB local donde residen las claves de desencriptado de notas (`GrumpkinScalar`).
   - El nodo Aztec de red solo recibe transacciones cifradas y pruebas UltraHonk compiladas con Barretenberg (Wasm).
3. **Inspección de Cuentas y Despliegue de Tokens:**
   - Cuentas Schnorr y firmas ECDSA.
   - Autorización de testigos (`AuthWitness`) para transacciones delegadas.

---

### Bloque 3: Anatomía de un Contrato en Noir (30 min)
1. **Estructura del Contrato `zk_escrow`:**
   - Funciones privadas vs. funciones públicas.
   - Declaración de notas personalizadas:
     ```rust
     struct EscrowNote {
         amount: Field,
         owner: AztecAddress,
         arbiter: AztecAddress,
         nonce: Field,
     }
     ```
2. **Pruebas de Unidad con TXE (Test Execution Environment):**
   - Ejecución de pruebas aisladas en CI sin requerir la red completa.

---

### Bloque 4: Demo en Vivo y Depuración de Errores Comunes (30 min)
1. **Transacción Privada Alice -> Bob:**
   - Paso 1: Alice genera la prueba local en el navegador (Web Worker).
   - Paso 2: Envío de la transacción al Sequencer.
   - Paso 3: Bob sincroniza su PXE, desencripta la nota entrante con su viewing key y actualiza su balance.
2. **Integración con la UI de Humanity Ledger:**
   - Componentes reactivos protegidos por `isZkEnabled`.
   - Eliminación de spinners falsos y tiempos de prueba simulados.
