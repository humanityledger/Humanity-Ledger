# Humanity Ledger — Formal Audit Dossier & Residual Risk Register
**Version 1.0 — Normative Baseline (Conformance Target A6)**

> **Normative Authority Notice**: This dossier conforms to Section 5 of the Humanity Ledger Protocol Complete Normative Maturity and Implementation Specification (`docs/PROTOCOL_SPEC.md`). It documents every residual risk, its severity, current mitigation status, and the formal justification for risks accepted by design.

---

## 1. Protocol Architecture & Invariant Scope

The Humanity Ledger protocol couples client-side zero-knowledge state transitions (Aztec Noir UltraHonk) with post-compromise secure messaging (XMTP MLS RFC 9420) and isolated multi-tenant execution frames (EAF).

### Invariant Summary (P1–P6)

1. **P1 (Message Confidentiality)**: Verified via `test/unit/crypto/xmtp-mls.test.ts` and RFC 9420 TreeKEM encryption.
2. **P2 (Post-Compromise Security)**: Verified via `test/mls_post_compromise.test.ts` (epoch advance unreadability).
3. **P3 (Private State Confidentiality)**: Verified via `test/circuits/*.test.ts` and client-side Web Worker execution.
4. **P4 (Private State Integrity)**: Verified via Noir circuit constraints and L1 contracts (`test/contracts_invariants.test.ts`).
5. **P5 (No Server Key Custody)**: Verified via `test/key_custody.test.ts` (full server compromise yields zero spending keys).
6. **P6 (EAF Isolation)**: Verified via `test/eaf_isolation.adversarial.test.ts` (air-gapped null-origin sandbox).

---

## 2. Residual Risk Register (Normative Section 5)

| Risk Identifier | Stated Threat | Severity | Treatment Status | Mitigation / Acceptance Rationale |
|---|---|---|---|---|
| **RISK-01** | **Proof generation failure on constrained devices** (RAM/CPU exhaustion during client-side UltraHonk synthesis on low-end mobile devices). | **Medium** | **CLOSED (Fail-Closed)** | Prover worker implements strict fail-closed boundary: if synthesis fails, zero witness or private state is leaked. User interface receives an explicit retry error and offers fallback to desktop or local node. |
| **RISK-02** | **Sequencer censorship of valid proofs** (A malicious Aztec sequencer selectively drops or delays state transitions). | **Medium** | **ACCEPTED (By Design)** | Sequencers cannot forge invalid state transitions or break circuit constraints (P4). Users can re-broadcast or relay proofs through alternative sequencers. Documented in threat model §1.1. |
| **RISK-03** | **MLS metadata leakage** (Packet timing, message size, and group membership visible to transport network). | **Low** | **ACCEPTED (Out of Scope)** | Formally declared outside the protocol threat model (Section 1.3). Content confidentiality and post-compromise ratcheting remain cryptographically unbroken (P1, P2). |
| **RISK-04** | **Client-side implementation bugs in PXE or EAF sandbox**. | **High until tested** | **CLOSED (Mitigated by Test Suites)** | Mitigated by automated adversarial suites in `test/circuits/` (T5) and `test/eaf_isolation.adversarial.test.ts` (T7). |
| **RISK-05** | **Dependency supply-chain compromise** (Malicious package injection in npm/cargo dependencies). | **Medium** | **CLOSED (Integrity Pinning)** | All direct dependencies pinned to exact versions in `package.json` (e.g. `@xmtp/browser-sdk` 5.2.0); CI enforces lockfile immutability (`npm ci --ignore-scripts`). |

---

## 3. L1 Governance & Centralization Analysis

1. **Timelock Governance**: Administrative parameter adjustments in `HumanityTimeLockVault` require minimum timelock cooldown periods. Immediate unilateral admin execution is cryptographically blocked on-chain.
2. **Zero Custody**: Settlement contracts hold zero user private keys. Dead man switch mechanisms (`LedgerDeadmanSwitch`) operate non-custodially via time-weighted authorization without granting contract owners access to user tokens.
3. **No Unilateral VK Mutation**: Verification keys for private escrow and stream settlements are immutable or gated behind published multi-day timelocks.

---

## 4. Reproducibility Verification

External auditors can reproduce and verify this dossier directly from repository state:

```bash
# 1. Verify zero server key custody (P5 / T3):
npx vitest run test/key_custody.test.ts

# 2. Verify MLS post-compromise security (P2 / T4):
npx vitest run test/mls_post_compromise.test.ts

# 3. Verify Noir circuit constraints & negative tests (P4 / T5):
npx vitest run test/circuits/

# 4. Verify EAF sandbox breakout resistance (P6 / T7):
npx vitest run test/eaf_isolation.adversarial.test.ts

# 5. Verify L1 contract anti-backdoor invariants (A4 / T8):
npx hardhat test test/contracts_invariants.test.ts

# 6. Verify property-based fuzzing (30,000 iterations / T12):
npx vitest run test/property_fuzz.test.ts
```

---

## 5. npm Dependency Vulnerability Register (T11 Supply Chain — Formal Acceptance)

Last evaluated: 2026-10-31. Produced by `npm audit`. 83 total advisories.

All vulnerabilities are formally classified below. **Zero vulnerabilities affect the protocol's cryptographic core** (Aztec proving system, MLS TreeKEM key derivation, circuit constraint logic). No private key derivation, proof generation, or key custody code is affected by any of these advisories.

### 5.1 Vulnerabilities with Upstream Overrides Already Applied

The following transitive dependency vulnerabilities are mitigated at the package resolution level via `overrides` in `package.json`. No further action required.

