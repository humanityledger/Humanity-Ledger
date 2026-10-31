# Humanity Ledger Protocol

Humanity Ledger is a privacy-oriented communication and settlement protocol that combines MLS messaging with client-side Aztec UltraHonk proof generation and auditable on-chain settlement.

Current maturity status: Testnet Stage 1 Audit Ready.

Normative specification reference: `docs/PROTOCOL_SPEC.md` is the single source of truth for the protocol, including the threat model, property definitions, acceptance criteria, and residual-risk treatment.

## Verified properties (P1-P6)

P1 — Message confidentiality: MLS is used in conformance with RFC 9420. This property is exercised by `test/mls_post_compromise.test.ts` and `npm run test:crypto`.

P2 — Post-compromise security: message confidentiality is preserved across epoch advances after client compromise. Demonstrated by `test/mls_post_compromise.test.ts`.

P3 — Private state confidentiality: private balances and client-held state are generated and verified on the client side; the server does not receive private witnesses. Demonstrated by the client-side Aztec PXE path in `scripts/aztec-pxe-e2e.ts` and the zero-simulation guard in `test/aztec_e2e_no_simulation.test.ts`.

P4 — Private state integrity: invalid private state transitions are rejected by the network and associated validation paths. Demonstrated by `test/circuits/` and `test/contracts_invariants.test.ts`.

P5 — No server key custody: the server does not generate, derive, or store user spending keys or long-term MLS identity keys. Demonstrated by `test/key_custody.test.ts`.

P6 — EAF isolation: executable artifact frames are constrained to a closed bridge surface and cannot escape the sandbox boundary. Demonstrated by `test/eaf_isolation.adversarial.test.ts`.

## Acceptance criteria status (A1-A7)

A1 — Satisfied. This is demonstrated by the real Aztec testnet end-to-end script `scripts/aztec-pxe-e2e.ts` with zero simulation, and the repository contains `test/aztec_e2e_no_simulation.test.ts` to guard against simulated-only execution.

A2 — Satisfied. MLS confidentiality and post-compromise behavior are checked in `test/mls_post_compromise.test.ts` and by `npm run test:crypto`.

A3 — Satisfied. EAF isolation is checked in `test/eaf_isolation.adversarial.test.ts`.

A4 — Satisfied. Contract invariants are checked in `test/contracts_invariants.test.ts` and `test/HumanTimeLock.test.ts`.

A5 — Satisfied. Server key custody is checked in `test/key_custody.test.ts`.

A6 — Satisfied. Residual risk treatment is documented in `docs/PROTOCOL_SPEC.md` and the audit dossier is present in `docs/AUDIT_DOSSIER.md`.

A7 — Satisfied. The traceability matrix in `docs/TRACEABILITY_MATRIX.md` maps protocol claims to P1-P6 and automated tests.

Traceability matrix: `docs/TRACEABILITY_MATRIX.md` is the repository-level mapping between public claims, normative properties, and verification artifacts.

## Explicit non-claims

The protocol does not claim the following:

- Metadata privacy for MLS group membership, message timing, or traffic patterns.
- Quantum resistance of any cryptographic primitive.
- Mainnet production readiness.

These limits are specified in `docs/PROTOCOL_SPEC.md` and are not treated as guarantees in this repository.

## How to verify

The following commands demonstrate the current verified state of the working branch:

```bash
npx vitest run test/key_custody.test.ts
npx vitest run test/mls_post_compromise.test.ts
npx vitest run test/circuits/
npx vitest run test/aztec_e2e_no_simulation.test.ts
npm run test:aztec:e2e
npx vitest run test/eaf_isolation.adversarial.test.ts
$env:LOCALAPPDATA = "$PWD\.cache"; npx hardhat test test/contracts_invariants.test.ts
npx tsx scripts/verify-l1-bytecode.ts
npx tsx scripts/check-traceability.ts
npx vitest run test/fortification.test.ts
npx vitest run test/property_fuzz.test.ts
npm run test:crypto
npm run test:scan
npm audit
```

The working branch is also recorded as `npm audit` clean in the repository status artifacts.

## Repository layout

The repository is organized around the core protocol components:

- `circuits/` contains Aztec/Noir circuit sources and associated verification logic.
- `test/` contains invariant tests, negative tests, adversarial tests, and end-to-end verification paths.
- `docs/` contains the normative protocol specification, traceability matrix, audit dossier, and supporting risk documentation.

## Notes on implemented state

- Client-side Aztec UltraHonk proofs are used for private state transitions.
- MLS is implemented in line with RFC 9420 semantics and validation tests.
- No server key custody is present in the verified implementation.
- The real PXE end-to-end pipeline is `scripts/aztec-pxe-e2e.ts` and was verified on Aztec testnet.
- The no-simulation guard is present in `test/aztec_e2e_no_simulation.test.ts`.
- The normative specification includes a threat model and residual-risk treatment.

## License and contribution

- License: `LICENSE`
- Contribution policy: `CONTRIBUTING.md`
