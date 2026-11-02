# Correcciones Técnicas para Diapositivas y Conferencias

> **Documento de Auditoría y Alineación Técnica**
> **Fecha:** Octubre 2026 | **Versión:** 2.0 (Post-Auditoría C1-C6, H1-H8, N01-N08)

---

## 1. UltraHonk (Aztec) vs Afirmaciones Antiguas
- **Afirmación anterior incorrecta:** "UltraHonk es un sistema de pruebas postcuántico que garantiza anonimato eterno contra computadoras cuánticas."
- **Realidad técnica comprobada:** UltraHonk (implementado en Barretenberg / Aztec) utiliza compromisos de polinomios KZG o IPA sobre la curva BN254. Su seguridad computacional depende de la dificultad del logaritmo discreto y emparejamientos bilineales en curvas elípticas clásicas. **No es postcuántico**.
- **Corrección en transparencias:** Explicar que UltraHonk proporciona pruebas de conocimiento cero altamente eficientes en cliente (WebAssembly / Web Workers), con verificación constante en Ethereum L1, pero su dureza criptográfica es clásica de 128 bits de seguridad.

---

## 2. Criptografía Postcuántica (ML-KEM y XMTP MLS)
- **Afirmación anterior incorrecta:** "Toda la mensajería es 100% postcuántica y resiste ataques cuánticos en todos sus niveles."
- **Realidad técnica comprobada:** XMTP v3 implementa Messaging Layer Security (MLS, RFC 9420). Las claves de bienvenida (Welcome messages) y el acuerdo inicial pueden encapsularse con ML-KEM (Kyber-768, FIPS 203), pero el intercambio de claves efímero y las firmas de identidad de cartera siguen empleando ECDSA (secp256k1) y Ed25519/X25519.
- **Corrección en transparencias:** Especificar con exactitud el modelo híbrido:
  1. Identidad: Clásica basada en ECDSA (Ethereum Wallet).
  2. Protocolo de Grupo: MLS híbrido (ML-KEM-768 para bienvenida postcuántica + doble trinquete clásico).
  3. Cero afirmaciones no fundamentadas sobre postcuántico generalizado.

---

## 3. Escala y Métricas de Rendimiento
- **Afirmación anterior incorrecta:** "Soporta 8.000 millones de humanos simultáneos en una arquitectura sin servidores."
- **Realidad técnica comprobada:** El límite real del cliente XMTP MLS actual es de ~400 miembros por grupo sin degradación. La infraestructura de Railway + PostgreSQL + Redis soporta hasta 50.000 conexiones concurrentes por réplica con PgBouncer y optimización SSE.
- **Corrección en transparencias:** Emplear la métrica real auditada:
  - Pruebas de estrés k6: p95 < 300ms a 50.000 clientes concurrentes.
  - Grupos privados: máximo 400 miembros por canal MLS.
