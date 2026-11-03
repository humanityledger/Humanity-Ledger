# Contributing to Humanity Ledger

This document establishes the technical standards, architectural review requirements, and invariant validation procedures for contributing to the Humanity Ledger protocol monorepo.

Because Humanity Ledger operates at the intersection of client side zero knowledge proof synthesis (Aztec / Noir / UltraHonk), cryptographic group state ratcheting (Messaging Layer Security / RFC 9420), and Layer 1 smart contract settlement, all contributions must satisfy strict mathematical rigor and empirical invariant testing.

> **Normative Specification:** [`docs/PROTOCOL_SPEC.md`](docs/PROTOCOL_SPEC.md)
> **Constraint Completeness Analysis:** [`circuits/CONSTRAINT_COMPLETENESS.md`](circuits/CONSTRAINT_COMPLETENESS.md)
> **Traceability Matrix:** [`docs/TRACEABILITY_MATRIX.md`](docs/TRACEABILITY_MATRIX.md)
> **Aztec Validation Dossier:** [`docs/AZTEC_FOUNDATION_DOSSIER.md`](docs/AZTEC_FOUNDATION_DOSSIER.md)
> **Baseline Commit:** `806d6d69` (November 2026)

---

## 1. Monorepo Architecture and Code Ownership

Unlike upstream Aztec development which spans separated repositories (`aztec-packages`, `noir`, `barretenberg`), Humanity Ledger maintains an integrated monorepo. Changes to core components affect interdependent cryptographic layers.

Per [`.github/CODEOWNERS`](.github/CODEOWNERS), pull requests modifying the following paths require dedicated cryptographic and architectural review prior to merging:

| Path | Domain | Focus of Review |
|---|---|---|
| `circuits/**` | Noir Domain Circuits | Algebraic relations, ACIR constraint counts, overflow analysis, and verification key generation |
| `circuits/CONSTRAINT_COMPLETENESS.md` | Pre-Audit Gap Register | Must be updated whenever a circuit changes; gap status must reflect code reality |
| `contracts/**` | Layer 1 Settlement | Solidity state transitions, non custodial timelocks, and EVM gas profiling |
| `lib/aztec/**` | Aztec PXE Client | Local witness generation, Barretenberg WASM execution, VK lifecycle checks, and PXE boundary security |
| `lib/security/**` | Cryptographic Hardening | Timing safe equality, memory zeroization routines, and iframe boundary enforcement |
| `lib/community-apps/**` | Sandbox Runtime | Ephemeral application isolation, CSP policy enforcement, payload boundary, and postMessage schemas |
| `test/**` | Automated Invariant Suites | Test integrity: deletion or weakening of existing assertions is strictly prohibited |
| `docs/PROTOCOL_SPEC.md` | Normative Specification | Formal architectural specifications and threat models |
| `docs/TRACEABILITY_MATRIX.md` | Traceability Matrix | Mapping of claims and criteria to executable test files (enforced by CI) |

---

## 2. Mandatory Invariant Analysis for Critical Pull Requests

Every pull request that modifies a critical component must include an explicit **Invariant Analysis** section in the pull request description detailing the following domains:

### 2.1 Aztec and Noir Circuits (`circuits/`, `lib/aztec/`)

1. **Algebraic Invariant:** Formulate the mathematical relation enforced by the circuit using prose or inline code (e.g., `commitment = pedersen_hash(secret, pubkey, amount, salt)`).
2. **Private Witness Isolation:** Confirm that private witnesses, nullifier secrets (nsk), and incoming viewing keys (IVK) remain within the local client Web Worker and are never serialized to network transport or RPC logs. Verified by `test/pxe_boundary_security.test.ts`.
3. **Nullifier Uniqueness:** Verify that the nullifier is derived deterministically from private state and domain separated note identifiers to prevent double spending.
4. **Constraint Regression:** Document the ACIR constraint count before and after the modification.
5. **Overflow Analysis:** For any `u64` arithmetic in circuits, document the maximum reachable value and confirm it cannot overflow. For streams, confirm `rate_per_second <= MAX_RATE` is preserved.
6. **Verification Key Policy:** If the circuit changes, confirm the modification complies with the 14 day timelock policy in [`docs/VK_MONITORING.md`](docs/VK_MONITORING.md) and update [`circuits/CONSTRAINT_COMPLETENESS.md`](circuits/CONSTRAINT_COMPLETENESS.md).
7. **Gap Register Update:** Any change that closes, opens, or changes the severity of a gap in `circuits/CONSTRAINT_COMPLETENESS.md` must update that document in the same pull request.

