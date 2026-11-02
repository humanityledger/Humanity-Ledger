# Security Architecture, Threat Model, and Vulnerability Disclosure

> **Specification Standard:** HL-SEC-2026.5  
> **Classification:** Public Cryptographic Protocol Specification  
> **Target Audience:** Aztec Foundation Technical and Ecosystem Team, Security Researchers, Protocol Auditors, and Institutional Partners  
> **Protocol Baseline:** Monorepo Commit `8837be70` (November 2026)  
> **Security Contact:** `humanityledger@icloud.com` — Initial acknowledgment within 12 hours

---

## 1. Architectural Security Principles

Humanity Ledger operates under an untrusted relay and adversarial network model. The protocol assumes that public remote procedure call (RPC) relays, cloud infrastructure providers, database stores, and transport gateways may at any time be actively monitored, compromised, or adversarial.

The protocol enforces six architectural principles designed to minimize the trusted computing base:

1. **Sovereign Client Execution:** All private state manipulation, witness generation, and transaction proof synthesis occur locally within the client Private Execution Environment (PXE). No private witness, balance note, or spending key is ever transmitted to remote relays or indexing infrastructure.
2. **Non Simulated Proof Verification:** Automated continuous integration and regression suites enforce deterministic witness generation and UltraHonk proof synthesis. Synthetic random fields (`Fr.random()`) and mock proof strings are strictly prohibited in production test paths (`test/aztec_e2e_no_simulation.test.ts`).
3. **Non Custodial Key Isolation:** The protocol server infrastructure does not hold, derive, or process private spending keys or long term cryptographic identity material (`test/key_custody.test.ts`).
4. **Timing Safe Cryptographic Equality:** Secret token comparisons, MAC validations, and enclave PIN checks utilize constant time comparison primitives (`crypto.timingSafeEqual`) to eliminate timing side channels (`lib/security/constant-time.ts`).
5. **Memory Zeroization:** Private key buffers, symmetric session secrets, and ratcheted epoch secrets are explicitly wiped from memory upon consumption (`lib/security/zeroize.ts`).
6. **Hermetic Sandbox Boundary Isolation:** Untrusted community applications execute within sandboxed iframe containers governed by a strict Content Security Policy (`connect-src 'none'`), postMessage schema validation, and an 8 KB payload ceiling (`lib/security/eaf-guard.ts`).

---

## 2. Mathematically Enforced Invariants

The monorepo enforces six cryptographic invariants validated by automated continuous integration on every commit:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CORE CRYPTOGRAPHIC INVARIANTS                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Zero Custodial Key Exposure                                              │
│    Private keys, mnemonic seeds, and Aztec viewing keys never leave the     │
│    client runtime. No server endpoint receives, logs, or processes raw keys.│
│    Verified: test/key_custody.test.ts                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Strict Replay Immunity and Nonce Consumption                             │
│    Every state mutating operation consumes a cryptographically secure,      │
│    single use nonce with Redis TTL and SHA-256 idempotency validation.      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Edge Enforced Identity Header Stripping                                  │
│    All client supplied identity headers (x-wallet-address, x-user-id) are  │
│    unconditionally stripped at Edge middleware before verified reinjection.│
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Constant Time Verification Across Sensitive Operations                   │
│    Enclave PINs, HMAC signatures, and webhook tokens are verified via       │
│    timingSafeEqual to eliminate side channel timing profiling.              │
│    Implementation: lib/security/constant-time.ts                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. Client Local Zero Knowledge Proof Synthesis                             │
│    UltraHonk proofs and Noir circuits (escrow, identity, streams) execute   │
│    strictly inside browser Web Workers with COOP/COEP isolation.            │
│    Zero simulation guard: test/aztec_e2e_no_simulation.test.ts             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. Sealed Network Egress for Community Sandboxes                           │
│    Untrusted user applications execute in sandboxed iframes governed by     │
│    connect-src 'none' and a parent mediated authenticated postMessage       │
│    bridge with a strict 8 KB payload ceiling.                               │
│    Verified: test/eaf_isolation.adversarial.test.ts                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Threat Model and Adversarial Defense Matrix

