# P2-B.1A: SESSION & JWT SECURITY ANALYSIS

## Methodology
This is a **static code analysis** of the implemented SIWE verify and session routes.
Empirical runtime tests require a live PostgreSQL instance (currently BLOCKED).
All findings here are based on code inspection only. Nothing is marked PASS.

---

## 1. JWT Security Audit (Code Analysis)

### Reviewed file: `app/api/auth/siwe/verify/route.ts`

| Property | Implementation | Analysis |
|---|---|---|
| Algorithm | `HS256` (SignJWT `.setProtectedHeader({ alg: 'HS256' })`) | HMAC-SHA256. Symmetric. Appropriate for server-to-server. |
| Signing key | `process.env.JWT_SECRET` with fallback to a hardcoded dev string | **RISK:** Fallback `VOID_SECRET_99_POLY_DEV_ONLY_CHANGE_IN_PRODUCTION` is predictable. If `JWT_SECRET` is not set in production, any attacker who knows this string can forge JWTs. Requires env var enforcement. |
| Expiration | `.setExpirationTime('24h')` | Set. JWT will self-expire. |
| Issued-at | `.setIssuedAt()` | Set. |
| Audience | NOT SET | Missing. Without `aud`, a JWT issued for one service can be replayed against another if they share the same `JWT_SECRET`. Low risk in this monolith but a gap. |
| Issuer | NOT SET | Missing. Without `iss`, origin cannot be validated during verification. |
| Subject | `sessionId` in payload, not `sub` claim | Non-standard placement. Should use `.setSubject(session.sessionId)`. |
| Cookie: HttpOnly | `httpOnly: true` | CORRECT — browser JS cannot read this cookie. |
| Cookie: Secure | `process.env.NODE_ENV === 'production'` | CORRECT for production. In dev, cookie is transmitted over HTTP. |
| Cookie: SameSite | `lax` | Acceptable. Would reject cross-site POST requests. `strict` would be more defensive but may break OAuth redirects. |
| Cookie: Path | `/` | Correct — cookie applies to all routes. |
| Cookie: Domain | NOT SET | Not set. Defaults to current domain. Correct for single-domain deployment. |

### JWT Hardcoded Fallback — Formal Risk

**Finding:** The fallback signing key `'VOID_SECRET_99_POLY_DEV_ONLY_CHANGE_IN_PRODUCTION'` is committed to source code and visible in this repository. If `JWT_SECRET` is not set in the production environment:
1. Any JWT signed in dev can be replayed in production (same key)
2. An attacker with source access can forge arbitrary JWTs

**Mitigation required:** The application should `throw` or exit if `JWT_SECRET` is absent in production, not fall back to the hardcoded string.

---

## 2. Session Revocation Analysis (Code Analysis)

### Architecture (from code):

```
Client JWT cookie
     ↓
middleware.ts  →  jwtVerify(token, JWT_SECRET)
                  [reads: payload.address / payload.sessionId]
                  [does NOT query DB]
     ↓
app/api/auth/siwe/session  →  jwtVerify(token)
                               → prisma.humanitySession.findUnique({ sessionId })
                               → checks: expiresAt, revokedAt
```

### Revocation Gap — IDENTIFIED

**Current behavior:** The edge middleware (`middleware.ts`) verifies the JWT signature and reads the `address` claim from the token. **It does NOT query `HumanitySession` to check if the session has been revoked.**

**Consequence:** If a `HumanitySession` is revoked in the database (setting `revokedAt`), an attacker who still holds a valid JWT cookie will:
- **Pass** the edge middleware (JWT signature is still valid)
- **Pass** for any route that only checks the middleware token
- **Fail** only at `GET /api/auth/siwe/session` (which does check `revokedAt`)

**This means:** Revocation is NOT instantaneous for all resource access. It is instantaneous only for resources that explicitly call `/api/auth/siwe/session` or independently verify `HumanitySession`.

**Formal classification:** This is NOT "remote revocation." It is **best-effort revocation** within JWT TTL.

**Mitigation options:**
1. Short JWT TTL (e.g., 15 minutes) + silent rotation via session endpoint
2. Session introspection middleware (Prisma query at edge — not possible without PG connector at Edge)
3. Maintain a revocation list in an edge-compatible store (Redis/KV) — allows O(1) revocation check
4. Accept the gap and document it as a known architectural constraint until a KV store is available

**Status: KNOWN GAP — documented, not ignored.**

---

## 3. Feature Flag Security Analysis (Code Analysis)

### Variable: `NEXT_PUBLIC_IDENTITY_SIWE_REGISTRY_ENABLED`

