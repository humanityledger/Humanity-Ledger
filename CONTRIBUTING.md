# Contributing to Humanity Ledger

This document establishes the technical standards, architectural review requirements, and invariant validation procedures for contributing to the Humanity Ledger protocol monorepo.

Because Humanity Ledger operates at the intersection of client side zero knowledge proof synthesis (Aztec / Noir / UltraHonk), cryptographic group state ratcheting (Messaging Layer Security / RFC 9420), and Layer 1 smart contract settlement, all contributions must satisfy strict mathematical rigor and empirical invariant testing.

> **Normative Specification:** [`docs/PROTOCOL_SPEC.md`](docs/PROTOCOL_SPEC.md)  
> **Traceability Matrix:** [`docs/TRACEABILITY_MATRIX.md`](docs/TRACEABILITY_MATRIX.md)  
> **Aztec Validation Dossier:** [`docs/AZTEC_FOUNDATION_DOSSIER.md`](docs/AZTEC_FOUNDATION_DOSSIER.md)  
> **Baseline Commit:** `931b1005` (November 2026)

---

## 1. Monorepo Architecture and Code Ownership

Unlike upstream Aztec development which spans separated repositories (`aztec-packages`, `noir`, `barretenberg`), Humanity Ledger maintains an integrated monorepo. Changes to core components affect interdependent cryptographic layers.

Per [`.github/CODEOWNERS`](.github/CODEOWNERS), pull requests modifying the following paths require dedicated cryptographic and architectural review prior to merging:

| Path | Domain | Focus of Review |
|---|---|---|
| `circuits/**` | Noir Domain Circuits | Algebraic relations, ACIR constraint counts, and verification key generation |
| `contracts/**` | Layer 1 Settlement | Solidity state transitions, non custodial timelocks, and EVM gas profiling |
| `lib/aztec/**` | Aztec PXE Client | Local witness generation, Barretenberg WASM execution, and VK lifecycle checks |
| `lib/security/**` | Cryptographic Hardening | Timing safe equality, memory zeroization routines, and iframe boundary enforcement |
| `lib/community-apps/**` | Sandbox Runtime | Ephemeral application isolation, CSP policy enforcement, and postMessage schemas |
| `test/**` | Automated Invariant Suites | Test integrity; deletion or weakening of existing assertions is strictly prohibited |
| `docs/PROTOCOL_SPEC.md` | Normative Specification | Formal architectural specifications and threat models |
| `docs/TRACEABILITY_MATRIX.md` | Traceability Matrix | Mapping of claims and criteria to executable test files (enforced by CI) |

---

## 2. Mandatory Invariant Analysis for Critical Pull Requests

Every pull request that modifies a critical component must include an explicit **Invariant Analysis** section in the pull request description detailing the following four domains:

### 2.1 Aztec and Noir Circuits (`circuits/`, `lib/aztec/`)

1. **Algebraic Invariant:** Formulate the mathematical relation enforced by the circuit (e.g. $\text{commitment} = \mathcal{H}(\text{secret}, \text{pubkey}, \text{amount}, \text{salt})$).
2. **Private Witness Isolation:** Confirm that private witnesses remain within the local client Web Worker and are never serialised to network transport or RPC logs.
3. **Nullifier Uniqueness:** Verify that the nullifier is derived deterministically from private state and domain separated note identifiers to prevent double spending.
4. **Constraint Regression:** Document the ACIR constraint count before and after the modification.
5. **Verification Key Policy:** If the circuit changes, verify that the modification conforms to the 14 day timelock policy documented in [`docs/VK_MONITORING.md`](docs/VK_MONITORING.md).

### 2.2 Layer 1 Smart Contracts (`contracts/`)

1. **State Transition Invariants:** Specify the preconditions and postconditions of the contract state machine.
2. **Absence of Unilateral Drain:** Demonstrate that no contract owner or privileged address can withdraw user balances or bypass timelock delays (enforced by Invariant P6 and `scripts/verify-l1-bytecode.ts`).
3. **Reentrancy and Arithmetic Safety:** Verify adherence to the Checks Effects Interactions pattern and ensure arithmetic operations prevent overflow under Solidity 0.8.28 rules.

### 2.3 Ephemeral Application Framework (`lib/community-apps/`, `lib/security/eaf-guard.ts`)

1. **Hermetic CSP Air Gap:** Confirm that the sandbox iframe maintains `connect-src 'none'` and blocks all network sockets.
2. **Storage Compartmentalization:** Verify that storage keys are strictly isolated per application identifier and session token.
3. **Identity Spoofing Immunity:** Ensure mutation operations validate user identity from verified server session cookies rather than trusting client iframe claims.
4. **Payload Bounding:** Verify that all cross context messages strictly respect the 8 KB payload ceiling enforced by `lib/security/eaf-guard.ts`.

### 2.4 Cryptographic Library (`lib/security/`)

1. **Timing Invariance:** Ensure that secret comparisons utilize `lib/security/constant-time.ts` (`crypto.timingSafeEqual`) to eliminate timing side channels.
2. **Memory Zeroization:** Verify that ephemeral key buffers and symmetric secrets are zeroized immediately after use using `lib/security/zeroize.ts`.
3. **Side Channel Elimination:** Confirm that no conditional branching occurs based on secret data outside of constant time primitives.

---

## 3. Pull Request Verification Checklist

Before submitting a pull request, verify that every item on this checklist is satisfied:

