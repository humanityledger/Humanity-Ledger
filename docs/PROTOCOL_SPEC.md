# Humanity Ledger Protocol
## Complete Normative Maturity and Implementation Specification
**Version 1.0 — Exhaustive Doctoral Target for Agent Implementation**

> **Normative Authority Notice**: This document is the single normative source of truth. An implementation is conformant only when every acceptance criterion is met and demonstrated by automated tests or reproducible procedures. All prior documents, `STATUS.md`, `README.md`, and public claims are subordinate to it. The agent and maintainers must treat this document as authoritative.

---

## 1. Threat Model

### 1.1 Adversaries Considered
The protocol claims the properties in Section 1.2 exclusively against the following adversaries. Claims against any other adversary are non-normative:

- **Passive network adversary**: Observes all network traffic between clients, servers, and Aztec sequencers. Cannot modify, drop, or inject messages.
- **Active network adversary**: Can drop, delay, reorder, or inject messages on any network path. Cannot break cryptographic primitives.
- **Compromised server**: Full administrative control of all backend infrastructure including databases, queues, object storage, indexers, and application servers. Can read and write all server-side state.
- **Compromised single device**: Full control of one user device, including all local key material, local storage, and running processes at the time of compromise. Does not extend to other devices of the same user after recovery.
- **Malicious Aztec sequencer**: Can censor, reorder, or delay Aztec transactions. Cannot forge valid UltraHonk proofs or violate circuit constraints.

### 1.2 Properties that Must Hold (P1–P6)
Each property must be enforced by the mechanisms listed. Automated tests must demonstrate each property under the corresponding adversaries:

| ID | Property | Statement | Enforcement |
|---|---|---|---|
| **P1** | **Message confidentiality** | Content of MLS application messages is unreadable by the server and by network adversaries. | MLS (RFC 9420) TreeKEM and application-layer encryption used exactly as specified. No custom weakening. |
| **P2** | **Message post-compromise security** | Compromise of a device at time $T$ does not reveal the content of messages sent or received after the next successful epoch advance. | MLS epoch ratcheting. Tests must simulate key compromise and verify post-epoch messages are unreadable. |
| **P3** | **Private state confidentiality** | Private balances, identity claims, and any EAF private state are invisible to the server and to the Aztec sequencer. | Client-side UltraHonk proof generation inside PXE / Web Worker. Private inputs never leave the client. |
| **P4** | **Private state integrity** | Invalid private state transitions are rejected by the network. | Aztec circuit constraints + L1 verification of the proof against the published verification key. |
| **P5** | **No server key custody** | The server never possesses, derives, or can reconstruct user spending keys or long-term MLS identity keys. | All long-term key generation and storage occurs exclusively on the client. No seed or private key is ever transmitted or stored server-side. |
| **P6** | **EAF isolation** | An Executable Artifact Frame cannot read or write state belonging to another EAF or to the host conversation except through the declared bridge. | Air-gapped iframe with enumerated, versioned `window.hl` surface. Adversarial tests must attempt escape. |

### 1.3 Explicit Non-Claims
The following are explicitly outside the claimed threat model and must not appear as guarantees in public materials:

- Metadata privacy of MLS group membership, message timing, or traffic patterns.
- Resistance to simultaneous compromise of the server and a majority of a user's devices.
- Quantum resistance of any primitive (post-quantum migration is architectural only).
- Availability against a global active network adversary that can partition the network indefinitely.
- Confidentiality of data that the user deliberately shares outside the protocol (screenshots, external exports).

---

## 2. Layer Interfaces (Normative)

### 2.1 Identity Layer
Canonical long-term identity is an EdDSA key pair generated on the client using a cryptographically secure random source. Session keys are derived, short-lived, and rotatable independently of the long-term key. Sign-In with Ethereum (SIWE, EIP-4361) is permitted only for initial bootstrap and must not be treated as the long-term identity. Device trust levels, if implemented, must be client-enforced and must not create a server-side recovery path that violates P5.

