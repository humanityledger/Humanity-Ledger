# Humanity Ledger: The Decentralized Communication Paradigm

The **Humanity Ledger** is a next-generation, privacy-first decentralized communication and identity ecosystem. Built upon the principles of cryptographic sovereignty and zero-knowledge architecture, it provides an uncompromisingly secure platform for messaging, WebRTC calling, and Community building.

![Status](https://img.shields.io/badge/Status-Production-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![Network](https://img.shields.io/badge/Network-Ethereum%20%7C%20XMTP-lightgrey)

## Table of Contents
- [Abstract](#abstract)
- [Core Technologies](#core-technologies)
- [Key Features](#key-features)
  - [Ledger Chat](#ledger-chat)
  - [Ledger Communities](#ledger-communities)
  - [Native Crypto Transport](#native-crypto-transport)
- [Architecture & Security](#architecture--security)
- [Getting Started](#getting-started)
- [Legal & Privacy](#legal--privacy)

## Abstract
Traditional communication platforms (like Discord, Telegram, and Signal) harvest data and metadata, compromising user sovereignty, or rely on centralized infrastructure. The Humanity Ledger reverses this paradigm. By decoupling the interface from centralized backend servers, users interact directly with decentralized protocols. Your identity is secured by smart contracts, and your communications are shielded by military-grade end-to-end encryption via the XMTP network. 

## Core Technologies
The Humanity Ledger is powered by a robust stack of decentralized protocols and modern Web frameworks:

* **Next.js 15 (App Router):** High-performance, edge-ready React framework for the interface.
* **XMTP (Extensible Message Transport Protocol):** The decentralized network for secure, end-to-end encrypted (E2EE) messaging.
* **PostgreSQL / Prisma:** High-availability database for Community topology and metadata.
* **WebRTC & PeerJS:** True peer-to-peer audio and video calling, negotiated securely over the E2EE XMTP signaling layer.
* **Wagmi / viem v2:** Seamless, type-safe Ethereum wallet integration for native on-chain payments.

## Key Features

### Ledger Chat
Ledger Chat is our flagship communication application. It offers Telegram-parity features entirely over a decentralized network, designed with a massive, elegant, and immersive UI:
- **Zero-Knowledge Transport:** All messages are encrypted locally; servers only route ciphertext. 
- **P2P Audio & Video Calls:** WebRTC connections bypass central media servers. The signaling (call offers and answers) is tunneled through XMTP, ensuring perfect forward secrecy even for the connection metadata.
- **Burn-on-Read & Timers:** Self-destructing messages and scheduled messages enforced at the client level.
- **OpenStreetMap Live Location:** Real-time location sharing embedded directly into chat bubbles without relying on Google SDKs.
- **Encrypted Attachments:** Share documents, media, and dynamic stickers safely over the network.
- **Offline Queuing:** A secure fallback mechanism ensures messages sent to offline peers are delivered securely once they reconnect.

### Ledger Communities
A paradigm shift designed to challenge Discord and Telegram groups. Communities allow unprecedented flexibility and monetization:
- **Freemium Architecture:** Create free public channels for onboarding, and **token-gated or paid-entry channels** for exclusive content.
- **Rich Post Editor:** A fully immersive Markdown/Rich Text editor (Tiptap v2) for writing long-form announcements and community posts.
- **Pay-to-Enter:** Users can pay via native crypto to unlock specific areas of a community, bypassing centralized app store fees.
- **Massively Scalable:** Zero limits on member counts. Granular roles, robust admin dashboards, and dynamic channel structures.

### Native Crypto Transport
Ledger Chat integrates Web3 natively. There are no artificial tokens required to chat.
- **Free Messaging:** Chatting on the Humanity Ledger is 100% free.
- **Offline P2P Crypto:** Send USDC, USDT, or ETH directly to your peers within the chat interface using a beautifully designed transaction flow.
- **Zero Intermediaries:** Real on-chain settlements utilizing wagmi v2 `useSendTransaction` and `useWriteContract`.

## Architecture & Security
**Zero-Knowledge by Design:** The Humanity Ledger interface cannot decrypt your messages. There is no centralized database holding your active peer-to-peer chat logs. 
- **Decentralized Signaling:** Unlike typical WebRTC apps that use vulnerable WebSockets for signaling, Ledger Chat routes all WebRTC connection data through encrypted XMTP messages.
- **Local Persistence:** Chat histories are stored securely in your browser's IndexedDB. If you disconnect your wallet or clear your cache, your local copy is wiped.
- **Strict Content Security Policy (CSP):** The application utilizes a hardened `middleware.ts` to block unauthorized scripts and enforce strict cross-origin policies.

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
   Copy `.env.example` to `.env.local` and configure the required RPC endpoints, Database URIs, and NextAuth secrets.
   
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Legal & Privacy
The software is provided **"AS IS"**. Humanity Ledger is a non-custodial, decentralized tool. You are responsible for your own keys, compliance with local laws, and managing the risks associated with experimental cryptographic technologies. 

---
*Built for the future. Secured by cryptography.*
