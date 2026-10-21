# Protocol: What Is and Isn't Private

> **Last updated**: October 2025  
> **Reviewed by**: Engineering team

---

## Summary

Humanity Ledger uses two distinct messaging architectures with different privacy properties.

---

## Direct Messages (DMs) — E2EE via XMTP

| Property | Value |
|----------|-------|
| Message content | **Private** — E2EE, server never sees it |
| Sender/recipient | **Private** — only parties to the conversation |
| Timing metadata | **Partially revealed** — XMTP network sees when a message is delivered |
| Message existence | **Revealed to XMTP nodes** — they route but cannot read |
| Key storage | **Client-side only** — in browser IndexedDB, encrypted |
| Post-quantum | XMTP MLS uses ML-KEM-768 for Welcome messages (post-quantum); other content uses X25519 (classical) |

### What XMTP Can See

XMTP nodes route ciphertext. They see:
- Timing of message sends
- Approximate payload sizes
- Installation IDs (pseudonymous)

They **cannot** see message content.

---

## Public Community Posts — Server-stored

| Property | Value |
|----------|-------|
| Message content | **Not private** — stored on our servers |
| Author | Wallet address (pseudonymous) |
| Visibility | All community members (for private communities), public (for public communities) |
| Encryption | **None for public communities** — the UI label says "Public — not encrypted" |

---

## Private Community Posts — E2EE via XMTP MLS

| Property | Value |
|----------|-------|
| Message content | **Private** — XMTP MLS group encryption |
| Group membership | Server-stored (who is a member) |
| Message content | Not on server |
| Key rotation | On member join/leave |

---

## Payments (Aztec ZK)

| Property | Value |
|----------|-------|
| Transfer amount | **Private** — ZK proof, not revealed on-chain |
| Recipient | **Private** — hidden in ZK proof |
| Transaction existence | **Public** — Aztec L2 records that a transfer happened |
| L1 bridge amount | **Public** — visible in L1 transaction |
| Metadata in chat | TxHash only (no amount or recipient in our DB) |

### Post-quantum status for payments

Aztec uses UltraHonk (Barretenberg) for ZK proofs — this is classical, not post-quantum. The security of the ZK proof relies on discrete log hardness (classical assumption). There is no post-quantum layer for Aztec ZK proofs in the current implementation.

---

## Calls (LiveKit)

| Property | Value |
|----------|-------|
| Call content | **Private** — LiveKit E2EE encrypts media frames |
| Who called whom | **Partially revealed** — LiveKit server sees room participants |
| Call duration | Revealed to LiveKit |
| IP addresses | Protected by TURN relay (optional setting) |

---

## Authentication

| Property | Value |
|----------|-------|
| Password/PIN | Never stored — Argon2id hash with random salt + server pepper |
| Session | Short-lived (15 min access token) |
| SIWE signature | Verified once, then discarded |
