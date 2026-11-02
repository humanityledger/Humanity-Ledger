# Security Architecture, Threat Model, and Vulnerability Disclosure

> **Specification Standard:** HL-SEC-2026.5
> **Classification:** Public Cryptographic Protocol Specification
> **Target Audience:** Aztec Ecosystem Engineering Team, Security Researchers, Protocol Auditors, and Institutional Partners
> **Protocol Baseline:** Monorepo Commit `806d6d69` (November 2026)
> **Security Contact:** `humanityledger@icloud.com` — Initial acknowledgment within 12 hours

---

## 1. Architectural Security Principles

Humanity Ledger operates under an untrusted relay and adversarial network model. The protocol assumes that public remote procedure call (RPC) relays, cloud infrastructure providers, database stores, and transport gateways may at any time be actively monitored, compromised, or adversarial.

The protocol enforces six architectural principles designed to minimize the trusted computing base:

1. **Sovereign Client Execution:** All private state manipulation, witness generation, and transaction proof synthesis occur locally within the client Private Execution Environment (PXE). No private witness, balance note, nullifier secret (nsk), incoming viewing key (IVK), or spending key is ever transmitted to remote relays or indexing infrastructure. Verified by `test/pxe_boundary_security.test.ts` (PXE.1 through PXE.4).
2. **Non Simulated Proof Verification:** Automated continuous integration enforces deterministic witness generation and UltraHonk proof synthesis. Synthetic random fields (`Fr.random()`) and mock proof strings are strictly prohibited in production test paths (`test/aztec_e2e_no_simulation.test.ts`).
3. **Non Custodial Key Isolation:** The protocol server infrastructure does not hold, derive, or process private spending keys or long term cryptographic identity material (`test/key_custody.test.ts`).
4. **Timing Safe Cryptographic Equality:** Secret token comparisons, MAC validations, and enclave PIN checks utilize constant time comparison primitives (`crypto.timingSafeEqual`) to eliminate timing side channels (`lib/security/constant-time.ts`).
5. **Memory Zeroization:** Private key buffers, symmetric session secrets, ratcheted epoch secrets, and ephemeral Schnorr keys are explicitly wiped from memory upon consumption (`lib/security/zeroize.ts`). Verified by `test/pxe_boundary_security.test.ts` (PXE.4) and `test/property_fuzz.test.ts` (60,000 iterations).
6. **Hermetic Sandbox Boundary Isolation:** Untrusted community applications execute within sandboxed iframe containers governed by a strict Content Security Policy (`connect-src 'none'`), a frozen and versioned `window.hl` bridge surface, prototype pollution prevention, and an 8 KB payload ceiling (`lib/security/eaf-guard.ts`). Verified by `test/eaf_isolation.adversarial.test.ts` (8 tests covering CSP, prototype pollution, Object.freeze enforcement, and exact boundary behavior).

---

## 2. Mathematically Enforced Invariants

The monorepo enforces six cryptographic invariants validated by automated continuous integration on every commit to the `main` branch:

```
+-----------------------------------------------------------------------------+
|                       CORE CRYPTOGRAPHIC INVARIANTS                        |
+-----------------------------------------------------------------------------+
| 1. Zero Custodial Key Exposure                                              |
|    Private keys, mnemonic seeds, Aztec nullifier secrets (nsk), and        |
|    incoming viewing keys (IVK) never leave the client runtime. No server   |
|    endpoint receives, logs, or processes raw key material.                 |
|    Verified: test/key_custody.test.ts, test/pxe_boundary_security.test.ts |
+-----------------------------------------------------------------------------+
| 2. Strict Replay Immunity and Nonce Consumption                             |
|    Every state mutating operation consumes a cryptographically secure,     |
|    single use nonce with Redis TTL and SHA-256 idempotency validation.     |
+-----------------------------------------------------------------------------+
| 3. Edge Enforced Identity Header Stripping                                  |
|    All client supplied identity headers (x-wallet-address, x-user-id) are |
|    unconditionally stripped at Edge middleware before verified reinjection. |
+-----------------------------------------------------------------------------+
| 4. Constant Time Verification Across Sensitive Operations                   |
|    Enclave PINs, HMAC signatures, and webhook tokens are verified via      |
|    timingSafeEqual to eliminate side channel timing profiling.             |
|    Implementation: lib/security/constant-time.ts                          |
+-----------------------------------------------------------------------------+
| 5. Client Local Zero Knowledge Proof Synthesis                             |
|    UltraHonk proofs and Noir circuits (escrow, identity, streams) execute  |
|    strictly inside browser Web Workers with COOP/COEP isolation.           |
|    Verification key HASH_MISMATCH or RETIRED status unconditionally        |
|    blocks proof synthesis with no override path.                           |
|    Tests: test/aztec_e2e_no_simulation.test.ts, test/vk_hash_mismatch.ts  |
+-----------------------------------------------------------------------------+
| 6. Sealed Network Egress for Community Sandboxes                           |
|    Untrusted user applications execute in sandboxed iframes governed by    |
|    connect-src 'none', a frozen window.hl bridge (Object.freeze enforced), |
|    prototype pollution prevention, and a strict 8 KB payload ceiling       |
|    with exact boundary test coverage.                                      |
|    Verified: test/eaf_isolation.adversarial.test.ts (8 tests)             |
+-----------------------------------------------------------------------------+
```

