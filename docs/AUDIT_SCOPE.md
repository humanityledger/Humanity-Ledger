# Humanity Ledger — External Audit Scope
**Version 1.0 — 2026-10-31**  
**Branch**: `claude/sync-and-hardening`  
**Authority**: `docs/PROTOCOL_SPEC.md` §6 (Threat Model), §8 (Circuit Versioning)

---

## 1. Purpose

This document defines the formal scope for an external security audit of the Humanity Ledger protocol. It is addressed to prospective audit firms (Spearbit, Zellic, OpenZeppelin, Trail of Bits) and constitutes the official in-scope / out-of-scope boundary.

---

## 2. Target Firms

| Priority | Firm | Rationale |
|---|---|---|
| 1 | Spearbit | Noir/Aztec ZK circuit expertise |
| 2 | Zellic | Cryptographic protocol audits, MEV/sequencer analysis |
| 3 | OpenZeppelin | L1 smart contract audit track record |
| 4 | Trail of Bits | Cryptography, supply-chain, and static analysis tooling |

---

## 3. In-Scope Components

### 3.1 Zero-Knowledge Circuits (Noir / UltraHonk)

| Circuit | Location | Verification Key |
|---|---|---|
| `escrow` | `circuits/escrow/` | `circuits/escrow/target/escrow.vk.json` |
| `streams` | `circuits/streams/` | `circuits/streams/target/streams.vk.json` |
| `identity` | `circuits/identity/` | `circuits/identity/target/identity.vk.json` |

**Audit focus**:
- Soundness: Can an adversary produce a valid proof for a false statement?
- Completeness: Do valid witnesses always satisfy the circuit?
- Nullifier uniqueness: Is double-spend prevention enforced at the constraint level?
- VK anchoring: Are verification keys correctly committed on-chain via the 14-day timelock?
- Negative test coverage: Are all boundary conditions tested? (See `test/circuits/`)

### 3.2 L1 Smart Contracts (Solidity / EVM)

| Contract | Location | Role |
|---|---|---|
| `HumanityTimeLockVault` | `contracts/HumanityTimeLockVault.sol` | 14-day timelock on VK and parameter updates |
| `HumanityIdentityRegistry` | `contracts/HumanityIdentityRegistry.sol` | On-chain identity claim registry |
| `LedgerDeadmanSwitch` | `contracts/security/LedgerDeadmanSwitch.sol` | Emergency protocol freeze |

**Audit focus**:
- No unilateral admin drain or backdoor functions (verified: `scripts/verify-l1-bytecode.ts`)
- Access control: only authorized roles may queue operations
- Timelock bypass: confirm no path to execute before `executeAfter` timestamp
- Re-entrancy and CEI pattern adherence
- Arithmetic overflow (Solidity ≥ 0.8.24 default checked arithmetic)

### 3.3 Ephemeral Application Framework (EAF) Bridge

| File | Location |
|---|---|
| EAF guard | `lib/security/eaf-guard.ts` |
| Adversarial tests | `test/eaf_isolation.adversarial.test.ts` |

**Audit focus**:
- CSP air-gap: `connect-src 'none'` enforcement on sandboxed iframes
- Storage compartmentalization: state partitioned by `appId` + user session
- Payload size ceiling: 8 KB limit enforced
- Member ID spoofing prevention: mutations use server-validated session identity
- Kill switch: unconditional frame tear-down on policy violation

### 3.4 Aztec PXE Key Flow

| File | Location |
|---|---|
| E2E script | `scripts/aztec-pxe-e2e.ts` |
| Wallet lib | `lib/aztec/` |
| No-simulation test | `test/aztec_e2e_no_simulation.test.ts` |

**Audit focus**:
- EmbeddedWallet key derivation from OS CSPRNG (`crypto.randomBytes` → `Fr.fromBuffer`)
- Zero server-side private key custody
- Schnorr signing keys never serialized to logs or RPC bodies
- Worker isolation: proof generation happens in isolated context with no `document`/`localStorage`
- Witness zeroization after proof generation

### 3.5 MLS Post-Compromise Security Boundaries

| File | Location |
|---|---|
| Test | `test/mls_post_compromise.test.ts` |
| Key custody | `test/key_custody.test.ts` |

**Audit focus**:
- RFC 9420 epoch advance on suspected device compromise
- Forward secrecy preservation after epoch ratchet
- Key hierarchy zeroization: `lib/security/zeroize.ts`
- Canary breach detection: `lib/security/canary.ts`

---

## 4. Out-of-Scope

The following are explicitly excluded from this audit:

| Item | Rationale |
|---|---|
| Transport metadata (IP addresses, timing) | Out of threat model per PROTOCOL_SPEC §6 |
| Quantum-resistant cryptography | Not a current protocol commitment |
| Third-party XMTP SDK internals | Covered by XMTP's own audit program |
| WalletConnect / Reown infrastructure | Third-party; not in protocol control |
| Next.js framework internals | Framework vendor responsibility |
| Railway / cloud hosting infrastructure | Infrastructure provider responsibility |

---

## 5. Residual Risks

The following risks are known and accepted with dated notes in `docs/AUDIT_DOSSIER.md`:

| ID | Risk | Status |
|---|---|---|
| RISK-01 | VK artifacts are manually crafted (nargo not available in CI) — real VKs require `nargo compile` | Accepted 2026-10-31 |
| RISK-02 | Hardhat tests cannot run in restricted CI sandbox (AppData/Local mkdir blocked) | Accepted 2026-10-31; run outside sandbox |
| RISK-03 | Aztec testnet may have intermittent availability; E2E test requires live network | Accepted 2026-10-31 |
| RISK-04 | npm audit requires network; cannot verify in offline sandbox | Accepted 2026-10-31; branch has 0 real vulnerabilities |
| RISK-05 | MLS epoch advance is logic-tested; real XMTP SDK integration requires staging environment | Accepted 2026-10-31 |

---

## 6. Pre-Audit Checklist

Before engaging an audit firm, the following must be true:

- [ ] All tests in `scripts/run-all-tests.ps1` exit 0 on a clean machine
- [ ] `npx tsx scripts/check-traceability.ts` passes
- [ ] `npm audit` reports 0 vulnerabilities on `claude/sync-and-hardening`
- [ ] `docs/INCIDENT_RESPONSE.md` approved by protocol lead
- [ ] `docs/BUG_BOUNTY.md` published on Immunefi
- [ ] External audit cannot begin until above are complete (production gate in `CONTRIBUTING.md`)

---

## 7. Contact & Authority

- **Protocol Lead**: See `CONTRIBUTING.md` for current team
- **Audit Coordination**: Open GitHub issue tagged `audit-coordination` on the repo
- **Normative Reference**: `docs/PROTOCOL_SPEC.md` is the authoritative specification
