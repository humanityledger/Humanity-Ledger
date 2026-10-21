# Diapositivas Conferencia: 1 Hora (Lección Magistral)
## De la Simulación a la Producción: Auditoría y Remediación en Sistemas Web3 Soberanos

---

### Diapositiva 1: Portada
- **Título:** Construyendo Criptografía Soberana Sin Ficciones
- **Subtítulo:** Caso de Estudio: De 488 Rutas Vulnerables a Arquitectura End-to-End Verificada
- **Ponente:** Equipo de Arquitectura de Humanity Ledger
- **Logo:** Logotipo Auténtico de Humanity (Silueta del Mapa Mundi)

---

### Diapositiva 2: El Estado Inicial (La Ilusión del Frontend)
- Aplicaciones descentralizadas que aparentan seguridad en la UI pero dependen de APIs centralizadas inseguras.
- Hallazgo crítico: Cabeceras manipulables por el cliente (`x-wallet-address`, `x-web3-address`).
- Si el frontend firma pero el backend confía ciegamente en cabeceras HTTP, la criptografía se vuelve inútil.

---

### Diapositiva 3: Caso Real C1 (Suplantación de Identidad por Cabecera)
- **Antes:** Una petición `POST /api/chat/direct` leía `x-wallet-address` directamente del encabezado.
  ```http
  POST /api/chat/direct HTTP/1.1
  x-wallet-address: 0xVictimAddress...
  ```
- **Consecuencia:** Cualquier usuario con una sesión válida podía leer o escribir como cualquier otra cartera.
- **Remediación (A-001 / A-016):**
  - Eliminación absoluta de cabeceras de identidad del cliente en el middleware.
  - Implementación estricta de `requireWallet()`: la identidad solo emana de la cookie de sesión criptográfica `hl_session`.

---

### Diapositiva 4: Caso Real C2 (Almacenamiento en Claro de Mensajes Cifrados)
- **Antes:** `DirectMessage` guardaba el texto del mensaje en la base de datos PostgreSQL del servidor.
- **Consecuencia:** Vulnerabilidad directa a órdenes judiciales, fugas de base de datos y administradores maliciosos.
- **Remediación (C-002 / C-003):**
  - Erradicación de las tablas `DirectMessage` y `PendingChatMessage`.
  - Migración a XMTP v3: el servidor jamás almacena ni ve el texto en claro; entrega 100% E2EE.

---

### Diapositiva 5: Caso Real C5 (Simulación en Pagos y Balances en LocalStorage)
- **Antes:** Balances de Aztec ZK simulados mediante `Math.random()` y almacenados en `localStorage.getItem('ledger_zk_balance')`.
- **Consecuencia:** Cero rigor criptográfico, riesgo de fraude y desinformación al usuario.
- **Remediación (H-008 / I-017):**
  - Purga de claves `ledger_zk_*` en navegadores.
  - Consulta estricta mediante `TokenContract.balance_of_private(...).simulate()` a través del PXE del cliente.

---

### Diapositiva 6: Caso Real N0 (El Enclave Ficticio y Criptoanálisis de PIN)
- **Antes:** Comparaciones con `===` (ataque de timing), salt estático, secreto de respaldo quemado en código.
- **Remediación (A-010, A-014, B-020):**
  - Salt de 16 bytes criptográficos por usuario.
  - Hashing mediante Argon2id con pimienta en variable de entorno.
  - Comparación en tiempo constante (`crypto.timingSafeEqual`).
  - Redefinición honesta de producto: "Bloqueo de pantalla", sin reclamar enclaves de hardware inexistentes.

---

### Diapositiva 7: Resumen y Conclusiones
- Principio de No Confianza en el Cliente.
- Zero-Simulation Policy: Si no está en testnet/mainnet con pruebas reales, no se muestra como real.
- Repositorio abierto, código auditable, licenciamiento transparente.
