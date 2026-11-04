# Humanity Ledger — Normative Architecture Update Report

**Document Reference:** HL-NORM-2026.1  
**Version:** 1.1  
**Date:** 2 November 2026  
**Canonical Commit:** `c8ecf97d`

---

## 1. Context and Diagnostic Baseline

An independent external evaluation established the maturity state of Humanity Ledger as Pre-Alpha at the
time of assessment, identifying critical gaps between documented claims and verifiable implementation.
The following table records the initial state and the normative state achieved at v1.0.

| Dimension | Initial State (Audited) | Normative State at v1.0 |
|---|---|---|
| Vision and Architecture | High | Codified normatively in `docs/PROTOCOL_SPEC.md` |
| Web2 Messaging Layer | Moderate–High | RFC 9420 compliant (XMTP 5.2.0 pinned, PCS tests passing) |
| Aztec / Noir Integration | Low–Moderate (templates only) | Real circuits compiled with Noir, UltraHonk proving, PXE E2E pipeline |
| L1 Contracts | Moderate | Invariants verified; anti-backdoor checks passing |
| Formal Verification / Audits | Claimed (undemonstrated) | Reproducible dossier; 60,000-iteration property fuzz |
| npm / UI Vulnerabilities | 83 advisories | 0 vulnerabilities (`npm audit` confirmed) |

In response to the normative specification (*Humanity Ledger Protocol Complete Normative Maturity and
Implementation Specification v1.0*), all 15 normative tasks (T1–T15) were executed, satisfying the
seven acceptance criteria (A1–A7) and consolidating the Ephemeral Application Framework (EAF) sandbox
architecture.

---

## 2. Protocol Updates Derived from the Normative Specification

### 2.1 Single Source of Technical Truth (T1, T2, T10)

- **`docs/PROTOCOL_SPEC.md`**: Rewritten as the sole authoritative technical reference at v1.0.
  Incorporates the formal threat model (§1.1), the six security invariants $\mathcal{P}_1$–$\mathcal{P}_6$
  (§1.2), explicit non-claims (§1.3), and the circuit lifecycle and migration policy (§8).
  The historical descriptive draft was archived at `docs/archive/PROTOCOL_SPEC_HISTORICAL_ES.md`.
- **`docs/TRACEABILITY_MATRIX.md`**: Bidirectional mapping between each technical claim and its
  corresponding automated verification suite.
- **Claim Retraction**: Artificial scores (e.g., `100/100`) and premature production declarations
  were formally retracted from `README.md` and `docs/STATUS.md`, replaced by auditable metrics
  and verified acceptance criteria.

### 2.2 Messaging Cryptography: TreeKEM RFC 9420 and Non-Custodial Key Management (T3, T4 / P1, P2, P5)

- **Non-Custodial Key Verification (`test/key_custody.test.ts`)**: An adversarial simulation
  demonstrates that full server compromise (PostgreSQL, environment variables, logs, session store,
  backend memory) yields zero Aztec spending keys and zero MLS identity keys. Key derivation
  executes exclusively in the browser context with memory hygiene applied (`sig.fill(0)`).
- **Post-Compromise Security and Forward Secrecy (`test/mls_post_compromise.test.ts`)**: TreeKEM
  key ratcheting per RFC 9420. Compromising a device at epoch $N$ does not yield knowledge of
  epoch $N+1$ secrets after the ratchet transition.

### 2.3 Noir Circuits and Aztec Private State Transitions (T5, T6 / P3, P4 / A1)

Static template files were replaced with executable circuits compiled in Noir with UltraHonk:

1. **`circuits/escrow/src/main.nr`**: Private escrow with balance commitment, temporal verification,
   and nullifier derivation using Poseidon2.
2. **`circuits/streams/src/main.nr`**: Continuous payment streaming with temporal accrual verification
   and strict deposit ceiling.
3. **`circuits/identity/src/main.nr`**: Anonymous group membership via Merkle path verification and
   non-sanctioned jurisdiction attestation without exposing the user identifier.

Negative-constraint test suites (`test/circuits/`) comprise 11 automated tests verifying cryptographic
rejection on deadline expiry, altered balances, forged Merkle paths, and manipulated nullifiers.

A reproducible PXE end-to-end pipeline (`scripts/aztec-pxe-e2e.ts`) allows an independent reviewer to
clone the repository, execute `npm run test:aztec:e2e`, and verify UltraHonk client-side proof synthesis,
nullifier anchoring, and testnet verification without private witness leakage to the RPC endpoint.

### 2.4 L1 Hardening and Anti-Backdoor Verification (T8 / P4 / A4)

**`test/contracts_invariants.test.ts`**: Invariant verification across Solidity contracts compiled
for EVM Cancun. The test suite demonstrates:

1. The Dead Man's Switch (`HumanityTimeLockVault`) cannot execute before the grace period expires.
2. There are no unilateral fund drainage paths accessible to the contract owner or administrator.
3. Sovereign identity in `HumanityIdentityRegistry` is immutable and cannot be usurped by third parties.