### 2.2 Layer 1 Smart Contracts (`contracts/`)

1. **State Transition Invariants:** Specify the preconditions and postconditions of the contract state machine.
2. **Absence of Unilateral Drain:** Demonstrate that no contract owner or privileged address can withdraw user balances or bypass timelock delays (enforced by Invariant P6 and `scripts/verify-l1-bytecode.ts`).
3. **Reentrancy and Arithmetic Safety:** Verify adherence to the Checks Effects Interactions pattern and confirm arithmetic operations prevent overflow under Solidity 0.8.28 rules.

### 2.3 Ephemeral Application Framework (`lib/community-apps/`, `lib/security/eaf-guard.ts`)

1. **Hermetic CSP Air Gap:** Confirm that the sandbox iframe maintains `connect-src 'none'` and blocks all network sockets.
2. **Storage Compartmentalization:** Verify that storage keys are strictly isolated per application identifier and session token.
3. **Identity Spoofing Immunity:** Ensure mutation operations validate user identity from verified server session state rather than trusting client iframe claims.
4. **Payload Bounding:** Verify that all cross-context messages strictly respect the 8 KB payload ceiling enforced by `lib/security/eaf-guard.ts`. The exact boundary (8192 bytes serialized) is tested by `test/eaf_isolation.adversarial.test.ts` (P6.6).
5. **Prototype Pollution Prevention:** Confirm that crafted `__proto__` keys in bridge messages cannot escalate privileges (P6.7).
6. **Frozen Bridge Surface:** Verify that `window.hl` is frozen and cannot be extended at runtime (P6.8).

### 2.4 Cryptographic Library (`lib/security/`)

1. **Timing Invariance:** Ensure that secret comparisons use `lib/security/constant-time.ts` (`crypto.timingSafeEqual`) to eliminate timing side channels.
2. **Memory Zeroization:** Verify that ephemeral key buffers and symmetric secrets are zeroized immediately after use via `lib/security/zeroize.ts`.
3. **Side Channel Elimination:** Confirm that no conditional branching occurs based on secret data outside of constant time primitives.

### 2.5 PXE Boundary and MLS Lockfile (`test/pxe_boundary_security.test.ts`)

Any change to the PXE integration pipeline, XMTP dependency version, or MLS epoch key derivation must confirm:

1. Witnesses, nsk, and IVK are not reachable from any JSON-serializable public surface.
2. The XMTP version pin at 5.2.0 in `package.json` is preserved or updated via an explicit version-bump commit.
3. RFC 9420 epoch advancement continues to produce computationally independent keys.

---

## 3. Pull Request Verification Checklist

Before submitting a pull request, verify that every item on this checklist is satisfied:

