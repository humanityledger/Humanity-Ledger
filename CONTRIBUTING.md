# Contributing to Humanity Ledger

We welcome contributions to the Humanity Ledger protocol, client applications, and infrastructure. Because Humanity Ledger is a cryptographic privacy protocol operating across zero-knowledge proof systems (Aztec / Noir / UltraHonk), end-to-end messaging (MLS / TreeKEM / RFC 9420), L1 timelocks, and sandboxed app execution (EAF), **all contributions must adhere to doctoral-grade rigour and invariant verification**.

> **Canonical Spec:** [`docs/PROTOCOL_SPEC.md`](docs/PROTOCOL_SPEC.md)  
> **Traceability:** [`docs/TRACEABILITY_MATRIX.md`](docs/TRACEABILITY_MATRIX.md)  
> **Last Updated:** 2 November 2026 · Commit `ece61837`

---

## 1. Code Ownership & Critical Paths

Per [`.github/CODEOWNERS`](.github/CODEOWNERS), pull requests touching the following paths require dedicated cryptographic and architectural review before merging:

| Path | Owner Domain |
|---|---|
| `circuits/**` | Aztec / Noir ZK circuits and verification key definitions |
| `contracts/**` | L1 Ethereum smart contracts (vaults, timelocks, registries) |
| `lib/aztec/**` | Client-side PXE interface, key derivation, and VK lifecycle enforcer |
| `lib/security/**` | Constant-time comparison, zeroization, EAF guard, canary monitors |
| `lib/community-apps/**` | Ephemeral Application Framework (EAF) runtime, CSP, postMessage bridge |
| `test/**` | Invariant test suites — any removal or weakening requires dual approval |
| `docs/PROTOCOL_SPEC.md` | Normative specification — changes require protocol lead sign-off |
| `docs/TRACEABILITY_MATRIX.md` | CI-enforced traceability — must remain consistent with `docs/STATUS.md` |

---

## 2. Mandatory Invariant Analysis for Critical PRs

Any PR modifying a critical path **must** include an explicit **Invariant Analysis** section in the PR description:

### 2.1 Aztec / Noir Circuits (`circuits/`, `lib/aztec/`)

1. **Mathematical Invariant** — What algebraic relation or state predicate does this circuit enforce? State it formally (e.g. `commitment == H(sender_secret, recipient_pubkey, amount, salt)`).
2. **Private Witness Isolation** — Does any private input escape the client boundary or get serialised to server logs or RPC endpoints?
3. **Nullifier Uniqueness** — Is the nullifier deterministically derived from a secret and a domain-separated note identifier to prevent double-spending or double-release?
4. **Constraint Regression** — Has the ACIR constraint count been profiled before and after the change?
5. **VK Migration** — If the verification key changes, does this PR follow the Circuit Migration and Versioning Policy in [`docs/VK_MONITORING.md`](docs/VK_MONITORING.md) (14-day timelock gate)?

### 2.2 L1 Smart Contracts (`contracts/`)

1. **State Machine Transitions** — What invariants are maintained across all state transitions? Are monotonic properties preserved where required?
2. **Access Control & Anti-Backdoor** — Does any function allow unilateral withdrawal of user balances or modification of verification keys without a timelock? (Strictly prohibited per Invariant P4 and [`scripts/verify-l1-bytecode.ts`](scripts/verify-l1-bytecode.ts).)
3. **Reentrancy & Economic Boundaries** — Are state updates performed before external calls (Checks-Effects-Interactions pattern)? Are arithmetic operations guarded against overflow?

### 2.3 Ephemeral Application Framework (`lib/community-apps/`)

1. **CSP Air-Gap** — Does the frame configuration maintain `connect-src 'none'` and block all network egress?
2. **Storage Compartmentalisation** — Does the storage key schema strictly partition state by `appId` and user session?
3. **Identity Spoofing Prevention** — Are user IDs for mutations injected from verified server-side session cookies rather than from client iframe payload claims?
4. **Payload Bounds** — Are state mutations bounded to the 8 KB EAF payload ceiling (enforced by `lib/security/eaf-guard.ts`)?

### 2.4 Security & Cryptographic Library (`lib/security/`)

1. **Constant-Time Guarantee** — Are all new comparisons over secret data routed through `lib/security/constant-time.ts`?
2. **Memory Zeroization** — Are private key buffers, symmetric key material, and MLS epoch secrets explicitly zeroized after use via `lib/security/zeroize.ts`?
3. **Side-Channel Surface** — Does the change introduce any conditional branching on secret data outside of constant-time primitives?

---

## 3. Pull Request Verification Checklist

Before submitting a PR, verify that all applicable boxes are checked:

