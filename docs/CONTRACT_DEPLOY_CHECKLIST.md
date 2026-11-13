# Contract deployment checklist (Aztec Alpha)

Run by Stefan with the Aztec toolchain, never by an agent: every deployment on Alpha spends real Fee Juice and is signed
by Humanity Ledger's own account. Nothing is recorded in `deployments/aztec-mainnet.json` without its transaction hash
and block, and nothing is announced before the preflight passes for the same artifacts.

## State on 13 November 2026

| Contract | State on Alpha | Source sha256 | Artifact |
| --- | --- | --- | --- |
| HLC token (standard Token, noir-contracts.js 6.0.0) | Deployed, block 24544 | — (Aztec's artifact) | `@aztec-labs/noir-contracts.js/Token` |
| PrivateEscrow | Not deployed | `d86b17a7…5e82ab` | `contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json` — **predates the source** (deposit nullifier) |
| PaymentStream | Not deployed | `7d59956d…a3148c` | `contracts/aztec/streams/target/payment_stream-PaymentStream.json` — **predates the source** (creation nullifier) |
| LedgerSponsor | Not deployed | `d5401e86…e6e62` (`main.nr`), `5afa6040…34be8` (`voucher.nr`) | `contracts/aztec/sponsor/target/ledger_sponsor-LedgerSponsor.json` |
| FeeJuicePortal | Aztec's own, pinned | — | `lib/aztec/sequencer/networks.ts` (`l1.feeJuicePortal`), checked by `lib/aztec/fee-juice.ts` |

Source hashes are those listed in `deployments/aztec-pending-recompile.json`, which `scripts/aztec/check-artifact-sources.mjs`
checks on every pull request.

## 1. Recompile PrivateEscrow and PaymentStream

1. With `aztec` 6.0.0 installed: `cd contracts/aztec/escrow && aztec compile` and `aztec test`; same in `contracts/aztec/streams`.
   Or run the workflow "Aztec contracts" (`.github/workflows/aztec-contracts.yml`), which compiles and runs the TXE tests.
2. Commit the new `target/*.json`. Record the new class IDs in `deployments/aztec-testnet.json`; mark the old entries
   `tracksCurrentArtifact: false`.
3. Delete the two entries from `deployments/aztec-pending-recompile.json`. `check-artifact-sources.mjs` must pass.

## 2. Test network first

1. `npm run aztec:setup` and the workflow "Aztec escrow e2e (testnet)": deposit, claim, refund, cancel with a keyed
   instance (`scripts/aztec/deploy-keyed.ts`). Record the transaction hashes in `deployments/aztec-testnet.json`.
2. Streams: create, withdraw, cancel, same recording.

## 3. Deploy on Alpha

1. Same script, same artifacts, `NEXT_PUBLIC_AZTEC_NETWORK=alpha`, from the operator account funded with Fee Juice.
2. Add each instance to `deployments/aztec-mainnet.json` → `contracts`: `name`, `address`, `classId`, `deployTx`,
   `deployBlock`, `tracksCurrentArtifact: true`, keys when it holds tokens. `authorizedMainnetRecord` ignores any entry
   without them.
3. Run the workflow "Aztec mainnet preflight" (read-only). It must confirm block and class for every entry.
4. Only then does `/protocol` show the escrow as deployed and does the client allow agreements (within the caps).

## 4. LedgerSponsor

1. Deploy with the signer public key returned by `GET /api/aztec/sponsor` (`AZTEC_SPONSOR_*` server secrets set first)
   and a `max_fee` cap; fund it with Fee Juice through `fund`.
2. Record it in `deployments/aztec-mainnet.json` → `sponsoredFpc` as `{ address, feeJuiceContract, feeJuiceBalanceSlot }`, the last two printed by `node --import ./scripts/aztec/register.mjs scripts/aztec/fee-juice-slot.mjs <address>`.
3. Set `NEXT_PUBLIC_AZTEC_SPONSOR` in Railway and redeploy (it is read at build time).
4. `/protocol` then shows the sponsor's Fee Juice balance, read from that slot at the anchored block.

## 5. Before raising caps or removing the "unaudited" acknowledgement

Every condition in `docs/MAINNET_READINESS.md` ("Conditions before raising caps") recorded with a date and a link,
starting with the external audit, whose report goes to `audits/` and into `deployments/aztec-mainnet.json` → `audit`.
