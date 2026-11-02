# Humanity Ledger Protocol

An integrated cryptographic monorepo coupling client local zero knowledge proof synthesis via the Aztec Private Execution Environment with post compromise secure messaging under RFC 9420.

```
Protocol Standard:      HL-SPEC-2026.1
Proving Architecture:   UltraHonk over BN254 (Barretenberg WASM)
Execution Environment:  Aztec Private Execution Environment (PXE)
Messaging Protocol:     RFC 9420 Messaging Layer Security (MLS)
L1 Target:              Ethereum Cancun EVM (Solidity 0.8.28)
Verification Status:    1,076 passing assertions · 61 test suites · 60,000 property fuzzing iterations
Monorepo Baseline:      Commit 931b1005 (November 2026)
Specification:          docs/PROTOCOL_SPEC.md
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
┌─────────────────────────────────────────────────────────────────────────┐
│                    Client Execution Context (Browser / Desktop)         │
│                                                                         │
│  ┌───────────────────────────┐         ┌─────────────────────────────┐  │
│  │   MLS Group State Engine  │         │   Aztec PXE (Client Local)  │  │
│  │   TreeKEM / RFC 9420      │         │   Barretenberg UltraHonk    │  │
│  └───────────────────────────┘         │   WASM Proving Engine       │  │
│                                        └──────────────┬──────────────┘  │
│                                                       │                 │
│                                                       ▼                 │
│                                        ┌─────────────────────────────┐  │
│                                        │   Noir Circuits (ACIR)      │  │
│                                        │   escrow · identity · stream│  │
│                                        └─────────────────────────────┘  │
└───────────────────────────────────────────────────────┬─────────────────┘
                                                        │ Shielded Proof
                                                        ▼
                                        ┌──────────────────────────────┐
                                        │   Aztec Network Testnet      │
                                        │   Sequencer & Prover Pool    │
                                        │   Rollup State Trees         │
                                        └───────────────┬──────────────┘
                                                        │ Batch Settlement
                                                        ▼
                                        ┌──────────────────────────────┐
                                        │   Ethereum Layer 1 (Cancun)  │
                                        │   HumanityTimeLockVault      │
                                        │   LedgerDeadmanSwitch        │
                                        └──────────────────────────────┘
```

---

## 2. Monorepo Package Topology

Whereas the upstream Aztec architecture distributes its stack across separate repositories (`aztec-packages` for the protocol kernel, `noir` for the language compiler, and `barretenberg` for the proving backend C++ library), Humanity Ledger organizes its implementation as a single integrated monorepo. 

This topology guarantees atomic compilation and synchronization between Noir constraint systems, compiled verification keys, client TypeScript bindings, and Layer 1 smart contracts.

| Package Directory | Domain | Technology | Key Responsibility |
|---|---|---|---|
| `circuits/` | Zero Knowledge Circuits | Noir / ACIR | Production Noir circuits and compiled verification keys (`target/*.vk.json`) |
| `contracts/` | Settlement Smart Contracts | Solidity 0.8.28 | 49 contracts targeting Cancun EVM, enforcing non custodial timelocks and registry state |
| `lib/aztec/` | Client Orchestration | TypeScript / Aztec.js | Client PXE manager, key derivation, note discovery, and verification key lifecycle policies |
| `lib/security/` | Cryptographic Hardening | TypeScript / Node Crypto | Constant time primitives, memory zeroization buffers, and iframe security guards |
| `lib/community-apps/` | Sandbox Runtime | TypeScript / HTML5 | Ephemeral Application Framework providing isolated execution with sealed network egress |
| `scripts/` | Tooling and Verification CI | TypeScript / Node.js | Real Aztec PXE pipelines, Layer 1 bytecode verification, and traceability assertions |
| `test/` | Automated Test Harness | Vitest / Hardhat | 1,076 unit and integration tests, Noir constraint violations, and 60,000 fuzz iterations |
| `docs/` | Normative Specifications | Markdown | Protocol specifications, formal traceability matrix, and external audit dossiers |

---

## 3. Formally Enforced Protocol Properties (P1 – P6)

The protocol enforces six architectural invariants verified continuously by automated test suites on the `main` branch:

