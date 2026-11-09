# P2-B.1C: SIWE VALIDATION & TEST MATRIX

## Validation Fixes Implemented

The API route `app/api/auth/siwe/verify/route.ts` has been modified to enforce the following required validation logic per EIP-4361:

### 1. URI Validation (FIXED)
The route now extracts the server's expected root URI (`process.env.NEXT_PUBLIC_APP_URL`) and explicitly checks that the client-provided `siweMessage.uri` starts with this expected URI. This prevents a signed message intended for `https://evil.com/login` from being accepted at `https://ledgerchat.org`.

### 2. Chain ID Binding (FIXED)
The route now enforces an explicit server-side policy for allowed networks.
```typescript
const ALLOWED_CHAIN_IDS = [137, 31337]; // Polygon Mainnet, Hardhat Local
if (!ALLOWED_CHAIN_IDS.includes(data.chainId)) { ... }
```
A client cannot supply an arbitrary `chainId` (e.g., Ethereum Mainnet `1`) to bypass network isolation.

### 3. Identity vs Authorization Separation (VERIFIED)
The creation of `HumanityIdentity` strictly defaults to `permissions: []`. Authenticating via a valid SIWE signature yields a canonical identity, but provides NO elevated authorization capabilities by default. This preserves the security boundary between AuthN and AuthZ.

---

## Test Matrix (Vitest)

Deterministic unit tests have been written in `test/auth/siwe.test.ts` to prove the pure logic of the validation (independent of PostgreSQL).

| Scenario | Expected | Result | Mechanism |
|---|---|---|---|
| Valid message & signature | PASS | ✅ PASS | `siweMessage.verify()` |
| Wrong domain | REJECT | ✅ PASS | `verify({ domain })` |
| Wrong URI | REJECT | ✅ PASS | Custom `startsWith(expectedUri)` |
| Wrong Chain ID | REJECT | ✅ PASS | Custom `ALLOWED_CHAIN_IDS` check |
| Wrong signature | REJECT | ✅ PASS | ECDSA recovery mismatch |
| Expired message | REJECT | ✅ PASS | `expirationTime` check |

These tests use dynamically generated ethers wallets and signatures to prove the cryptographic math and application logic works correctly.

**Status:** SIWE URI VALIDATION = VERIFIED. SIWE CHAIN VALIDATION = VERIFIED.
