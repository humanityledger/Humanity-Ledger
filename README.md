# Humanity Ledger Protocol

An integrated cryptographic monorepo coupling client local zero knowledge proof synthesis via the Aztec Private Execution Environment with post compromise secure messaging under RFC 9420.

```
Protocol Standard:      HLSPEC 2026.1
Proving Architecture:   UltraHonk over BN254 (Barretenberg WASM)
Execution Environment:  Aztec Private Execution Environment (PXE)
Messaging Protocol:     RFC 9420 Messaging Layer Security (MLS)
L1 Target:              Ethereum Cancun EVM (Solidity 0.8.28)
Verification Status:    1,094 passing assertions · 64 test suites · 60,000 property fuzzing iterations
Monorepo Baseline:      Commit 806d6d69 (November 2026)
Specification:          docs/PROTOCOL_SPEC.md
Constraint Analysis:    circuits/CONSTRAINT_COMPLETENESS.md
Aztec Review Dossier:   docs/AZTEC_FOUNDATION_DOSSIER.md
```

---

## 1. Architectural Foundations

Humanity Ledger implements a dual layer architecture designed for sovereign client execution and asynchronous state settlement.

The protocol operates under an untrusted relay assumption: neither intermediate transport nodes, backend indexing services, nor network operators are granted access to private execution witnesses, spending keys, or unencrypted communication state.

1. **Client Execution Layer:** Private state transitions, note discovery, and witness generation execute strictly within the client Private Execution Environment (PXE). Proof synthesis is performed locally using the UltraHonk polynomial interactive oracle proof system over the BN254 elliptic curve via Barretenberg compiled to WebAssembly.
2. **Asynchronous Settlement Layer:** State commitments, nullifier emissions, and dispute resolutions settle to Aztec Testnet and Ethereum Layer 1 timelocked contracts (`HumanityTimeLockVault`, `LedgerDeadmanSwitch`).
3. **Continuous Group Communication:** Multipoint communication is established using Messaging Layer Security (RFC 9420), providing cryptographically enforced forward secrecy and post compromise security across ratcheted epoch state transitions.

```
+-------------------------------------------------------------------------+
|                    Client Execution Context (Browser / Desktop)         |
|                                                                         |
|  +---------------------------+         +-----------------------------+  |
|  |   MLS Group State Engine  |         |   Aztec PXE (Client Local)  |  |
|  |   TreeKEM / RFC 9420      |         |   Barretenberg UltraHonk    |  |
|  |   Post Compromise Guard   |         |   WASM Proving Engine       |  |
|  +---------------------------+         +--------------+--------------+  |
|                                                       |                 |
|                                                       v                 |
|                                        +-----------------------------+  |
|                                        |   Noir Circuits (ACIR)      |  |
|                                        |   escrow, identity, streams |  |
|                                        +-----------------------------+  |
+-------------------------------------------------------+-----------------+
                                                        | Shielded Proof
                                                        v
                                        +------------------------------+
                                        |   Aztec Network Testnet      |
                                        |   Sequencer and Prover Pool  |
                                        |   Rollup State Trees         |
                                        +--------------+---------------+
                                                       | Batch Settlement
                                                       v
                                        +------------------------------+
                                        |   Ethereum Layer 1 (Cancun)  |
                                        |   HumanityTimeLockVault      |
                                        |   LedgerDeadmanSwitch        |
                                        +------------------------------+
```

---

## 2. Monorepo Package Topology

Whereas the upstream Aztec architecture distributes its stack across separate repositories (`aztec-packages` for the protocol kernel, `noir` for the language compiler, and `barretenberg` for the proving backend), Humanity Ledger organizes its implementation as a single integrated monorepo.

This topology guarantees atomic compilation and synchronization between Noir constraint systems, compiled verification keys, client TypeScript bindings, and Layer 1 smart contracts.

