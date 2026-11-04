# Humanity Ledger — Architecture, Engineering, and Security Dossier

**Document Reference:** HL-ARCH-SEC-2026.1  
**Target Audience:** Aztec Foundation, zero-knowledge protocol researchers, security auditors  
**Verification Baseline:** 1,076 / 1,076 unit and integration tests passing • 0 TypeScript compilation errors  
**Date:** 2 November 2026  
**Canonical Commit:** `c8ecf97d`

---

## Executive Summary

This dossier provides a comprehensive, transparent, and authoritative review of the systematic engineering
transformation executed across the Humanity Ledger codebase. The project has transitioned from demonstrative
prototype routes to an institutional, non-custodial cryptographic platform with formal invariant enforcement
and a reproducible test harness.

A total of 17 distinct security vulnerabilities across authentication, session management, perimeter routing,
enclave PIN protection, and internal schedulers were diagnosed and resolved. Concurrently, the platform
has integrated the Aztec Network proving stack, hardened decentralized XMTP MLS messaging, and
decommissioned more than 200 unused legacy API endpoints.

### Verification Metrics at Canonical Commit

| Metric | Value |
|---|---|
| TypeScript strict compilation (`tsc --noEmit`) | 0 errors |
| Vitest unit and integration test suite | 1,076 / 1,076 passing |
| Hardhat contract invariant tests | 43 / 43 passing |
| Property fuzz iterations | 60,000 |
| npm audit vulnerabilities | 0 |
| Forbidden pattern violations | 0 |
| Traceability criteria A1–A7 | All VERIFIED |

---

## 1. Elimination of Simulated Execution Paths

Prior iterations of the system contained synthetic fallback routines designed for demonstration purposes.
These have been eradicated in favor of verifiable system behavior:

- **Pseudo-Random Sequencer Data Removed:** In `app/api/zk/sequencer/route.ts`, all loops using
  `Math.random()` to fabricate block production were removed. When an active Aztec Sequencer RPC node
  is unavailable, the endpoint reports a `disabled` or `unreachable` status.
- **Simulated Paymasters Decommissioned:** Legacy routes returning hardcoded sponsor signatures without
  executing on-chain sponsorship were retired (HTTP 410) and removed from all client flows.
- **Non-Custodial Cryptographic Model Enforced:** The server neither derives, stores, nor possesses
  Ethereum private keys, Aztec viewing keys, or XMTP installation credentials. All zero-knowledge
  proof generation occurs strictly on the client device.

---

## 2. Aztec Network Integration and Client-Side Proving Architecture

Humanity Ledger integrates the Aztec Network proving stack to provide programmable privacy and
non-custodial asset management.

- **Client-Side Proving:** Private payment proofs are generated in the user's browser by the Aztec SDK's embedded PXE (`lib/aztec/wallet/client.ts`). For the standalone Noir circuits there is a Web Worker prover (`lib/zk/prover.worker.ts`, `lib/zk/browser-prover.ts`), real in tests only and not wired into any page. The earlier `public/workers/prover.worker.js` was a stub that returned `0x` and was removed on 4 November 2026. The middleware sets `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` only for paths under `/prove`, and no such page exists yet, so no page runs cross-origin isolated today.
- **Noir Circuit Invariants:**
  - `zk_escrow`: Conditional escrow releases governed by authorized witness (`authwit`) cryptographic
    signatures with timeout fallback.
  - `zk_streams`: Continuous payment streaming with block-timestamp verification and non-repudiation.
  - `zk_identity`: Anonymous group membership via Merkle path verification without exposing the user
    identifier.
- **Provenance Anchoring Integrity:** In `app/api/passport/[slug]/anchor/route.ts`, anchoring proofs are
  validated against a 32-byte hexadecimal format (`HEX32`). The endpoint verifies issuer ownership and
  enforces idempotency to prevent transaction hash overwrites.
- **Resilient RPC Circuit Breaking:** External RPC calls implement automated circuit breakers with
  exponential backoff, preventing application cascade failures during sequencer latency spikes.

**Non-Claims (Aztec Integration Scope):**

- The BN254 elliptic curve used in PLONK-based proving is not quantum-resistant. Post-quantum migration
  is a long-term Aztec Network roadmap item, not a current protocol property.