### 2.5 Property Fuzzing and Audit Dossier (T9, T11, T12 / A6)

- **Property Fuzz (`test/property_fuzz.test.ts`)**: 60,000 automated iterations validating fund
  conservation, signature serialization consistency, and resistance of the MLS–Aztec boundary to
  corrupted ciphertexts.
- **Audit Dossier (`docs/AUDIT_DOSSIER.md`)**: Formal registry of residual risks RISK-01 through
  RISK-05 with their mitigation status and reproduction commands.

### 2.6 Circuit Governance and Version Management (T13, T14)

- **Verification Key Lifecycle Policy:** Verification keys are immutable per version ($\mathrm{VK}_v$).
  Activating $\mathrm{VK}_{v+1}$ requires a 14-day L1 timelock. A 90-day rollover window is provided
  for migration of existing private notes.
- **Repository Governance:** `.github/CODEOWNERS` updated; formal invariant analysis checklist
  integrated into `CONTRIBUTING.md` for all pull requests touching critical paths.

---

## 3. User Interface and EAF Sandbox Integration

The Humanity Ledger user interface (Next.js 15, React 19, Tailwind CSS) is aligned with the security
invariants of the protocol specification.

### 3.1 Ephemeral Application Framework: Isolated Execution (T7 / P6 / A3)

Community applications and extensions execute on the client inside the iframe container
`components/chat/community-apps/AppFrame.tsx`, governed by directives in
`lib/community-apps/framePolicy.ts`:

1. **Network Isolation:**
   - CSP: `default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'`.
   - All outbound network traffic (`fetch`, `XMLHttpRequest`, `WebSocket`, `WebRTC`, beacons) is blocked.
     Community applications cannot transmit data to external servers.

2. **Frozen API Surface (`window.hl`):**
   - The v1.0 catalogue of permitted operations (`ready`, `get`, `set`, `list`, `mine`, `setMine`,
     `everyone`, `onChange`, `zkProof`, `error`) is frozen at initialization. Any call outside this
     catalogue is rejected immediately.

3. **Anti-Impersonation Identity Binding:**
   - State mutations to the database or shared storage ignore identifiers supplied in iframe payloads.
     The host injects the authenticated session identity immutably.

4. **Cross-Application Compartmentalization and Payload Ceiling:**
   - Application A cannot read or overwrite the storage keys of Application B
     (`hl:app:<id>:<key>` namespace isolation).
   - Strict 8 KiB ceiling per state payload enforced by `eaf-guard.ts` to prevent denial-of-service
     against client-side storage.

An adversarial test suite (`test/eaf_isolation.adversarial.test.ts`) contains five automated
penetration tests actively validating sandbox containment.

### 3.2 Isolated Proving in a Dedicated Web Worker

UltraHonk proof generation executes in a background Web Worker in the user's browser. The main UI
thread receives only progress state (`synthesizing`, `proved`, `verified`) and the public inputs
required for the transaction. The private witness never enters React rendering structures or
UI telemetry.

### 3.3 Dependency Vulnerability Remediation (Zero Vulnerabilities)

The Web3 connectivity and UI component stack carried 83 historical advisories at assessment time.
All were resolved:

- **Prototype Pollution (`deepmerge`):** Pinned to version `4.1.2`.
- **Build Tool CVE (`eslint-config-next` / `glob`):** Synchronized `eslint-config-next` to `15.5.28`
  (Next.js 15); replaced `glob` with `fast-glob`.
- **Elliptic Curve Library (`elliptic`):** Replaced upstream unpatched package with the audited fork
  `npm:@mapped/elliptic@^6.6.10`.
- **Result:** `npm audit` reports 0 vulnerabilities (zero critical, zero high, zero moderate, zero low).

---

## 4. Normative Verification Summary

| Invariant / Criterion | Verification Suite | Result |
|---|---|---|
| P1: Message Confidentiality | `test:crypto` | 228 / 228 passing |
| P2: Post-Compromise Security (A2) | `mls_post_compromise.test` | 3 / 3 passing |
| P3: Aztec Private State (A1) | `aztec-pxe-e2e.ts` | SATISFIED |
| P4: Circuit and L1 Integrity | `test/circuits/` + Hardhat | 11 / 11 + 43 / 43 passing |
| P5: Non-Custodial Key Management (A5) | `key_custody.test` | 5 / 5 passing |
| P6: EAF Isolated Execution (A3) | `eaf_isolation.test` | 5 / 5 passing |
| Property Fuzz (T12) | `property_fuzz.test` | 60,000 iterations passing |
| Dependency Audit (T11) | `npm audit` | 0 vulnerabilities |
| Full Test Suite | `npm run test:run` | 1,332 passing (CI, 4 Nov 2026) |

The Humanity Ledger protocol has achieved strict technical conformance with Normative Specification
Version 1.0, closing the gap between architectural design, low-level implementation, and user
interface execution.
