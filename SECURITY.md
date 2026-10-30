# SECURITY POLICY & THREAT MODEL (HUMANITY LEDGER)

> **Specification Standard**: HL-SEC-2026.4 (Institutional Production Audit)  
> **Classification**: Public Cryptographic Protocol Specification  
> **Target Audience**: Security Researchers, Protocol Auditors, Aztec Network Core Team, Institutional Partners  
> **Security Contact**: `security@humanityledger.com` (SLA: Initial response within 24 hours)

---

## 1. Executive Summary & Architectural Philosophy

Humanity Ledger is engineered under a **Zero-Trust, Zero-Simulation, Zero-Custody** architectural paradigm. We operate under the explicit assumption that any external infrastructure component—including cloud hosting providers, databases, relayers, public RPC nodes, and third-party API dependencies—can be actively monitored, compromised, or adversarial.

Our security envelope guarantees that even in the catastrophic event of a total database leak or Edge server compromise, **user funds cannot be stolen, private Zero-Knowledge proofs cannot be forged, and private communications cannot be decrypted in plaintext**.

---

## 2. Inviolable Cryptographic Invariants

The following six invariants are mathematically enforced and validated across our CI/CD pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CORE CRYPTOGRAPHIC INVARIANTS                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Zero Custodial Key Exposure                                              │
│    Private keys, mnemonic seeds, and Aztec viewing keys NEVER leave the     │
│    client runtime. No server endpoint receives, logs, or processes raw keys │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Strict Replay Immunity & Nonce Consumption                               │
│    Every state-mutating operation consumes a cryptographically secure,      │
│    single-use nonce with Redis TTL and SHA-256 idempotency validation.     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Edge-Enforced Identity Header Stripping (A-016)                           │
│    All client-supplied identity headers (e.g., x-wallet-address) are        │
│    unconditionally stripped at Edge middleware before verified injection.   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Constant-Time Verification Across All Sensitive Operations               │
│    Enclave PINs, HMAC signatures, and webhook tokens are verified via       │
│    crypto.timingSafeEqual to eliminate side-channel timing profiling.        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. Client-Side Zero-Knowledge Proving (PXE)                                │
│    UltraHonk proofs and Noir zk_escrow / zk_streams circuits execute        │
│    strictly inside browser Web Workers with COOP/COEP isolation.            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. Least Privilege & Sealed Egress for Community Sandboxes                  │
│    Untrusted user applications execute in sandboxed iframes governed by     │
│    connect-src 'none' and parent-mediated authenticated postMessage bridge. │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Threat Model & Adversarial Defense Matrix

Our threat model explicitly accounts for state-sponsored Advanced Persistent Threats (APTs, e.g., Lazarus Group), distributed flash-loan attack teams, and sophisticated supply-chain poisoners:

| Threat Vector | Adversary Profile | Architectural Defense in Humanity Ledger |
|---|---|---|
| **Private Key / Seed Extraction** | APT / Remote Code Execution | **Zero Custody**: Keys generated via WebCrypto API or Secure Enclave hardware; private materials are never transmitted across the wire. |
| **Session Forgery & Cookie Tampering** | Replay / Man-in-the-Middle | **Strict SIWE Nonce Binding**: EIP-4361 signed sessions verified with `jose` at Edge; `HttpOnly; Secure; SameSite=Strict` cookies. |
| **Side-Channel Timing Profiling** | Advanced Cryptanalyst | **Constant-Time Verification**: Argon2id Enclave PIN comparisons and API credentials hashed to SHA-256 before `timingSafeEqual`. |
| **Supply Chain Dependency Poisoning** | Malicious NPM Package Injection | **Strict Version Pinning**: Carets (`^`) removed from critical cryptographic dependencies; `engine-strict=true`; automated SLSA Level 3 CI provenance. |
| **UltraHonk Proof Serialization Exploit** | Aztec Protocol Adversary | **Barretenberg Native Verifier Isolation**: Updated to verified releases outside GHSA-73xc-j27q-wg75 vulnerable ranges; recursive pairing accumulator validation. |
| **Sybil Flooding & Distributed DoS** | Botnet / Proxy Farms | **On-Chain Identity Perimeter**: Edge rate-limiting (90 req/min per verified wallet) backed by Redis token buckets and proof-of-humanity verification. |
| **Metadata & IP Surveillance** | Network Snooping / ISP Eavesdropping | **TURN Relay Enforcement**: Audio/video streams routed via `iceTransportPolicy: 'relay'` to mask participant IP addresses; XMTP MLS end-to-end encryption. |

---

## 4. Security Boundary Map & Blast Radius Analysis