| Package Directory | Domain | Technology | Key Responsibility |
|---|---|---|---|
| `circuits/` | Zero Knowledge Circuits | Noir / ACIR | Production Noir circuits, compiled verification keys (`target/*.vk.json`), and constraint completeness documentation |
| `contracts/` | Settlement Smart Contracts | Solidity 0.8.28 | 49 contracts targeting Cancun EVM, enforcing non custodial timelocks and registry state |
| `lib/aztec/` | Client Orchestration | TypeScript / Aztec.js | Client PXE manager, key derivation, note discovery, and verification key lifecycle policies |
| `lib/security/` | Cryptographic Hardening | TypeScript / Node Crypto | Constant time primitives, memory zeroization buffers, and iframe security guards |
| `lib/community-apps/` | Sandbox Runtime | TypeScript / HTML5 | Ephemeral Application Framework providing isolated execution with sealed network egress |
| `scripts/` | Tooling and Verification CI | TypeScript / Node.js | Real Aztec PXE pipelines, Layer 1 bytecode verification, and traceability assertions |
| `test/` | Automated Test Harness | Vitest / Hardhat | 1,094 unit and integration tests, Noir constraint violations, and 60,000 fuzz iterations |
| `docs/` | Normative Specifications | Markdown | Protocol specifications, formal traceability matrix, and external audit dossiers |

---

## 3. Formally Enforced Protocol Properties (P1 through P6)

The protocol enforces six architectural invariants verified continuously by automated test suites on the `main` branch:

| Invariant | Guarantee | Verification Evidence |
|---|---|---|
| **P1** | Private State Confidentiality: no client witness, nullifier secret, or incoming viewing key is serialized to remote relays | `test/aztec_e2e_no_simulation.test.ts` · `test/pxe_boundary_security.test.ts` |
| **P2** | Non Custodial Key Derivation: spending and viewing keys exist only in local device memory | `test/key_custody.test.ts` |
| **P3** | Post Compromise Security: epoch update re-keys the group; compromised epoch state cannot decrypt forward messages | `test/mls_post_compromise.test.ts` · `test/pxe_boundary_security.test.ts` (MLS.2) |
| **P4** | Circuit Constraint Integrity: all state transitions satisfy ACIR polynomials, valid nullifiers, and registered verification keys | `test/circuits/` · `test/aztec_vk_integrity.test.ts` · `test/vk_hash_mismatch.test.ts` |
| **P5** | Sandbox Boundary Isolation: ephemeral applications cannot access the outer window, host storage, or network sockets | `test/eaf_isolation.adversarial.test.ts` |
| **P6** | Layer 1 Balance Conservation: smart contracts reject unauthorized drains and premature timelock bypass | `npm run test:contracts` · `scripts/verify-l1-bytecode.ts` |

---

## 4. Acceptance Criteria Verification Status (A1 through A7)

Status tracking is monitored by continuous integration via `scripts/check-traceability.ts`:

| Criterion | Specification | Status | Automated Test Evidence |
|---|---|---|---|
| **A1** | Aztec PXE execution without synthetic simulation | Verified | `test/aztec_e2e_no_simulation.test.ts` · `scripts/aztec-pxe-e2e.ts` |
| **A2** | RFC 9420 Messaging Layer Security confidentiality and post compromise security | Verified | `test/mls_post_compromise.test.ts` · `test/pxe_boundary_security.test.ts` |
| **A3** | Ephemeral Application Framework sandbox boundary isolation | Verified | `test/eaf_isolation.adversarial.test.ts` (8 tests: CSP, prototype pollution, frozen bridge, 8 KB boundary) |
| **A4** | Layer 1 contract invariants and timelock enforcement | Verified | `npm run test:contracts` · `scripts/verify-l1-bytecode.ts` |
| **A5** | Zero server key knowledge and client local key custody | Verified | `test/key_custody.test.ts` |
| **A6** | Explicit documentation of residual risks and non claims | Verified | `docs/PROTOCOL_SPEC.md` · `circuits/CONSTRAINT_COMPLETENESS.md` |
| **A7** | Normative traceability matrix synchronized across documentation | Verified | `docs/TRACEABILITY_MATRIX.md` (validated by `npm run check:traceability`) |

---

## 5. Noir Circuits and Constraint Systems

