# Security Policy & Threat Model — Humanity Ledger

> **Specification Standard:** HL-SEC-2026.5 (Testnet Stage 1 Audit Ready)  
> **Classification:** Public Cryptographic Protocol Specification  
> **Last Updated:** 2 November 2026 · Canonical Commit `ece61837`  
> **Target Audience:** Security Researchers · Protocol Auditors · Aztec Foundation · Institutional Partners  
> **Security Contact:** `security@humanityledger.com` — Initial response within 24 hours

---

## 1. Architectural Philosophy — Zero-Trust, Zero-Simulation, Zero-Custody

Humanity Ledger is engineered under a **Zero-Trust, Zero-Simulation, Zero-Custody** paradigm. We operate under the explicit assumption that any external infrastructure component — cloud providers, databases, relayers, public RPC nodes, and third-party API dependencies — can at any time be actively monitored, compromised, or adversarial.

Our security envelope guarantees that even in the catastrophic event of a total database leak or Edge server compromise:

- **User funds cannot be stolen.** Private keys and spending keys are generated and held exclusively in the client runtime and never transmitted across the wire.
- **Private Zero-Knowledge proofs cannot be forged.** UltraHonk proof generation executes inside the client-local Aztec PXE, governed by circuit verification keys anchored under a 14-day timelock.
- **Private communications cannot be decrypted in plaintext.** MLS messaging follows RFC 9420 with full post-compromise security (PCS); the server stores no decryption key material.

---

## 2. Inviolable Cryptographic Invariants

The following six invariants are mathematically enforced and validated by the automated CI/CD pipeline on every commit:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CORE CRYPTOGRAPHIC INVARIANTS                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Zero Custodial Key Exposure                                              │
│    Private keys, mnemonic seeds, and Aztec viewing keys NEVER leave the     │
│    client runtime. No server endpoint receives, logs, or processes raw keys.│
│    Verified: test/key_custody.test.ts                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Strict Replay Immunity & Nonce Consumption                               │
│    Every state-mutating operation consumes a cryptographically secure,      │
│    single-use nonce with Redis TTL and SHA-256 idempotency validation.      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Edge-Enforced Identity Header Stripping (A-016)                          │
│    All client-supplied identity headers (x-wallet-address, x-user-id) are  │
│    unconditionally stripped at Edge middleware before verified re-injection.│
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Constant-Time Verification Across All Sensitive Operations               │
│    Enclave PINs, HMAC signatures, and webhook tokens are verified via       │
│    crypto.timingSafeEqual to eliminate side-channel timing profiling.       │
│    Implementation: lib/security/constant-time.ts                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. Client-Side Zero-Knowledge Proving (PXE)                                │
│    UltraHonk proofs and Noir circuits (escrow, identity, streams) execute   │
│    strictly inside browser Web Workers with COOP/COEP isolation.            │
│    Zero-simulation guard: test/aztec_e2e_no_simulation.test.ts             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. Least Privilege & Sealed Egress for Community Sandboxes (EAF)           │
│    Untrusted user applications execute in sandboxed iframes governed by     │
│    connect-src 'none' and a parent-mediated authenticated postMessage bridge│
│    with a strict 8 KB payload ceiling.                                      │
│    Verified: test/eaf_isolation.adversarial.test.ts                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Threat Model & Adversarial Defense Matrix

The threat model explicitly accounts for state-sponsored Advanced Persistent Threats (APTs — including Lazarus Group), distributed flash-loan attack teams, and sophisticated supply-chain poisoners.

