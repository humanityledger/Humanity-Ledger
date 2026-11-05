# Humanity Ledger — Protocol Status
**Current status: pre-release, Aztec testnet only, no external audit.**
**Last updated: 4 November 2026.** The engineering plan and the component-by-component state table live in [`docs/zk/MASTER_PROMPT.md`](zk/MASTER_PROMPT.md); this file summarises them and must not claim more.

> Earlier versions of this file described "full production circuits", "audited timelocked infrastructure" and RFC 9420 conformance proven by our own tests. Those statements were not supported by the code and were withdrawn on 3 November 2026.

---

## 1. State by area

| Area | State | Evidence | Limit |
|---|---|---|---|
| Private payments (Aztec wallet) | Real on Aztec testnet | `lib/aztec/wallet/`, `npm run test:aztec:e2e` | Needs the testnet token and faucet configuration (task R-15) |
| Direct messages | Real, provided by XMTP v3 (MLS) | XMTP browser SDK 5.2.0 | We do not implement MLS ourselves |
| Community posts | Readable by our server | Disclosed in the product | Migration plan: `docs/communities/MLS_MIGRATION.md` (task R-17) |
| Standalone circuits v1 (`circuits/escrow`, `identity`, `streams`) | Real in tests only; VKs pinned | `scripts/zk/check-artifacts.mjs`, `test/zk/`, `test/circuits/` | Known soundness issues ZK-01 to ZK-07 |
| Standalone circuits v2 (`circuits/*_v2`) | Experimental; compiled and tested in CI (`Noir circuits` workflow); VK hashes pinned in `scripts/zk/v2-vks.mjs` | `docs/zk/V2_CIRCUITS.md` | No deployed verifier stores their state yet |
| aztec-nr contracts (`contracts/aztec/`) | Compile with Aztec 6.0.0 and pass 55 TXE tests in CI (escrow 13, identity 20, streams 22); escrow, stream (with sender cancel) and identity claims ran end to end on testnet | `docs/zk/AZTEC_CONTRACTS_REVIEW.md`, workflows "Aztec contracts", "Aztec escrow e2e (testnet)", "Aztec testnet deployments" | Not yet wired into the chat (one keyed instance per agreement, secret shared over XMTP); the first keyless instances are do-not-use |
| On-chain VK registry (`contracts/ZKVerificationKeyRegistry.sol`) | Real in tests only (Hardhat) | `test/ZKVerificationKeyRegistry.test.ts`, `test/zk/vk-registry-onchain.test.ts` | Not deployed; `assertVKIntegrityOnChain` throws until it is |
| Browser prover (`lib/zk/browser-prover.ts`, Web Worker) | Real in tests only; no Node built-ins; pinned VK | `test/zk/browser-prover.test.ts` | Not wired into any screen |
| Sign-in (SIWE at `/connect`) | Real: sealed single-use nonce, any EVM chain, www/apex domain, ERC-1271/6492 wallets | `test/auth/siwe-routes.test.ts` (real route handlers and signatures) | Needs `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_DOMAIN` set in production |
| L1 contracts | Local tests; not audited, not deployed to mainnet | `npm run test:contracts` | `ZKIdentityRegistry.verifyCredential` reverts until a verifier exists |
| Community apps sandbox | Real (CSP `sandbox allow-scripts`, no network) | `test/eaf_isolation.adversarial.test.ts` | An app can navigate its own frame |

---

## 2. Gap register (circuits/CONSTRAINT_COMPLETENESS.md)

| Gap | v1 | v2 | Notes |
|---|---|---|---|
| G1 recipient key not a checked curve point | Open | Not applicable: parties are key hashes | Client-side Grumpkin check in `lib/aztec/grumpkin.ts` |
| G2 sanction set hard-coded | Open | Closed in `identity_v2`: committed list + non-membership | Bounded list of 16 entries (option B); sparse tree is option A |
| G3 Merkle depth 1 | Open | Closed in `identity_v2`: depth 32 | |
| G4 streams overflow | Closed (rate bound) | Closed; accrual in u128 | |
| G5 Pedersen | Open | Closed: Poseidon2 with domain separators | Not checked against an Aztec test vector |
| G6 Noir ↔ ACIR equivalence | Committed ACIR equals a fresh compile (CI) | v2 compiled in CI | No formal equivalence proof |

---

## 3. Acceptance criteria (A1–A7)

* **A1 (Private state end-to-end)**: **SATISFIED**
  - `npm run test:aztec:e2e` against Aztec testnet (needs the testnet configuration). Verified on 23 October 2026 from Node and a headless browser.
* **A2 (Messaging properties P1 & P2)**: **DELEGATED**
  - Provided by XMTP v3 (MLS). `test/mls_post_compromise.test.ts` models an MLS key schedule inside the test file and does not exercise the app, so it is not evidence for A2. Community posts are outside A2 until R-17.
* **A3 (EAF isolation P6)**: **SATISFIED**
  - `test/eaf_isolation.adversarial.test.ts` checks the community app frame policy.
* **A4 (L1 contracts)**: **SATISFIED** (local tests only; no external audit)
  - `npm run test:contracts`, `scripts/verify-l1-bytecode.ts` (a lint, not an audit).