- [ ] **No Unsubstantiated Claims:** No assertions of production readiness, formal verification, or quantum resistance unless supported by documented artifacts and passing test suites.
- [ ] **Prohibition of Synthetic Proof Simulation:** No usage of `Fr.random()`, `mockWorkerProof`, `simulatedNullifier`, or synthetic proof tokens in production test paths. Enforced by `test/aztec_e2e_no_simulation.test.ts` and `node scripts/forbidden-patterns.mjs`.
- [ ] **Automated Test Battery Passing:**
  * Full test suite: `npm run test:run` (must finish with 0 failures)
  * Noir circuit constraint tests: `npx vitest run test/circuits/`
  * Streams rate bound (Gap G4 closure): `npx vitest run test/circuits/streams_rate_bound.test.ts`
  * PXE boundary and MLS lockfile: `npx vitest run test/pxe_boundary_security.test.ts`
  * VK HASH_MISMATCH unconditional block: `npx vitest run test/vk_hash_mismatch.test.ts`
  * EAF adversarial isolation (8 tests): `npx vitest run test/eaf_isolation.adversarial.test.ts`
  * Non custodial key isolation: `npx vitest run test/key_custody.test.ts`
  * MLS post compromise security: `npx vitest run test/mls_post_compromise.test.ts`
  * Layer 1 contract invariants: `npm run test:contracts` (43 passing Hardhat tests)
  * High capacity property fuzzing: `npx vitest run test/property_fuzz.test.ts` (60,000 iterations)
  * Adversarial security battery: `npm run test:massive`
- [ ] **Traceability Synchronization:** When adding or modifying protocol capabilities, update `docs/TRACEABILITY_MATRIX.md` and verify with `npm run check:traceability`.
- [ ] **Constraint Completeness Update:** When modifying a Noir circuit, update `circuits/CONSTRAINT_COMPLETENESS.md` to reflect any opened or closed gaps.
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

### 4.2 Pre-Audit Circuit Requirements

- [ ] All gaps in `circuits/CONSTRAINT_COMPLETENESS.md` either closed or explicitly accepted with documented rationale.
- [ ] Identity circuit migrated from depth-1 prototype to depth-32 Merkle tree with governance-controlled sanction set.
- [ ] Hash function migration from Pedersen to Poseidon2 completed and re-audited.
- [ ] Grumpkin point validation boundary decision documented and implemented.

### 4.3 Security Operations Gate

- [ ] Coordinated vulnerability disclosure framework established (see [`docs/BUG_BOUNTY.md`](docs/BUG_BOUNTY.md)).
- [ ] Incident response runbook reviewed and approved ([`docs/INCIDENT_RESPONSE.md`](docs/INCIDENT_RESPONSE.md)).
- [ ] Telemetry and observability pipeline operational ([`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md)).

### 4.4 Performance and Scalability Gate

- [ ] Concurrent user load testing Milestone 1 (10,000 concurrent sessions) completed ([`docs/LOAD_TEST_PLAN.md`](docs/LOAD_TEST_PLAN.md)).
- [ ] Client UltraHonk proof generation p95 latency under 8 seconds on consumer mobile hardware ([`docs/PROOF_BENCHMARKS.md`](docs/PROOF_BENCHMARKS.md)).
- [ ] Barretenberg WASM peak RSS below 1.2 GB on Mobile Safari (currently 1.8 GB on desktop Chromium).

### 4.5 Automated Zero Regression Gate

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

# 3. Execute PXE boundary security and VK integrity tests
npx vitest run test/pxe_boundary_security.test.ts test/vk_hash_mismatch.test.ts

# 4. Execute Layer 1 contract invariants (Cancun EVM)
npm run test:contracts

# 5. Execute the complete test suite
npm run test:run

# 6. Verify normative traceability consistency
npm run check:traceability

# 7. Verify bytecode integrity and absence of backdoor patterns
npx tsx scripts/verify-l1-bytecode.ts

# 8. Build local application package
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
| `docs:` | Specification and documentation updates (including constraint completeness) |
| `chore:` | Tooling, monorepo scripts, and dependency updates |

---

## 7. Contacts

* **Protocol Communications and Security Inquiries:** `humanityledger@icloud.com` (see [`SECURITY.md`](SECURITY.md))
* **Licensing and Legal:** `humanityledger@icloud.com` (see [`LICENSE`](LICENSE))
* **Repository:** [https://github.com/humanityledger/Humanity-Ledger](https://github.com/humanityledger/Humanity-Ledger)
