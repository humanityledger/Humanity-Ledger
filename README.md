# Humanity Ledger Protocol

Humanity Ledger is a privacy oriented communication and settlement protocol that combines MLS messaging with client side Aztec UltraHonk proof generation and auditable on chain settlement.

Current maturity status: Testnet Stage 1 Audit Ready.

Normative specification reference: docs/PROTOCOL_SPEC.md is the single source of truth for the protocol, including the threat model, normative properties, acceptance criteria, and residual risk treatment.

Verified properties

1. P1 Message confidentiality. MLS is used in conformance with RFC 9420. The corresponding verification is in test/mls_post_compromise.test.ts and in the command npm run test:crypto.

2. P2 Post compromise security. Epoch advance does not expose previously unreadable message content after device compromise. Verified in test/mls_post_compromise.test.ts.

3. P3 Private state confidentiality. Private balances and client held state remain client side and are not exposed to the server or to the Aztec sequencer. The real client side PXE path is in scripts/aztec-pxe-e2e.ts and the no simulation guard is in test/aztec_e2e_no_simulation.test.ts.

4. P4 Private state integrity. Invalid private state transitions are rejected by validation and contract invariants. Verified in test/circuits and in test/contracts_invariants.test.ts.

5. P5 No server key custody. The server does not generate, derive, or store user spending keys or long term MLS identity keys. Verified in test/key_custody.test.ts.

6. P6 EAF isolation. Executable artifact frames are constrained to a closed bridge surface and cannot escape the sandbox boundary. Verified in test/eaf_isolation.adversarial.test.ts.

Acceptance criteria status

1. A1 Satisfied. This is demonstrated by the real Aztec testnet end to end script scripts/aztec-pxe-e2e.ts with zero simulation. The repository also contains test/aztec_e2e_no_simulation.test.ts to ensure the pipeline does not rely on simulated only execution.

2. A2 Satisfied. MLS confidentiality and post compromise protection are checked in test/mls_post_compromise.test.ts and by the command npm run test:crypto.

3. A3 Satisfied. EAF isolation is checked in test/eaf_isolation.adversarial.test.ts.

4. A4 Satisfied. Contract invariants are checked in test/contracts_invariants.test.ts and in test/HumanTimeLock.test.ts.

5. A5 Satisfied. Server key custody is checked in test/key_custody.test.ts.

6. A6 Satisfied. Residual risk treatment is included in docs/PROTOCOL_SPEC.md and the audit dossier is formally recorded in docs/AUDIT_DOSSIER.md.

7. A7 Satisfied. The traceability matrix in docs/TRACEABILITY_MATRIX.md maps the public claims to properties P1 to P6 and to automated tests.

Traceability matrix: docs/TRACEABILITY_MATRIX.md.

Explicit non claims

The protocol does not claim the following:

1. Metadata privacy for MLS membership, message timing, or traffic patterns.
2. Quantum resistance for any cryptographic primitive.
3. Mainnet production readiness.

These limits are specified in docs/PROTOCOL_SPEC.md and must be treated as explicit constraints rather than guarantees.

How to verify the current state

Run the following commands from the repository root:

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

The working branch is reported as npm audit clean.

Repository layout note

The repository is organized around three core areas:

1. circuits contains Aztec and Noir circuit sources and associated verification logic.
2. test contains invariant, negative, adversarial, and end to end verification tests.
3. docs contains the normative protocol specification, traceability matrix, audit dossier, and residual risk documentation.

Implemented state summary

1. Client side Aztec UltraHonk proofs are used for private state transitions.
2. MLS is implemented in accordance with RFC 9420.
3. No server key custody is present in the verified implementation.
4. The real PXE end to end pipeline is scripts/aztec-pxe-e2e.ts and was verified on Aztec testnet.
5. The no simulation guard is present in test/aztec_e2e_no_simulation.test.ts.
6. The normative specification contains the threat model and residual risk treatment.

License

The repository license is documented in LICENSE.

Contributing

The contribution policy is documented in CONTRIBUTING.md.
