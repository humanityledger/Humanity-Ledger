# Ledger Chat on Aztec Alpha (mainnet): readiness

**Date:** 5 November 2026, updated 10 November 2026 (G2). **Status:** nothing of ours is deployed on Aztec Alpha. The wallet refuses a node that settles on Ethereum mainnet (`assertNetworkAllowed` in `lib/aztec/wallet/config.ts`) unless the operator sets **both** `NEXT_PUBLIC_AZTEC_NETWORK=alpha` and `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true`. Neither is set in production, and neither should be until the gates below are met.

## Where Aztec is

- Aztec Alpha runs on Ethereum mainnet (L1 chain 1), version 6.0.0 ("Tierra", 3 November 2026), the same version our contracts and client are built against. The testnet runs the same release and Aztec calls it the staging environment for Alpha. Source: [docs.aztec.network/networks](https://docs.aztec.network/networks).
- Aztec's own words on Alpha: live but early, bugs (including critical ones) expected. Earlier coverage of the Alpha launch quoted the team: deposit only funds you can afford to lose.
- Alpha has **no Sponsored FPC**. Fees are paid in Fee Juice, from the account's balance or by claiming Fee Juice bridged from L1 in the same transaction (`FeeJuicePaymentMethodWithClaim`). `PrivateFeePaymentMethod` and `PublicFeePaymentMethod` are deprecated and do not work on Alpha. Source: [Paying Fees](https://docs.aztec.network/developers/docs/aztec-js/how_to_pay_fees).

## First preflight against Alpha (5 November 2026)

Workflow "Aztec mainnet preflight", run 42040311011, read-only against `https://aztec-mainnet.drpc.org`:

- node 6.0.0, L1 chain 1, rollup version 2070860440: no drift from `lib/aztec/sequencer/networks.ts`;
- no contract at the testnet's sponsored fee payer address: fees on Alpha are paid in Fee Juice;
- the classes of our committed artifacts are not published on Alpha: PrivateEscrow `0x1fc9702de2946be7308126990f4cf3b8a3fbe9a4c53dc072d9ccb95bf9f04b5e`, PaymentStream `0x1fd6afbe0bffe6a7cb675927dedc0aed886a46bf7c6d58edc32854af073701f2`, IdentityCredential `0x1be813182640bfe08c2dea56bc3f96a7192b380a8dadc8210fc27ae0867e6c06`. The same classes run on testnet (run 42030688268).

## Gates

| # | Gate | State on 5 Nov 2026 | How to check |
| --- | --- | --- | --- |
| G1 | The client knows which network it talks to and refuses drift | Done: `identifyNode` (`lib/aztec/fees.ts`) reads the node's L1 chain ID, rollup version, node version and rollup address and compares them with `lib/aztec/sequencer/networks.ts` | `test/unit/aztec/fees.test.ts`; workflow "Aztec mainnet preflight" against the Alpha node |
| G2 | Fees in Fee Juice, never a sponsored payer on Alpha | Done in the wallet, not yet run against Alpha. On Alpha the wallet pays in Fee Juice (`lib/aztec/fee-juice.ts`, `lib/aztec/wallet/client.ts`). A new account waits in `needs-fee-juice` until the user bridges AZTEC from L1 through the **pinned** FeeJuicePortal (a node reporting another portal or token is refused), then deploys by claiming in the same transaction (`FeeJuicePaymentMethodWithClaim`). Later transactions pay from the balance and claim any deposit that has arrived. Claim secrets are derived from the wallet signature, so deposits are recoverable from L1 on any device (`recoverFeeJuiceClaims`). Alpha signs a different EIP-712 message, so it is a different account from testnet. Checked against the Aztec v6.0.0 sources (aztec-node `1b6de149`). The screen is in `ZkBridgePortal` (Settings, Network fees). Open: one real run | `test/unit/aztec/fee-juice.test.ts` (12); first real run on Alpha with a small deposit, by Stefan |
| G3 | A real private token for agreements | Partly done: `lib/aztec/token-check.ts` accepts a token only if its instance runs a class computed from an artifact the client trusts and that artifact has `transfer_in_private((Field),(Field),u128,Field)`, the function our contracts call by selector; the standard Token of noir-contracts.js 6.0.0 matches. Open: which private tokens are live on Alpha, and with which contract, is a question for Aztec | `test/unit/aztec/token-check.test.ts`; per-token caps |
| G4 | Contract risk is bounded | Partly done: `lib/aztec/agreement-policy.ts` allows an agreement on Alpha only for a recorded class, with the user's acknowledgement while unaudited, and within a per-token cap; `openEscrow`, `openStream` and `acceptInvite` enforce it before anything is sent or registered. No external audit | `test/unit/aztec/agreement-policy.test.ts` |
| G5 | Deployments recorded like on testnet | Ready: `deployments/aztec-mainnet.json` (empty) and its offline checks (transaction hash and block required, keys required for token-holding instances, class equal to the committed artifact); the preflight checks every entry on the node | `test/unit/aztec/deployments-registry.test.ts`, preflight |
| G6 | Agreements usable from the chat | Built: Private agreement in the attach menu, cards for invitations and address announcements, verify and accept, claim, refund, withdraw, cancel (`docs/chat/AGREEMENTS.md`). Open: a recorded two-account session in browsers | Two-account demo |
| G7 | Proof that the peer controls the pinned Aztec address | Done in code (10 November). Version 2 announcements carry a Schnorr signature by the account's signing key over `hl/aztec-binding/v1 \| address \| signer inbox \| dm:recipient inbox`. The receiver recomputes the address from the signing key, salt and public keys before pinning it as verified. A failed proof is rejected with a warning. On Alpha, private payments go only to verified addresses (`lib/payments/rails.ts`). Limit: proves the signing key, not the privacy keys (`docs/AZTEC_AUDIT_MANIFEST.md` §4). Open: a run between two browsers | `test/unit/aztec/peer-binding.test.ts` (7 G7 tests) |
| G8 | External security review | Open | Report recorded in `deployments/aztec-mainnet.json` (`audit`) |

Test tokens (zkUSDC, zkDAI, zkETH, HLT) are testnet tokens with no value. They are never shown as mainnet assets.

## G2 notes: what paying in Fee Juice means for privacy

Paying with the account's own Fee Juice is public: the account is the visible fee payer of each transaction. Amounts and recipients of private transfers stay private, but an observer can link an account's transactions to each other. Aztec's documentation points to a private FPC, which holds Fee Juice as an internal private balance, as the way to remove that link ("Pay Fees Privately", `how_to_use_private_fee_juice.md`). The documented example is community code with its own operator, so it needs a review before Ledger Chat relies on it. Until then, the wallet and the website must not describe Alpha transactions as unlinkable.

Operator settings for Alpha:

- `NEXT_PUBLIC_AZTEC_NETWORK=alpha` and `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true`;
- `NEXT_PUBLIC_AZTEC_NODE_URL` (defaults to the pinned public RPC) and `NEXT_PUBLIC_AZTEC_EXPLORER` (no default on Alpha);
- `NEXT_PUBLIC_AZTEC_TOKENS`, listing only tokens that pass `checkTokenInstance` against the Alpha node (G3);
- `NEXT_PUBLIC_AZTEC_L1_FROM_BLOCK`: the L1 block of the release, the start of the claim recovery scan.

## G3: tokens

No code can settle this. Which private token contracts are live on Alpha, and who controls their minting, is a question for Aztec (Stefan is sending it). When the answer comes:

1. Run `checkTokenInstance` against the Alpha node for each address.
2. List only the tokens that pass, in `NEXT_PUBLIC_AZTEC_TOKENS`.
3. Set per-token caps in `agreement-policy.ts`.

## G7 design: proof that the peer controls an Aztec address

The idea is to let the peer prove control of the signing key behind the Aztec address it announces in the DM, without revealing anything that can spend. A Schnorr account's address commits to its signing public key: the key is a constructor argument, so it enters the initialization hash, then the partial address, then the address. The announcement would carry:

- the signing public key, salt, deployer and class id, and the account's public keys;
- a Schnorr signature by the signing key over `hl/aztec-binding/v1 | <aztec address> | <xmtp inbox id> | <conversation id>`.

The verifier recomputes the address from those values, checks that it equals the announced one, verifies the signature, and only then pins the address. Nothing in the announcement can spend: the signing private key never leaves the wallet. The SDK functions for each step (initialization hash, partial address, address from public keys and partial address, Schnorr verification) must be confirmed against the pinned `@aztec-labs` 6.0.0 sources before this is written. That check was not part of the 10 November work.

## G8

An external review cannot be done in code. `docs/AUDIT_SCOPE.md` lists what a reviewer would look at; the report, when there is one, is recorded in `deployments/aztec-mainnet.json` (`audit`). Until then the Alpha policy (`agreement-policy.ts`) keeps the "unaudited" acknowledgement and small caps.

## What December can honestly hold

- **Reachable by December if G2, G3, G5 and G6 are done:** a limited Alpha release of agreements: deployed and recorded classes, small per-token caps, an explicit "unaudited" acknowledgement, Fee Juice for fees. Every instance recorded with its transaction hash and block, checked weekly by the preflight.
- **Not reachable by December:** an external audit (G8), and therefore any claim that the contracts are audited or that agreements are safe for significant amounts.
- **Who deploys:** the deployment on Alpha spends real Fee Juice and is signed by Humanity Ledger's own account. It is run by Stefan, after the same script has run on testnet, never by an automated agent.

## Order of work

1. G2 in the wallet: done in code (10 November). Bridging goes through the user's own Ethereum wallet against the pinned portal, not through `L1FeeJuicePortalManager`, which expects a private-key L1 client. Next: the bridging screen in `ZkWalletPanel`, then one real run with a small amount.
2. G3: ask Aztec which private token contracts are live on Alpha, and list a token only after `checkTokenInstance` passes against the Alpha node.
3. G6: agreements in the conversation (invitation messages, status, claim, refund, withdraw, cancel).
4. G5: deploy on Alpha (Stefan), record, preflight green.
5. Small caps, acknowledgement on; raise caps only with an audit.