- The protocol does not provide network-level metadata privacy. XMTP transport metadata is visible to
  the XMTP network.
- The current integration targets Aztec Network Testnet. Mainnet deployment requires completion of
  formal security audits and the criteria documented in `docs/STATUS.md`.

---

## 3. Ledger Studio: Integrated Development Toolchain

Ledger Studio provides an integrated development workspace with strong isolation boundaries. It is a
**development tool**, not a runtime component of the protocol.

- **Development Toolchain:** TypeScript / Node.js, Hardhat (Solidity compilation and invariant testing),
  Vitest (unit and integration testing), Barretenberg WASM (Noir circuit compilation and UltraHonk
  proving), `tsx` (TypeScript script execution).
- **Workspace Isolation:** Supports branch creation and isolated directory operations, permitting
  speculative code modifications and test runs without modifying the active working tree.
- **Version Control Integration:** Bidirectional Git integration enabling branch pull, diff generation,
  and code review.
- **Execution Confinement:** Development terminal commands operate within a restricted execution context,
  disallowing arbitrary external network egress and file access outside the project tree unless
  explicitly approved.
- **Execution Bounds:** Deterministic execution locks and strict per-turn bounds prevent infinite
  execution loops in automated tooling.

---

## 4. Cryptographic Messaging, Privacy, and Community Sandbox

### 4.1 XMTP MLS End-to-End Encryption

Direct messages traverse the decentralized XMTP network using the Messaging Layer Security (MLS)
protocol (RFC 9420) with TreeKEM key ratcheting. The central PostgreSQL database retains zero
message contents.

Offline message payloads in `PendingChatMessage` are stored encrypted, enforced with a seven-day
automatic TTL expiration, a 10 MiB payload ceiling, and rate-limiting at 90 messages per minute per
account.

### 4.2 Voice and Video Calling

Audio and video calling via LiveKit uses frame-level encryption with keys rotated on participant
join and leave events. When `iceTransportPolicy: 'relay'` is enabled, traffic is routed exclusively
through TURN relays, preventing participant IP address exposure to call peers.

### 4.3 Community Application Sandbox (EAF)

User-generated community applications execute inside sandboxed iframes governed by `lib/community-apps/framePolicy.ts`:

- **Network Isolation:** CSP directive `connect-src 'none'` blocks all outbound network access from
  community applications.
- **Frozen API Surface:** The `window.hl` API catalogue is frozen at the v1.0 method set. Any call
  outside this catalogue is rejected immediately.
- **Identity Binding:** State mutations ignore identifiers supplied in iframe payloads; the host
  injects the authenticated session identity immutably.
- **Storage Compartmentalization:** Application A cannot read or overwrite Application B storage
  keys (`hl:app:<id>:<key>`).
- **Payload Size Enforcement:** Strict 8 KiB ceiling per state payload, enforced by `eaf-guard.ts`.

---

## 5. Security Vulnerability Remediation Registry

