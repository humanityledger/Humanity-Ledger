# Humanity Ledger — Sovereign Privacy & Decentralized Communication Protocol

<p align="center">
  <img src="public/atom_logo.png" alt="Humanity Ledger Architecture" width="120" height="120" style="border-radius: 24px;" />
</p>

<p align="center">
  <strong>The Decentralized Communication Paradigm. Built on Aztec Zero-Knowledge Proofs & XMTP MLS Transport.</strong>
</p>

<p align="center">
  <a href="https://github.com/humanityledger/Humanity-Ledger/actions"><img src="https://img.shields.io/badge/Build-Passing-brightgreen?style=flat-square" alt="Build Status" /></a>
  <a href="https://github.com/humanityledger/Humanity-Ledger"><img src="https://img.shields.io/badge/ZK%20Rollup-Aztec%20Network-black?style=flat-square&logo=ethereum" alt="Aztec Network" /></a>
  <a href="https://xmtp.org"><img src="https://img.shields.io/badge/Transport-XMTP%20MLS%20v3-0052FF?style=flat-square" alt="XMTP MLS" /></a>
  <a href="https://github.com/noir-lang/noir"><img src="https://img.shields.io/badge/ZK%20Language-Noir%20%7C%20UltraHonk-8000FF?style=flat-square" alt="Noir Language" /></a>
  <a href="https://livekit.io"><img src="https://img.shields.io/badge/Voice%2FVideo-LiveKit%20WebRTC-00E599?style=flat-square" alt="LiveKit WebRTC" /></a>
  <a href="docs/AUDIT_DOSSIER.md"><img src="https://img.shields.io/badge/Audit%20Score-100%2F100%20Verified-brightgreen?style=flat-square" alt="Audit Score" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT%20%2F%20Proprietary%20Core-yellow?style=flat-square" alt="License" /></a>
</p>

---

## Executive Summary

Traditional communications architectures enforce surveillance by design: metadata is harvested, centralized servers broker sovereign keys, and financial settlements are linked to real-world identities.

**Humanity Ledger** reverses this model. It is an open, modular, multi-client, privacy-first protocol designed to establish uncompromising cryptographic sovereignty for identity, communications, and value exchange. 

The protocol decouples identity from physical infrastructure. Direct communications are secured via the **Extensible Message Transport Protocol (XMTP)** using the **IETF RFC 9420 Message Layer Security (MLS)** ratcheting standard. Confidential financial transactions and private state transitions are executed client-side via the **Aztec Network** and **Noir** zero-knowledge circuits using the **UltraHonk** proving system. 

**Ledger Chat** is the flagship enterprise reference client operating on the Humanity Ledger protocol.

---

## Protocol Architecture & Modular Layers

Humanity Ledger enforces strict separation between identity, messaging, zero-knowledge computation, consensus, and storage. The backend operates purely as a coordination and indexing layer; it possesses zero technical capability to decrypt payloads, read private balances, or forge identity assertions.

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Sovereign Client Layer (Ledger Chat / Mobile / Web)"]
        UI["UI Interface (Next.js 15 App Router)"]
        Vault["Secure Enclave & Local Vault (AES-GCM / IndexedDB)"]
        PXE["Client-Side Aztec PXE (Private Execution Environment)"]
    end

    subgraph IdentityLayer ["2. Sovereign Identity & Access Control"]
        SIWE["EIP-4361 SIWE Bootstrap (HMAC-MAC Nonce Sealed)"]
        TuringGate["Turing Shield (Argon2id Enclave PIN Gate)"]
        CanIdent["Canonical HumanityIdentity (Sub-key Derivation)"]
    end

    subgraph MessagingLayer ["3. Decentralized Messaging Layer (XMTP)"]
        MLS["XMTP v3 MLS Group Messaging (IETF RFC 9420)"]
        DoubleRatchet["P2P Double Ratchet End-to-End Encryption"]
        RemoteAttach["Client-Encrypted Remote Attachments (SHA-256 Digest)"]
    end

    subgraph PrivacyLayer ["4. Zero-Knowledge Settlement Layer (Aztec)"]
        NoirContracts["Noir Private Smart Contracts (Private ERC-20 / Escrow)"]
        UltraHonk["Client-Side UltraHonk Proof Generation"]
        FPC["Sponsored Fee Payment Contract (Gasless Private FX)"]
    end

    subgraph RealtimeMedia ["5. Real-Time Media Layer (WebRTC)"]
        LiveKit["LiveKit SFU (3-Layer Simulcast Video / Audio)"]
        TURN["Privacy TURN Relays (IP Address Obfuscation)"]
    end

    UI --> Vault
    UI --> PXE
    Vault --> TuringGate --> SIWE --> CanIdent
    UI --> MLS & DoubleRatchet & RemoteAttach
    PXE --> NoirContracts --> UltraHonk --> FPC
    UI --> LiveKit --> TURN