### 2.2 Messaging Layer
All conversation content must use XMTP MLS conforming to IETF RFC 9420. No modifications to TreeKEM, epoch handling, or key package processing are permitted. The server may store only encrypted MLS payloads and must be unable to decrypt them. Group membership changes, device addition, and device removal must follow MLS semantics. The agent must pin the exact MLS library version and configuration used.

### 2.3 Privacy Layer (Aztec / Noir / UltraHonk)
All private state transitions must execute inside a client-side Private eXecution Environment (PXE). Proofs must be UltraHonk proofs generated in a Web Worker under cross-origin isolation (COOP/COEP). The server must never receive private inputs, intermediate witnesses, or spending keys. Verification keys of every circuit that protects value or identity must be anchored on L1. The agent must publish the circuit source, the verification key, and a reproducible end-to-end test against Aztec testnet.

### 2.4 Execution Layer (Executable Artifact Frames — EAF)
Every EAF must run inside an air-gapped iframe. The only communication channel with the host is the typed, versioned, enumerated `window.hl` bridge. The bridge surface must be frozen per EAF version and documented. Resource limits (CPU, memory, network) must be enforced. The agent must implement and maintain an adversarial test suite that attempts escape, cross-EAF access, and exfiltration.

### 2.5 Settlement Layer
L1 contracts that accept proofs must verify them against the published verification keys. No administrative function may unilaterally change a verification key or freeze user funds without a published timelock whose parameters are public. Ownership and upgrade paths must be either immutable or governed by a documented multisig + timelock. Deployed bytecode must be verified against repository source.

---

## 3. Detailed Implementation Tasks for the Agent

The agent must execute the following tasks in the listed order. Later tasks depend on the artifacts produced by earlier tasks:

- **T1. Elevate PROTOCOL_SPEC.md to normative status**: Replace existing high-level Spanish text with this normative specification.
- **T2. Create and enforce traceability matrix**: Produce `docs/TRACEABILITY_MATRIX.md` mapping every claim in public materials to P1–P6 and tests.
- **T3. Implement key custody tests (supports A5)**: Add automated tests demonstrating full server compromise yields neither Aztec spending keys nor long-term MLS keys.
- **T4. Implement MLS post-compromise security tests (supports A2 / P2)**: Pin XMTP MLS library. Test device compromise at epoch $N$, epoch advance, and verify post-advance unreadability.
- **T5. Publish Noir circuits with complete tests**: Escrow, streams, and identity claim circuits in `circuits/` with unit and constraint-violation negative tests.
- **T6. Implement reproducible PXE end-to-end path (A1)**: Script generating an UltraHonk proof in Web Worker, submitting to Aztec testnet, verifying note/nullifier on L1.
- **T7. Implement EAF isolation and adversarial suite (A3 / P6)**: Enumerate frozen `window.hl` surface, test iframe sandbox breakout, cross-frame leakage, resource limits.
- **T8. Harden L1 contracts (A4)**: NatSpec comments, Foundry invariant and fuzz tests covering ownership, reentrancy, edge cases, timelock governance.
- **T9. Produce reproducible audit dossier (A6)**: Create `docs/AUDIT_DOSSIER.md` listing every residual risk from Section 5.
- **T10. Align public claims (A7)**: Update `docs/STATUS.md` and `README.md` to remove unearned 100/100 claims and reflect actual verified status.
- **T11. Supply-chain integrity**: Pin all runtime and build dependencies with integrity hashes. Document toolchain verification.
- **T12. Property-based and fuzz testing**: Fast-check tests with $\ge 10\,000$ runs on parsers, serializers, accounting invariants, and MLS-Aztec boundary.
- **T13. Migration and versioning policy**: Document circuit upgrade procedure and private state migration/invalidation in this specification.
- **T14. Repository governance**: Add `CODEOWNERS` for `circuits/`, `contracts/`, `lib/aztec/`, and EAF sandbox. Update `CONTRIBUTING.md`.
- **T15. Residual risk closure or acceptance**: Document explicit treatment for all Section 5 risks in the audit dossier.

---

## 4. Acceptance Criteria (A1–A7)