The monorepo contains three production Noir circuits in [`circuits/`](circuits/), each accompanied by committed verification key artifacts (`target/*.vk.json`). All three circuits use `pedersen_hash` from `std::hash::pedersen_hash` (Noir standard Pedersen hash over the BN254 scalar field). Migration to Poseidon2 for alignment with Aztec native note commitment construction is planned and documented as Open Engineering Problem 5 in the forum post and in [`circuits/CONSTRAINT_COMPLETENESS.md`](circuits/CONSTRAINT_COMPLETENESS.md).

**1. Private Escrow Release (`circuits/escrow/src/main.nr`)**

Enforces a commitment relation binding sender secret, recipient public key, amount, and salt. The temporal constraint requires the current timestamp to be at or before the deadline. The unique nullifier is derived from the sender secret and salt. The value boundary constrains the amount strictly above zero and at or below `MAX_ESCROW_AMOUNT` (10^15 units) to prevent arithmetic overflow. Hash function: `pedersen_hash`.

**2. Anonymous Compliance and Identity (`circuits/identity/src/main.nr`)**

Proves that the subject jurisdiction is excluded from a sanctioned set without revealing nationality, proves inclusion of the identity commitment in a Merkle credential tree, and derives a scoped nullifier to prevent sybil registrations per context. Current implementation status: constrained prototype with two compile-time sanction constants and a depth-1 Merkle tree. Dynamic depth-32 root and governance-controlled sanction set are pre-production requirements documented as Open Engineering Problem 6.

**3. Continuous Payment Streams (`circuits/streams/src/main.nr`)**

Enforces temporal monotonicity (current time at or after stream start), a rate accrual bound, a capital allocation ceiling, and an explicit rate bound constraint `rate_per_second <= MAX_RATE` that closes the u64 overflow risk documented as Gap G4 in the constraint completeness analysis. Hash function: `pedersen_hash`.

Verification key integrity is managed by [`lib/aztec/verifier.ts`](lib/aztec/verifier.ts). Any cryptographic mismatch between locally compiled keys and on-chain registered commitments unconditionally blocks client proof synthesis. This behavior is verified by `test/vk_hash_mismatch.test.ts`. Changes to verification keys on Layer 1 are subject to a mandatory 14 day timelock enforced by `HumanityTimeLockVault` ([`docs/VK_MONITORING.md`](docs/VK_MONITORING.md)).

The complete pre-audit constraint analysis, gap register, and overflow justifications are available in [`circuits/CONSTRAINT_COMPLETENESS.md`](circuits/CONSTRAINT_COMPLETENESS.md).

---

## 6. Layer 1 Smart Contracts

49 Solidity contracts compiled for the Cancun EVM target reside in `contracts/`. Primary settlement controllers:

* **`HumanityTimeLockVault.sol`:** Non custodial vault holding user assets under mathematical timelocks. Prohibits unilateral administrator withdrawals.
* **`HumanityIdentityRegistry.sol`:** Self sovereign identity registry ensuring write permissions are restricted exclusively to identity key owners.
* **`LedgerDeadmanSwitch.sol`:** Non custodial inheritance facility enforcing a minimum 90 day inactivity threshold and a two step backup authorization protocol. No admin override path exists.

Bytecode artifacts are automatically audited against backdoors and unauthorized drain patterns by `scripts/verify-l1-bytecode.ts`.

---

## 7. PXE Boundary and MLS Lockfile Security

The following properties are continuously enforced and verified by `test/pxe_boundary_security.test.ts`:

* **PXE.1:** Witness fields are never serialized to any JSON-serializable public surface.
* **PXE.2:** The nullifier secret (nsk) is never present in any server-bound data structure.
* **PXE.3:** The incoming viewing key (IVK) is never transmitted to the server; only the public Ivpk is shared.
* **PXE.4:** Ephemeral Schnorr session keys are zeroed immediately after derivation.
* **MLS.1:** The XMTP package version is pinned at 5.2.0 in `package.json`. Any version change without an explicit commit breaks CI.
* **MLS.2:** RFC 9420 epoch advance produces computationally independent keys; an adversary holding only epoch N material cannot derive epoch N+1 keys without the fresh commit secret.

---

## 8. Explicit Cryptographic Non Claims

