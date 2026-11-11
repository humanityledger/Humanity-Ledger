# Migrating Ledger Chat to a new Aztec network version

Applies whenever Aztec ships a new rollup (as V5 → V6 "Tierra" did). A new version means recompiled contracts, new class IDs and a new canonical rollup; nothing carries over automatically.

## What is tied to a network version

| Item | Where | On upgrade |
|---|---|---|
| SDK | `@aztec-labs/*` in package.json, one exact version (CI: `check-sdk-single-version.mjs`) | Bump all six together |
| Contract toolchain | `contracts/aztec/*/Nargo.toml` tag, workflow "Aztec contracts" | Bump tag and installer version, recompile, TXE tests |
| Artifacts and class IDs | `contracts/aztec/*/target`, `deployments/aztec-*.json` | New class IDs; old entries `tracksCurrentArtifact=false` |
| Network pins | `lib/aztec/sequencer/networks.ts`, `lib/aztec/fees.ts`, `lib/aztec/fee-juice.ts` | New rollup address/version; old one refused |
| Local wallet stores | names include the rollup address (`walletStoreNames`) | A new rollup gets empty stores; old ones stay until wiped |
| Token and Fee Juice addresses | `lib/aztec/wallet/config.ts`, `deployments/` | Re-verify on the new network |
| Own-circuit prover | `@aztec/bb.js` 5.3.0, `lib/zk`, pinned VKs | Not shipped. Do not re-enable before bumping bb.js and re-deriving VKs |

## Order of work

1. Read the release notes and the migration notice. Record the new rollup address, version and L1 chain.
2. Branch. Bump SDK and toolchain together. `check-sdk-single-version.mjs` and "SDK still encrypts the wallet stores" must pass on the new version before anything else.
3. Recompile (workflow "Aztec contracts" on a `claude/**` or feature branch). `check-artifact-sources.mjs` must report no pending entries.
4. Deploy keyed test instances on the new testnet, run `scripts/aztec/e2e-escrow-testnet.mts`, record class IDs and receipts in `deployments/aztec-testnet.json`.
5. Update network pins. The old rollup must now be refused by `assertNodeForValue`.
6. Two-browser runs listed in docs/MAINNET_READINESS.md on the new network.
7. Only then update `deployments/aztec-mainnet.json` and consider `alphaEnabled`.

## Value on the old version

- Notes and agreements on the old rollup do not move. Each party settles there (claim, refund, cancel, withdraw) and, if Aztec provides a bridge or migration path for tokens, uses that. Ledger Chat does not migrate funds.
- Set `AZTEC_VALUE_MODE=exits-only` while the old rollup is still the configured one, and keep that build reachable until every agreement opened through the app is past its deadline.
- Tell users before the switch: what to settle, by when, and that funds left on a version Aztec has declared affected are at risk.

## Acceptance for "migrated"

- CI green: single SDK, store encryption, artifact sources (no pending), deployments registry, TXE tests.
- Live check green against the new node (workflow "Aztec testnet deployments").
- No class ID of the old version has `tracksCurrentArtifact=true`.
- An invitation carrying an old class ID is rejected by `verifyAgreementInvite`.
