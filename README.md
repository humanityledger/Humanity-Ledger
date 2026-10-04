# Humanity Ledger

The **Humanity Ledger** is a next-generation, privacy-first decentralized communication and identity ecosystem. Built upon the principles of cryptographic sovereignty and zero-knowledge architecture, it provides an uncompromisingly secure platform for messaging, WebRTC calling, and asset providence.

![Status](https://img.shields.io/badge/Status-Beta-purple)
![License](https://img.shields.io/badge/License-MIT-blue)
![Network](https://img.shields.io/badge/Network-Ethereum%20%7C%20Aztec%20%7C%20XMTP-lightgrey)

## Table of Contents
- [Abstract](#abstract)
- [Core Technologies](#core-technologies)
- [Key Features](#key-features)
  - [Ledger Chat](#ledger-chat)
  - [Sovereign Identity](#sovereign-identity)
  - [Quantum Dots (QDs)](#quantum-dots-qds)
- [Architecture & Security](#architecture--security)
- [Getting Started](#getting-started)
- [Legal & Privacy](#legal--privacy)

## Abstract
Traditional communication platforms harvest data and metadata, compromising user sovereignty. The Humanity Ledger reverses this paradigm. By decoupling the interface from centralized backend servers, users interact directly with decentralized protocols. Your identity is secured by smart contracts, and your communications are shielded by military-grade end-to-end encryption. The protocol is engineered with a quantum-ready mindset, establishing a resilient network capable of withstanding the privacy threats of tomorrow.

## Core Technologies
The Humanity Ledger is powered by a robust stack of decentralized protocols and modern Web frameworks:

* **Next.js 15 (App Router):** High-performance, edge-ready React framework for the interface.
* **XMTP (Extensible Message Transport Protocol):** The decentralized network for secure, end-to-end encrypted (E2EE) messaging.
* **Aztec Network:** A privacy-first L2 zk-Rollup (simulated in beta) providing sovereign identity and confidential state execution via Noir circuits.
* **WebRTC & PeerJS:** True peer-to-peer audio and video calling, negotiated securely over the E2EE XMTP signaling layer.
* **Wagmi / viem:** Seamless, type-safe Ethereum wallet integration.

## Key Features

### Ledger Chat
Ledger Chat is our flagship communication application. It offers Telegram-parity features entirely over a decentralized network:
- **E2EE Text Messaging:** All messages are encrypted locally; servers only route ciphertext.
- **P2P Audio & Video Calls:** WebRTC connections bypass central media servers. The signaling (call offers and answers) is tunneled through XMTP, ensuring perfect forward secrecy even for the connection metadata.
- **Burn-on-Read & Timers:** Self-destructing messages enforced at the client level.
- **Encrypted File Sharing:** Share documents and media safely over the P2P network.
- **Polls & Reactions:** Interactive components synced cryptographically across peers.
- **Offline Queuing:** A secure fallback mechanism ensures messages sent to offline peers are delivered securely once they reconnect.

### Sovereign Identity
Your identity on the Humanity Ledger is tied to your cryptographic keypair, not an email address or a phone number. 
- Connect seamlessly with MetaMask, WalletConnect, or any EVM-compatible wallet.
- Generate an Aztec-compatible zero-knowledge identity for private interactions.
- Address book and contact data are encrypted and synced locally, never uploaded in plain text.

### Quantum Dots (QDs)
QDs are the native utility resource of the Humanity Ledger ecosystem.
- Earn QDs through ecosystem participation and daily claims.
- QDs are utilized as a spam-prevention mechanism (micro-deductions for network operations).
- Send and receive QDs peer-to-peer instantly within Ledger Chat.

## Architecture & Security
**Zero-Knowledge by Design:** The Humanity Ledger interface cannot decrypt your messages. There is no centralized database holding your active chat logs. 
- **Strict Content Security Policy (CSP):** The application utilizes a hardened `middleware.ts` to block unauthorized scripts and enforce strict cross-origin policies.
- **Local Persistence:** Chat histories are stored securely in your browser's IndexedDB. If you disconnect your wallet or clear your cache, your local copy is wiped.
- **Decentralized Signaling:** Unlike typical WebRTC apps that use vulnerable WebSockets for signaling, Ledger Chat routes all WebRTC connection data through encrypted XMTP messages.

For legal disclaimers, liability terms, and an extensive overview of our privacy model, please read the [Legal & Terms of Service](docs/LEGAL_AND_TERMS.md).

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm or npm
- An EVM-compatible Web3 wallet (e.g., MetaMask)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/humanityledger/Humanity-Ledger.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Environment Configuration:
   Copy `.env.example` to `.env.local` and configure the required RPC endpoints and NextAuth secrets.
   
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Legal & Privacy
The software is provided **"AS IS"**. Humanity Ledger is a non-custodial, decentralized tool. You are responsible for your own keys, compliance with local laws, and managing the risks associated with experimental cryptographic technologies. 

Please read the full [Legal Disclaimer & Terms of Service](docs/LEGAL_AND_TERMS.md) before using the platform.

---
*Built for the future. Secured by cryptography.*