---

## 3. Verification Key Lifecycle and HASH_MISMATCH Policy

Production Noir circuits (`escrow`, `identity`, `streams`) maintain compiled verification keys in `circuits/*/target/*.vk.json`. The verification key monitor (`lib/aztec/verifier.ts`) enforces the following state machine before allowing any proof generation:

| Key State | Verification Action | System Behavior |
|---|---|---|
| `ACTIVE` | Local SHA-256 matches on-chain commitment | Proof synthesis permitted |
| `DEPRECATED` | Hash matches but key is flagged for migration | Proof permitted with logged migration warning |
| `RETIRED` | Key deactivated by protocol governance | Proof synthesis **unconditionally blocked** — no override path |
| `HASH_MISMATCH` | Local compiled hash differs from on-chain anchor | Proof synthesis **unconditionally blocked** — no override path |

HASH_MISMATCH and RETIRED produce identical blocking behavior. No configuration option, feature flag, or operator action can bypass this gate. This is verified by a dedicated test suite: `test/vk_hash_mismatch.test.ts` (5 tests covering both block states, parity behavior, DEPRECATED rollover window, and missing circuit detection).

On-chain updates to verification key commitments are subject to a mandatory **14 day timelock delay**, preventing stealth key substitution attacks ([`docs/VK_MONITORING.md`](docs/VK_MONITORING.md)).

---

## 4. Circuit Security and Constraint Completeness

All three Noir circuits are analyzed in [`circuits/CONSTRAINT_COMPLETENESS.md`](circuits/CONSTRAINT_COMPLETENESS.md), which documents every enforced constraint, its positive and negative test coverage, and the current status of all identified gaps.

### Current Gap Status (November 2026)

| Gap | Circuit | Status |
|---|---|---|
| G1: `recipient_pubkey` treated as Field without Grumpkin point validation | escrow, streams | Open — validation occurs at PXE layer |
| G2: Sanction set hardcoded at compile time (not dynamic public input) | identity | Open — prototype state, documented |
| G3: Merkle tree depth is 1 (2-node path) | identity | Open — prototype state, documented |
| G4: u64 overflow in accrual multiplication | streams | **CLOSED** — `rate_per_second <= MAX_RATE` constraint enforced |
| G5: Hash function is Pedersen (not Poseidon2) | all three | Open — planned migration, alignment choice |
| G6: No formal equivalence check between Noir source and compiled ACIR | all three | Open — pre-audit priority |

### Circuit Prototype Status

The identity circuit (`circuits/identity/src/main.nr`) is a constrained prototype: it uses two hardcoded compile-time sanction constants and a depth-1 Merkle tree. Any change to either parameter requires a full circuit recompile, a new verification key, and the 14 day VK timelock cycle. The intended production design (dynamic Merkle-committed sanction set and depth-32 tree) is documented as Open Engineering Problem 6.

---

## 5. Threat Model and Adversarial Defense Matrix

The threat model evaluates the protocol against sophisticated adversaries, including state sponsored Advanced Persistent Threats (APTs), distributed network syndicates, and supply chain poisoners.

