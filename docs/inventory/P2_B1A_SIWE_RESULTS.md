# P2-B.1A: SIWE VALIDATION ANALYSIS

## Methodology
Static code analysis of `app/api/auth/siwe/verify/route.ts`.
No runtime tests possible without PostgreSQL (BLOCKED).

---

## EIP-4361 Field Validation Matrix

| Field | Required by EIP-4361 | Validated server-side? | Mechanism | Gap? |
|---|---|---|---|---|
| `domain` | YES | YES | `siweMessage.verify({ domain: expectedDomain })` | None |
| `address` | YES | YES | ECDSA recovery in `siwe.verify()` | None |
| `uri` | YES | PARTIAL | Parsed but not compared to server's expected URI | GAP |
| `version` | YES | YES | `siwe` parser enforces "1" | None |
| `chainId` | YES | PARTIAL | Read into `data.chainId`; no allowlist enforced | GAP |
| `nonce` | YES | YES | Server-side atomic DELETE; P2025 on reuse | None |
| `issuedAt` | YES | PARTIAL | `time` passed to verify; siwe checks window | Acceptable |
| `expirationTime` | OPTIONAL (if present) | YES | `siwe.verify()` checks if not expired | None |
| `notBefore` | OPTIONAL (if present) | YES | `siwe.verify()` enforces nbf | None |
| `requestId` | OPTIONAL | NOT CHECKED | Not present in flow; marked optional | Acceptable |
| `statement` | OPTIONAL | NOT CHECKED | Accepted as-is from client | Low risk |
| `resources` | OPTIONAL | NOT CHECKED | Accepted as-is from client | Low risk |
| `signature` | YES | YES | Core ECDSA verification in `siwe.verify()` | None |

---

## Gap 1: URI Not Validated Against Server Expected URI

**Current code:**
```ts
verificationResult = await siweMessage.verify({
  signature,
  domain: process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).host : 'localhost:3000',
  time: new Date().toISOString()
});
```

**Problem:** The `uri` field from the SIWE message (e.g., `https://ledgerchat.org/registry`) is not compared to the expected server URI. While `domain` is validated, `uri` could be any path on that domain.

**Exploitability:** Low in isolation. Domain validation already prevents cross-site attacks. But a SIWE message signed for `https://ledgerchat.org/legacy-auth` could be replayed at `https://ledgerchat.org/api/auth/siwe/verify` and would pass validation.

**Fix:**
```ts
verificationResult = await siweMessage.verify({
  signature,
  domain: expectedDomain,
  nonce: siweMessage.nonce, // already consumed, but siwe can double-check
  time: new Date().toISOString()
});
// Additional check:
const expectedUri = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
if (!siweMessage.uri.startsWith(expectedUri)) {
  return NextResponse.json({ error: 'URI mismatch' }, { status: 401 });
}
```

---

## Gap 2: No Chain ID Allowlist

**Current code:**
```ts
identity = await prisma.humanityIdentity.create({
  data: {
    walletAddress: data.address.toLowerCase(),
    chainId: data.chainId,  // accepted as-is
    ...
  }
});
```

**Problem:** A user can sign a SIWE message for any `chainId`. The server accepts the signature and creates an identity regardless of which chain was used. If the system should only accept mainnet (chainId=1) or a specific chain, an attacker could authenticate with a testnet signature.

**Policy question:** What chains should Humanity Ledger accept?
- If accepting any chain: document this as a policy decision
- If requiring specific chains: add an allowlist

**Fix:**
```ts
const ALLOWED_CHAIN_IDS = [1, 137, 42161]; // mainnet, polygon, arbitrum
if (!ALLOWED_CHAIN_IDS.includes(data.chainId)) {
  return NextResponse.json({ error: 'Chain not supported' }, { status: 400 });
}
```

---

## Cross-Origin / Domain Attack Analysis

**Test cases (synthetic analysis, no empirical test):**

| Origin | Expected result | Current behavior |
|---|---|---|
| `ledgerchat.org` | PASS | PASS (domain validated) |
| `evil-ledgerchat.org` | FAIL | FAIL (domain mismatch → siwe.verify() rejects) |
| `ledgerchat.org.evil.com` | FAIL | FAIL (different host) |
| `sub.ledgerchat.org` | FAIL | FAIL (different host — exact match) |
| `ledgerchat.org:8080` | FAIL | FAIL (host includes port) |
| `https://ledgerchat.org` (wrong scheme) | FAIL | FAIL (domain field includes scheme in full URI) |

**Conclusion:** Domain validation in `siwe@3` uses exact string matching on the `domain` field (host + optional port, no scheme). This is correct per EIP-4361 §3.

---

## Replay Attack Analysis

**Mechanism:** Nonce is deleted from `SiweNonce` before signature verification completes. This means:
1. The nonce is consumed even if the signature is invalid
2. A valid nonce cannot be replayed even with a valid signature
3. An attacker who intercepts the nonce cannot replay: they lack the private key to produce a valid signature

**Timing window analysis:**
1. `DELETE SiweNonce WHERE nonce = ?` ← nonce consumed
2. `siweMessage.verify()` ← signature checked
3. If (2) fails, nonce is already gone — the request fails cleanly

**Potential DoS:** An attacker who obtains a nonce (e.g., by observing the `/api/auth/nonce` endpoint) can consume it by sending an invalid SIWE verify request, forcing the legitimate user to request a new nonce. Mitigated by rate limiting on the nonce endpoint (already implemented: 100 req/min per IP).

---

## Status

| Test | Method | Result |
|---|---|---|
| Domain validation | Code analysis | ANALYZED — appears correct |
| URI validation | Code analysis | GAP IDENTIFIED — not enforced |
| Chain binding | Code analysis | GAP IDENTIFIED — no allowlist |
| Nonce single-use | Code analysis | DESIGN CORRECT — empirical test BLOCKED |
| Replay after restart | Code analysis | DESIGN CORRECT — DB-persistent nonces |
| Signature validation | Code analysis | ANALYZED — siwe library handles |
| Expiration | Code analysis | ANALYZED — enforced by siwe |
| Wrong domain SIWE | Synthetic analysis | FAIL (correct) |
| Homoglyph domain | NOT TESTED | UNKNOWN |