The implementation is conformant with this specification only when all of the following are demonstrated:

- **A1 — Private state end-to-end**: An external party clones the repository, runs one documented command, and obtains a verified private state transition on Aztec testnet. Private inputs never leave the client.
- **A2 — Messaging properties**: Automated tests demonstrate P1 and P2 under the adversaries of Section 1.1. The MLS library version and configuration are pinned and unmodified.
- **A3 — EAF isolation**: The adversarial test suite of T7 runs in CI and fails closed. The `window.hl` surface is enumerated and frozen per version.
- **A4 — L1 contracts**: All value-holding or verification-key contracts have verified source, complete invariant tests, and no unilateral admin path outside a published timelock.
- **A5 — Key custody**: Tests of T3 demonstrate that full server compromise yields neither spending keys nor long-term MLS identity keys.
- **A6 — Audit dossier**: The dossier of T9 is reproducible from the repository. Every residual risk is closed or explicitly accepted with a user-visible rationale.
- **A7 — Public claims**: The traceability matrix of T2 is enforced. No unmapped normative claim remains in `README.md`, `STATUS.md`, or landing materials.

---

## 5. Residual Risks & Treatment Ledger

Every residual risk identified in the protocol threat model is formally tracked, evaluated, and assigned an audited treatment status:

| Risk ID | Description | Severity | Treatment Status | Verification & Mitigation Reference |
|---|---|---|---|---|
| **RISK-01** | Proof generation failure on constrained mobile/web clients | Medium | **TREATED** | Client-side fail-closed architecture: witness generation is in-memory only and zeroed on catch. Zero private witness leaked over network. Verified in `scripts/aztec-pxe-e2e.ts` and documented in `docs/AUDIT_DOSSIER.md`. |
| **RISK-02** | Sequencer censorship or reordering of valid ZK proofs | Medium | **TREATED** | Nonce and nullifier monotonicity guarantees idempotency. Censored proofs can be rebroadcast to alternative sequencers without state corruption. Documented in `docs/AUDIT_DOSSIER.md`. |
| **RISK-03** | MLS metadata leakage (traffic timing, group size) | Low | **ACCEPTED** | Explicitly outside claimed threat model (§1.3). Traffic analysis protections (e.g. constant-rate padding) deferred to future transport layers. Formally accepted by protocol governance. |
| **RISK-04** | Client-side sandbox escape or PXE execution bugs | High | **TREATED & MITIGATED** | Air-gapped CSP (`connect-src 'none'`), null-origin sandbox, frozen `window.hl` API surface, and strict session-bound writes. Verified via `test/eaf_isolation.adversarial.test.ts` and `test/key_custody.test.ts`. |
| **RISK-05** | Upstream dependency supply-chain compromise | Medium | **TREATED** | Strict package integrity pinning (e.g. XMTP pinned to `5.2.0`), lockfile enforcement, and signed commit policy documented in `docs/SUPPLY_CHAIN.md`. |

---

## 6. Implementation Guidance for the Agent

### 6.1 Order of Execution
The agent must execute tasks T1 through T15 in the order listed. Later tasks depend on the artifacts produced by earlier tasks. The agent must not begin T6 (PXE end-to-end) until T5 (circuits) is complete, and must not mark A1 satisfied until the external reproducibility criterion is met.

### 6.2 Testing Requirements
Every property P1–P6 must have at least one automated test that fails if the property is violated. Property-based tests must use a minimum of 10,000 runs. Negative tests must actively attempt to violate invariants (empty lists, duplicate nullifiers, non-owner calls, partial execution, reentrancy patterns). The agent must not rely solely on happy-path tests.

### 6.3 Documentation Requirements
Every new circuit, contract, or bridge surface must include NatSpec or equivalent comments stating the invariants it preserves. The contribution guidelines must require that any pull request touching private state or value includes an invariant analysis. The agent must update the traceability matrix whenever a public claim is added or modified.

