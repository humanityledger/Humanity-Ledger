# Aztec alignment audit, 26 November 2026

Internal review of how Ledger Chat uses Aztec 6.0.0 "Tierra" (Alpha V6), against the official migration notes (6.0.0, 6.0.0-rc.3, 6.0.0-rc.1, 5.2.0 at `docs.aztec.network/developers/docs/resources/migration_notes`) and the patterns of aztec-nr v6.0.0. Written by the engineering assistant for the operator. **It is not an external audit and Aztec Labs has not reviewed it.**

**Scope rule.** An external audit began on 25 November 2026. Any change under `contracts/aztec/` changes class IDs and moves the code away from what the auditors are reading. So this branch changes **no contract and no wallet code**: every correction below that touches either is queued for after the report, with its exact form. Documentation was corrected where it disagreed with the code ([`TRUTH_AUDIT.md`](TRUTH_AUDIT.md)).

## 1. What is aligned (checked, with the line)

| # | Practice | Evidence |
|---|---|---|
| OK-1 | aztec-nr from `aztec-labs-eng/aztec-nr`, tag `v6.0.0`, the same tag for `aztec`, `uint_note` and `balance_set` in all five crates (rc.1: "aztec-nr moved repositories"; 6.0.0: same tag for every aztec-nr dependency) | `contracts/aztec/*/Nargo.toml` |
| OK-2 | npm scope `@aztec-labs/*` 6.0.0 and upstream `viem`, not the old fork (rc.1) | `package.json` lines 81 to 86 and 286 |
| OK-3 | No protocol-contract wrappers from `noir-contracts.js` and no deprecated `at(wallet)` on them (rc.1) | no match in `lib/`, `components/`, `app/`, `scripts/` |
| OK-4 | No removed names (`OriginBlock`, `GasPrice` in `l1-tx-utils`, `ACVM_*`) | no match |
| OK-5 | CI installs the official toolchain at `VERSION=6.0.0`, compiles every crate and runs the TXE tests | `.github/workflows/aztec-contracts.yml` lines 42 and 43 |
| OK-6 | The PXE runs in the browser through `EmbeddedWallet.create(node, { pxe: { store }, walletDb: { store } })`, with encrypted stores | `lib/aztec/wallet/client.ts` line 459 |
| OK-7 | Gas limits from `simulate({ includeMetadata: true, skipFeeEnforcement: true })`, padded; no fixed `MAX_PROCESSABLE_L2_GAS` | `lib/aztec/wallet/client.ts` line 803, `lib/aztec/fee-juice.ts` |
| OK-8 | Each account pays its own Fee Juice; no sponsor contract or route (410) | `test/unit/aztec/no-sponsorship.test.ts` |
| OK-9 | A token is loaded only after its class, read from the node, matches an artifact the wallet holds | `lib/aztec/token-check.ts`, `lib/aztec/standards-token.ts` |
| OK-10 | Value notes delivered with `MessageDelivery::onchain_constrained()` | `contracts/aztec/escrow/src/main.nr` lines 226 and 227 |
| OK-11 | Per-owner `Owned<PrivateSet<…>>`; `pop_notes` filtered by id with `set_limit(1)` | escrow lines 169, 236 to 240 |
| OK-12 | Expiration bounded to `min(deadline, anchor + 3600)`, under the 24-hour maximum | escrow lines 215, 216, 252, 253 |
| OK-13 | Read-only views are `#[external("utility")]` (unconstrained, never proven) | escrow line 334 |
| OK-14 | Admin entry points of the identity registry are `#[only_self]` where they are internal | `contracts/aztec/identity/src/main.nr` lines 172 and 180 |
| OK-15 | `DelayedPublicMutable` (one-hour minimum since rc.1) is not used | no match |

## 2. Deviations and opportunities