The threat model evaluates the protocol against sophisticated adversaries, including state sponsored Advanced Persistent Threats (APTs), distributed network syndicates, and supply chain poisoners.

| Threat Vector | Adversary Profile | Mitigation Mechanism in Humanity Ledger |
|---|---|---|
| **Private Key Extraction** | Malicious Node / Host Compromise | Non custodial architecture: private keys are generated via WebCrypto API or hardware enclaves; private material is never transmitted across the wire. |
| **Session Forgery and Replay** | Man in the Middle / Network Interceptor | Sign In With Ethereum (EIP-4361) sessions bound to cryptographically generated nonces and verified at Edge middleware (`HttpOnly; Secure; SameSite=Strict`). |
| **Timing Side Channel Profiling** | Advanced Cryptanalyst | Constant time verification: Argon2id hashes, PIN comparisons, and authentication tokens evaluate via `crypto.timingSafeEqual`. |
| **Supply Chain Dependency Injection** | Malicious Upstream Package | Strict version pinning, `engine-strict=true`, SLSA Level 3 CI provenance, and zero vulnerability status under `npm audit`. |
| **UltraHonk Proof Serialization Exploit** | Malicious Prover / Circuit Adversary | Barretenberg dependencies updated outside historical CVE ranges; verification key hash mismatches unconditionally reject proof synthesis. |
| **Sybil Flooding and Denial of Service** | Botnet / Proxy Farms | Edge rate limiting (90 requests per minute per verified wallet) using Redis token buckets, coupled with proof of humanity screening. |
| **Metadata and Traffic Analysis** | Passive ISP / Network Snooper | TURN relay encapsulation (`iceTransportPolicy: 'relay'`) masks peer IP addresses; Messaging Layer Security encrypts payload trees under RFC 9420. |
| **Prototype Pollution** | Malicious Runtime Script | Deep object immutability and defensive parsing validated by `test/fortification.test.ts` and `test/lazarus_adversarial_deep.test.ts`. |
| **Memory Residue and Forensics** | Physical Device Forensic Extraction | Explicit zeroization via `lib/security/zeroize.ts`; validated by `test/property_fuzz.test.ts` across 60,000 iterations. |

---

## 4. Security Boundary and Blast Radius Analysis

```
                              [ UNTRUSTED INTERNET ]
                                        │
                                        ▼
                  ┌──────────────────────────────────────────┐
                  │          EDGE MIDDLEWARE (Vercel Edge)   │
                  │  ✓ Strips client injected identity hdrs  │
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
    │  ✓ Rate limit state (Redis)  │   │  ✓ Secure Enclave PIN Store  │
    │  ✓ Prisma ORM indexing       │   │  ✓ XMTP MLS Decryption Keys  │
    │  ✗ NO private keys held      │   │  ✗ Keys NEVER leave device   │
    └──────────────┬───────────────┘   └──────────────┬───────────────┘
                   ▼                                    ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │  POSTGRESQL / REDIS          │   │  AZTEC ROLLUP & ETHEREUM L1  │
    │  ✓ Public ledger indices     │   │  ✓ On chain proof settlement │
    │  ✓ Sanitised audit trails    │   │  ✓ Smart contract invariants  │
    │  ✗ NO plaintext DM content   │   │  ✓ VK timelock enforcement    │
    └──────────────────────────────┘   └──────────────────────────────┘
```

### Blast Radius Assessment

| Compromised Subsystem | Adversary Capabilities | Absolute Bounds (What Cannot Happen) |
|---|---|---|
| **API or Edge Server** | Read only access to public index data; service disruption | Cannot extract private keys · cannot forge ZK proofs · cannot decrypt private chats |
| **PostgreSQL Database** | Access to public wallet metadata and transaction references | Cannot decrypt MLS message payloads (stored in decentralized XMTP network) |
| **Redis Cache** | Reset transient rate limiting counters | Cannot forge authentication sessions or derive user keys |
| **Physical Client Device** | Access to local storage (mitigated by Secure Enclave) | Cannot compromise historical epochs (guaranteed by MLS forward secrecy) |

