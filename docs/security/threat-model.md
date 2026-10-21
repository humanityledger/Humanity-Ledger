# STRIDE Threat Model — Humanity Ledger

> **Last updated**: 2025-10-20  
> **Status**: Draft — each threat links to a backlog task or an existing control

---

## Scope

This document covers the five trust boundaries most likely to be attacked:

1. **Authentication** (SIWE wallet login, email OTP, PIN, sessions)
2. **Direct messaging** (XMTP stream, API integration)
3. **Communities** (membership, posts, channels, permissions)
4. **Calls** (LiveKit tokens, TURN server, WebRTC)
5. **Payments** (Aztec ZK transfers, L1↔L2 bridge)

---

## STRIDE Threat Table

### 1. Authentication

| ID | Threat | Category | Mitigation | Task |
|----|--------|----------|------------|------|
| T-AUTH-01 | Attacker forges `x-wallet-address` header to impersonate another user | Spoofing | Middleware strips all client-supplied identity headers (A-016) | A-016 ✅ |
| T-AUTH-02 | Session token stolen from insecure cookie | Tampering | `HttpOnly; Secure; SameSite=Strict` cookie; single `hl_session` cookie | B-007 |
| T-AUTH-03 | SIWE nonce reuse — attacker replays signed message | Replay / Spoofing | Nonce stored in Redis with 10 min TTL, single-use | B-011 |
| T-AUTH-04 | Brute-force email OTP | Elevation of Privilege | 5 attempts max, Redis rate limit per email+IP, hashed code | B-013 |
| T-AUTH-05 | PIN brute-force via Enclave API | Elevation of Privilege | Argon2id + 8 attempts / 5 min limit | B-020, B-024 |
| T-AUTH-06 | PIN bypass by sending `clearanceToken` from GET response | Elevation of Privilege | GET never returns `clearanceToken` (A-013) | A-013 ✅ |
| T-AUTH-07 | Refresh token reuse after logout | Tampering | Refresh token rotation with reuse detection (revokes family) | B-009 |
| T-AUTH-08 | Secrets leaked in environment defaults | Information Disclosure | `lib/env.ts` fails on startup without required secrets; no defaults | B-037 ✅ |
| T-AUTH-09 | CSRF mutation via cross-origin form | Cross-Site Request Forgery | `Origin` + `Sec-Fetch-Site` header validation on all mutations | B-015 ✅ |
| T-AUTH-10 | Multiple SIWE route confusion | Spoofing | Unify to one canonical route; others return 410 | B-012 |

### 2. Direct Messaging (XMTP)

| ID | Threat | Category | Mitigation | Task |
|----|--------|----------|------------|------|
| T-MSG-01 | Message plaintext stored on server (legacy DirectMessage table) | Information Disclosure | Delete `DirectMessage` and `PendingChatMessage` tables | C-002, C-003 |
| T-MSG-02 | Attacker supplies own address in request body to read others' DMs | Spoofing / IDOR | `requireWallet()` resolves identity from session only (A-002) | A-002 ✅ |
| T-MSG-03 | Server learns message content via API route inspection | Information Disclosure | DMs travel only over XMTP (E2EE); server stores only txHash | D-031 |
| T-MSG-04 | Polling loop leaks metadata about conversation participants to server | Information Disclosure | Remove polling; use XMTP stream only | D-001 |
| T-MSG-05 | Unknown sender spam | Denial of Service | XMTP consent states — strangers in separate inbox | D-008 |
| T-MSG-06 | XMTP installation limit exhaustion | Denial of Service | Clear error message; revocation UI | D-007 |

### 3. Communities

| ID | Threat | Category | Mitigation | Task |
|----|--------|----------|------------|------|
| T-COM-01 | Non-member reads private community messages | Information Disclosure | Membership check before serving posts (A-023) | A-023 ✅ |
| T-COM-02 | Member with no role elevation performs admin action | Elevation of Privilege | Role-based permission matrix on all routes | E-009, E-010 |
| T-COM-03 | Reused invitation link used by unintended party | Spoofing | Signed, single-use, expiring invite tokens | E-011 |
| T-COM-04 | XSS via community post content | Tampering | DOMPurify + isomorphic-dompurify on all content | B-028 |
| T-COM-05 | Token-gate bypass by lying about on-chain balance | Elevation of Privilege | Server verifies balance via RPC, not client claim | E-024 |
| T-COM-06 | Mass join spam (sybil attack) | Denial of Service | Rate limit on join route (B-025); antispam | E-015 |
| T-COM-07 | Enumeration of private community members | Information Disclosure | Members route requires membership; pagination limited | C-005 |

