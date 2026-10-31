# Humanity Ledger — Supply-Chain Integrity & Toolchain Verification
**Version 1.0 — Normative Baseline (Task T11)**

This document establishes the reproducible toolchain verification procedure required by Task **T11** of `docs/PROTOCOL_SPEC.md`.

---

## 1. Pinned Dependencies & Integrity Verification

1. **JavaScript / TypeScript Runtime**:
   - Package manager: `npm` (strictly enforcing `package-lock.json` integrity sha512 hashes).
   - CI build command:
     ```bash
     npm ci --ignore-scripts
     ```
   - Core cryptographic dependencies are pinned to exact versions (e.g. `@xmtp/browser-sdk: 5.2.0`, `@aztec-labs/aztec.js: 0.72.0`).

2. **Noir / Barretenberg Zero-Knowledge Toolchain**:
   - Nargo Version: `>= 0.30.0`
   - Target Proof System: UltraHonk / Barretenberg BN254
   - Verification command:
     ```bash
     nargo --version
     bb --version
     ```

3. **Solidity & EVM Compiler Toolchain**:
   - Solidity compiler: `0.8.24` (via Hardhat / Foundry).
   - Optimizer runs: `200`
   - EVM target: `cancun` / `paris`

---

## 2. Commit Signing Policy on Critical Paths

All pull requests and commits modifying files within the following security-critical perimeters **require GPG/SSH cryptographically signed commits**:

- `circuits/**` (Noir zero-knowledge circuit definitions and proofs)
- `contracts/**` (L1 settlement contracts, registries, timelocks)
- `lib/aztec/**` (PXE wallet derivation, key handling, and RPC clients)
- `lib/community-apps/**` (EAF air-gapped iframe policy and `window.hl` bridge)

Unsigned commits touching these paths will be rejected by GitHub branch protection rules.