| ID | Severity | Finding | Exact correction | When |
|---|---|---|---|---|
| A-01 | Medium | Escrow and streams call the token through a raw selector, `FunctionSelector::from_signature("transfer_in_private((Field),(Field),u128,Field)")` with `call_private_function`, and discard the result (escrow line 132, streams line 189). A signature typo compiles and fails only at proving. Open as Q3 in [`AZTEC_DECISIONS.md`](AZTEC_DECISIONS.md). | Use the token crate's generated interface, or keep the raw call and add a TXE test that resolves the selector against the token artifact. | After the audit report |
| A-02 | High (product) | cUSDC runs the aztec-standards AIP-20 Token, which has no `transfer_in_private`, so agreements cannot use cUSDC. Its `transfer_private_to_private(from, to, amount, nonce)` has the same parameter shape (`lib/aztec/token-dialect.ts` line 37). | Store the transfer selector per token as a `PublicImmutable` set at construction from an allow-list of two (reference Token, AIP-20). Confirm with Aztec Labs or the aztec-standards authors that AIP-20 checks an authwit when `from` is not the caller. New class IDs, TXE tests against the AIP-20 artifact, external review. | After the audit report |
| A-03 | Medium | Deposit and settlement nullifiers are pushed with `push_nullifier_unsafe` under app-defined separators 718293041 to 718293043. Nullifiers are siloed by contract address, so other contracts cannot collide; rc.1 moved the protocol separators and recommends aztec-nr helpers for those. | Ask Aztec Labs to confirm this pattern for one-shot settlement (Q1 and Q4 in [`AZTEC_DECISIONS.md`](AZTEC_DECISIONS.md)). No change until they answer. | Question sent with the forum post |
| A-04 | Low | `compiler_version = ">=1.0.0"` in every `Nargo.toml`. CI pins the toolchain, but a local `nargo` of another version can produce another class ID than the pins in `lib/aztec/artifact-pins.ts`. | Pin `compiler_version` to the exact nargo shipped with Aztec 6.0.0 (read from `aztec --version` in the CI log). | Next contract change |
| A-05 | Medium (privacy) | On Alpha the fee payer is public, so one account's transactions are linkable. The PrivateFPC route recommended by the Aztec documentation is written and off by default ([`PRIVATE_FEES.md`](PRIVATE_FEES.md)). | Enable for the beta only after a review of the FPC contract and a two-account run. | Operator decision |
| A-06 | Medium (UX) | The AIP-20 Token emits no private event on a private-to-private transfer, so a received cUSDC payment shows in the balance and not as activity, and a request is not marked paid. | Client: detect receipts from note discovery and balance deltas, labelled as such. Upstream: propose an event to the aztec-standards authors. | Wallet change after the audit; upstream issue now |
| A-07 | Low | `docker-compose.yml` runs `aztecprotocol/aztec-sandbox:6.0.0-rc.1`; everything else is 6.0.0. | Move to the 6.0.0 image once its published name under the new scope is confirmed. | Next infra change |
| A-08 | Info | 6.0.0-rc.3 re-pinned `AuthRegistry` and changed every contract address (separator V3). The addresses we use on Alpha (HLC, cUSDC, FeeJuicePortal) were recorded on the 6.0.0 network, and the wallet re-checks token classes at run time (OK-9). | None. | — |

## 3. What this means for a reviewer from Aztec Labs

* The integration uses the canonical browser path (EmbeddedWallet, PXE in WebAssembly, Fee Juice, simulation-based gas), pinned to the current release and compiled in CI with the official installer.
* The contracts follow aztec-nr v6 idioms (owned private sets, constrained delivery, bounded expiration, utility views). The two places where they do not (A-01 raw selector, A-03 custom nullifiers) are documented decisions with open questions, not oversights.
* The biggest functional gap (A-02, agreements in cUSDC) has a concrete, reviewable fix that waits for the audit.

## 4. Questions for Aztec Labs

1. A-02: does the AIP-20 `transfer_private_to_private` enforce an authwit for `from != msg_sender` in every path, so a contract can pull funds with the user's authwit as it does with `transfer_in_private`?
2. A-03: is a contract-level `push_nullifier_unsafe` with a domain-separated hash the recommended way to make claim and refund mutually exclusive, or is there an aztec-nr helper for one-shot state?
3. A-06: is a private transfer event planned for the AIP-20 Token, or should wallets rely on note discovery?
