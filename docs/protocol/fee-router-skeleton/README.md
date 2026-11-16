# Fee path — documentary skeleton

**This directory is not a contract.** It is not Noir, not Solidity, and not bytecode. Nothing here is compiled, deployed, or called.

The production source is `contracts/aztec/escrow/src/main.nr` and `contracts/aztec/streams/src/main.nr`. It follows the authorized baseline and is ahead of the committed artifact. This directory does not replace that source.

Authorized baseline: `docs/protocol/FEE_CONTRACT_SPEC.md` sections 6 and 8, 16 November 2026. Values are those rows. This skeleton adds none.

There is still no treasury address (this file does not invent one) and, before any Alpha deploy, launch condition 1 of `docs/TOKENOMICS.md` (external audit) is unmet. There is no external audit.

Q1–Q10 stay OPEN. R8 is not run. `communityMls` stays false.

| File | What it holds |
|---|---|
| `CONSTANTS.md` | The D5 constants, as comments |
| `SIGNATURES.md` | Private-function signatures, the u128-safe formula, and where the fee is taken |
