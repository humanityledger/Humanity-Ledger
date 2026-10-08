# HUMANITY LEDGER - PROTOCOL SPECIFICATION

## I. VISIÓN Y ARQUITECTURA FUNDACIONAL

**Objetivo Rector:**
Humanity Ledger es una infraestructura modular, composable, multi-cliente y privacy-first. Ledger Chat es el **primer cliente/producto** del ecosistema, no el propio protocolo. Toda decisión estructural debe permitir la creación de múltiples aplicaciones en el futuro (identidad, pagos, provenance, miniapps) sin necesidad de reescribir el core backend.

Esta especificación **tiene autoridad absoluta** sobre el README, la web, la documentación comercial y las decisiones tomadas por cualquier Agente de IA.

**Principio Maestro:**
> No construir ninguna nueva funcionalidad que obligue a rehacer Identity, Messaging, Privacy, Payments, Data o Settlement. Ledger Chat no es la aplicación alrededor de la cual se construye el protocolo, sino su primer consumidor de referencia.

### Capas del Protocolo
El sistema se divide estrictamente en las siguientes capas, operadas de manera independiente:
1. **Client Layer**: (Ej: Ledger Chat, Web, iOS, Android). Múltiples clientes concurrentes.
2. **Identity Layer**: `HumanityIdentity` canónica. SIWE es solo para bootstrap.
3. **Messaging Layer**: Off-chain, cifrado E2E, descentralizado (XMTP).
4. **Privacy Layer**: ZK / Aztec PXE local. Privacidad ejecutada en el cliente.
5. **Execution Layer**: Off-chain por defecto, on-chain por necesidad.
6. **Settlement Layer**: Ethereum y Aztec para resoluciones que requieran consenso global.
7. **Storage Layer**: Object storage (CDN/S3) para attachments.
8. **Indexing Layer**: Indexadores reconstruibles (PostgreSQL / Redis), separados de la ejecución.
9. **Payments Layer**: Abstracción de tarifas (fee abstraction) y transferencias.
10. **Governance Layer**: Seguridad, observabilidad y control plane.

---

## II. LOS 15 PILARES ESTRATÉGICOS (P0 Priorities)

Antes de añadir más funcionalidades de capa de presentación, el desarrollo debe garantizar estos 15 puntos:

1. **Canonical HumanityIdentity**: Separar las claves de sesión (signing keys) de la identidad lógica.
2. **Separación de Chat y Blockchain**: Blockchain es solo para settlement. El chat usa XMTP.
3. **Eliminación de ZK Mocks de Producción**: Todo circuito simulado debe aislarse fuera de Mainnet.
4. **Rol de Aztec Definido**: Uso estricto de Aztec para estado privado y PXE en el cliente (no en el backend).
5. **Messaging Desacoplado**: Reutilización de XMTP u otra red E2E.
6. **E2E Encryption Verificable**: El servidor no tiene capacidad técnica para descifrar mensajes.
7. **Multi-device Identity**: Identidad independiente del dispositivo físico, con recuperación social.
8. **Object Storage + CDN**: Ningún blob multimedia en base de datos.
9. **Event-driven Backend**: Control plane y data plane separados.
10. **Queues + Workers + Backpressure**: Operaciones pesadas (proving, media) no bloquean requests interactivos.
11. **Multi-region Architecture**: Preparado para routing global.
12. **RPC/Provider Redundancy**: Fallbacks para infraestructura blockchain.
13. **Fee Abstraction**: Experiencia de usuario libre de fricción cripto (sin requerir balances on-chain para chatear).
14. **Security Invariants & Threat Model**: Auditoría continua de vectores de ataque.
15. **Unidad Documental**: Este documento rige sobre cualquier otro archivo del repositorio.

---

## III. IDENTIDAD Y PRIVACIDAD

- **Dispositivos y Rotación**: Las claves deben poder rotarse. Cada dispositivo tiene niveles de confianza (*Device Trust Levels*).
- **Aislamiento ZK**: Las operaciones privadas (PXE) suceden localmente. El backend no debe convertirse en custodio de secretos.
- **Minimización de Correlación**: Identificadores utilizados en una app no deben vincular directamente la actividad en otra sin permiso.

## IV. EJECUCIÓN Y DATA AVAILABILITY

- **Degradación Elegante**: Si falla Aztec o XMTP, los demás componentes deben resistir el fallo (circuit breakers, timeouts estrictos).
- **Agrupación de Operaciones**: *Batching*, *Idempotency Keys*, y tolerancia a desconexiones de red.
- **Sharding y Retención**: Diseño preparado para particionar por usuario o región. Reconstrucción de índices de base de datos desde la fuente de verdad.

## V. OBSERVABILIDAD Y ECONOMÍA

- **Tokenomics**: El chat básico debe ser *siempre gratuito*. Los tokens (como QD) y la abstracción de fees son para *settlement*, premium features o infraestructura corporativa.
- **Seguridad**: Mantenimiento de invariantes (nunca reusar nonce, nunca filtrar private key, nunca cruzar sesión revocada).
- **Post-Quantum Roadmap**: Consideración arquitectónica para protección *Harvest now, decrypt later*.

---

*Ledger Chat pondrá bajo presión esta arquitectura en 2026/2027. La verdadera medida del éxito de Humanity Ledger es que si Ledger Chat fuera sustituido, toda la infraestructura subyacente seguiría existiendo y sirviendo a nuevas aplicaciones (miniapps, provenance, finanzas, comunidades).*