```
                              [ UNTRUSTED INTERNET ]
                                        │
                                        ▼
                  ┌──────────────────────────────────────────┐
                  │          EDGE MIDDLEWARE (EDGE)          │
                  │  - Strips client-injected identity headers │
                  │  - Enforces Strict CSP with Nonce (N-05)  │
                  │  - Verifies SIWE JWT signature (O(1))     │
                  │  - Blocks retired legacy routes (410)     │
                  └─────────────────────┬────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
    ┌───────────────────────────────┐       ┌───────────────────────────────┐
    │       NEXT.JS API BACKEND     │       │       CLIENT BROWSER (PXE)    │
    │  - Authenticated route logic  │       │  - Barretenberg WASM Prover   │
    │  - Rate-limit state (Redis)   │       │  - Secure Enclave PIN Storage │
    │  - Database indexing (Prisma) │       │  - XMTP MLS Decryption Key    │
    │  * NO PRIVATE USER KEYS HELD  │       │  * KEYS NEVER LEAVE DEVICE    │
    └───────────────┬───────────────┘       └───────────────┬───────────────┘
                    │                                       │
                    ▼                                       ▼
    ┌───────────────────────────────┐       ┌───────────────────────────────┐
    │    POSTGRESQL / NEO4J / REDIS │       │    AZTEC ROLLUP & ETHEREUM    │
    │  - Public ledger indices      │       │  - On-chain proof settlement  │
    │  - Sanitized audit trails     │       │  - Smart contract invariants  │
    │  * NO PLAINTEXT DM CONTENT    │       │  - Authwit witness signatures │
    └───────────────────────────────┘       └───────────────────────────────┘
```

### Blast Radius Analysis:
1. **API / Edge Server Compromise**: Attacker gains read-only access to public indices and temporary denial-of-service capability. **Cannot drain user wallets, cannot sign transactions, cannot decrypt user chats.**
2. **Database Compromise (PostgreSQL)**: Attacker obtains public profile data and transaction hashes. **Messages travel over XMTP MLS and are never stored unencrypted in the primary database.**
3. **Redis Compromise**: Attacker may reset transient rate limits. Cannot forge sessions, as session cryptographic verification relies on root secret key signatures with independent cryptographic bounds.
4. **Local Device Loss**: Mitigated by hardware Secure Enclave, WebAuthn cryptographic keys, and Argon2id PIN rate-limiting with progressive delay exponential backoffs.

---

## 5. Responsible Disclosure & Bug Bounty Program

We actively invite ethical whitehat researchers to probe and audit our contracts, circuits, and application runtime.

### Reporting Process:
- **Email**: `security@humanityledger.com`
- **PGP Key**: Submissions may be encrypted using our official protocol security public key.
- **SLA Commitments**:
  - **Initial Acknowledgment**: Within 24 hours.
  - **Severity Assessment & Triage**: Within 72 hours.
  - **Remediation & Patch Deployment**: Within 7 calendar days for High/Critical issues.

### Scope:
- Smart contracts (`/contracts`, Solidity & Aztec Noir circuits)
- Cryptographic implementations (`/lib/crypto`, `/lib/zk`)
- Authentication & Edge Perimeter (`middleware.ts`, `/app/api/auth`)
- XMTP integration & key delegation (`/lib/xmtp`)

### Safe Harbor:
Humanity Ledger will **never** pursue legal action against security researchers who:
1. Make a good faith effort to avoid privacy violations, destruction of data, and service interruption.
2. Provide us a reasonable period of time to resolve the issue before public disclosure.
3. Do not exploit vulnerabilities for extortion, financial gain, or unauthorized data retention.

---

## 6. Modelo de Amenazas e Invariantes (Resumen en Español)

El protocolo Humanity Ledger opera bajo un estándar institucional de no-custodia absoluta:
1. **Cero Custodia**: Los servidores nunca almacenan ni procesan claves privadas de usuarios, semillas de recuperación ni viewing keys de Aztec.
2. **Inmunidad contra Replay**: Todo cambio de estado requiere el consumo de un nonce único en Redis validado criptográficamente.
3. **Aislamiento en el Perímetro (A-016)**: El middleware perimetral elimina todas las cabeceras de identidad inyectadas por el cliente antes de procesar cualquier solicitud.
4. **Cifrado E2E sin Intermediarios**: La mensajería directa opera exclusivamente sobre el protocolo descentralizado XMTP con cifrado MLS.
5. **Verificación en Tiempo Constante**: Toda validación de PIN de enclave o secretos de API utiliza comparaciones de tiempo constante (`timingSafeEqual`) previniendo ataques de canal lateral (timing attacks).
