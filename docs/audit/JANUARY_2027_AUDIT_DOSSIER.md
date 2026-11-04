# Humanity Ledger — Prospective Audit Preparation Dossier (January 2027)

**Document Reference:** HL-AUDIT-PREP-2027.1  
**Status:** PROSPECTIVE PREPARATION DOCUMENT — Not a record of completed audit findings.  
**Date of Preparation:** 2 November 2026  
**Target Audit Window:** January 2027 (contingent on testnet milestone completion)

> [!IMPORTANT]
> This document is a preparation artifact describing the target state and checklist for an independent
> external security audit planned for January 2027. It does not record results of a completed audit.
> The current verified state of the protocol is documented in `docs/STATUS.md` and `docs/AUDIT_DOSSIER.md`.

---

## 1. Scope and Objective

This dossier consolidates the intended cryptographic, architectural, and security posture that Humanity
Ledger must demonstrate prior to engaging an independent external auditor in January 2027. All items
in Section 6 are **preparation targets**, not verified results.

The audit scope encompasses:

- Noir circuit constraint completeness and soundness (`circuits/escrow/`, `circuits/streams/`,
  `circuits/identity/`).
- L1 Solidity contract invariants (`contracts/HumanityTimeLockVault.sol`,
  `contracts/LedgerDeadmanSwitch.sol`, `contracts/HumanityIdentityRegistry.sol`).
- EAF sandbox containment under adversarial payloads.
- Authentication, session management, and cron scheduler security.
- XMTP MLS key custody and forward secrecy properties.

---

## 2. Cryptographic Systems and Protocols

### 2.1 Messaging Encryption (XMTP MLS)

- **Protocol:** Message Layer Security (MLS) via XMTP, implementing RFC 9420 TreeKEM ratcheting.
- **Forward Secrecy:** Continuous key rotation per epoch prevents retroactive decryption.
- **Attachment Encryption:** Encrypted client-side with AES-256-GCM. Storage objects contain only
  raw ciphertext; no plaintext metadata is retained server-side.

### 2.2 Voice and Video Calling (LiveKit)

- **Signaling:** Authenticated via ephemeral JWTs signed by `LIVEKIT_API_SECRET`.
- **Frame Encryption:** Insertable Streams with per-room keys exchanged over XMTP MLS groups.
- **Relay Routing:** `iceTransportPolicy: relay` routes media traffic through TURN relays, preventing
  IP address exposure to call peers.

### 2.3 Zero-Knowledge Proofs and Aztec L2

- **Language:** Noir (Aztec ecosystem).
- **Prover Architecture:** Private payment proofs are generated in the user's browser by the Aztec SDK's embedded PXE (`lib/aztec/wallet/client.ts`). For the standalone Noir circuits there is a Web Worker prover (`lib/zk/prover.worker.ts`, `lib/zk/browser-prover.ts`), real in tests only and not wired into any page. The earlier `public/workers/prover.worker.js` was a stub that returned `0x` and was removed on 4 November 2026.
- **Origin Isolation:** `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` on `/prove`.
- **Circuits:**
  - `zk_escrow`: Two-party escrow with timeout fallback and authorized witness (`authwit`) validation.
  - `zk_streams`: Continuous streaming payments based on verified L2 block timestamps.
  - `zk_identity`: Anonymous group membership via Merkle path and non-sanctioned jurisdiction
    attestation.

**Non-Claims applicable at time of audit:**

- BN254 (used in UltraHonk / PLONK) is not quantum-resistant.
- The protocol does not provide network-level metadata privacy.
- This dossier targets external audit engagement, not production mainnet deployment. Mainnet
  readiness criteria are defined separately in `docs/STATUS.md`.

---

## 3. Threat Model and Mitigations

| Threat | Target Asset | Architectural Mitigation | Code Location |
|---|---|---|---|
| Spoofing | User session | SIWE (EIP-4361) signature verification; Redis nonces with 10-minute TTL; single `hl_session` cookie | `app/api/siwe/verify`, `lib/session.ts` |
| Tampering | Community posts | Cryptographically signed post authorship; role permission matrix | `lib/communities/permissions.ts` |
| Repudiation | Moderation actions | Append-only `ModerationLog` table recording admin actions with timestamps | `app/api/chat/communities/[id]/moderation-log` |
| Information Disclosure | Chat content | Zero plaintext in database; XMTP MLS encryption exclusively | `docs/db/direct-message-removal.md` |
| Denial of Service | API endpoints | Redis sliding-window rate limiters across auth, messaging, and creation routes | `lib/security/rateLimiter.ts` |
| Elevation of Privilege | Admin panel | Closed admin allowlist; mandatory TOTP multi-factor authentication | `app/api/admin/login`, `lib/adminAudit.ts` |

---

## 4. Database and Persistence Controls

1. **Connection Pooling:** `connection_limit=10` per replica, managed by PgBouncer in transaction mode.
2. **Index Coverage:** High-frequency community queries verified via `EXPLAIN ANALYZE` to complete
   within 5 ms.
3. **Atomic Multi-Table Operations:** Executed via `prisma.$transaction([...])`.
4. **Seed Safeguard:** `prisma/seed.ts` terminates immediately if `NODE_ENV === 'production'`.

---

## 5. Compliance and Regulatory Alignment

- **GDPR Article 17 (Right to Erasure):** Irreversible account wipe endpoint (`POST /api/user/nuke`)
  deletes all associated user memberships, tokens, and records atomically.
- **GDPR Article 33 (Breach Notification):** 72-hour formal notification runbook documented in
  `docs/legal/breach.md`.
- **MiCA and AML Preparedness:** Non-custodial wallet interaction with automated OFAC sanctions
  screening on bridge transactions; see `docs/legal/mica-aml.md`.

---

## 6. Audit Readiness Checklist (Preparation Targets)

> [!NOTE]
> Items below marked `[ ]` are targets to be completed before the January 2027 audit engagement.
> Items marked `[x]` are verified at the current canonical commit (`c8ecf97d`, 2 November 2026).

- [x] Zero forbidden security patterns across codebase (`node scripts/forbidden-patterns.mjs`).
- [x] Unit, cryptographic, and resilience tests passing (`npm run test:run`: 1,338 passing in CI on 4 Nov 2026).
- [x] L1 contract invariant tests passing (`npm run test:contracts`: 43 / 43).
- [x] Property fuzz suite passing (60,000 iterations, `test/property_fuzz.test.ts`).
- [x] npm dependency audit clean (`npm audit`: 0 vulnerabilities).
- [x] L1 bytecode verification passing (`npx tsx scripts/verify-l1-bytecode.ts`: 3 contracts, 0 backdoors).
- [x] Traceability criteria A1–A7 all VERIFIED (`npm run check:traceability`).
- [x] PII-scrubbing logger integrated across all API routes (`lib/logger.ts`).
- [x] Incident response and rollback runbooks documented (`docs/runbooks/`).
- [ ] Engage independent external auditor for Noir circuit constraint review.
- [ ] Engage independent external auditor for L1 Solidity contract review.
- [ ] Formal threat model review with Aztec Foundation.
- [ ] Complete endurance test run (`npm run test:5h`) on dedicated hardware with log artifact.