- [ ] **No Unsubstantiated Claims:** No assertions of production readiness or formal verification unless supported by documented artifacts in `docs/` and passing test suites.
- [ ] **Prohibition of Synthetic Proof Simulation:** No usage of `Fr.random()`, `mockWorkerProof`, `simulatedNullifier`, or synthetic proof tokens in production test paths (enforced by `test/aztec_e2e_no_simulation.test.ts`).
- [ ] **Automated Test Battery Passing:**
  - Full test suite passes: `npm run test:run` (1,076 tests passing · 0 failures)
  - Noir circuit constraint tests: `npx vitest run test/circuits/`
  - Ephemeral application sandbox isolation: `npx vitest run test/eaf_isolation.adversarial.test.ts`
  - Non custodial key isolation: `npx vitest run test/key_custody.test.ts`
  - Messaging Layer Security post compromise tests: `npx vitest run test/mls_post_compromise.test.ts`
  - Layer 1 contract invariants: `npm run test:contracts` (43 passing Hardhat tests)
  - High capacity property fuzzing: `npx vitest run test/property_fuzz.test.ts` (60,000 iterations)
  - Adversarial security battery: `npm run test:massive`
- [ ] **Traceability Synchronization:** When adding or modifying protocol capabilities, update `docs/TRACEABILITY_MATRIX.md` and verify with `npm run check:traceability`.
- [ ] **Bytecode Integrity:** When modifying Layer 1 Solidity contracts, recompile artifacts and confirm clean output from `npx tsx scripts/verify-l1-bytecode.ts`.
- [ ] **Dependency Audit:** Verify that `npm audit` reports zero vulnerabilities.

---

## 4. Mainnet Production Deployment Gate

Mainnet production deployment is gated by formal governance criteria. The protocol will remain in Testnet Stage 1 until each of the following milestones is fulfilled:

### 4.1 External Security Audit Gate

- [ ] Comprehensive external audit completed by an accredited Tier 1 security firm listed in [`docs/AUDIT_SCOPE.md`](docs/AUDIT_SCOPE.md) (Spearbit, Zellic, OpenZeppelin, or Trail of Bits).
- [ ] Complete remediation of all Critical and High severity findings.
- [ ] Formal sign off and publication of the audit report in [`docs/AUDIT_DOSSIER.md`](docs/AUDIT_DOSSIER.md).
- [ ] Verification of consistency via `npm run check:traceability`.

### 4.2 Security Operations Gate

- [ ] Coordinated vulnerability disclosure framework established (see [`docs/BUG_BOUNTY.md`](docs/BUG_BOUNTY.md)).
- [ ] Incident response runbook reviewed and approved ([`docs/INCIDENT_RESPONSE.md`](docs/INCIDENT_RESPONSE.md)).
- [ ] Telemetry and observability pipeline operational ([`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md)).

### 4.3 Performance and Scalability Gate

- [ ] Concurrent user load testing Milestone 1 (10,000 concurrent sessions) completed ([`docs/LOAD_TEST_PLAN.md`](docs/LOAD_TEST_PLAN.md)).
- [ ] Client UltraHonk proof generation p95 latency under 8 seconds on consumer mobile hardware ([`docs/PROOF_BENCHMARKS.md`](docs/PROOF_BENCHMARKS.md)).

### 4.4 Automated Zero Regression Gate

- [ ] All tests in `npm run test:run` and `npm run test:contracts` exit with code 0 on a clean environment.
- [ ] `npm audit` reports zero known vulnerabilities.
- [ ] `node scripts/forbidden-patterns.mjs` reports zero violations.
- [ ] `node scripts/check-forbidden-copy.mjs` reports zero violations.

---

## 5. Local Development Workflow

```bash
# 1. Clone repository and install dependencies
git clone https://github.com/humanityledger/Humanity-Ledger.git
cd Humanity-Ledger
npm install

# 2. Execute critical invariant verification
npx vitest run test/circuits/ test/key_custody.test.ts test/eaf_isolation.adversarial.test.ts test/mls_post_compromise.test.ts

# 3. Execute Layer 1 contract invariants (Cancun EVM)
npm run test:contracts

# 4. Execute the complete test suite
npm run test:run

# 5. Verify normative traceability consistency
npm run check:traceability

# 6. Verify bytecode integrity and absence of backdoor patterns
npx tsx scripts/verify-l1-bytecode.ts

# 7. Build local application package
npm run build:local
```

---

## 6. Commit Message Convention

Commits must follow structured prefixes indicating the modified package domain:

| Prefix | Domain |
|---|---|
| `feat(circuit):` | New or modified Noir circuit and ACIR constraints |
| `feat(contract):` | New or modified Layer 1 Solidity contract |
| `feat(pxe):` | Aztec PXE client orchestration or Barretenberg WASM integration |
| `fix(security):` | Cryptographic hardening or vulnerability mitigation |
| `test:` | New or updated automated invariant tests |
| `docs:` | Specification and documentation updates |
| `chore:` | Tooling, monorepo scripts, and dependency updates |

---

## 7. Contacts

- **Protocol Communications and Security Inquiries:** `humanityledger@icloud.com` (see [`SECURITY.md`](SECURITY.md))
- **Licensing and Legal:** `humanityledger@icloud.com` (see [`LICENSE`](LICENSE))
- **Repository:** [https://github.com/humanityledger/Humanity-Ledger](https://github.com/humanityledger/Humanity-Ledger)
