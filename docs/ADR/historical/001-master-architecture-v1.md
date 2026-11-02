# Humanity Ledger 2.0: MASTER ARCHITECTURE (Historical Draft v1.0)

> [!NOTE]
> **HISTORICAL ARCHIVE ARTIFACT (14 August 2026)**: This document is preserved strictly for historical traceability.
> It reflects an early architectural draft that has been superseded by the normative protocol specification
> ([`docs/PROTOCOL_SPEC.md`](../../PROTOCOL_SPEC.md)). Terminology, informal design concepts, and legacy components
> described herein do not represent the current verified protocol invariants.

---

## 1. MACRO-ARCHITECTURE OVERVIEW (Historical)
Humanity Ledger is no longer just a portal; it is a **Hub & Spoke System Execution Environment**. It acts as a unified OS hosting sovereign Mini-Apps (LedgerChat, Portfolio, Markets, Studio Provenance). The central Hub provides Zero-Knowledge identity verification, while each Mini-App executes in its own isolated context.

### Topology Grid
```mermaid
graph TD
    subgraph EVM Base Layer
        Mem[Mempool Streams]
        Blk[Confirmed Blocks]
    end

    subgraph System Desktop Vault
        Daemon[SystemVault_RUN.bat]
        Wrk[Ledger Worker Nodes]
        Prisma[(PostgreSQL State)]
        Neo[(Neo4j Graph)]
        Redis[(Upstash PubSub)]
    end

    subgraph ZK Security Layer
        Cir[circomlibjs Circuits]
        Hnd[QR Handshake Protocol]
    end

    subgraph Private Aztec Layer
        Pxe[Private Execution Environment - PXE]
        Noir[Noir Circuits - Aztec.nr]
        Azt[Aztec Account Contracts - ECDSA]
        L2[Aztec L2 Shielded Pool]
    end

    subgraph User Devices
        Nxt[Next.js 15 Web/Desktop]
        Pwa[iOS/Android PWA Offline]
    end

    Mem -->|Alchemy gRPC| Wrk
    Blk -->|Alchemy gRPC| Wrk
    Wrk -->|Z-Score Eval| Neo
    Wrk --> Prisma
    Wrk -->|vitals.tx.new| Redis
    
    Redis --> Daemon
    Prisma --> Daemon
    Neo --> Daemon

    Daemon -->|Locally Hosted Hub| Cir
    Cir -->|Zero Knowledge Verified| Nxt
    Daemon -->|E2EE Tunnel| Hnd
    Hnd --> Pwa
    
    Nxt -->|aztec.js client-side proofs| Pxe
    Pwa -->|aztec.js client-side proofs| Pxe
    Pxe -->|ACIR Compilation| Noir
    Noir -->|UltraHonk Backend| L2
    L2 -->|Settlement| Azt
```

###  Public Entropy & Ephemeral Sync Layer
- **PostgreSQL - Prisma ORM (Public Entropy Indexer)**: Primary relational store acting strictly as an indexer for public L1/L2 data (EVM Thermodynamics). No private user state is stored here.
- **MongoDB - Mongoose**: Dynamic storage for Polymarket event data and complex market indices.
- **Redis / Upstash (Ephemeral State Sync)**:
  - **Zero-Crash Safeguard**: Implements a "Degraded Mode" mock client if `REDIS_URL` is unavailable.
  - **PubSub**: Facilitates real-time event broadcasting from workers to the WebSocket gateway.
  - **Caching**: 10-minute TTL on heavy Analytics Reports and portfolio snapshots.

### ️ Blockchain & Protocol Layer
- **Base & ETH RPCs**: Leveraging Alchemy, Infura, and official public nodes.
- **ResilientProvider**: Custom fail-over logic with circuit breakers across 4+ RPC endpoints for 100% uptime.
- **Identity IDKit**: ZK-SNARK based identity proofs for sybil-resistant human verification.
- **Moralis Deep Indexing**: High-speed retrieval of historical cross-chain transaction data.
- **Private Aztec Network**: The primary shielded execution layer (Aztec-native), utilizing private notes for anti-double-spend and zero-knowledge privacy out-of-the-box (private-by-default logic for chat, alerts, and portfolio balance).

###  Background Engine / Scanners (The Ledger Engine)
- **EVM Ledger Scanner**: Dedicated long-running process scanning mempools and new blocks for high-value movement.
- **BTC Mempool Scanner**: Real-time monitoring of Bitcoin unconfirmed transactions.
- **Telegram Alert Bot**: Automated notification delivery via dedicated worker.
- **Alchemy Monitoring**: Subscribes to `alchemy_pendingTransactions` for elite addresses (e.g., vitalik.eth).

---

##  2. CELESTIAL GATEWAY (Node.js + WebSockets)
**Technology:** Custom Node.js server (`server.ts`) wrapping Next.js 15.

- **Unified Hub:** Handles HTTP requests and WebSocket connections (`Socket.io`) on a single port (3000).
- **Resilience Standard:** Implements dynamic internal imports and mock-fallbacks to prevent startup crashes (ECONNREFUSED protection).
- **Socket Event Pipeline:**
  1. `AlchemyMonitor` detects mempool activity.
  2. Event published to Redis channel `vitals.tx.new`.
  3. WebSocket Hub broadcasts JSON payload to authenticated clients with **sub-100ms latency**.

---

##  3. THE INTELLIGENCE SERVICE (Deep Analytics)
**Technology:** `lib/blockchain/AnalyticsService.ts`

Generates "Pentagon-level" address profiles by merging Moralis deep-indexing with real-time Ethers.js data.

### Key Metrics Tracked:
- **Active Age & Streaks**: Precise calculation of wallet longevity and daily activity consistency.
- **365-Day Heatmaps**: Visual intensity mapping of on-chain interactions.
- **Elite Neighbors**: Net inflow/outflow analysis identifying top counterparty relationships.
- **dApp Sentiment**: Protocol-level volume tracking and interaction frequency.
- **AI Forensics**: Automated risk signaling and behavior profiling via GPT-powered analysis.

---

##  4. CLIENT TERMINAL (Frontend UX/UI)
**Technology:** Next.js 15 App Router + Tailwind CSS + Framer Motion.

### Aesthetics: "Legendary Level" Cyberpunk-Glassmorphism
- **LiquidPrismBackground**: Advanced WebGL-simulated shaders creating a premium, living interface depth.
- **PaperPortfolioView**: Real-time table rendering reacting instantly to `vitals.tx.new` socket events with smooth entry animations.
- **Data Fidelity**: Zero-polling architecture; the UI reflects the blockchain state the moment it hits the mempool.

---

## ️ 5. THE "LEGENDARY LEVEL" FIXES (Integrity Standard)
The architecture is fortified against critical failure vectors:

1. **OOM Immunity**: Node memory expanded to 8GB (`--max-old-space-size=8192`) for heavy AST parsing.
2. **Web3 Dependency Isolation**: Webpack configuration excludes mobile-native SDKs (`@react-native-async-storage`, `porto`) from browser bundles.
3. **Zero-Crash Redis**: The application detects Redis connection issues at boot and enters "Degraded Mode" rather than failing, ensuring the UI remains accessible even if the cache layer is down.
4. **RPC Circuit Breaker**: If an RPC endpoint (like Alchemy) returns 429 or 5xx, the system automatically rotates to the next healthy provider in the `ResilientProvider` pool.

**[System Status: LEGENDARY. Protocol Active.]**
