# Ledger Chat on Aztec

How Ledger Chat uses Aztec, what stays private, what does not, and where the integration departs from Aztec's own patterns. State on 26 November 2026. Evidence for every figure is in [`EVALUATION_DOSSIER.md`](EVALUATION_DOSSIER.md); the line-by-line check against the Aztec 6.0.0 migration notes is [`AZTEC_ALIGNMENT_AUDIT.md`](AZTEC_ALIGNMENT_AUDIT.md).

Humanity Ledger is not affiliated with, endorsed by or audited by Aztec Labs or the Aztec Foundation.

## 1. Versions

| Piece | Version | Where |
|---|---|---|
| Network | Aztec 6.0.0 "Tierra" (Alpha V6), settling on Ethereum mainnet | [`../deployments/aztec-mainnet.json`](../deployments/aztec-mainnet.json) |
| Client SDK | `@aztec-labs/aztec.js`, `accounts`, `wallets`, `stdlib`, `foundation`, `noir-contracts.js` 6.0.0 | [`../package.json`](../package.json) |
| Contracts | aztec-nr `v6.0.0` from `aztec-labs-eng/aztec-nr` | [`../contracts/aztec/`](../contracts/aztec/) |
| Toolchain in CI | Official installer, `VERSION=6.0.0` | [`../.github/workflows/aztec-contracts.yml`](../.github/workflows/aztec-contracts.yml) |

## 2. The wallet runs in the browser

* **PXE.** `EmbeddedWallet.create(node, { pxe: { store }, walletDb: { store } })` from `@aztec-labs/wallets`, with both stores encrypted on the device ([`../lib/aztec/wallet/client.ts`](../lib/aztec/wallet/client.ts)). Proofs (UltraHonk) are built locally; only the proof, nullifiers, note hashes and encrypted notes leave the device.
* **Node access.** The public Aztec node, through the Ledger Relay, or the person's own node with the same identity checks ([`../lib/aztec/node-relay.ts`](../lib/aztec/node-relay.ts)).
* **Account.** A Schnorr account. Its root is an EIP-712 signature by the person's Ethereum wallet; the account secret, salt, signing key, store key and Fee Juice claim secrets are derived from it with HKDF-SHA256 ([`../lib/aztec/wallet/keys.ts`](../lib/aztec/wallet/keys.ts)). Alpha and the test network sign different messages, so they are different accounts.
* **Passkeys.** WebAuthn PRF can unwrap the same account root ([`ACCOUNT_MODEL.md`](ACCOUNT_MODEL.md)). Whoever holds an enrolled passkey can spend, like whoever holds the wallet. In code and unit tests; not yet tested on a real device.

## 3. Fees

* Each account pays its own fees in **Fee Juice**, bridged from AZTEC on Ethereum by the person or paid in by a contact through a fee link. Ledger Chat sponsors no fee; `/api/aztec/sponsor` answers 410 ([`../test/unit/aztec/no-sponsorship.test.ts`](../test/unit/aztec/no-sponsorship.test.ts)).
* **Gas limits come from a simulation** (`simulate({ includeMetadata: true, skipFeeEnforcement: true })`), padded by 25% plus a margin, so an account needs about 15 AZTEC of Fee Juice instead of about 42 ([`../lib/aztec/fee-juice.ts`](../lib/aztec/fee-juice.ts), `gasLimitsFromSimulation`, `budgetFeeFor`).
* **Fee privacy.** Aztec runs no public Sponsored FPC on Alpha, so the fee payer is visible and one account's transactions can be linked. A route through the shared PrivateFPC recommended in the Aztec documentation is written and off by default ([`PRIVATE_FEES.md`](PRIVATE_FEES.md)).

## 4. Tokens

The wallet loads a token on Alpha only if the class its instance runs, read from the node, equals the class computed from an artifact the wallet holds ([`../lib/aztec/token-check.ts`](../lib/aztec/token-check.ts)). It speaks two token ABIs and matches a token to one only when every function it calls exists with the exact signature ([`../lib/aztec/token-dialect.ts`](../lib/aztec/token-dialect.ts)):