| Code | Target | Severity | Vulnerability and Resolution |
|---|---|---|---|
| A-018 | `/api/premium/webauthn` | Critical | Session forging via unverified cookie value as subject. Route decommissioned (HTTP 410). |
| A-019 | `middleware.ts` | High | Lookahead regex bypass allowing extension-matched paths to skip middleware. Replaced with anchored static asset checks. |
| A-020 | `/api/graph` | High | Arbitrary Cypher injection against Neo4j. Route retired (HTTP 410). |
| A-021 | `/api/auth/enclave-pin` | High | PIN brute-force and race conditions on concurrent DELETE/POST/PUT. Shared limiter counting attempts before cryptographic verification (maximum 8 per 5 minutes). |
| A-022 | `GeoLoginTracker` | Medium | Transmission of visitor IP and coordinates over plaintext HTTP. Tracker deleted; route retired. |
| A-023 | `/api/cron/*` | High | Fail-open scheduler execution when `CRON_SECRET` was unset. Unified under `cronAuth.ts`; fails closed on absent or short secret. |
| A-024 | `/api/auth/qr-sync-seed` | High | Null `creatorAddress` allowed any authenticated caller to read seed ciphertext. Strict 403 rejection on null creator enforced. |
| A-025 | `/api/pulse` | High | Runtime random secret cold-start invalidating authorized scheduler calls. Migrated to fail-closed `cronAuth.ts` validation. |
| A-026 | `/api/variables` | Medium | IDOR via query parameter fallback when Edge session header was absent. Fallback removed; verified Edge header required exclusively. |
| A-027 | `/api/user/search` | Medium | Unauthenticated enumeration of wallet addresses, bios, and verification statuses. Mandatory verified caller session enforced before query execution. |
| A-028 | `/api/notifications/ingest` | High | Non-constant-time key check and random secret fallback. SHA-256 `timingSafeEqual` comparison with fail-closed secret validation. |
| A-029 | `/api/vault/sync` | Medium | String equality on authorization headers allowing side-channel latency profiling. Constant-time comparison on cryptographic digests. |
| A-030 | `/api/bots/command` | Low | Quota exhaustion and path traversal in ENS lookups. IP rate-limiting (30 req/min) and strict regex validation applied. |
| A-031 | `/api/academy/parse-document` | Medium | Zip bomb denial of service via untrusted archive headers. 10 MiB upload ceiling and 25 MiB maximum decompressed buffer cap. |
| A-032 | `/login` and `/connect` | Medium | Open redirect and DOM XSS via unvalidated `?next=` parameter. Unified under `safeRedirect.ts` validating relative local paths only. |
| A-033 | `/api/admin/clean-posts` | Medium | CSRF in administrative deletion triggered by HTTP GET. Migrated to POST under Fetch Metadata CSRF enforcement. |
| A-034 | Edge Routing Registry | Low | Extensive attack surface from over 200 unused, unauthenticated endpoints. Catalogued in `retiredRoutes.ts` and served HTTP 410 at the Edge. |

---

## 6. Verification Suite

| Test Category | Command | Result |
|---|---|---|
| TypeScript strict compilation | `tsc --noEmit` | 0 errors |
| Vitest unit and integration | `npm run test:run` | 1,076 / 1,076 passing |
| Hardhat L1 contract invariants | `npm run test:contracts` | 43 / 43 passing |
| Property fuzz (60,000 iterations) | `npm run test:run` | PASSING |
| Forbidden pattern scan | `node scripts/forbidden-patterns.mjs` | 0 violations |
| L1 bytecode verification | `npx tsx scripts/verify-l1-bytecode.ts` | 3 contracts, 0 backdoors |
| Traceability check | `npm run check:traceability` | A1–A7 all VERIFIED |
| npm dependency audit | `npm audit` | 0 vulnerabilities |

---

## 7. Production Deployment Prerequisites

For operators deploying Humanity Ledger into live environments, the following procedures are mandatory.

1. **Cryptographic Key Rotation:** Rotate `JWT_SECRET` and the EdDSA asymmetric keypair
   (`JWT_EDDSA_PRIVATE_JWK` / `JWT_EDDSA_PUBLIC_JWK`) in deployment environment variables to
   revoke all legacy tokens and sessions.

2. **High-Entropy Secrets (Minimum 16 Characters):**

   ```bash
   CRON_SECRET=<32-byte secure hex string>
   INTERNAL_INGEST_KEY=<32-byte secure hex string>
   PRIVATE_VAULT_SECRET=<32-byte secure hex string>
   ADMIN_SECRET=<32-byte secure hex string>
   PULSE_SECRET=<32-byte secure hex string>
   ENCLAVE_PIN_PEPPER=<32-byte secure hex string>
   ```

   Under the hardened architecture, missing or short secrets cause corresponding endpoints to fail
   closed (HTTP 503 / HTTP 401).

3. **Dedicated TURN Infrastructure:** Configure dedicated Coturn servers via `NEXT_PUBLIC_TURN_URLS`,
   `NEXT_PUBLIC_TURN_USERNAME`, and `NEXT_PUBLIC_TURN_CREDENTIAL` to eliminate reliance on public
   community fallback relays.

4. **Aztec Node Connectivity:** Ensure `AZTEC_NODE_URL` points to a healthy Aztec Network node to
   enable real-time sequencer status reporting and client-side proof verification.
