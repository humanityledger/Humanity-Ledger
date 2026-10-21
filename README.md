# Humanity Ledger: The Decentralized Communication Paradigm

The **Humanity Ledger** is a next-generation, privacy-first decentralized communication and identity ecosystem. Built upon the principles of cryptographic sovereignty and zero-knowledge architecture, it provides an uncompromisingly secure platform for messaging, WebRTC group calling, and Communities.

![Status](https://img.shields.io/badge/Status-Beta-yellow)
![License](https://img.shields.io/badge/License-Proprietary-red)
![Network](https://img.shields.io/badge/Network-Ethereum%20%7C%20XMTP%20%7C%20Aztec-lightgrey)
![Score](https://img.shields.io/badge/Audit%20Score-100%2F100-brightgreen)

> [!NOTE]
> **Production Status:** Ledger Chat is live in public beta with XMTP MLS end-to-end encrypted messaging. The Aztec ZK payment and escrow layer uses Aztec Account Abstraction with client-side PXE proving. See [docs/STATUS.md](docs/STATUS.md) and [docs/antigravity/BACKLOG.md](docs/antigravity/BACKLOG.md) for the complete 400-task audit verification.

## Table of Contents
- [Abstract](#abstract)
- [Core Technologies](#core-technologies)
- [Key Features](#key-features)
  - [Ledger Chat](#ledger-chat)
  - [Ledger Communities](#ledger-communities)
  - [Encrypted Group Calling](#encrypted-group-calling)
  - [Native Crypto & ZK Transport](#native-crypto--zk-transport)
- [Architecture & Security](#architecture--security)
- [Getting Started](#getting-started)
- [Verification & Audit](#verification--audit)
- [Legal & Privacy](#legal--privacy)

## Abstract
Traditional communication platforms harvest personal metadata, compromising user sovereignty, or rely on centralized servers. The Humanity Ledger reverses this paradigm. By decoupling the interface from centralized backend servers, users interact directly with decentralized protocols. Your identity is secured cryptographically, your communications are shielded by MLS end-to-end encryption via the XMTP network, and payments are settled with Zero-Knowledge privacy.

## Architectural Authority
The structural decisions, priorities, and roadmap for this project are governed by the [PROTOCOL_SPEC.md](./docs/PROTOCOL_SPEC.md) and [docs/architecture.md](./docs/architecture.md).

## Core Technologies
The Humanity Ledger is powered by a robust stack of decentralized protocols and modern frameworks:

* **Next.js 15 (App Router):** High-performance, edge-ready React framework with strict CSP and nonce per request.
* **XMTP (Extensible Message Transport Protocol):** Decentralized MLS protocol for secure, end-to-end encrypted messaging.
* **Aztec Network & Noir:** Zero-knowledge privacy layer for private asset transfers, escrow contracts, and client-side PXE execution.
* **LiveKit WebRTC:** Low-latency, multi-participant encrypted audio and video calling with simulcast and privacy TURN relays.
* **PostgreSQL / Prisma:** High-availability database for public Community topology and metadata with strict connection pooling.
* **Redis:** Sliding-window rate limiting, session rotation, and pub/sub Server-Sent Events broker.

## Key Features

### Ledger Chat
- **Zero-Knowledge Transport:** All direct messages are encrypted locally; servers only route ciphertext. 
- **MLS Group Messaging:** Multi-party chats secured by Message Layer Security with dynamic ratcheting.
- **Burn-on-Read & Timers:** Self-destructing and scheduled messages enforced at the client level.
- **Encrypted Remote Attachments:** Media and documents encrypted client-side via AES-GCM before object store upload.
- **Offline Outbox Queuing:** Resilient IndexedDB offline queue automatically flushes once network connectivity resumes.

### Ledger Communities
- **Freemium Architecture:** Create free public channels for onboarding, and token-gated or paid channels for exclusive content.
- **Moderation & Permissions:** Granular role-based access control (Owner, Admin, Moderator, Member) backed by cryptographic verification.
- **Real-Time SSE:** Scalable multi-replica Server-Sent Events without expensive periodic database polling.

### Encrypted Group Calling
- **E2EE LiveKit Engine:** Up to multi-party audio and video calling with 3-layer simulcast and active speaker detection.
- **Forced TURN Relay Mode:** Optional high-privacy toggle to relay all media through TURN servers, concealing client IP addresses.

### Native Crypto & ZK Transport
- **Direct P2P Settlements:** Send ETH, USDC, or USDT directly in conversation flows using Wagmi and Viem.
- **Aztec L2 Private Transfers:** Private balances and confidential transfers with client-side zero-knowledge proof generation.

## Architecture & Security
- **Strict Content Security Policy (CSP):** Unified CSP enforced in Edge Middleware with unique cryptographic nonce per request.
- **Session Protection:** Single `hl_session` HttpOnly cookie with rotating refresh tokens and automatic reuse detection.
- **Screen Lock PIN:** Scrypt-hashed 6-digit screen lock with per-user salt and pepper, protected by Redis rate limiting.
- **Zero Plaintext Storage:** Database stores zero message content for direct chats or private communities.

## Getting Started

### Prerequisites
- Node.js 20+
- npm or pnpm
- An EVM-compatible Web3 wallet (e.g., MetaMask, Rainbow, Coinbase Wallet)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/humanityledger/Humanity-Ledger.git
   cd Humanity-Ledger
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Environment Configuration:
   ```bash
   cp .env.example .env.local
   ```
4. Verify Security Patterns & Routes:
   ```bash
   npm run check:patterns
   npm run check:copy
   ```
5. Run the Audit Scoring Engine:
   ```bash
   npm run score
   ```
6. Start the development server:
   ```bash
   npm run dev
   ```
7. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Verification & Audit
Run the automated test and audit suite:
```bash
npm run test:run        # Unit, crypto, and security test suites
npm run score           # Recalculates backlog score (100/100)
```

## Legal & Privacy
The software is provided **"AS IS"**. Humanity Ledger is a non-custodial, decentralized tool. You are responsible for your own keys, compliance with local laws, and managing the risks associated with cryptographic technologies. See [docs/legal/privacy.md](docs/legal/privacy.md) and [docs/legal/terms.md](docs/legal/terms.md).

---
*Humanity Ledger — Sovereign Communication Infrastructure.*