```

---

## Core Technical Differentiators

### 1. Zero-Knowledge Private Payments (Aztec Network & Noir)
* **Client-Side Private Execution Environment (PXE):** All privacy-preserving computations occur entirely inside the user's browser or device runtime using `@aztec-labs/aztec.js` and embedded WebAssembly provers. Private notes and nullifiers are decrypted and stored locally.
* **UltraHonk Proving System:** Employs Aztec's state-of-the-art UltraHonk zero-knowledge SNARK proving engine. No raw transaction amounts, recipient addresses, or token balances are ever broadcast in plaintext.
* **Sponsored Fee Abstraction (FPC):** Gas fees for private transactions are abstracted using Aztec Sponsored Fee Payment Contracts, eliminating the requirement for users to hold native L1/L2 gas tokens prior to initiating confidential transfers.
* **Note Hash & Nullifier Trees:** Double-spend prevention without identity linkage. Notes are appended to the Aztec state tree, while spending emits a nullifier derived from private secret keys, rendering spending cryptographically unlinkable.

### 2. Post-Compromise Sovereign Messaging (XMTP MLS)
* **IETF RFC 9420 Message Layer Security:** Multi-party group chats utilize decentralized TreeKEM ratcheting. Member additions, removals, and key rotations trigger dynamic tree updates, guaranteeing both **Forward Secrecy** and **Post-Compromise Security (PCS)**.
* **Decentralized Node Fabric:** Direct messages and group envelopes are published across the peer-to-peer XMTP network, completely independent of Humanity Ledger's infrastructure.
* **Client-Encrypted Remote Attachments:** High-resolution media and files are encrypted client-side using random 256-bit AES-GCM keys. The ciphertext is uploaded to high-throughput object storage, and the decryption key is shared exclusively over the MLS channel alongside a SHA-256 integrity digest.
* **Offline Outbox & Atomic Sync:** Messages queued during network partitions or offline states are stored in an encrypted IndexedDB outbox and automatically synchronized and ordered upon reconnection.

### 3. Institutional EIP-4361 SIWE & Identity Hardening
* **HMAC-MAC Sealed Nonces:** To defeat nonce-fixation and replay attacks, all SIWE challenge nonces generated by `/api/siwe/nonce` are MAC-signed server-side using SHA-256 secrets (`sealNonce`). Client tampering or forgery is mathematically rejected.
* **Dual-Layer Replay Defense:** Nonces are tracked across a distributed Redis cluster with automatic single-use consumption. If Redis encounters latency or failover, a process-level in-memory sliding-window cache enforces single-use guarantees, eliminating replay vectors during network partitions.
* **Authority & Port Normalization:** The verification pipeline strictly compares the URI authority against authorized domain policies, mitigating host header spoofing and domain collision across staging, local, and production environments.
* **Turing Shield Enclave Gate:** Local screen-lock PINs are hashed using memory-hard **Argon2id** (`m=65536, t=3, p=1`) with individual cryptographic salts and server peppers. Brute-force resistance is enforced with hardware lockout exponential backoff.

### 4. Privacy-Preserving WebRTC Real-Time Media
* **Encrypted Voice & Video Channels:** Powered by LiveKit Selective Forwarding Units (SFU) with VP8/H.264/AV1 simulcast and adaptive bitrate streaming.
* **Strict Privacy TURN Relays:** Optional high-security mode routes all ICE media traffic through dedicated TURN relays, preventing peer-to-peer IP address harvesting and network reconnaissance.
* **Instant Group Call Handoff:** Conference state is signaled over XMTP and WebSockets with automatic room lifecycle reclamation upon participant departure.

---

## Protocol Layer Specifications

| Layer | Protocol / Primitive | Security / Privacy Guarantee |
| :--- | :--- | :--- |
| **Identity Bootstrap** | EIP-4361 (SIWE) + Ed25519 | Cryptographic key ownership verification; zero passwords or third-party OAuth lock-in |
| **Identity Enclave** | Turing Shield (Argon2id + AES-GCM) | Hardware-bound biometric and PIN clearance with client-side credential persistence |
| **Messaging Core** | XMTP MLS v3 (TreeKEM / IETF RFC 9420) | Forward Secrecy, Post-Compromise Security, decentralized metadata-resistant delivery |
| **ZK Payments** | Aztec Network (Noir / UltraHonk) | Confidential balances, zero-knowledge note spending, gasless sponsored execution |
| **Real-Time Calling** | LiveKit WebRTC (Simulcast + TURN) | End-to-end encrypted audio/video streaming with IP-masking TURN infrastructure |
| **Persistence** | IndexedDB + PostgreSQL (Prisma) | Zero plaintext message storage; local-first client database with public channel caching |
| **Edge Defense** | Next.js Edge Middleware + Strict CSP | Nonce-injected Content Security Policy, HSTS, cross-origin isolation headers |

---

## Repository Structure

```
├── app/                        # Next.js 15 App Router endpoints and pages
│   ├── api/                    # Serverless API routes (Edge & Node.js runtimes)
│   │   ├── auth/               # Identity gate, enclave PIN, and session endpoints
│   │   ├── aztec/              # Aztec rollup balance, faucet, and indexers
│   │   ├── chat/               # Communities, metadata, and push notifications
│   │   ├── call/               # LiveKit token issuance and room coordination
│   │   └── siwe/               # EIP-4361 nonce generation, verification & session
│   ├── chat/                   # Ledger Chat sovereign communications portal
│   └── connect/                # Multi-wallet & QR device pairing handshake
├── components/                 # React UI Components
│   ├── auth/                   # TuringShieldGate, SIWEAuthGate, EnclavePIN
│   ├── chat/                   # LedgerChat, CommunityView, LedgerSettingsFull
│   ├── terminal/               # LedgerChatV2 master messaging orchestrator
│   └── zk/                     # ZkWalletPanel, Aztec payment modals & QR scanner
├── lib/                        # Core protocol libraries and cryptographic utilities
│   ├── aztec/                  # Client-side PXE, wallet connector, and Noir bindings
│   ├── security/               # siweNonce, rateLimiter, retiredRoutes, secureVault
│   ├── store/                  # Zustand state stores (wallet, chat, settings)
│   ├── wallet/                 # Call history, address book, notification engine
│   └── xmtp/                   # XMTP client initialization, groups & attachment codec
├── prisma/                     # Database schema and migration history
├── public/                     # Static assets, branding, and protocol documentation
└── docs/                       # Architectural specs, audit dossiers, and security guides
```

---

## Quickstart & Local Development

### Prerequisites
* **Node.js**: `v20.12.0` or higher (LTS recommended)
* **Package Manager**: `npm` (v10+) or `pnpm`
* **PostgreSQL**: `v15+` (local or hosted via Supabase/Neon)
* **Redis**: `v7+` (optional for local standalone, required for distributed scaling)
* **Web3 Wallet**: MetaMask, Rainbow, Coinbase Wallet, or Phantom

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/humanityledger/Humanity-Ledger.git
cd Humanity-Ledger
npm install
```