**Finding:** This variable is prefixed with `NEXT_PUBLIC_` which in Next.js means it is:
- Embedded in the client-side JavaScript bundle at build time
- Readable by any user who inspects the page source
- Modifiable by a user via browser devtools (it doesn't change the server-side behavior, but the client component reads it)

**Component behavior (`SiweRegistryAdapter.tsx`):**
```ts
const isEnabled = process.env.NEXT_PUBLIC_IDENTITY_SIWE_REGISTRY_ENABLED === "true";
if (!isEnabled) return <>{children}</>;
```

**Security implication:** If `isEnabled = false`, the Registry page loads without SIWE. This is **intentional** (legacy fallback mode). The flag controls **UI rollout**, not **API authorization**.

**Verification of backend independence:** 
- The SIWE verify route (`/api/auth/siwe/verify`) does not check this flag
- The nonce route does not check this flag
- The existing middleware (`middleware.ts`) runs independently of this flag

**Conclusion:** The feature flag does NOT constitute a security boundary. The backend routes are protected independently. This is architecturally correct. **No fix required for the flag itself**, but API-level authorization must be verified independently (requires PostgreSQL for empirical test — BLOCKED).

---

## 4. Identity Race Condition — Design Analysis

### Scenario: Two concurrent requests with same wallet address, neither identity exists

**Code path (verify route, lines 56–82):**
```
findUnique(walletAddress)  → null
create(walletAddress)      → SUCCESS on first
                           → FAIL on second (unique constraint on walletAddress)
```

**Mechanism:** `HumanityIdentity.walletAddress` has `@unique` in Prisma schema → maps to a `UNIQUE` constraint in PostgreSQL. If two requests attempt `create()` simultaneously for the same `walletAddress`, PostgreSQL will reject the second with a constraint violation.

**HOWEVER:** The current code does not handle this constraint violation. A concurrent `create()` failure would propagate as an unhandled exception and return HTTP 500 to the second request.

**Implication:**
- No duplicate identities will be created (constraint prevents it) ✓
- The second request will fail with 500 instead of a clean 400/409 ✗
- The nonce was already consumed at this point, meaning the second request consumed no nonce (it failed before creating identity), but the first request already consumed the nonce in the single-use step

**Finding:** The identity uniqueness constraint is correct but the error handling for race conditions is incomplete. Under concurrent auth with the same wallet, one request succeeds and one returns HTTP 500. This is not a security vulnerability but is a reliability issue.

**Recommendation:** Add `try/catch` around `humanityIdentity.create()` and handle `P2002` (unique constraint) by doing `findUnique` as a retry.

---

## 5. SIWE Validation — Fields Verified vs Fields Present in EIP-4361

| EIP-4361 Field | Verified in code? | How? |
|---|---|---|
| `domain` | YES | Passed to `siweMessage.verify({ domain: ... })` |
| `address` | YES | `siweMessage.verify()` checks sig recovery matches address |
| `uri` | PARTIAL | `siweMessage.verify()` does not explicitly receive `uri` to validate against expected origin in current implementation |
| `version` | YES | `SiweMessage` parser enforces version = "1" |
| `chain ID` | PARTIAL | Parsed into `data.chainId` but not validated against an expected chain allowlist |
| `nonce` | YES | Server-side delete enforces single-use |
| `issued-at` | PARTIAL | `time: new Date().toISOString()` passed to verify; `siwe` checks issuance time window |
| `expiration-time` | YES | `siwe.verify()` checks if present and not expired |
| `not-before` | YES | `siwe.verify()` checks if present |
| `request-id` | NOT CHECKED | Not present in this flow; EIP-4361 marks it as optional |
| `signature` | YES | Core of `siweMessage.verify()` — ECDSA recovery |

**Gaps identified:**
1. **`uri` not validated against server-expected URI** — the server does not enforce that `message.uri` matches `process.env.NEXT_PUBLIC_APP_URL`. An attacker who constructs a valid SIWE message for `https://evil.com` with a nonce stolen from `https://ledgerchat.org` would still pass signature verification (signature is against the full message text including domain/URI). However, `domain` validation IS enforced, which makes this less critical.
2. **`chainId` not restricted** — A valid signature from Chain 1 (Ethereum Mainnet) will be accepted even if the system should only accept Chain 137 (Polygon). No chain allowlist exists. This is a policy gap.

---

## Summary Status (Code Analysis — NOT empirical)

| Item | Status | Notes |
|---|---|---|
| JWT algorithm | ANALYZED | HS256, appropriate |
| JWT signing key | GAP FOUND | Hardcoded fallback is a production risk |
| JWT expiration | ANALYZED | Set to 24h |
| JWT audience/issuer | GAP FOUND | Not set |
| Cookie HttpOnly | ANALYZED | Correct |
| Cookie Secure | ANALYZED | Conditional on NODE_ENV |
| Cookie SameSite | ANALYZED | lax — acceptable |
| Session revocation | GAP FOUND | JWT not invalidated at middleware layer |
| Feature flag security | ANALYZED | Not a security boundary — correct |
| SIWE domain validation | ANALYZED | Enforced |
| SIWE URI validation | GAP FOUND | Not validated against server expected URI |
| SIWE chain binding | GAP FOUND | No chain allowlist |
| Identity uniqueness | ANALYZED | Constraint correct, error handling incomplete |

**All empirical tests (concurrency, multi-instance, restart) = BLOCKED pending PostgreSQL.**