| Threat Vector | Adversary Profile | Mitigation Mechanism |
|---|---|---|
| **Private Key Extraction** | Malicious Node or Host Compromise | Non custodial architecture: private keys and IVK are generated via WebCrypto API; private material is never transmitted across the wire. Verified by PXE.1 through PXE.4. |
| **Session Forgery and Replay** | Man in the Middle / Network Interceptor | Sign In With Ethereum (EIP-4361) sessions bound to cryptographically generated nonces and verified at Edge middleware (`HttpOnly; Secure; SameSite=Strict`). |
| **Timing Side Channel Profiling** | Advanced Cryptanalyst | Constant time verification: Argon2id hashes, PIN comparisons, and authentication tokens evaluate via `crypto.timingSafeEqual`. |
| **Supply Chain Dependency Injection** | Malicious Upstream Package | Strict version pinning, XMTP locked at 5.2.0 (verified by `test/pxe_boundary_security.test.ts` MLS.1), `engine-strict=true`, SLSA Level 3 CI provenance, and zero vulnerability status under `npm audit`. |
| **Verification Key Substitution** | Malicious Deployer or Governance Attack | HASH_MISMATCH unconditionally blocks proof synthesis; 14 day on-chain timelock prevents stealth VK updates; verified by `test/vk_hash_mismatch.test.ts`. |
| **Sybil Flooding and Denial of Service** | Botnet or Proxy Farms | Edge rate limiting (90 requests per minute per verified wallet) using Redis token buckets, coupled with proof of humanity screening. |
| **Metadata and Traffic Analysis** | Passive ISP or Network Snooper | TURN relay encapsulation (`iceTransportPolicy: 'relay'`) masks peer IP addresses; RFC 9420 MLS encrypts payload trees. Residual risk: packet timing and lengths remain observable at the network layer. |
| **Prototype Pollution** | Malicious Runtime Script | `window.hl` bridge surface is frozen via `Object.freeze`; bridge message parsing uses structural validation. Verified by `test/eaf_isolation.adversarial.test.ts` (P6.7, P6.8). |
| **EAF Payload Resource Exhaustion** | Malicious Community App | Strict 8 KB payload ceiling enforced by `lib/security/eaf-guard.ts`; exact boundary test (8192 bytes accepted, 8193 bytes rejected) verified by P6.6. |
| **Memory Residue and Forensics** | Physical Device Forensic Extraction | Explicit zeroization via `lib/security/zeroize.ts`; ephemeral Schnorr key zeroization verified by PXE.4; fuzz validated across 60,000 iterations. |
| **North Korea APT / Supply Chain Attack** | State Sponsored Actor | Layered defense: SLSA provenance, dependency version pinning, `npm audit` zero vulnerabilities, CI forbidden-patterns enforcement, VK timelock governance, non custodial key architecture. No single compromised component enables fund extraction or key recovery. |

---

## 6. Security Boundary and Blast Radius Analysis

```
                              [ UNTRUSTED INTERNET ]
                                        |
                                        v
                  +------------------------------------------+
                  |          EDGE MIDDLEWARE (Vercel Edge)   |
                  |  + Strips client injected identity hdrs  |
                  |  + Enforces Strict CSP with nonce        |
                  |  + Verifies SIWE JWT (constant time)     |
                  |  + Blocks retired legacy routes (410)    |
                  +------------------+------------------------+
                                     |
                   +-----------------+------------------+
                   v                                    v
    +------------------------------+   +------------------------------+
    |    NEXT.JS API BACKEND       |   |   CLIENT BROWSER (PXE)       |
    |  + Authenticated route logic |   |  + Barretenberg WASM Prover  |
    |  + Rate limit state (Redis)  |   |  + Secure Enclave PIN Store  |
    |  + Prisma ORM indexing       |   |  + XMTP MLS Epoch Keys       |
    |  x NO private keys held      |   |  x Keys NEVER leave device   |
    +-------------+----------------+   +-------------+----------------+
                  v                                    v
    +------------------------------+   +------------------------------+
    |  POSTGRESQL / REDIS          |   |  AZTEC ROLLUP + ETHEREUM L1  |
    |  + Public ledger indices     |   |  + On-chain proof settlement  |
    |  + Sanitized audit trails    |   |  + Smart contract invariants  |
    |  x NO plaintext DM content   |   |  + VK 14 day timelock guard   |
    +------------------------------+   +------------------------------+
```

### Blast Radius Assessment

| Compromised Subsystem | Adversary Capabilities | Absolute Bounds (What Cannot Happen) |
|---|---|---|
| **API or Edge Server** | Read only access to public index data; service disruption | Cannot extract private keys, nullifier secrets, or IVK — cannot forge ZK proofs — cannot decrypt private chats |
| **PostgreSQL Database** | Access to public wallet metadata and transaction references | Cannot decrypt MLS message payloads (stored in decentralized XMTP network with client-held epoch keys) |
| **Redis Cache** | Reset transient rate limiting counters | Cannot forge authentication sessions or derive user keys |
| **Physical Client Device** | Access to local storage (mitigated by Secure Enclave) | Cannot compromise historical epochs (guaranteed by MLS forward secrecy) — cannot access spent epochs |