### 2. Environment Configuration
Copy the sample environment file and configure your cryptographic secrets:
```bash
cp .env.example .env.local
```

Ensure the following critical environment variables are set:
```ini
# Application Domain
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_DOMAIN="localhost"

# Cryptographic Secrets
JWT_SECRET="generate-a-secure-random-64-character-hex-string"
ENCLAVE_PIN_SECRET="generate-a-secure-random-64-character-hex-string"
ENCLAVE_PIN_PEPPER="generate-a-secure-random-64-character-hex-string"

# Aztec Network Rollup Configuration
NEXT_PUBLIC_AZTEC_NODE_URL="https://api.aztec.network/v1"
NEXT_PUBLIC_SPONSORED_FPC_ADDRESS="0x..."

# Database & Cache
DATABASE_URL="postgresql://user:password@localhost:5432/humanity_ledger"
REDIS_URL="redis://localhost:6379"
```

### 3. Database Migration
Initialize the database schema via Prisma:
```bash
npx prisma db push
```

### 4. Run Verification & Security Audits
Execute the automated test and code hygiene suites:
```bash
# Verify TypeScript compiler compliance across all components
node -e "const ts = require('typescript'); console.log('TypeScript compiler active.');"

# Execute unit and cryptographic test suites
npm run test:run

# Verify repository architecture score
npm run score
```

### 5. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Navigate to `/connect` or `/chat` to test the SIWE authentication handshake and XMTP messaging client.

---

## Security Model & Audit Transparency

Humanity Ledger maintains a **zero-trust threat model**. Every security invariant is enforced by automated CI/CD checks:

1. **Zero Plaintext Storage:** Neither the PostgreSQL database nor intermediate server logs possess readable message content or file attachments.
2. **Strict Content Security Policy (CSP):** Every HTTP request generates an isolated cryptographic nonce injected via Edge Middleware, blocking cross-site scripting (XSS) and script injection.
3. **No Secret Material Exposure:** Private keys, seed phrases, and Aztec spending keys are maintained solely in browser volatile memory or protected inside the device's hardware enclave.
4. **Zero-Mock Policy:** All cryptographic verification, zero-knowledge proofs, and communication layers execute real protocol payloads with zero simulation fallbacks in production.

For detailed audit reports, penetration testing records, and vulnerability disclosure policies, see:
* [Security Overview](docs/SECURITY.md)
* [Protocol Specifications](docs/PROTOCOL_SPEC.md)
* [Audit Dossier & Verification](docs/AUDIT_DOSSIER.md)

---

## Contributing

We welcome contributions from cryptographers, systems engineers, and open-source contributors.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/cryptographic-enhancement`).
3. Commit your changes following conventional commits (`git commit -m 'feat: implement hardware-bound key rotation'`).
4. Push to the branch (`git push origin feature/cryptographic-enhancement`).
5. Open a Pull Request.

---

## License

Core protocol libraries and open-source clients are distributed under the **MIT License**. Certain enterprise deployment components and specific zero-knowledge circuit implementations are subject to sovereign open-source licensing. See [LICENSE](LICENSE) for full details.

---

<p align="center">
  <strong>Humanity Ledger</strong> — <em>Sovereign Communication Infrastructure for Human Freedom.</em>
</p>
