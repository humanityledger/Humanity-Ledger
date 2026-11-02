# Humanity Ledger Protocol

Humanity Ledger is a privacy oriented communication and settlement protocol that combines MLS messaging with client side Aztec UltraHonk proof generation and auditable on chain settlement.

Current maturity status: Testnet Stage 1 Audit Ready.

Normative specification reference: `docs/PROTOCOL_SPEC.md` is the single source of truth for the protocol, including the threat model, normative properties, acceptance criteria, and residual risk treatment.

## Verified properties (P1 to P6)

P1. Message confidentiality: MLS is used in conformance with RFC 9420. Verification is in `test/mls_post_compromise.test.ts` and in the command `npm run test:crypto`.

P2. Post compromise security: Message confidentiality is preserved across epoch advances after device compromise. Verified in `test/mls_post_compromise.test.ts`.

P3. Private state confidentiality: Private balances and client held state are generated and verified on the client side; the server does not receive private witnesses. Verified by the client side Aztec PXE path in `scripts/aztec-pxe-e2e.ts` and the zero simulation guard in `test/aztec_e2e_no_simulation.test.ts`.

P4. Private state integrity: Invalid private state transitions are rejected by validation, circuit constraints, and contract invariants. Verified in `test/circuits/` and `test/contracts_invariants.test.ts`.

P5. No server key custody: The server does not generate, derive, or store user spending keys or long term MLS identity keys. Verified in `test/key_custody.test.ts`.

P6. EAF isolation: Executable artifact frames are constrained to a closed bridge surface and cannot escape the sandbox boundary. Verified in `test/eaf_isolation.adversarial.test.ts`.

## Acceptance criteria status (A1 to A7)

A1. Verified. Demonstrated by the real Aztec testnet end to end script `scripts/aztec-pxe-e2e.ts` with zero simulation, and guarded by `test/aztec_e2e_no_simulation.test.ts`.

A2. Verified. MLS confidentiality and post compromise protection are checked in `test/mls_post_compromise.test.ts` and by `npm run test:crypto`.

A3. Verified. EAF isolation is checked in `test/eaf_isolation.adversarial.test.ts`.

A4. Verified. Contract invariants are checked in `test/contracts_invariants.test.ts` and `test/HumanTimeLock.test.ts`.

A5. Verified. Server key custody is checked in `test/key_custody.test.ts`.

A6. Verified. Residual risk treatment is documented in `docs/PROTOCOL_SPEC.md` and the audit dossier is recorded in `docs/AUDIT_DOSSIER.md`.

A7. Verified. The traceability matrix in `docs/TRACEABILITY_MATRIX.md` maps protocol claims to properties P1 to P6 and automated tests.

Traceability matrix: `docs/TRACEABILITY_MATRIX.md` is the repository level mapping between public claims, normative properties, and verification artifacts.

## Explicit non claims

The protocol does not claim the following:

1. Metadata privacy for MLS group membership, message timing, or traffic patterns.
2. Quantum resistance for any cryptographic primitive.
3. Mainnet production readiness.

These limits are specified in `docs/PROTOCOL_SPEC.md` and are treated as explicit constraints rather than guarantees.

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

The working branch is reported as `npm audit` clean.

## Repository layout

The repository is organized around three core areas:

1. `circuits/` contains Aztec and Noir circuit sources and associated verification logic.
2. `test/` contains invariant, negative, adversarial, and end to end verification tests.
3. `docs/` contains the normative protocol specification, traceability matrix, audit dossier, and residual risk documentation.

## Implemented state summary

1. Client side Aztec UltraHonk proofs are used for private state transitions.
2. MLS is implemented in line with RFC 9420 semantics and validation tests.
3. No server key custody is present in the verified implementation.
4. The real PXE end to end pipeline is `scripts/aztec-pxe-e2e.ts` and was verified on Aztec testnet.
5. The no simulation guard is present in `test/aztec_e2e_no_simulation.test.ts`.
6. The normative specification contains the threat model and residual risk treatment.

## License and contribution

- License: `LICENSE`
- Contribution policy: `CONTRIBUTING.md`
