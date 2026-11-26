feat(wallet): load cUSDC with the aztec-standards Token ABI

## Why
The private wallet refused cUSDC with "token class is not one this client trusts". cUSDC on Aztec Alpha runs the AIP-20 Token from aztec-standards 6.0.0 (class `0x2ff0939914ff64bd3f7979926dbe8cf3332bc2fee55928bf3cc9ca802568ea9f`, read from the node). The client only trusted the reference Token from noir-contracts.js.

## What changes
- `lib/aztec/artifacts/aztec-standards-token-6.0.0.json`: the published artifact (npm `@aztec-foundation/aztec-standards@6.0.0`, `target/token_contract-Token.json`, sha256 `f18cccf8…343e0`) with its debugging data removed. Bytecode and ABI are untouched, and a test pins the computed class to the one deployed on Alpha. Its `auth_contract` slot on Alpha is zero, so private transfers make no nested authorization call.
- `lib/aztec/token-dialect.ts`: describes the two token ABIs the wallet speaks. A dialect is recognised only when every signature matches exactly. It provides send, shield and unshield for each dialect, always with nonce 0 and the wallet as sender.
- `lib/aztec/token-check.ts`: new `purpose: 'wallet'` option. It accepts a trusted class whose artifact speaks a wallet dialect and returns which artifact matched. The default (agreements) is unchanged, so cUSDC still cannot back escrows or streams (it has no `transfer_in_private`).
- `lib/aztec/wallet/client.ts`: on Alpha, trusts both artifacts and binds each token to the one that matched. send, shield and unshield go through that token's dialect. Private Transfer events are read only for the reference Token: the aztec-standards Token emits none for a private send, so incoming cUSDC appears in the balance.

## Not changed
- Railway variables, deployments, `CUSDC_GATES`, legal texts and the `cusdcBeta` switch.

## Tests
- `test/unit/aztec/token-dialect.test.ts`: covers the class ID, dialect detection, exact signatures, the calls built for each dialect, `checkTokenInstance` for wallet versus agreements, and the wallet wiring.
- Checked against the real libraries (`@aztec-labs/*` 6.0.0) in a Node run:
  - the class matches;
  - dialects are detected;
  - `checkTokenInstance` returns index and dialect;
  - `Contract.at` exposes `balance_of_private`, `balance_of_public` and the three `transfer_*` functions;
  - the private send builds a `ContractFunctionInteraction`.
- `tsc` is clean on the changed files.
- `wallet-open-tokens` patterns are kept.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XxvenN4H1ayA7t8W7b1enS
