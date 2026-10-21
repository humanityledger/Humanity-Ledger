# Privacy Policy

**Last updated**: October 2025 | **Version**: 2.0

---

## 1. Who we are

Humanity Ledger ("we", "us") provides a privacy-preserving communication and payment platform. Our core product combines end-to-end encrypted messaging (via XMTP) with private payments (via Aztec Protocol).

**Contact**: [privacy@humanityledger.com](mailto:privacy@humanityledger.com)

---

## 2. What data we collect and why

### 2.1 Data you provide

| Data | Purpose | Legal basis | Retention |
|------|---------|-------------|-----------|
| Wallet address (Ethereum) | Identity in SIWE authentication | Contract performance | Until account deleted |
| Email address (optional) | Alternative login via OTP | Legitimate interest / consent | Until account deleted |
| PIN hash (Argon2id) | Screen lock for the app | Contract performance | Until PIN removed |
| Community posts (public communities) | Community content delivery | Legitimate interest | Until deleted or community disbanded |
| Profile display name, avatar URL | User profile | Consent | Until changed or deleted |

### 2.2 Data generated automatically

| Data | Purpose | Retention |
|------|---------|-----------|
| Session token (HttpOnly cookie `hl_session`) | Authentication | 15 min (access) / 30 days (refresh) |
| Redis rate-limit counters | Abuse prevention | 5–60 min TTL |
| SIWE nonces | Replay attack prevention | 10 min TTL |
| Server logs | Debugging, security | ≤ 30 days |
| Notification metadata | Push delivery (no message content) | Until delivered or 7 days |

### 2.3 What we do NOT store

- **Direct message content** — DMs travel exclusively over XMTP (end-to-end encrypted). We never see the plaintext. We do not store message history.
- **Private payment amounts or recipients** — Aztec ZK transfers are processed client-side. We store only the Aztec transaction hash.
- **Private community messages** — Private communities use XMTP MLS groups. Server holds no message content.
- **Your private keys** — Wallets, XMTP keys, and Aztec keys never leave your device.

---

## 3. How we use your data

- Authenticate your account (SIWE or email OTP)
- Deliver notifications (silent push — no message content in payload)
- Moderate public communities (human review of reported content)
- Protect against abuse (rate limiting, WAF)
- Comply with legal obligations (DSA, GDPR)

---

## 4. Third-party processors

| Processor | Purpose | Location | DPA |
|-----------|---------|----------|-----|
| Railway (Brex) | Hosting, PostgreSQL, Redis | US (US-East) | Required — see N-003 |
| LiveKit | Real-time calls (SFU/TURN) | US/EU | Required — see N-003 |
| XMTP Labs | Encrypted messaging network | US | Required — see N-003 |

---

## 5. Your rights (GDPR)

- **Access** (Art. 15): Request a copy of your data via `GET /api/user/export`
- **Erasure** (Art. 17): Delete your account at Settings → Delete Account (`/api/user/nuke`)
- **Portability** (Art. 20): Export your profile data via `GET /api/user/export`
- **Rectification** (Art. 16): Update profile data in Settings
- **Objection** (Art. 21): Contact [privacy@humanityledger.com](mailto:privacy@humanityledger.com)

**EEA residents** may also contact your national DPA.

---

## 6. Cookies

We use **one essential cookie** only:

| Cookie | Purpose | Duration |
|--------|---------|---------|
| `hl_session` | Authentication (HttpOnly, Secure, SameSite=Strict) | 30 days |

No advertising, analytics, or third-party cookies.

---

## 7. Data security

- Transport: TLS 1.3 enforced (HSTS preload)
- PIN hashing: Argon2id with per-user random salt and server-side pepper
- Session tokens: short-lived with rotation, reuse detection
- Infrastructure: Railway (encrypted volumes)

---

## 8. International transfers

Data is processed on Railway infrastructure in the US. Standard Contractual Clauses (SCCs) apply for EEA→US transfers. See `docs/legal/transfers.md`.

---

## 9. Changes

We will notify users by email or in-app notice of material changes at least 30 days in advance.