- [ ] **No Unearned Claims** — No assertions of "production-ready", "audit-complete", or "quantum-safe" unless formally backed by an artifact in `docs/` and passing CI tests.
- [ ] **Zero-Simulation Rule** — No occurrence of `Fr.random()`, `mockWorkerProof`, `simulatedNullifier`, `simulatedCommitment`, or `UltraHonk-v1-proof-verified` in any production code path. Enforced by `test/aztec_e2e_no_simulation.test.ts`.
- [ ] **Automated Test Coverage**:
  - Full test suite passes: `npm run test:run` (1,076 tests · 0 failures required)
  - Noir circuit constraint tests: `npx vitest run test/circuits/`
  - EAF adversarial isolation: `npx vitest run test/eaf_isolation.adversarial.test.ts`
  - Key custody: `npx vitest run test/key_custody.test.ts`
  - MLS post-compromise: `npx vitest run test/mls_post_compromise.test.ts`
  - L1 contract invariants: `$env:TS_NODE_TRANSPILE_ONLY="1"; npx hardhat test test/contracts_invariants.test.ts`
  - Property fuzzing (60,000 iterations): `npx vitest run test/property_fuzz.test.ts`
  - Adversarial battery: `npm run test:massive`
- [ ] **Traceability** — If introducing a new protocol capability or modifying an existing claim, update `docs/TRACEABILITY_MATRIX.md` and link the corresponding test. Verify with `npx tsx scripts/check-traceability.ts`.
- [ ] **Bytecode Integrity** — If modifying L1 contracts, regenerate artifacts and re-run `npx tsx scripts/verify-l1-bytecode.ts`.
- [ ] **Security Audit** — `npm audit` reports zero vulnerabilities.

---

## 4. Mainnet Production Gate — Explicit Blockers

> [!CAUTION]
> Mainnet production deployment is **explicitly blocked** until ALL of the following gates are cleared. This is enforced by the protocol governance process.

### 4.1 External Audit Gate

- [ ] External security audit completed by a firm listed in [`docs/AUDIT_SCOPE.md`](docs/AUDIT_SCOPE.md) (Spearbit, Zellic, OpenZeppelin, or Trail of Bits)
- [ ] All **CRITICAL** findings remediated and re-tested
- [ ] All **HIGH** findings remediated or formally accepted with a dated risk note in [`docs/AUDIT_DOSSIER.md`](docs/AUDIT_DOSSIER.md)
- [ ] `npx tsx scripts/check-traceability.ts` passes post-audit

### 4.2 Security Program Gate

- [ ] Bug bounty program published on Immunefi (ref: [`docs/BUG_BOUNTY.md`](docs/BUG_BOUNTY.md))
- [ ] Incident response runbook reviewed and approved (ref: [`docs/INCIDENT_RESPONSE.md`](docs/INCIDENT_RESPONSE.md))
- [ ] Observability stack operational (ref: [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md))

### 4.3 Performance Gate

- [ ] Load test Milestone 1 (10k concurrent users) passed (ref: [`docs/LOAD_TEST_PLAN.md`](docs/LOAD_TEST_PLAN.md))
- [ ] UltraHonk proof generation p95 < 8 s on mid-range mobile hardware (ref: [`docs/PROOF_BENCHMARKS.md`](docs/PROOF_BENCHMARKS.md))

### 4.4 Zero-Regression Gate

- [ ] All tests in `scripts/run-all-tests.ps1` (or `run-all-tests.sh`) exit 0 on a clean machine
- [ ] `npm audit` reports 0 vulnerabilities
- [ ] `node scripts/forbidden-patterns.mjs` reports 0 violations
- [ ] `node scripts/check-forbidden-copy.mjs` reports 0 violations

Any deviation requires a dated risk-acceptance note signed by the protocol lead in [`docs/AUDIT_DOSSIER.md`](docs/AUDIT_DOSSIER.md).

---

## 5. Development Workflow

```bash
# 1. Fork and create a feature branch
git checkout -b feature/your-hardening-component

# 2. Install dependencies
npm install

# 3. Run the critical invariant suite
npx vitest run test/circuits/ test/key_custody.test.ts test/eaf_isolation.adversarial.test.ts test/mls_post_compromise.test.ts

# 4. Run L1 contract invariants
$env:TS_NODE_TRANSPILE_ONLY="1"; npx hardhat test test/contracts_invariants.test.ts

# 5. Run the full suite
npm run test:run

# 6. Verify traceability
npx tsx scripts/check-traceability.ts

# 7. Build
npm run build:local

# 8. Submit your PR with the Invariant Analysis section completed
```

---

## 6. Commit Message Convention

Use the following prefix convention for all commits:

| Prefix | When to Use |
|---|---|
| `feat(circuit):` | New or modified Noir circuit |
| `feat(contract):` | New or modified L1 Solidity contract |
| `feat(pxe):` | Aztec PXE client integration changes |
| `fix(security):` | Security hardening or vulnerability remediation |
| `test:` | New or updated automated tests |
| `docs:` | Documentation updates |
| `chore:` | Dependency updates, CI config, tooling |

---

## 7. Contact

For questions about contributing or about the protocol architecture:

- **Email:** `core@humanityledger.com`
- **Security issues:** `security@humanityledger.com` (see [`SECURITY.md`](SECURITY.md))
- **Repository:** [https://github.com/humanityledger/Humanity-Ledger](https://github.com/humanityledger/Humanity-Ledger)
