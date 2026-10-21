# Humanity Ledger — Master Audit Dossier (January 2027 Certification)

## 1. Executive Summary
This dossier consolidates the complete cryptographic, architectural, and security posture of the **Humanity Ledger** platform in preparation for external independent certification in January 2027.

The platform provides sovereign, non-custodial messaging and Zero-Knowledge transactions, adhering strictly to:
- **Zero Knowledge Architecture**: Client-side proof generation and key management.
- **Zero Plaintext Persistence**: Server databases hold no unencrypted chat messages or private keys.
- **Defense in Depth**: Strict CSP nonce per request, Argon2id/scrypt PIN hashing, Redis-backed sliding-window rate limiters.

---

## 2. Cryptographic Systems & Protocols

### 2.1 Messaging Encryption (XMTP MLS)
- **Protocol**: Message Layer Security (MLS) protocol via XMTP.
- **Key Ratcheting**: Continuous key rotation per message preventing backward and forward secrecy leakage.
- **Attachments**: Encrypted client-side with AES-256-GCM. Objects stored on decentralised or S3 buckets contain only raw ciphertext and zero metadata.
- **Metadata Protection**: No server logs of peer-to-peer recipients, timestamps, or message counters.

### 2.2 Calling & WebRTC (LiveKit E2EE)
- **Signaling**: Authenticated via ephemeral JWTs signed by `LIVEKIT_API_SECRET`.
- **E2EE Frame Encryption**: Insertable Streams with per-room keys exchanged over XMTP MLS groups.
- **Network Privacy**: Forced TURN relay routing (`iceTransportPolicy: relay`) completely hides residential IP addresses from call peers.

### 2.3 Zero-Knowledge Proofs & Aztec L2
- **Language**: Noir (Aztec ecosystem).
- **Prover Architecture**: Executed in a dedicated Web Worker (`public/workers/prover.worker.js`) on the client device.
- **Isolation Headers**: Origin-isolated via `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on `/prove`.
- **Contracts**:
  - `zk_escrow`: Two-party escrow with timeout fallback, dispute resolution, and authorized witness (`authwit`) validation.
  - `zk_streams`: Continuous streaming payments based on verified L2 block timestamps.

---

## 3. Threat Model & Mitigations (STRIDE Matrix)

| Threat | Target Asset | Architectural Mitigation | Code Location |
|---|---|---|---|
| **Spoofing** | User Session | SIWE (EIP-4361) signature verification + Redis nonces with 10m TTL + single `hl_session` cookie | `app/api/siwe/verify`, `lib/session.ts` |
| **Tampering** | Community Posts | Cryptographically signed post authorship + role permission matrix | `lib/communities/permissions.ts` |
| **Repudiation** | Moderation Actions | Append-only `ModerationLog` table recording admin actions with timestamps | `app/api/chat/communities/[id]/moderation-log` |
| **Information Disclosure** | Chat Content | Zero plaintext stored in database; XMTP MLS encryption exclusively | `docs/db/direct-message-removal.md` |
| **Denial of Service** | API Endpoints | Redis sliding-window rate limiters (auth, messaging, creations) | `lib/security/rateLimiter.ts` |
| **Elevation of Privilege** | Admin Panel | Closed admin list + mandatory TOTP Multi-Factor Authentication | `app/api/admin/login`, `lib/adminAudit.ts` |

---

## 4. Database & Persistence Controls

1. **Connection Pooling**: `connection_limit=10` per replica, managed by PgBouncer in transaction mode to prevent database connection spikes.
2. **Composite Indexes**: Verified via `EXPLAIN ANALYZE` ensuring that all high-frequency community queries complete in under 5ms.
3. **Multi-Table Operations**: Atomic batch execution via `prisma.$transaction([...])`.
4. **Seed Safeguard**: `prisma/seed.ts` terminates immediately if `process.env.NODE_ENV === 'production'`.

---

## 5. Compliance & Regulatory Alignment

- **GDPR Article 17 (Right to Erasure)**: Irreversible account wipe endpoint (`POST /api/user/nuke`) deletes all associated user memberships, tokens, and records in an atomic transaction.
- **GDPR Article 33 (Breach Notification)**: 72-hour formal notification runbook documented in `docs/legal/breach.md`.
- **MiCA & AML Preparedness**: Non-custodial wallet interaction with automated OFAC sanctions screening on bridge transactions (`docs/legal/mica-aml.md`).

---

## 6. Audit Readiness Checklist

- [x] All 400 Backlog Tasks Implemented and Verified (`score.py`: 100/100).
- [x] Zero forbidden security patterns across code (`npm run check:patterns`).
- [x] Unit, crypto, and resilience tests 100% passing (`npm run test:run`).
- [x] PII scrubbing logger integrated across all API routes (`lib/logger.ts`).
- [x] Authentic world map branding unified across desktop, mobile, and PWA touchpoints.
- [x] Master runbooks established for on-call, incident response, rollback, and gamedays (`docs/runbooks/`).