### 4. Calls

| ID | Threat | Category | Mitigation | Task |
|----|--------|----------|------------|------|
| T-CALL-01 | Attacker joins call without being a community member | Elevation of Privilege | LiveKit token issued only to verified members | F-002 |
| T-CALL-02 | IP address leaked to other call participants via ICE | Information Disclosure | TURN relay option (iceTransportPolicy: 'relay') | F-009 |
| T-CALL-03 | Long-lived call token reuse | Replay | Token TTL 10 min; short-lived | F-002 |
| T-CALL-04 | TURN credentials hardcoded (openrelayproject) | Information Disclosure | Remove openrelayproject; use HMAC-temporal credentials | F-008 |
| T-CALL-05 | Call recording without participant knowledge | Privacy | Recording off by default; visible warning if enabled | F-018 |

### 5. Payments (Aztec ZK)

| ID | Threat | Category | Mitigation | Task |
|----|--------|----------|------------|------|
| T-PAY-01 | Fake L1 tx hash accepted as deposit | Tampering | Validate portal address, sender, and amount on L1 receipt | H-017 |
| T-PAY-02 | Server-side PXE holds user keys (custodial) | Non-Repudiation | Remove server-side sidecar.ts; keys stay in browser | H-004 ✅ |
| T-PAY-03 | Fake ZK proof accepted | Tampering | Remove client-side prover stub; use Aztec PXE for real proofs | H-019 ✅ |
| T-PAY-04 | Balance/history from localStorage is fabricated | Information Disclosure | Replace localStorage reads with PXE `balance_of_private` | H-008 |
| T-PAY-05 | ZK payment routes accept arbitrary amounts without limits | Elevation of Privilege | Amount limits + testnet flag; mainnet requires audit | H-038 ✅ |
| T-PAY-06 | Sanctions evasion via bridge | Legal / Compliance | Sanctions check on bridge transactions | N-009 |

---

## Infrastructure & Supply Chain

| ID | Threat | Category | Mitigation | Task |
|----|--------|----------|------------|------|
| T-INF-01 | Malicious dependency (supply chain) | Tampering | SBOM (J-030 ✅), license check (J-032 ✅), npm audit (B-035) | B-035, J-030 ✅ |
| T-INF-02 | Secret committed to git history | Information Disclosure | Gitleaks in CI (J-001 ✅); pre-commit hook (J-034 ✅) | J-001 ✅ |
| T-INF-03 | Data loss from migration failure | Tampering | Migration fail → deploy stops; backup before migration (A-017 ✅) | A-017 ✅ |
| T-INF-04 | PostgreSQL connection exhaustion under load | Denial of Service | Connection pool limit + PgBouncer | C-007 |
| T-INF-05 | Redis eviction clears rate limiter counters | Security Control Failure | Redis persistence + TTL on all rate limit keys | C-019 |

---

## External Threats Requiring Vendor Action

| ID | Threat | Status |
|----|--------|--------|
| T-EXT-01 | Vulnerabilities found only by external pentester | B-039 — external pentest required |
| T-EXT-02 | Aztec contract vulnerabilities | H-037 — external audit required |
| T-EXT-03 | XMTP network-level surveillance | Architectural — E2EE is the mitigation |

---

## Control Coverage Summary

- **STRIDE Spoofing**: Covered by A-002, A-016, B-011, B-012, B-015 (all done or in progress)
- **Tampering**: Covered by B-028, H-017, J-022, J-034
- **Repudiation**: Admin audit log (M-009), moderation log (E-013)
- **Information Disclosure**: C-002/C-003, D-031, H-008
- **Denial of Service**: B-024, B-025, E-015
- **Elevation of Privilege**: E-009/E-010, F-002, B-020, B-013
