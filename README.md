# Humanity Ledger Protocol

[![CI Test Suite](https://img.shields.io/badge/CI-1%2C076%20Passing-brightgreen?style=flat-square)](test/)
[![Aztec PXE](https://img.shields.io/badge/Aztec-UltraHonk%20%2F%20PXE-blueviolet?style=flat-square)](https://aztec.network)
[![Zero Simulation](https://img.shields.io/badge/Simulation-Zero%20Tolerance-success?style=flat-square)](test/aztec_e2e_no_simulation.test.ts)
[![MLS Messaging](https://img.shields.io/badge/MLS-RFC%209420-blue?style=flat-square)](test/mls_post_compromise.test.ts)
[![Maturity](https://img.shields.io/badge/Maturity-Testnet%20Stage%201-orange?style=flat-square)](docs/STATUS.md)
[![License](https://img.shields.io/badge/License-Proprietary%202.0-lightgrey?style=flat-square)](LICENSE)

> **Maturity Status:** Testnet Stage 1 — Audit & Product Validation Ready  
> **Canonical Tree Baseline:** Commit `65f5c4bf` — 2 November 2026  
> **Test Suite:** 1,076 / 1,076 passing · 61 test suites · 60,000 fuzz iterations · 0 failures  
> **Normative Spec:** [`docs/PROTOCOL_SPEC.md`](docs/PROTOCOL_SPEC.md)  
> **Aztec Foundation Dossier:** [`docs/AZTEC_FOUNDATION_DOSSIER.md`](docs/AZTEC_FOUNDATION_DOSSIER.md)

Humanity Ledger is a privacy-first communication and settlement protocol. It couples **MLS messaging** (RFC 9420) with **client-side Aztec UltraHonk proof generation** via the Private Execution Environment (PXE) and auditable on-chain settlement over Ethereum L1, Base, and Polygon.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Device (Browser / Desktop)            │
│                                                                 │
│  ┌─────────────────────┐   ┌───────────────────────────────┐   │
│  │  MLS Messaging      │   │  Aztec PXE (Local)            │   │
│  │  RFC 9420 / XMTP    │   │  UltraHonk Prover             │   │
│  └─────────────────────┘   │  Noir Circuits (BN254)        │   │
│                            │  - escrow · identity · streams │   │
│                            └───────────────────────────────┘   │
└──────────────────────────────────────┬──────────────────────────┘
                                       │ Private Tx / Shielded Proof
                                       ▼
                          ┌────────────────────────┐
                          │  Aztec Network Testnet │
                          │  Sequencer / Prover    │
                          └────────────┬───────────┘
                                       │ Batch Settlement
                                       ▼
                          ┌────────────────────────┐
                          │  Ethereum L1           │
                          │  HumanityTimeLockVault │
                          │  LedgerDeadmanSwitch   │
                          └────────────────────────┘
```

---

## Verified Protocol Properties (P1 – P6)

Each property is backed by passing automated tests on the `main` branch.

| Property | Guarantee | Test Evidence |
|---|---|---|
| **P1** — Message Confidentiality | MLS used in conformance with RFC 9420 | `test/mls_post_compromise.test.ts` · `npm run test:crypto` |
| **P2** — Post-Compromise Security | Epoch advance does not expose prior secrets after device compromise | `test/mls_post_compromise.test.ts` |
| **P3** — Private State Confidentiality | Private balances and witnesses stay client-side; server receives no private inputs | `scripts/aztec-pxe-e2e.ts` · `test/aztec_e2e_no_simulation.test.ts` |
| **P4** — Private State Integrity | Invalid state transitions rejected by circuit constraints and contract invariants | `test/circuits/` · `test/contracts_invariants.test.ts` |
| **P5** — No Server Key Custody | Server does not generate, derive, or store spending keys or long-term MLS identity keys | `test/key_custody.test.ts` |
| **P6** — EAF Isolation | Executable artifact frames are bounded by a closed bridge surface; no sandbox escape | `test/eaf_isolation.adversarial.test.ts` |

---

## Acceptance Criteria Status (A1 – A7)

| Criterion | Status | Evidence |
|---|---|---|
| **A1** — Real Aztec E2E, zero simulation | ✅ Verified | `scripts/aztec-pxe-e2e.ts` · `test/aztec_e2e_no_simulation.test.ts` |
| **A2** — MLS confidentiality and PCS | ✅ Verified | `test/mls_post_compromise.test.ts` · `npm run test:crypto` |
| **A3** — EAF sandbox isolation | ✅ Verified | `test/eaf_isolation.adversarial.test.ts` |
| **A4** — L1 contract invariants | ✅ Verified | `npm run test:contracts` · `scripts/verify-l1-bytecode.ts` |
| **A5** — No server key custody | ✅ Verified | `test/key_custody.test.ts` |
| **A6** — Residual risk documentation | ✅ Verified | `docs/PROTOCOL_SPEC.md` · `docs/AUDIT_DOSSIER.md` |
| **A7** — Traceability matrix complete | ✅ Verified | `docs/TRACEABILITY_MATRIX.md` (CI-enforced by `npm run check:traceability`) |

---

## Noir Circuits

Three production ZK circuits implemented in [`circuits/`](circuits/), each with a compiled Verification Key (`target/*.vk.json`):

| Circuit | File | Key Invariants |
|---|---|---|
| **Escrow Release** | `circuits/escrow/src/main.nr` | Commitment binding · deadline enforcement · nullifier uniqueness · value ceiling (≤ 10¹⁵) |
| **Anonymous Identity** | `circuits/identity/src/main.nr` | Sanction screening without identity disclosure · Merkle membership · scoped sybil-resistance nullifier |
| **Payment Streams** | `circuits/streams/src/main.nr` | Temporal monotonicity · accrual constraint · allocation ceiling · withdrawal nullifier |

Circuit verification keys are monitored by `lib/aztec/verifier.ts`. Hash mismatches or `RETIRED` status unconditionally block client-side proof generation.

---

## L1 Smart Contracts

49 contracts compiled (Cancun EVM target). Key contracts:

| Contract | Purpose |
|---|---|
| `HumanityTimeLockVault` | Time-locked, non-custodial user vaults with anti-drain invariants |
| `HumanityIdentityRegistry` | Self-sovereign identity registration — owner-only updates, no hijack |
| `LedgerDeadmanSwitch` | Non-custodial inheritance switch — 90-day minimum · 2-step backup wallet change |

---

## Explicit Non-Claims

This repository does **not** claim the following:

1. **Quantum resistance** for any classical cryptographic primitive (BN254, secp256k1, Curve25519 remain vulnerable to Shor's algorithm on cryptanalytically relevant quantum computers).
2. **Metadata privacy** for MLS group membership, message timing, or IP-layer traffic patterns.
3. **Mainnet production readiness** — the protocol is on Aztec Testnet and EVM testnets only.
4. **Formal verification** — correctness is validated by automated property testing and fuzzing, but has not yet undergone third-party mathematical formal verification.

These boundaries are specified in [`docs/PROTOCOL_SPEC.md`](docs/PROTOCOL_SPEC.md) and are treated as hard constraints, not aspirational caveats.

---

## How to Verify (< 60 seconds from a clean clone)

```bash
# Clone
git clone https://github.com/humanityledger/Humanity-Ledger.git && cd Humanity-Ledger

# 1. Zero-simulation guard + Noir circuits + VK lifecycle
npx vitest run test/aztec_e2e_no_simulation.test.ts test/aztec_vk_integrity.test.ts test/circuits/

# 2. MLS post-compromise security + key custody
npx vitest run test/mls_post_compromise.test.ts test/key_custody.test.ts

# 3. EAF adversarial isolation
npx vitest run test/eaf_isolation.adversarial.test.ts

# 4. L1 contract invariants (Hardhat Cancun EVM)
npm run test:contracts

# 5. Anti-backdoor bytecode verifier
npx tsx scripts/verify-l1-bytecode.ts

# 6. Normative traceability CI (A1–A7)
npm run check:traceability

# 7. High-capacity property fuzzing (60,000 iterations)
npx vitest run test/property_fuzz.test.ts

# 8. Full adversarial battery
npm run test:massive

# 9. Entire test suite (1,076 tests)
npm run test:run

# 10. Dependency security audit
npm audit
```

**Last verified result on `65f5c4bf`:** 1,076 / 1,076 tests passing · 43 / 43 Hardhat invariants passing · 0 traceability contradictions · 0 bytecode backdoor patterns · 0 vulnerabilities in `npm audit`.

---

## Repository Layout

```
circuits/          Noir circuit sources and compiled verification keys
├── escrow/        Private escrow release circuit
├── identity/      Anonymous compliance and identity membership circuit
└── streams/       Continuous payment stream withdrawal circuit

contracts/         49 Solidity contracts (Cancun EVM)
├── HumanityTimeLockVault.sol
├── HumanityIdentityRegistry.sol
└── security/LedgerDeadmanSwitch.sol

docs/              Normative documentation
├── PROTOCOL_SPEC.md          Single source of truth for the protocol
├── TRACEABILITY_MATRIX.md    P1–P6 / A1–A7 ↔ test mapping
├── AUDIT_DOSSIER.md          External audit record and risk notes
├── AZTEC_FOUNDATION_DOSSIER.md  Technical brief for Aztec Foundation review
├── VK_MONITORING.md          Verification key lifecycle policy
└── FORTIFICATION_CHECKLIST.md  Security hardening checklist

scripts/
├── aztec-pxe-e2e.ts          Real Aztec testnet PXE end-to-end pipeline
├── check-traceability.ts     Normative CI consistency checker
├── verify-l1-bytecode.ts     Anti-backdoor L1 bytecode verifier
└── benchmark-proof-gen.ts    UltraHonk proving time profiler

test/
├── circuits/                 Noir circuit invariant and negative tests
├── mls_post_compromise.test.ts
├── key_custody.test.ts
├── aztec_e2e_no_simulation.test.ts
├── eaf_isolation.adversarial.test.ts
├── contracts_invariants.test.ts
├── property_fuzz.test.ts     60,000-iteration property fuzzer
└── fortification.test.ts     Adversarial hardening battery
```

---

## Aztec Foundation

A technical dossier prepared for the Aztec Foundation product validation review is available at [`docs/AZTEC_FOUNDATION_DOSSIER.md`](docs/AZTEC_FOUNDATION_DOSSIER.md). It covers the client-side PXE architecture, circuit design rationale, reproducible verification commands, explicit non-claims, and proposed collaboration areas.

---

## Community & Policy Navigation

- **Contributing Guide:** [`CONTRIBUTING.md`](CONTRIBUTING.md) — Mandatory invariant analysis, PR verification gates, and development workflows.
- **Security Policy:** [`SECURITY.md`](SECURITY.md) — HL-SEC-2026.5 standard, threat model, bug bounty scope, and SLA commitments.
- **License:** [`LICENSE`](LICENSE) — Version 2.0 Proprietary Software License (Restricted Read-Only for educational and academic evaluation).
- **Contact:** `core@humanityledger.com` · Security: `security@humanityledger.com`