| Invariant | Guarantee | Mathematical Definition | Verification Evidence |
|---|---|---|---|
| **P1** | Private State Confidentiality | No client witness or spending key is serialised to remote relays | `test/aztec_e2e_no_simulation.test.ts` |
| **P2** | Non Custodial Key Derivation | Spending and viewing keys exist only in local device memory | `test/key_custody.test.ts` |
| **P3** | Post Compromise Security | Epoch update re-keys group; compromised state cannot read forward | `test/mls_post_compromise.test.ts` |
| **P4** | Circuit Constraint Integrity | All state transitions satisfy ACIR polynomials and valid nullifiers | `test/circuits/` · `test/aztec_vk_integrity.test.ts` |
| **P5** | Sandbox Boundary Isolation | Ephemeral applications cannot access outer window or network sockets | `test/eaf_isolation.adversarial.test.ts` |
| **P6** | Layer 1 Balance Conservation | Smart contracts reject unauthorized drains or premature timelock bypass | `npm run test:contracts` · `scripts/verify-l1-bytecode.ts` |

---

## 4. Acceptance Criteria Verification Status (A1 – A7)

Status tracking is monitored by continuous integration via `scripts/check-traceability.ts`:

| Criterion | Specification | Status | Automated Test Evidence |
|---|---|---|---|
| **A1** | Aztec PXE execution without synthetic simulation | Verified | `test/aztec_e2e_no_simulation.test.ts` · `scripts/aztec-pxe-e2e.ts` |
| **A2** | RFC 9420 Messaging Layer Security confidentiality and PCS | Verified | `test/mls_post_compromise.test.ts` · `npm run test:crypto` |
| **A3** | Ephemeral Application Framework sandbox boundary isolation | Verified | `test/eaf_isolation.adversarial.test.ts` |
| **A4** | Layer 1 contract invariants and timelock enforcement | Verified | `npm run test:contracts` · `scripts/verify-l1-bytecode.ts` |
| **A5** | Zero server key knowledge and client local key custody | Verified | `test/key_custody.test.ts` |
| **A6** | Explicit documentation of residual risks and non claims | Verified | `docs/PROTOCOL_SPEC.md` · `docs/AUDIT_DOSSIER.md` |
| **A7** | Normative traceability matrix synchronized across documentation | Verified | `docs/TRACEABILITY_MATRIX.md` (Validated by `npm run check:traceability`) |

---

## 5. Noir Circuits and Constraint Systems

The monorepo contains three production Noir circuits in [`circuits/`](circuits/), each accompanied by committed verification key artifacts (`target/*.vk.json`):

1. **Private Escrow Release (`circuits/escrow/src/main.nr`):**
   - Commitment relation: $\text{commitment} = \mathcal{H}(\text{sender\_secret}, \text{recipient\_pubkey}, \text{amount}, \text{salt})$
   - Temporal constraint: $\text{current\_timestamp} \le \text{deadline}$
   - Unique nullifier: $\text{nullifier} = \mathcal{H}(\text{sender\_secret}, \text{salt})$
   - Value boundary: $0 < \text{amount} \le 10^{15}$ (arithmetic overflow protection)

2. **Anonymous Compliance and Identity (`circuits/identity/src/main.nr`):**
   - Sanction exclusion: Proves subject jurisdiction is excluded from restricted sets without revealing nationality.
   - Merkle membership: Proves inclusion of identity commitment within authoritative credential tree.
   - Scoped nullifier: $\text{nullifier} = \mathcal{H}(\text{identity\_secret}, \text{scope})$ prevents sybil registrations per context.

3. **Continuous Payment Streams (`circuits/streams/src/main.nr`):**
   - Monotonic temporal validity: $\text{current\_time} \ge \text{start\_time}$
   - Rate accrual bound: $(\text{withdrawn} + \text{claim}) \le (\text{current\_time} - \text{start\_time}) \times \text{rate}$
   - Capital allocation ceiling: $(\text{withdrawn} + \text{claim}) \le \text{total\_allocation}$

Verification key integrity is managed by [`lib/aztec/verifier.ts`](lib/aztec/verifier.ts). Any cryptographic mismatch between local compiled keys and on-chain registered commitments unconditionally blocks client proof synthesis. Changes to verification keys on Layer 1 are subject to a mandatory 14 day timelock policy ([`docs/VK_MONITORING.md`](docs/VK_MONITORING.md)).

---

## 6. Layer 1 Smart Contracts

49 Solidity contracts compiled for the Cancun EVM target reside in `contracts/`. Primary settlement controllers:

- **`HumanityTimeLockVault.sol`:** Non custodial vault holding user assets under mathematical timelocks. Prohibits unilateral administrator withdrawals.
- **`HumanityIdentityRegistry.sol`:** Self sovereign identity registry ensuring write permissions are restricted exclusively to identity key owners.
- **`LedgerDeadmanSwitch.sol`:** Non custodial inheritance facility enforcing a minimum 90 day inactivity threshold and a two step backup authorization protocol.