### 6.4 What the Agent Must NOT Do
- **Do not claim 100/100 or production readiness** in `STATUS.md` or `README.md` until A1–A7 are fully met and demonstrated.
- **Do not introduce server-side key derivation or storage.**
- **Do not modify MLS TreeKEM or epoch handling.**
- **Do not leave verification keys changeable by a unilateral admin function.**
- **Do not mark a task complete without demonstrating its acceptance criterion.**

---

## 7. Conformity and Maturity

The Humanity Ledger protocol reaches the target maturity defined by this specification only when tasks T1–T15 are complete and acceptance criteria A1–A7 are demonstrated. Until that moment, the protocol remains below the target, regardless of internal scores or declarations. This document is normative. Implementation that deviates from it is non-conformant.

---

## 8. Circuit Migration and Versioning Policy (Normative)

All Zero-Knowledge circuits in Humanity Ledger (`circuits/escrow`, `circuits/streams`, `circuits/identity`) and their corresponding UltraHonk verification keys (VK) are governed by this migration and lifecycle policy:

### 8.1 Verification Key Immutability and Versioning
- Each circuit build generates a deterministic verification key hash: $\mathrm{VK}_{v} = \mathrm{Poseidon2}(\text{circuit\_vk\_bytes})$.
- Verification keys are strictly immutable once registered on L1. A verification key cannot be modified in-place.
- Any change to circuit logic, constraint structure, or field representation produces a distinct version identifier $\mathrm{VK}_{v+1}$.
- The canonical on-chain circuit registry maintains a state machine for each registered VK:
  $$\text{State}(\mathrm{VK}) \in \{\text{PROPOSED}, \text{ACTIVE}, \text{DEPRECATED}, \text{RETIRED}\}$$

### 8.2 L1 Timelock Proposal and Activation
- **Timelock Requirement**: Registration and activation of a new verification key $\mathrm{VK}_{v+1}$ must occur via an L1 timelock contract with a mandatory proposal delay:
  $$T_{\text{delay}} \ge 14\text{ days (1,209,600 seconds)}$$
- **No Unilateral Admin Activation**: Per Invariant P4, no multisig or admin key can bypass this timelock to activate or replace a verification key instantly.
- **Emergency Circuit Revocation**: In the event of a proven critical soundness bug in $\mathrm{VK}_{v}$, governance may invoke an immediate transition $\text{State}(\mathrm{VK}_{v}) \leftarrow \text{DEPRECATED}$ to block new note commitments, but introducing $\mathrm{VK}_{v+1}$ still requires the full timelock delay.

### 8.3 Note Rollover Window & Deprecation Schedule
When $\mathrm{VK}_{v+1}$ becomes `ACTIVE`:
1. **Grace Period**: $\mathrm{VK}_{v}$ transitions to `DEPRECATED` for a mandatory 90-day rollover window:
   $$T_{\text{rollover}} = 90\text{ days (7,776,000 seconds)}$$
2. **Rollover Execution**: During $T_{\text{rollover}}$, clients holding unspent notes under $\mathrm{VK}_{v}$ can:
   - Spend them according to the existing $\mathrm{VK}_{v}$ verification logic, or
   - Execute a state rollover proof that consumes (nullifies) the note under $\mathrm{VK}_{v}$ and creates an equivalent note commitment under $\mathrm{VK}_{v+1}$.
3. **Retirement**: Upon expiration of $T_{\text{rollover}}$, $\mathrm{VK}_{v}$ automatically transitions to `RETIRED`. No new state transitions under `RETIRED` circuits are accepted on-chain.

### 8.4 Client PXE Synchronization
- The client-side PXE must query the canonical on-chain registry before generating any private proof.
- If the target circuit's verification key is `DEPRECATED`, the PXE issues an explicit user-facing warning prompting state rollover.
- If the target circuit is `RETIRED`, proof construction is blocked client-side to prevent unrecoverable proof generation fees.

---

### Historical Archive Note
*The prior high-level Spanish overview document (Humanity Ledger - Protocol Specification v0.1) has been superseded by this normative specification and is retained in `docs/archive/PROTOCOL_SPEC_HISTORICAL_ES.md` for historical traceability.*
