# Humanity Ledger — Supply-Chain Integrity & Toolchain Verification
**Version 1.1 — Updated 2026-10-31 (SBOM generation added)**  
**Authority**: `docs/PROTOCOL_SPEC.md` Task T11; Directive Section 3.2

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

---

## 3. Software Bill of Materials (SBOM)

A CycloneDX SBOM is generated quarterly and on every release to enumerate all direct and transitive dependencies.

### 3.1 SBOM Generation Command

```bash
# Generate CycloneDX SBOM (JSON format)
npx @cyclonedx/cyclonedx-npm --output-file sbom.json --output-format JSON

# Or XML format
npx @cyclonedx/cyclonedx-npm --output-file sbom.xml --output-format XML
```

### 3.2 SBOM Artifact Location

Generated SBOMs are committed to `docs/audit/sbom-YYYY-MM-DD.json` on each release tag.

```bash
# Example — generate and commit current SBOM
npx @cyclonedx/cyclonedx-npm --output-file docs/audit/sbom-$(date +%F).json
git add docs/audit/sbom-*.json
git commit -m "chore: update SBOM for release"
```

### 3.3 Dependency Review Policy

- Any new direct dependency requires a review comment in the PR explaining the rationale.
- Any dependency with a known CRITICAL CVE blocks merge until remediated.
- `npm audit` must report 0 vulnerabilities on the `claude/sync-and-hardening` branch.
- Critical cryptographic dependencies (`@noir-lang/*`, `@aztec-labs/*`, `@xmtp/*`) use exact version pins.

---

## 4. Vulnerability Disclosure for Dependencies

If a vulnerability is found in a dependency:

1. Check if an override in `package.json` (`overrides` section) can remediate without breaking changes.
2. File a GitHub Security Advisory on the dependency's repository.
3. Document the CVE and remediation in `docs/AUDIT_DOSSIER.md`.
4. Update `npm audit` badge in `docs/STATUS.md`.
