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

#### 3.1.1 Native Aztec Pre-Audit Gaps Register (G1–G6, UI Integration)

All open protocol and circuit gaps are tracked with **High for production** severity to enforce native Aztec Network architecture alignment prior to mainnet:

| Gap ID | Description | Severity | Current Status & Planned Resolution |
|---|---|---|---|
| **G1** | `recipient_pubkey` treated as Field rather than validated Grumpkin point | **High for production** | Validated at PXE client layer prior to witness construction; in-circuit curve check and migration to native Aztec `Npk` type planned. |
| **G2** | Sanction set hardcoded as compile-time constants (999, 998) | **High for production** | Prototype constraint. Production design requires on-chain Merkle-committed dynamic sanction root. |
| **G3** | Identity Merkle tree depth is 1 (2-node path) | **High for production** | Currently a demonstration subpath. Requires expansion to full depth (e.g. depth 32) for realistic anonymity sets using native Poseidon2. |
| **G4** | Potential u64 arithmetic overflow in stream accrual multiplication | **CLOSED** | CLOSED via explicit `rate_per_second <= MAX_RATE` constraint and test suite (`test/circuits/streams_rate_bound.test.ts`). |
| **G5** | Hash function is `pedersen_hash`, not native `poseidon2` | **High for production** | Cryptographically sound over BN254, but not yet aligned with Aztec's native Poseidon2 note scheme. Migration planned before external audit. |
| **G6** | No formal equivalence verification between Noir source and ACIR | **High for production** | Formal circuit verification planned prior to mainnet consideration. |
| **UI Integration** | In-browser client prover integration | **High for production** | Executed and verified in automated test suites (`test/aztec_e2e_no_simulation.test.ts`); currently being wired into the user-facing web interface. |

### 3.2 L1 Smart Contracts (Solidity / EVM)

| Contract | Location | Role |
|---|---|---|
| `HumanityTimeLockVault` | `contracts/HumanityTimeLockVault.sol` | Per-user multi-token dead man's switch vault — sweeps all deposited ERC-20 tokens to a designated backup wallet after configurable inactivity timeout; vault reconfigurable by owner if alive |
| `HumanityIdentityRegistry` | `contracts/HumanityIdentityRegistry.sol` | On-chain identity claim registry |
| `LedgerDeadmanSwitch` | `contracts/security/LedgerDeadmanSwitch.sol` | Non-custodial inheritance protocol — forwards pre-approved ERC-20/ERC-721 allowances from owner to backup wallet; callable only by backupWallet or owner after inactivity timeout |

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

## 3.6 Inventory as of 2026-11-11 (supersedes §3.1–§3.5 where they differ)

Nothing listed here has been audited by a third party. "Shipped" means reachable from the deployed app after the Ledger Chat only cleanup (#29).

| Layer | Component | Location | Shipped | State |
|---|---|---|---|---|
| aztec-nr | `PrivateEscrow`, `PaymentStream` | `contracts/aztec/{escrow,streams}` | Yes (keyed instance per agreement, testnet) | Source is ahead of the artifact (deposit/creation nullifiers, 313623e). The app deploys the older artifact. Tracked in `deployments/aztec-pending-recompile.json`; a compiled build with green TXE tests exists on `claude/alpha-hardening-2026-11-10@00d451c`, not merged, no e2e |
| aztec-nr | `IdentityCredential` | `contracts/aztec/identity` | Contract deployed on testnet; no UI path found | Artifact matches source |
| Client | Private wallet, PXE, proving | `lib/aztec/wallet/*`, `@aztec-labs/*` 6.0.0 | Yes | Until 2026-11-11 `getFeeJuiceBalance` and `isL1ToL2MessageReady` were loaded from a 6.0.0 nightly (unaliased import). Fixed; CI guard added |
| Client | Encrypted OPFS stores, HKDF key derivation from a wallet signature | `lib/aztec/wallet/{store,keys,wipe}.ts` | Yes | Fail-closed without OPFS; SDK key handling asserted in CI. The signed message is the root secret: its domain separation and phishing resistance need review |
| Client | Value gates: G7 binding, caps, node pin, fee checks | `lib/aztec/{peer-binding,agreement-policy,fee-juice,fees}.ts`, `lib/payments/*` | Yes | Unit-tested; no two-browser run recorded |
| Messaging | XMTP v3 (MLS) | `lib/xmtp/*` | Yes | Peer binding is G7 (Schnorr-signed `hl/aztec-binding/v1`, re-verified on every use), not TOFU. TOFU remains only for XMTP inbox ↔ EVM address |
| Messaging | Agreement invitations (carry claim/contract secrets inside MLS) | `lib/aztec/agreement-invite.ts`, `chat-agreements.ts` | Yes | Legacy `__ZK_*` cards neutralised |
| Multi-device | Chat preferences over XMTP | `lib/sync/*` | Yes | Aztec state is not synced: keys re-derive from the signature, notes resync from the network. Sender registrations and agreements come back only from re-exchanged addresses and chat invitations |
| Own circuits | Noir circuits + `@aztec/bb.js` 5.3.0 prover | `circuits/*`, `lib/zk/*` | No (only the VK pin manifest is served) | bb.js 5.x status against the V5 proving-system disclosure is unknown: the disclosure names no component or version. Treat as affected until bumped |
| L1 | `HumanityIdentityRegistry`, `HumanityTimeLockVault`, `LedgerDeadmanSwitch`, `ZKIdentityRegistry`, `ZKVerificationKeyRegistry`, `StudioProvenance` | `contracts/*.sol`, `contracts/security` | No UI; `/api/wallet/deadman` and `/api/wallet/recovery` are retired (410) | Hardhat suite (workflow "System Core") fails on `main` and did before this inventory. Decide: retire or fix, then audit |
| Server | Auth (SIWE, JWT), communities, settings, Studio proxy | `app/api/*`, `lib/jwt.ts` | Yes | Secrets no longer defaulted in the repository. Community posts are server-stored and not end-to-end encrypted |
| Server | LiveKit token route | `app/api/call/token` | Route exists, no UI caller | Remove or wire and audit. 1:1 calls are browser-to-browser WebRTC |
| Removed | SSE, market/portfolio/hub products, QD identity context | n/a | No | Deleted in #29/#30 |
| Not present | Sanctions screening | legal text only | No | No code |
| Supply chain | Served JS/WASM | `next.config.js`, `scripts/zk/check-artifacts.mjs` | Yes | SRI is configured but Next.js does not emit `integrity` for dynamically rendered pages, so it is not in effect. Integrity of the proving bundle rests on TLS and the host |

Stale statements elsewhere in this file: RISK-01 (VKs are derived and compared in workflow "Noir circuits"), RISK-02 (Hardhat does run in CI and fails), RISK-04 (npm audit runs in four workflows; the 2026-11-11 finding was an unused `mongoose` dependency, removed).

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
