# HUMANITY LEDGER - PROTOCOL SPECIFICATION (HISTORICAL ARCHIVE)
*Archived on October 31, 2026. This document is historical and non-normative. The single normative source of truth is `docs/PROTOCOL_SPEC.md`.*

---

## I. VISIÓN Y ARQUITECTURA FUNDACIONAL

**Objetivo Rector:**
Humanity Ledger es una infraestructura modular, composable, multi-cliente y privacy-first. Ledger Chat es el **primer cliente/producto** del ecosistema, no el propio protocolo. Toda decisión estructural debe permitir la creación de múltiples aplicaciones en el futuro (identidad, pagos, provenance, miniapps) sin necesidad de reescribir el core backend.

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

1. Canonical HumanityIdentity
2. Separación de Chat y Blockchain
3. Eliminación de ZK Mocks de Producción
4. Rol de Aztec Definido (PXE cliente)
5. Messaging Desacoplado (XMTP)
6. E2E Encryption Verificable
7. Multi-device Identity
8. Object Storage + CDN
9. Event-driven Backend
10. Queues + Workers + Backpressure
11. Multi-region Architecture
12. RPC/Provider Redundancy
13. Fee Abstraction
14. Security Invariants & Threat Model
15. Unidad Documental
