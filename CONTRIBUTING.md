# Contributing to Humanity Ledger

We welcome contributions to the Humanity Ledger protocol, client applications, and infrastructure. Because Humanity Ledger is a cryptographic privacy protocol operating across zero-knowledge proof systems (Aztec/Noir/UltraHonk), end-to-end messaging (MLS/TreeKEM), L1 timelocks, and sandboxed app execution (EAF), contributions must adhere to doctoral-grade rigor and invariant verification.

---

## 1. Governance & Code Ownership

Per `.github/CODEOWNERS`, pull requests affecting critical paths require dedicated cryptographic and architectural review before merging:

- `circuits/**`: Aztec/Noir ZK circuits and verification key definitions.
- `contracts/**`: L1 Ethereum smart contracts (vaults, timelocks, registries).
- `lib/aztec/**`: Client-side PXE interface, key derivation, and Aztec bridge.
- `lib/community-apps/**`: Ephemeral Application Framework (EAF) runtime, CSP security, and postMessage bridge.
- `test/**`: Invariant test suites (`test/key_custody.test.ts`, `test/mls_post_compromise.test.ts`, `test/circuits/`, `test/eaf_isolation.adversarial.test.ts`, `test/contracts_invariants.test.ts`, `test/property_fuzz.test.ts`).

---

## 2. Mandatory Invariant Analysis for Critical PRs

Any PR modifying files in the critical paths listed above **must** include an explicit Invariant Analysis section in the PR description answering the following:

### 2.1 Aztec / Noir Circuits (`circuits/`, `lib/aztec/`)
1. **Mathematical Invariant**: What algebraic relation or state predicate does this circuit enforce?
2. **Private Witness Isolation**: Does any private input escape the client boundary or get serialized to server logs/RPC endpoints?
3. **Nullifier Uniqueness**: Is the nullifier deterministically derived from a secret and domain-separated note identifier to prevent double-spending?
4. **Constraint Regression**: Has the ACIR constraint count been profiled?
5. **Circuit Versioning**: If a verification key changes, does this PR adhere to the **Circuit Migration and Versioning Policy** (Spec §8)?

### 2.2 L1 Smart Contracts (`contracts/`)
1. **State Machine Transitions**: What state invariants are maintained? Are all state transitions monotonic where required?
2. **Access Control & Anti-Backdoor**: Does any function allow unilateral withdrawal of user balances or modification of verification keys without a timelock? (Strictly prohibited per Invariant P4).
3. **Reentrancy & Economic Boundaries**: Are state updates performed before external calls (`Checks-Effects-Interactions`)? Are arithmetic operations guarded against overflow/underflow?

### 2.3 Ephemeral Application Framework (`lib/community-apps/`, `components/chat/community-apps/`)
1. **CSP Air-Gap**: Does the frame configuration maintain `connect-src 'none'` and block network egress?
2. **Storage Compartmentalization**: Does the storage key schema strictly partition state by `appId` and user session?
3. **Identity Spoofing Prevention**: Are user IDs for mutations injected from verified server-side session cookies rather than trusting client iframe payload claims?
4. **Payload Bounds**: Are state mutations bounded to 8 KB payload limits to prevent DoS?

---

## 3. Pull Request Verification Checklist

Before submitting a PR, verify that all applicable checks are satisfied:

- [ ] **No Unearned Claims**: No claims of "100/100", "production-ready", or "audit-complete" unless formally backed by an artifact in `docs/` and passing CI tests.
- [ ] **Automated Test Coverage**:
  - Critical invariant tests pass: `npm test`
  - Circuit constraint tests pass: `npx vitest run test/circuits/`
  - EAF adversarial isolation tests pass: `npx vitest run test/eaf_isolation.adversarial.test.ts`
  - Key custody tests pass: `npx vitest run test/key_custody.test.ts`
  - MLS post-compromise tests pass: `npx vitest run test/mls_post_compromise.test.ts`
  - L1 contract invariant tests pass: `npm run test:contracts`
  - Property fuzzing passes (30,000 iterations): `npx vitest run test/property_fuzz.test.ts`
- [ ] **Traceability**: If introducing a new protocol capability or modifying an existing claim, update `docs/TRACEABILITY_MATRIX.md` and link the corresponding test.
- [ ] **Formatting & Style**:
  - Zero unescaped underscores in markdown LaTeX formulas.
  - No automatic hyphenation in UI (`hyphens: none`).
  - IBM Plex Sans for prose, IBM Plex Mono for addresses and cryptographic hashes.

---

## 4. Development Workflow

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/hardening-component
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the local test suites:
   ```bash
   npm run test:crypto
   npx vitest run test/circuits/
   npx vitest run test/eaf_isolation.adversarial.test.ts
   npm run test:contracts
   ```
4. Build the application:
   ```bash
   npm run build
   ```
5. Submit your PR with the invariant analysis completed.