| ABI | Private send | Used by |
|---|---|---|
| aztec-standards AIP-20 Token 6.0.0 (class `0x2ff09399…68ea9f`) | `transfer_private_to_private(from, to, amount, nonce)` | cUSDC, issued by human.tech through its Shield bridge |
| Reference `Token` of `noir-contracts.js` | `transfer(to, amount)` | HLC, a test token with no value, no longer listed on Alpha |

Ledger Chat does not issue, hold or redeem cUSDC.

## 5. Binding a chat contact to an Aztec address (G7)

The peer announces its Aztec address inside the encrypted XMTP conversation, with a Schnorr signature over Grumpkin by the account's signing key on:

```text
sha256ToField("hl/aztec-binding/v2 | <address> | <signerInboxId> | dm:<recipientInboxId> | net:aztec:<l1ChainId>:<rollupVersion>")
```

The receiver checks that the signer and recipient inboxes are the authenticated ends of the conversation, that the address is exactly the Schnorr account address computed from the signing key, salt and public keys, that the signature verifies, and that the network is its own. Only then is the address pinned; a later, different address is shown as a conflict and never replaces it silently ([`../lib/aztec/peer-binding.ts`](../lib/aztec/peer-binding.ts), [`aztec/G7_BINDING_SPEC.md`](aztec/G7_BINDING_SPEC.md)). It stops a relay or third party from substituting its own address. It does not prove the peer holds the address's privacy keys.

## 6. Contracts

| Contract | Purpose | Tests | Deployed |
|---|---|---|---|
| `PrivateEscrow` | Claim note for the recipient and refund note for the sender share one settlement nullifier, so exactly one lands. Bounded expiration; constrained on-chain delivery | TXE in CI; end to end on testnet | Testnet only. Refused on Alpha until an audit exists |
| `PaymentStream` | Accrual capped at the total; a state nullifier shared by withdraw and cancel | TXE in CI; end to end on testnet | Testnet only |
| `PortalToken` | Aztec side of the Ethereum portal: claim an L1 deposit privately, burn to withdraw | 11 TXE tests | Nowhere |
| `IdentityCredential` | Depth-32 Poseidon2 membership, committed sanction lists, single-use claim per scope | TXE in CI | Testnet |
| `test_token` | Test-only token for TXE | — | — |

Agreements hold token notes owned by the contract, so each agreement gets its own instance deployed with public keys derived from a secret only its two parties hold ([`../lib/aztec/keyed-deploy.ts`](../lib/aztec/keyed-deploy.ts)). Open design questions Q1 to Q10 are in [`AZTEC_DECISIONS.md`](AZTEC_DECISIONS.md).

## 7. What is private, and what is not

| On Aztec, private | On Aztec, public |
|---|---|
| Sender, recipient, amount of a transfer | That a transaction happened; its note hashes and nullifiers |
| Balances | The fee payer and its Fee Juice balance |
| The terms of an escrow or stream | The contract class of a deployed instance |

## 8. Where we are not yet aligned

From [`AZTEC_ALIGNMENT_AUDIT.md`](AZTEC_ALIGNMENT_AUDIT.md). None of these is changed while the external audit reads the code; each has its exact correction there.

* **A-01.** Escrow and streams call the token by raw selector instead of a typed interface.
* **A-02.** Agreements cannot use cUSDC, because the AIP-20 Token has no `transfer_in_private`; its `transfer_private_to_private` has the same shape and could be supported.
* **A-03.** One-shot settlement uses `push_nullifier_unsafe` with app domain separators; confirmation from Aztec Labs is asked.
* **A-06.** The AIP-20 Token emits no private event on transfer, so received cUSDC is not listed as activity.

## 9. Reproduce

```bash
npm run test:run                    # includes test/unit/aztec/
npm run test:aztec:e2e              # PXE end to end on the test network (needs .env.aztec, see AZTEC_E2E.md)
```

Contracts: CI workflow "Aztec contracts" compiles every crate with Aztec 6.0.0 and runs the TXE tests. Testnet receipts: [`AZTEC_TESTNET_DEPLOYMENTS.md`](AZTEC_TESTNET_DEPLOYMENTS.md). Alpha transactions: [`EVALUATION_DOSSIER.md`](EVALUATION_DOSSIER.md) §3, readable on Aztecscan.