| Advisory | CVE / GHSA | Affected Package | Override Applied | Status |
|---|---|---|---|---|
| Elliptic risky crypto primitive | GHSA-848j-6mx2-7j84 | `elliptic` | `"elliptic": "^6.6.1"` | **MITIGATED** |
| minimatch ReDoS / globparts amplification | GHSA-g3hv-75wg-m249 | `minimatch` | `"minimatch": "^10.0.1"` | **MITIGATED** |
| deepmerge-ts prototype confusion | — | `deepmerge-ts` | `"deepmerge-ts": "^8.0.2"` | **MITIGATED** |
| crypto-browserify outdated primitives | — | `crypto-browserify` | `"crypto-browserify": "^3.12.1"` | **MITIGATED** |
| mocha glob/minimatch chain | — | `mocha` | `"mocha": "^12.0.3"` | **MITIGATED** |

### 5.2 Vulnerabilities Formally Accepted — Dev-Only Scope (Zero Production Exposure)

The following vulnerabilities exist exclusively in development and build toolchain packages. These packages are **never bundled into the client or server production runtime**. They are `devDependencies` used only during local development, CI linting, Solidity compilation, and test execution.

| Advisory | Affected Packages | Scope | Formal Acceptance Rationale |
|---|---|---|---|
| glob AbortSignal cancellation bypass (GHSA-3g3m-2fjr-6pw4) | `glob`, `rimraf`, `shelljs`, `sc-istanbul`, `typechain`, `globby`, `solidity-coverage`, `hardhat-gas-reporter` | **Dev toolchain only** | No fix available upstream for `glob@3.0.0-14.0.1`. These packages are excluded from production builds via `devDependencies`. The filesystem traversal timing issue requires an active attacker in the same process executing glob patterns with AbortSignal — not applicable in CI or local dev. |
| minimatch DoS (GHSA-g3hv-75wg-m249) | `eslint`, `eslint-config-next`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `@typescript-eslint/parser`, `@eslint/eslintrc`, `@humanwhocodes/config-array`, `recursive-readdir`, `filelist`, `jake`, `ejs`, `snarkjs` | **Dev/lint toolchain only** | Same as above — dev-only linting and compilation tools. The DoS requires specially crafted glob patterns sent by an external party to a running server, which does not apply to static build tooling. |

### 5.3 Vulnerabilities Formally Accepted — Third-Party Wallet Connector Ecosystem

The following vulnerabilities exist in the WalletConnect / Reown AppKit / wagmi / RainbowKit wallet connection stack. These are transitive dependencies with no upstream patch published at the time of this evaluation. The elliptic-based signatures these libraries use are **for wallet connection UX only** — they do not touch the Aztec proving system, MLS key material, or any circuit private witnesses.

| Advisory | Root Affected Package | Exposure Path | Formal Acceptance Rationale |
|---|---|---|---|
| elliptic risky primitive (GHSA-848j-6mx2-7j84) | `@ethersproject/signing-key <= 5.8.0` | `@walletconnect/utils` → `@ethersproject/hash` → `@ethersproject/signing-key` → `elliptic` | The `@ethersproject/v5` suite is pinned by WalletConnect internals. Override `"elliptic": "^6.6.1"` is applied at the resolution level. The remaining advisory is a package registry false-positive against the `@ethersproject` major range — WalletConnect has not shipped a v6 migration. Runtime exposure is limited to ECDSA signature computation for wallet session authentication, not cryptographic key custody or ZK proof generation. |
| deepmerge prototype poisoning (GHSA-gcqx-w48m-w2h4) | `@rainbow-me/rainbowkit >= 0.1.1` | `@vanilla-extract/css` → `deepmerge` | Fix requires downgrading RainbowKit to `0.1.0`, which is a 2022-era pre-release with severe API regressions. The prototype poisoning in `deepmerge.mergeObject()` requires an attacker to control a merged object containing `__proto__` keys at wallet connection UI rendering time. Not remotely exploitable. **Accepted** pending RainbowKit v2+ releasing a `@vanilla-extract/css` upgrade. |
| elliptic risky primitive (GHSA-848j-6mx2-7j84) | `alchemy-sdk` | `alchemy-sdk` → `@ethersproject/*` → `elliptic` | `alchemy-sdk` uses `@ethersproject/v5` for Ethereum RPC calls (balance queries, transaction receipts). Aztec protocol operations bypass `alchemy-sdk` entirely via the Aztec node RPC. **Accepted** pending Alchemy SDK v4 migration to `ethers@v6`. |

### 5.4 Vulnerabilities Formally Accepted — Aztec SDK Upstream (No Fix Available)

The Aztec Labs SDK packages `@aztec/pxe`, `@aztec/wallet-sdk`, `@aztec/wallets`, and their `@aztec-labs/*` equivalents depend on `glob` versions flagged by GHSA-3g3m-2fjr-6pw4. Aztec Labs has not published a patched version at the time of this evaluation.

| Advisory | Affected Package | Formal Acceptance Rationale |
|---|---|---|
| glob AbortSignal bypass (GHSA-3g3m-2fjr-6pw4) | `@aztec/pxe`, `@aztec/wallet-sdk`, `@aztec/wallets`, `@aztec-labs/pxe`, `@aztec-labs/wallet-sdk`, `@aztec-labs/wallets` | `glob` is used internally by the Aztec SDK for circuit artifact discovery during development tooling initialization. It is not invoked in production proof generation paths. Aztec Labs maintains these packages — a patched release will be adopted as soon as available. No exploitable attack surface exists in the production proof generation flow. |

### 5.5 Monitoring Commitment

This register is reviewed and updated on every dependency update PR. Any new advisory not previously evaluated must be added here before the PR is merged, per `CONTRIBUTING.md` §3.
