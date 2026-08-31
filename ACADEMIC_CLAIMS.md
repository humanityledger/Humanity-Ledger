# Protocol Status & Capability Matrix

This document provides a transparent overview of the Humanity Ledger architecture as of **August 2026**. It distinguishes between components running live in production versus those that are currently simulated.

## Architecture Status

| Component | Status | Implementation Details |
|-----------|--------|------------------------|
| **Ledger Chat** | **LIVE (BETA)** | End-to-end encrypted messaging via XMTP & WebRTC. |
| **Authentication** | **SIMULATED** | Currently uses SIWE via standard NextAuth/Web2 flow. True ZK authentication is planned. |
| **ZK Proving** | **SIMULATED** | Routes like `/api/zk/prove` currently use HMAC-SHA256 mock proofs. |
| **State Storage** | **WEB2** | Currently stored in a centralized PostgreSQL database. |
| **Aztec L2 / Noir**| **PLANNED** | Smart contracts and Noir circuits are actively being written but are **not connected** to this frontend. |
| **Portfolio Sync** | **LIVE** | Cross-chain portfolio reading via RPCs (e.g., Alchemy). |

We maintain this document to ensure academic, peer, and security reviewers have an accurate understanding of the system's current trust assumptions.