---

## 5. Circuit Verification Keys and Governance

Production Noir circuits (`escrow`, `identity`, `streams`) maintain compiled Verification Keys in `circuits/*/target/*.vk.json`. The verification key monitor (`lib/aztec/verifier.ts`) asserts the following state machine before allowing proof generation:

| Key State | Verification Action | System Behavior |
|---|---|---|
| `ACTIVE` | Local SHA-256 matches on chain commitment | Proof synthesis permitted |
| `DEPRECATED` | Hash matches but key is flagged for migration | Proof permitted with migration warning |
| `RETIRED` | Key deactivated by protocol governance | Proof synthesis **unconditionally blocked** |
| `HASH MISMATCH` | Local compiled hash differs from on chain | Proof synthesis **unconditionally blocked** |

On chain updates to verification key commitments are subject to a mandatory **14 day timelock delay**, preventing stealth key substitution attacks ([`docs/VK_MONITORING.md`](docs/VK_MONITORING.md)).

---

## 6. Explicit Cryptographic Non Claims

The following operational constraints are explicitly documented:

1. **Classical Elliptic Curve Cryptography:** BN254 (Aztec UltraHonk), secp256k1 (Ethereum), and Curve25519 (X25519) are not quantum resistant and are vulnerable to Shor's algorithm on cryptanalytically relevant quantum computers.
2. **Network Layer Traffic Analysis:** Messaging Layer Security protects payload content and ratcheted state. It does not conceal IP addresses, connection durations, or transmission frequencies.
3. **Deployment Maturity:** The protocol is deployed in Testnet Stage 1. Production deployment on Ethereum mainnet is gated by external audits and protocol governance.
4. **Third Party Formal Verification:** Automated invariant verification and fuzzing batteries are operational. Formal machine checked mathematical proofs (e.g. Coq or Lean4) represent a future roadmap item.

---

## 7. Coordinated Vulnerability Disclosure Framework

Humanity Ledger maintains an academic Coordinated Vulnerability Disclosure framework.

> [!NOTE]
> **No Monetary Bounties in Testnet Stage 1:** In accordance with our pre mainnet status, Humanity Ledger does not offer cash bounties or financial rewards for vulnerability disclosures. All research contributions are acknowledged academically through public attribution, GitHub Security Advisories, and inclusion in the protocol Security Hall of Fame. A capitalized bounty program will be established upon mainnet funding.

### Submission Protocol

- **Transmission:** Encrypted advisory via GitHub Security Advisories or to `humanityledger@icloud.com`.
- **Service Level Agreements:**
  - Initial Acknowledgment: 12 hours
  - Technical Triage: 24 hours
  - Remediation Window (Critical): 5 business days
  - Remediation Window (High): 7 business days
  - Remediation Window (Medium / Low): 30 business days

### Scope

- **In Scope:** Noir circuits (`circuits/`), Layer 1 Solidity contracts (`contracts/`), client PXE orchestration (`lib/aztec/`), cryptographic library (`lib/security/`), and sandbox guards (`lib/community-apps/`).
- **Out of Scope:** Volumetric denial of service attacks without protocol logic flaws, social engineering of maintainers, and third party upstream dependencies.

### Safe Harbor

The protocol will not pursue legal action against security researchers who conduct testing within the bounds of this policy, preserve the confidentiality of private state data, and allow a reasonable disclosure window before publishing findings.

---

## 8. Contacts

- **Security Disclosures and General Inquiries:** `humanityledger@icloud.com`
- **Legal and Licensing:** `humanityledger@icloud.com`

*Humanity Ledger — Protocol Specification HL-SEC-2026.5 (November 2026)*
