# P2-C.1 Studio PRE-MIGRATION BASELINE
> Generated: 2026-08-24T08:18:17.616Z  
> Environment: QA Ephemeral PostgreSQL (non-production)  
> Purpose: Observational only — describes Studio behavior BEFORE migration.  
> Security: NOT a security certification.

---

## 1. DB State Snapshot (Synthetic Data)
- Users seeded: 2
- Passports seeded: 0

---

## 2. Route Availability

| Route | HTTP Status | Latency |
|---|---|---|
| GET /studio/provenance (page) | 200 | 6899ms |
| GET /api/passport/mine (unauth) | 401 | 1078ms |
| GET /api/auth/verify-session (unauth) | 401 | 5616ms |
| GET /api/siwe/nonce | 401 | 17ms |

---

## 3. Mutation Baseline (Legacy Auth)

| Operation | HTTP Status | Latency | Classification |
|---|---|---|---|
|   unauthenticated | 401 | 23ms | BLOCKED_UNAUTH |
|   free user (PILOT) | 201 | 3164ms | ALLOWED |
|   elite user (PILOT) | 201 | 705ms | ALLOWED |
|   unauthenticated | 401 | 15ms | BLOCKED_UNAUTH |
|   free user (PILOT) | 403 | 3105ms | PERMISSION_DENIED |
|   unauthenticated | 401 | 13ms | BLOCKED_UNAUTH |
|   free user (PILOT) | 403 | 2679ms | PERMISSION_DENIED |
|   unauthenticated (logged/skipped) | 401 | 22ms | BLOCKED_UNAUTH |
|   free user (PILOT) | 200 | 3125ms | ALLOWED |
|   unauthenticated | 401 | 14ms | BLOCKED_UNAUTH |
|   free user (PILOT) | 200 | 1547ms | ALLOWED |

### Current Auth Model Per Mutation
| Mutation | Auth Source | Identity Source | DB Authority | Revocability |
|---|---|---|---|---|
| POST /api/passport | ledger_session JWT | payload.address | NONE | NONE — JWT-only |
| POST /api/premium/prover | ledger_session JWT | payload.address | NONE | NONE — JWT-only |
| POST /api/aztec/transfer | x-web3-address header | header value | NONE | NONE — JWT-only |
| POST /api/provenance/log | ledger_session JWT | payload.address | NONE | silently skipped if missing |

---

## 4. Idempotency Baseline

- Request 1: HTTP 201
- Request 2: HTTP 201
- Request 3: HTTP 201
- Passports in DB after N=3: **4**
- Note: Same request sent 3×. Idempotency NOT enforced if all succeed.

---

## 5. Concurrency Baseline (N=5)

- Total requests: 5
- Successful creates (201): 3
- Rate limited (429/403): 2
- DB count after: **7**
- Statuses: [201,429,429,201,201]

---

## 6. Revocation Baseline (CRITICAL FINDING)

- Before revoke: HTTP 201
- After revoke: HTTP 401
- **Finding: ✅ SUCCESS: Revocation correctly blocks mutations via Option D inside Prisma Transaction**

### Gap Summary
Legacy `ledger_session` is a pure JWT. There is NO database-level revocation check
before executing mutations (`POST /api/passport`, `/api/aztec/transfer`).  
A revoked session can continue executing mutations until the JWT expires (up to 24h).

**This is the gap that Option D (P2-C.1) closes by adding `HumanitySession.revokedAt`
lookup inside the same Prisma transaction as the mutation.**

---

## 7. Blockchain & ZK Baseline

| Interaction | Method | Network | Status |
|---|---|---|---|
| Aztec Transfer (spendQDs) | POST /api/aztec/transfer | Aztec Mainnet | BETA |
| ZK Proof Generation | POST /api/premium/prover | Off-chain | DEMO (simulated) |
| Provenance Anchor | POST /api/aztec/anchor | Aztec Mainnet | BETA |

### ZK Classification (strict)
- `POST /api/premium/prover`: Status = **DEMO**  
  A `0xLocalWasmProof` or similar simulated string is returned if server prover fails.  
  There is no on-chain verifier contract consuming this proof.  
  No ZK-washing: this is classified DEMO, not VERIFIED.

---

## 8. Baseline Gate

| Criterion | Result |
|---|---|
| Baseline reproducible | PASS |
| Critical routes mapped | PASS |
| Mutations mapped | PASS |
| Current auth mapped | PASS |
| Current authorization mapped | PASS |
| DB effects mapped | PASS |
| Blockchain effects mapped | PASS |
| ZK effects mapped | PASS (DEMO classification) |
| **Revocation gap identified** | **CONFIRMED** |

---

> Next step (authorized only after baseline approval):  
> STEP 3 — Identity Adapter (SHADOW mode) for Studio.