| Threat Vector | Adversary Profile | Defense in Humanity Ledger |
|---|---|---|
| **Private Key / Seed Extraction** | APT / Remote Code Execution | Zero Custody: keys generated via WebCrypto API or Secure Enclave hardware; private material is never transmitted. |
| **Session Forgery & Cookie Tampering** | Replay / Man-in-the-Middle | Strict SIWE Nonce Binding: EIP-4361 sessions verified with `jose` at Edge; `HttpOnly; Secure; SameSite=Strict`. |
| **Side-Channel Timing Profiling** | Advanced Cryptanalyst | Constant-Time Verification: Argon2id PIN and API credential comparisons use `timingSafeEqual` throughout. |
| **Supply Chain Dependency Poisoning** | Malicious NPM Package | Strict Version Pinning; `engine-strict=true`; SLSA Level 3 CI provenance; `npm audit` enforced in CI. |
| **UltraHonk Proof Serialization Exploit** | Aztec Protocol Adversary | Barretenberg updated outside GHSA-73xc-j27q-wg75 vulnerable ranges; VK hash mismatch unconditionally blocks proving. |
| **Sybil Flooding & Distributed DoS** | Botnet / Proxy Farms | Edge rate-limiting (90 req/min per verified wallet) via Redis token buckets; WorldCoin proof-of-humanity integration. |
| **Metadata & IP Surveillance** | Network Snooping / ISP | TURN relay enforcement: `iceTransportPolicy: 'relay'` masks participant IPs; XMTP MLS encrypts message content. |
| **Prototype Pollution** | JavaScript Supply Chain | Deep defensive hardening verified by `test/fortification.test.ts` and `test/lazarus_adversarial_deep.test.ts`. |
| **Memory Forensics / Key Residue** | Physical Device Compromise | Explicit zeroization via `lib/security/zeroize.ts`; verified by `test/property_fuzz.test.ts` (10,000 iterations). |

---

## 4. Security Boundary Map & Blast Radius Analysis

```
                              [ UNTRUSTED INTERNET ]
                                        │
                                        ▼
                  ┌──────────────────────────────────────────┐
                  │          EDGE MIDDLEWARE (Vercel Edge)   │
                  │  ✓ Strips client-injected identity hdrs  │
                  │  ✓ Enforces Strict CSP with nonce        │
                  │  ✓ Verifies SIWE JWT (O(1), timeSafe)    │
                  │  ✓ Blocks retired legacy routes (410)    │
                  └──────────────────┬───────────────────────┘
                                     │
                   ┌─────────────────┴──────────────────┐
                   ▼                                    ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │    NEXT.JS API BACKEND       │   │   CLIENT BROWSER (PXE)       │
    │  ✓ Authenticated route logic │   │  ✓ Barretenberg WASM Prover  │
    │  ✓ Rate-limit state (Redis)  │   │  ✓ Secure Enclave PIN Store  │
    │  ✓ Prisma ORM indexing       │   │  ✓ XMTP MLS Decryption Keys  │
    │  ✗ NO private keys held      │   │  ✗ Keys NEVER leave device   │
    └──────────────┬───────────────┘   └──────────────┬───────────────┘
                   ▼                                    ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │  POSTGRESQL / REDIS          │   │  AZTEC ROLLUP & ETHEREUM L1  │
    │  ✓ Public ledger indices     │   │  ✓ On-chain proof settlement  │
    │  ✓ Sanitised audit trails    │   │  ✓ Smart contract invariants  │
    │  ✗ NO plaintext DM content   │   │  ✓ VK timelock enforcement    │
    └──────────────────────────────┘   └──────────────────────────────┘
```

### Blast Radius Analysis

| Compromise Scenario | Impact | Cannot Happen |
|---|---|---|
| **API / Edge Server** | Read-only access to public indices; transient DoS | Drain wallets · sign transactions · decrypt chats |
| **Database (PostgreSQL)** | Public profile data · transaction hashes | Decrypt MLS messages (stored only on XMTP) |
| **Redis** | Reset transient rate-limit counters | Forge sessions (session cryptography is independent) |
| **Local Device Loss** | None — mitigated by Secure Enclave, WebAuthn, Argon2id PIN backoff | N/A with hardware-backed keys |

---