Bytecode artifacts are automatically audited against backdoors and unauthorized drain patterns by `scripts/verify-l1-bytecode.ts`.

---

## 7. Explicit Cryptographic Non-Claims

In accordance with academic rigor, this protocol explicitly defines its operational boundaries:

1. **No Quantum Resistance for Classical Primitives:** BN254 elliptic curves utilized in Aztec UltraHonk, secp256k1 utilized in Ethereum, and Curve25519 utilized in Diffie Hellman operations remain susceptible to polynomial time discrete logarithm algorithms on cryptanalytically relevant quantum computers. Migration to lattice based primitives represents a post 2028 roadmap objective.
2. **No Transport Layer Traffic Analysis Immunity:** Messaging Layer Security guarantees payload confidentiality and forward secrecy. It does not conceal IP packet origin, packet lengths, or transmission timings. Network layer anonymity requires routing through Tor, Nym, or equivalent mixnet infrastructures.
3. **Testnet Stage 1 Operational Status:** The protocol is deployed across Aztec Testnet and Ethereum testnet environments (Polygon Amoy and Base Sepolia). It is not production ready for high value mainnet deployment until external security audits and formal verification milestones are achieved.
4. **Third Party Formal Verification Scope:** Automated invariant tests, negative circuit tests, and property fuzzing (60,000 iterations) pass with zero errors. Formal mathematical machine checked verification (e.g. Coq or Lean4 proofs) is an ongoing milestone and not yet completed.

---

## 8. Reproducible Verification Commands

The complete test battery can be reproduced on any standard developer workstation in under 60 seconds from a clean repository checkout:

```bash
# 1. Clone monorepo
git clone https://github.com/humanityledger/Humanity-Ledger.git && cd Humanity-Ledger

# 2. Verify non-simulated proof requirements and Noir circuit constraints
npx vitest run test/aztec_e2e_no_simulation.test.ts test/aztec_vk_integrity.test.ts test/circuits/

# 3. Verify non-custodial key isolation and MLS post-compromise security
npx vitest run test/key_custody.test.ts test/mls_post_compromise.test.ts

# 4. Verify Ephemeral Application Framework sandbox boundary isolation
npx vitest run test/eaf_isolation.adversarial.test.ts

# 5. Verify Layer 1 contract invariants (Hardhat Cancun EVM)
npm run test:contracts

# 6. Verify Layer 1 contract bytecode against unauthorized drain patterns
npx tsx scripts/verify-l1-bytecode.ts

# 7. Verify normative consistency across status and traceability matrices
npm run check:traceability

# 8. Execute high-capacity property fuzzing (60,000 iterations)
npx vitest run test/property_fuzz.test.ts

# 9. Execute full unit and integration battery (1,076 tests)
npm run test:run

# 10. Audit dependency vulnerability database
npm audit
```

**Verified Test Metric:** 1,076 / 1,076 tests passing · 43 / 43 Hardhat contract invariants passing · 0 traceability contradictions · 0 bytecode backdoor signatures · 0 dependencies with known vulnerabilities.

---

## 9. Aztec Foundation Technical Review

A technical dossier specifically prepared for the product validation review by **Alejo Amiras** and the Aztec Foundation team is published at [`docs/AZTEC_FOUNDATION_DOSSIER.md`](docs/AZTEC_FOUNDATION_DOSSIER.md). It details client side PXE integration parameters, circuit constraint counts, mobile WebAssembly benchmarking goals, and joint security review proposals.

---

## 10. Governance, Security, and Contribution

- **Contribution Guidelines:** [`CONTRIBUTING.md`](CONTRIBUTING.md) — Architectural invariants, pull request validation gates, and monorepo workflow.
- **Security Policy:** [`SECURITY.md`](SECURITY.md) — HL-SEC-2026.5 standard, threat models, coordinated vulnerability disclosure, and response SLAs.
- **Software License:** [`LICENSE`](LICENSE) — Version 2.0 Proprietary Software License (Restricted Read Only evaluation for personal and academic study).
- **Vulnerability Disclosure Policy:** [`docs/BUG_BOUNTY.md`](docs/BUG_BOUNTY.md) — Academic Coordinated Vulnerability Disclosure framework.
- **Communications:** `core@humanityledger.com` · Security: `security@humanityledger.com`
