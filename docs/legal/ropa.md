# Records of Processing Activities (ROPA)
# GDPR Article 30

**Controller**: Humanity Ledger  
**DPO Contact**: privacy@humanityledger.com  
**Last updated**: October 2025

---

## Processing Activities

### PA-001: User Authentication

| Field | Value |
|-------|-------|
| Purpose | Authenticate users via SIWE (wallet) or email OTP |
| Legal basis | Contract performance (Art. 6(1)(b)) |
| Data categories | Wallet address, email (optional), session token, IP address |
| Recipients | Internal only |
| Retention | Session: 30 days; email: until account deleted |
| Third-country transfers | None |
| Security measures | Argon2id PIN hashing, HttpOnly cookies, rate limiting, Redis nonces |

### PA-002: Direct Messaging

| Field | Value |
|-------|-------|
| Purpose | Enable end-to-end encrypted private messaging |
| Legal basis | Contract performance |
| Data categories | Wallet address (conversation key), message metadata (timestamp of delivery to XMTP network) |
| Note | **Message content never reaches our servers** — XMTP E2EE |
| Recipients | XMTP network (decentralized) |
| Retention | No message content stored |
| Third-country transfers | XMTP network (US-based) — SCC required |

### PA-003: Public Community Posts

| Field | Value |
|-------|-------|
| Purpose | Community discussion in public channels |
| Legal basis | Legitimate interest |
| Data categories | Post content (text), wallet address of author, timestamps |
| Recipients | Community members, moderators |
| Retention | Until deleted by user/moderator or community disbanded |
| Third-country transfers | Railway US — SCC required |

### PA-004: Private Payments (Aztec)

| Field | Value |
|-------|-------|
| Purpose | Private token transfers via Aztec ZK |
| Legal basis | Contract performance |
| Data categories | Aztec transaction hash only (amount/recipient is ZK-private) |
| Note | All ZK computation happens client-side — server stores only txHash |
| Recipients | Aztec network (public blockchain) |
| Retention | TxHash stored indefinitely (blockchain record) |

### PA-005: Push Notifications

| Field | Value |
|-------|-------|
| Purpose | Alert users to new messages/events without revealing content |
| Legal basis | Contract performance |
| Data categories | Device push token, notification type (no message content) |
| Recipients | Apple (APNs) / Google (FCM) |
| Retention | Until notification delivered or 7 days |
| Third-country transfers | Apple/Google US — SCC required |

### PA-006: Server Logs

| Field | Value |
|-------|-------|
| Purpose | Security, debugging, abuse detection |
| Legal basis | Legitimate interest |
| Data categories | IP address, request path, response code, timestamp |
| Note | Logs are redacted — no email, wallet address, or message content |
| Retention | ≤ 30 days |

### PA-007: Moderation

| Field | Value |
|-------|-------|
| Purpose | Enforce community guidelines (DSA obligations) |
| Legal basis | Legal obligation (DSA Art. 16) |
| Data categories | Reported content, reporter wallet address, timestamp |
| Retention | 3 years (DSA requirement) |