* **A5 (Key custody P5)**: **SATISFIED**
  - `test/key_custody.test.ts` (unit tests of the key helpers).
* **A6 (Audit dossier)**: **SATISFIED**
  - `docs/AUDIT_DOSSIER.md` lists residual risks RISK-01 to RISK-05. It is an internal dossier, not an external audit.
* **A7 (Public claims)**: **SATISFIED**
  - `docs/TRACEABILITY_MATRIX.md` and `scripts/check-traceability.ts`, plus `scripts/check-forbidden-copy.mjs`.

## Not claimed

External audit, formal verification, quantum resistance, traffic-analysis protection, mainnet readiness.

---

## 4. Master Automated Verification Suite

Run all core invariant verification commands:

```bash
# 1. Key custody invariant P5 (Server compromise simulation)
npx vitest run test/key_custody.test.ts

# 2. MLS post-compromise security P2 (Epoch ratcheting)
npx vitest run test/mls_post_compromise.test.ts

# 3. Noir circuits & UltraHonk constraint tests
npx vitest run test/circuits/ test/zk/

# 4. Aztec PXE zero simulation static verification
npx vitest run test/aztec_e2e_no_simulation.test.ts

# 5. Aztec PXE end-to-end proof & note verification pipeline on testnet (A1)
npm run test:aztec:e2e

# 6. EAF air-gap & sandbox adversarial suite (P6, A3)
npx vitest run test/eaf_isolation.adversarial.test.ts

# 7. L1 contract invariants & anti-backdoor suite (P4, A4)
$env:LOCALAPPDATA = "$PWD\.cache"; npx hardhat test test/contracts_invariants.test.ts

# 8. L1 bytecode & anti-backdoor static analysis
npx tsx scripts/verify-l1-bytecode.ts

# 9. Traceability matrix & status consistency verification (A7)
npx tsx scripts/check-traceability.ts

# 10. Fortification checklist verification suite (300 items / Lazarus defense)
npx vitest run test/fortification.test.ts

# 11. Property-based fuzzing suite (60,000 iterations)
npx vitest run test/property_fuzz.test.ts

# 12. Cryptographic primitives & general security scans
npm run test:crypto
npm run test:scan

# 13. Supply-chain security audit
npm audit

# 14. Sign-in routes (SIWE) with real signatures
npx vitest run test/auth/

# 15. aztec-nr contracts: compile and TXE tests (needs the Aztec 6.0.0 toolchain)
(cd contracts/aztec/test_token && aztec compile)
for c in escrow identity streams; do (cd contracts/aztec/$c && aztec compile && aztec test); done

# 16. L1 contracts including the VK registry
npm run test:contracts
```

---

## 5. Directive Closure Status (Sections 1–5)

> **Updated**: 2 November 2026

| Section | Item | Status | Artifact |
|---|---|---|---|
| 1.1 | Verification logs committed | ✅ DONE | `docs/verification-logs/` |
| 2.1 | Client-side VK hash assertion | ✅ DONE | `docs/VK_MONITORING.md`, `lib/aztec/verifier.ts` |
| 2.1 | 60-second VK detectability | ❌ WITHDRAWN (3 Nov): there is no alert path; VK changes are caught by CI pins | `docs/VK_MONITORING.md` §1 |
| 2.2 | Proof generation benchmarks | ✅ DONE | `docs/PROOF_BENCHMARKS.md` |
| 2.3 | DEPRECATED/RETIRED VK client behavior | ✅ DONE (registry tested, not deployed) | `docs/VK_MONITORING.md` §4, `lib/aztec/verifier.ts` |
| 2.4 | Sequencer censorship fallback | ✅ DONE | `docs/SEQUENCER_RESILIENCE.md` |
| 3.1 | `docs/AUDIT_SCOPE.md` | ✅ DONE | `docs/AUDIT_SCOPE.md` |
| 3.2 | SBOM generation command | ✅ DONE | `docs/SUPPLY_CHAIN.md` §3 |
| 3.3 | CSP report-only mode | ✅ DONE | `next.config.js` + `app/api/security/csp-report/route.ts` |
| 3.4 | `docs/INCIDENT_RESPONSE.md` | ✅ DONE | `docs/INCIDENT_RESPONSE.md` |
| 3.5 | EAF rejected bridge operation logging | ✅ VERIFIED | `lib/security/eaf-guard.ts` (console.warn on rejection) |
| 4.1 | Proof performance benchmarks (p50/p95) | ✅ DONE | `docs/PROOF_BENCHMARKS.md` |
| 4.2 | Load test plan committed | ✅ DONE | `docs/LOAD_TEST_PLAN.md` |
| 4.3 | Observability metrics dashboard/list | ✅ DONE | `docs/OBSERVABILITY.md` |
| 4.4 | Multi-region/degradation topology | ✅ DONE | `docs/DEPLOYMENT_TOPOLOGY.md` |
| 5.1 | Academic CVD policy committed | ✅ DONE | `docs/BUG_BOUNTY.md` |
| 5.2 | Production gate in CONTRIBUTING.md | ✅ DONE | `CONTRIBUTING.md` §4 |
| 5.3 | Monthly review schedule | ✅ DONE | `docs/AUDIT_DOSSIER.md` (see below) |