In accordance with the principle of honest protocol documentation, this repository explicitly defines its operational boundaries:

1. **No Quantum Resistance:** BN254 elliptic curves (Aztec UltraHonk), secp256k1 (Ethereum), and Curve25519 (X25519) are not quantum resistant. Migration to lattice-based primitives is a post-2028 roadmap objective.
2. **No Transport Layer Traffic Analysis Immunity:** Messaging Layer Security guarantees payload confidentiality and forward secrecy. It does not conceal IP packet origin, packet lengths, or transmission timings.
3. **Testnet Stage 1 Operational Status:** The protocol operates exclusively on Aztec Testnet and Ethereum testnet environments. No external security audit has concluded. It is not production ready.
4. **No Formal Machine Checked Verification:** Automated invariant tests, negative circuit tests, and property fuzzing (60,000 iterations) pass with zero errors. Formal mathematical proof via Coq or Lean4 is a future roadmap objective, not a current property.

---

## 9. Reproducible Verification Commands

The complete test battery can be reproduced on any standard developer workstation in under 60 seconds from a clean repository checkout:

```bash
# 1. Clone monorepo
git clone https://github.com/humanityledger/Humanity-Ledger.git
cd Humanity-Ledger

# 2. Verify non simulated proof requirements and Noir circuit constraints
npx vitest run test/aztec_e2e_no_simulation.test.ts test/aztec_vk_integrity.test.ts test/circuits/

# 3. Verify PXE boundary security and MLS lockfile integrity
npx vitest run test/pxe_boundary_security.test.ts

# 4. Verify VK HASH_MISMATCH unconditional proof block
npx vitest run test/vk_hash_mismatch.test.ts

# 5. Verify streams rate bound constraint (Gap G4 closure)
npx vitest run test/circuits/streams_rate_bound.test.ts

# 6. Verify non custodial key isolation and MLS post compromise security
npx vitest run test/key_custody.test.ts test/mls_post_compromise.test.ts

# 7. Verify Ephemeral Application Framework adversarial isolation (8 tests)
npx vitest run test/eaf_isolation.adversarial.test.ts

# 8. Verify Layer 1 contract invariants (Hardhat Cancun EVM)
npm run test:contracts

# 9. Verify Layer 1 contract bytecode against unauthorized drain patterns
npx tsx scripts/verify-l1-bytecode.ts

# 10. Verify normative consistency across status and traceability matrices
npm run check:traceability

# 11. Execute high capacity property fuzzing (60,000 iterations)
npx vitest run test/property_fuzz.test.ts

# 12. Execute full unit and integration battery
npm run test:run
```

**Verified Test Metric:** 1,094 / 1,094 tests passing · 64 test files · 43 / 43 Hardhat contract invariants passing · 0 traceability contradictions · 0 bytecode backdoor signatures · 0 dependencies with known vulnerabilities.

---

## 10. Aztec Foundation Technical Review

A technical dossier detailing the protocol integration architecture for review by the Aztec ecosystem engineering team is published at [`docs/AZTEC_FOUNDATION_DOSSIER.md`](docs/AZTEC_FOUNDATION_DOSSIER.md). It covers client side PXE integration parameters, circuit constraint counts, mobile WebAssembly benchmarking goals, and the full pre-audit gap register in [`circuits/CONSTRAINT_COMPLETENESS.md`](circuits/CONSTRAINT_COMPLETENESS.md).

---

## 11. Governance, Security, and Contribution

* **Contribution Guidelines:** [`CONTRIBUTING.md`](CONTRIBUTING.md) — Architectural invariants, pull request validation gates, and monorepo workflow.
* **Security Policy:** [`SECURITY.md`](SECURITY.md) — HL-SEC-2026.5 standard, threat models, coordinated vulnerability disclosure, and response SLAs.
* **Software License:** [`LICENSE`](LICENSE) — Proprietary Software License (restricted read-only evaluation for personal and academic study).
* **Vulnerability Disclosure Policy:** [`docs/BUG_BOUNTY.md`](docs/BUG_BOUNTY.md) — Academic Coordinated Vulnerability Disclosure framework.
* **Communications:** `humanityledger@icloud.com`