## 5. Verification Keys & Circuit Lifecycle

Production Noir circuits (`escrow`, `identity`, `streams`) have compiled Verification Keys anchored in `circuits/*/target/*.vk.json`. The VK lifecycle enforcer (`lib/aztec/verifier.ts`) operates as follows:

| VK Status | Client Behaviour |
|---|---|
| `ACTIVE` — local SHA-256 matches on-chain commitment | Proof synthesis permitted |
| `DEPRECATED` — hash matches but marked for migration | Proof permitted with migration warning |
| `RETIRED` — explicitly deactivated | Proof synthesis **unconditionally blocked** |
| `HASH MISMATCH` — local != on-chain | Proof synthesis **unconditionally blocked** |

On-chain VK commitments are governed by a **14-day timelock** before any hash update takes effect. This prevents silent circuit substitution attacks. Monitored by [`docs/VK_MONITORING.md`](docs/VK_MONITORING.md).

---

## 6. Explicit Security Non-Claims

The following are **not** guaranteed by the current protocol and are documented as hard constraints, not aspirational caveats:

1. **No quantum resistance for classical cryptographic primitives.** BN254 (Aztec UltraHonk), secp256k1 (Ethereum), and Curve25519 (X25519 key agreement) remain vulnerable to Shor's algorithm on a cryptanalytically relevant quantum computer (CRQC). Post-quantum migration is a future roadmap item.
2. **No metadata privacy at the network layer.** MLS guarantees payload confidentiality and post-compromise security. It does not obscure IP addresses, connection timing, or communication graph frequency. Use Tor or a privacy-preserving transport layer for metadata protection.
3. **No mainnet production readiness.** The protocol is deployed on Aztec Testnet and Polygon Amoy / Base testnets only. External audit and formal governance are prerequisites for mainnet deployment.
4. **No formal verification.** Circuit and contract correctness is validated by automated invariant tests and the adversarial fuzzing battery, but has not yet undergone formal verification by a third-party verification firm.

---

## 7. Responsible Disclosure & Bug Bounty

We actively invite ethical security researchers to probe our contracts, circuits, and application runtime.

### Reporting Process

- **Email:** `security@humanityledger.com`
- **PGP:** Submissions may be encrypted using the public key on file.

### SLA Commitments

| Severity | Initial Acknowledgment | Triage | Remediation |
|---|---|---|---|
| **Critical** | 12 hours | 24 hours | 5 calendar days |
| **High** | 24 hours | 48 hours | 7 calendar days |
| **Medium / Low** | 48 hours | 72 hours | 30 calendar days |

### Scope

- Smart contracts (`/contracts/` — Solidity and Aztec Noir circuits in `circuits/`)
- Cryptographic implementations (`/lib/security/`, `/lib/aztec/`)
- Authentication and Edge perimeter (`middleware.ts`, `/app/api/auth/`)
- XMTP MLS integration and key delegation (`/lib/xmtp/`)
- EAF sandbox and postMessage bridge (`/lib/community-apps/`)

### Out of Scope

- Denial-of-service attacks not exploiting a logic vulnerability
- Social engineering of team members
- Physical attacks against user hardware
- Issues in third-party dependencies not introduced by this codebase

### Safe Harbor

Humanity Ledger will **never** pursue legal action against security researchers who:

1. Make a good faith effort to avoid privacy violations, destruction of data, and service interruption.
2. Provide a reasonable disclosure period (minimum 7 days for Critical, 30 days for others) before public disclosure.
3. Do not exploit vulnerabilities for financial gain, extortion, or unauthorised data retention.

---

## 8. Security Contacts

| Role | Contact |
|---|---|
| Security disclosures | `security@humanityledger.com` |
| Protocol architecture | `core@humanityledger.com` |
| DMCA / IP enforcement | `humanityledger@icloud.com` |

*Humanity Ledger — Testnet Stage 1 · 2 November 2026*