---

## 7. Residual Risk Ledger

The following risks are explicitly acknowledged, documented, and not treated as resolved:

| Risk ID | Description | Current Mitigation | Path to Resolution |
|---|---|---|---|
| RISK-01 | BN254, secp256k1, and Curve25519 not quantum resistant | Documented non-claim | Lattice migration post-2028 |
| RISK-02 | Network layer metadata (IP, timing, packet size) observable | TURN relay; RFC 9420 payload encryption | Tor or mixnet integration |
| RISK-03 | Identity circuit uses prototype sanction set and depth-1 Merkle tree | Explicitly documented; VK timelock enforced | Pre-production redesign (Open Problem 6) |
| RISK-04 | Pedersen hash used (not Poseidon2); diverges from Aztec native note scheme | Documented as alignment gap, not security gap | Pre-audit migration (Open Problem 5) |
| RISK-05 | Barretenberg WASM peak RSS 1.8 GB; exceeds Mobile Safari 1.5 GB limit | Desktop client only; mobile proving deferred | WASM allocator profiling and witness compression |
| RISK-06 | `recipient_pubkey` not validated as Grumpkin curve point in-circuit | PXE-layer validation prevents invalid inputs | In-circuit validation decision pending (Open Problem 7) |
| RISK-07 | No formal machine-checked verification of circuits | Automated negative tests and fuzz coverage | Coq or Lean4 formal proof roadmap |

---

## 8. Coordinated Vulnerability Disclosure Framework

Humanity Ledger maintains an academic Coordinated Vulnerability Disclosure framework.

> [!NOTE]
> **No Monetary Bounties in Testnet Stage 1:** In accordance with pre-mainnet status, Humanity Ledger does not offer cash bounties or financial rewards for vulnerability disclosures. All research contributions are acknowledged academically through public attribution, GitHub Security Advisories, and inclusion in the protocol Security Hall of Fame. A capitalized bounty program will be established upon mainnet funding.

### Submission Protocol

* **Transmission:** Encrypted advisory via GitHub Security Advisories or to `humanityledger@icloud.com`.
* **Service Level Agreements:**
  * Initial Acknowledgment: 12 hours
  * Technical Triage: 24 hours
  * Remediation Window (Critical): 5 business days
  * Remediation Window (High): 7 business days
  * Remediation Window (Medium or Low): 30 business days

### Scope

* **In Scope:** Noir circuits (`circuits/`), Layer 1 Solidity contracts (`contracts/`), client PXE orchestration (`lib/aztec/`), cryptographic library (`lib/security/`), and sandbox guards (`lib/community-apps/`).
* **Out of Scope:** Volumetric denial of service attacks without protocol logic flaws, social engineering of maintainers, and third party upstream dependencies.

### Safe Harbor

The protocol will not pursue legal action against security researchers who conduct testing within the bounds of this policy, preserve the confidentiality of private state data, and allow a reasonable disclosure window before publishing findings.

---

## 9. Explicit Cryptographic Non Claims

1. **No Quantum Resistance:** BN254 (Aztec UltraHonk), secp256k1 (Ethereum), and Curve25519 (X25519) are not quantum resistant and are vulnerable to Shor's algorithm on cryptanalytically relevant quantum computers.
2. **No Network Layer Traffic Analysis Immunity:** RFC 9420 MLS protects payload content and ratcheted key state. It does not conceal IP addresses, connection durations, or transmission frequencies.
3. **Testnet Stage 1 Only:** The protocol is deployed in Aztec Testnet and Ethereum testnet environments. No external security audit has concluded. It is not production ready.
4. **No Formal Machine Checked Verification:** Automated invariant verification and fuzzing batteries are operational. Formal mathematical proofs (Coq or Lean4) represent a future roadmap item, not a current property.

---

## 10. Contacts

* **Security Disclosures and General Inquiries:** `humanityledger@icloud.com`
* **Legal and Licensing:** `humanityledger@icloud.com`
* **Repository:** [https://github.com/humanityledger/Humanity-Ledger](https://github.com/humanityledger/Humanity-Ledger)

*Humanity Ledger — Security Specification HL-SEC-2026.5 (November 2026)*
