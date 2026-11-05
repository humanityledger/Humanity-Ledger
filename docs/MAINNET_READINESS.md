# Ledger Chat on Aztec Alpha (mainnet): readiness

**Date:** 5 November 2026. **Status:** nothing of ours is deployed on Aztec Alpha. The wallet refuses to start against a node that settles on Ethereum mainnet (`assertTestNetwork` in `lib/aztec/wallet/config.ts`), and stays that way until the gates below are met.

## Where Aztec is

- Aztec Alpha runs on Ethereum mainnet (L1 chain 1), version 6.0.0 ("Tierra", 3 November 2026), the same version our contracts and client are built against. The testnet runs the same release and Aztec calls it the staging environment for Alpha. Source: [docs.aztec.network/networks](https://docs.aztec.network/networks).
- Aztec's own words on Alpha: live but early, bugs (including critical ones) expected. Earlier coverage of the Alpha launch quoted the team: deposit only funds you can afford to lose.
- Alpha has **no Sponsored FPC**. Fees are paid in Fee Juice, from the account's balance or by claiming Fee Juice bridged from L1 in the same transaction (`FeeJuicePaymentMethodWithClaim`). `PrivateFeePaymentMethod` and `PublicFeePaymentMethod` are deprecated and do not work on Alpha. Source: [Paying Fees](https://docs.aztec.network/developers/docs/aztec-js/how_to_pay_fees).

## Gates

| # | Gate | State on 5 Nov 2026 | How to check |
| --- | --- | --- | --- |
| G1 | The client knows which network it talks to and refuses drift | Done: `identifyNode` (`lib/aztec/fees.ts`) reads the node's L1 chain ID, rollup version, node version and rollup address and compares them with `lib/aztec/sequencer/networks.ts` | `test/unit/aztec/fees.test.ts`; workflow "Aztec mainnet preflight" against the Alpha node |
| G2 | Fees in Fee Juice, never a sponsored payer on Alpha | Policy done (`feeChoices`, `assertFeeChoice`); the wallet still only implements the sponsored path, used on testnet | Unit tests; the preflight checks there is no sponsored payer on Alpha |
| G3 | A real private token for agreements | Open. Our contracts call the token through the selector `transfer_in_private((Field),(Field),u128,Field)`; a mainnet token must expose exactly that function. Which private tokens exist on Alpha, and with which contract, is a question for Aztec | Verify the token's class before listing it; per-token caps |
| G4 | Contract risk is bounded | Partly done: `lib/aztec/agreement-policy.ts` allows an agreement on Alpha only for a recorded class, with the user's acknowledgement while unaudited, and within a per-token cap; `openEscrow`, `openStream` and `acceptInvite` enforce it before anything is sent or registered. No external audit | `test/unit/aztec/agreement-policy.test.ts` |
| G5 | Deployments recorded like on testnet | Ready: `deployments/aztec-mainnet.json` (empty) and its offline checks (transaction hash and block required, keys required for token-holding instances, class equal to the committed artifact); the preflight checks every entry on the node | `test/unit/aztec/deployments-registry.test.ts`, preflight |
| G6 | Agreements usable from the chat | Open (NLnet D-1): the library is done and runs on testnet; the Ledger Chat interface is not | Two-account demo |
| G7 | Proof that the peer controls the pinned Aztec address | Open: today trust on first use (`lib/aztec/peer-binding.ts`) | — |
| G8 | External security review | Open | Report recorded in `deployments/aztec-mainnet.json` (`audit`) |

Test tokens (zkUSDC, zkDAI, zkETH, HLT) are testnet tokens with no value. They are never shown as mainnet assets.

## What December can honestly hold

- **Reachable by December if G2, G3, G5 and G6 are done:** a limited Alpha release of agreements: deployed and recorded classes, small per-token caps, an explicit "unaudited" acknowledgement, Fee Juice for fees. Every instance recorded with its transaction hash and block, checked weekly by the preflight.
- **Not reachable by December:** an external audit (G8), and therefore any claim that the contracts are audited or that agreements are safe for significant amounts.
- **Who deploys:** the deployment on Alpha spends real Fee Juice and is signed by Humanity Ledger's own account. It is run by Stefan, after the same script has run on testnet, never by an automated agent.

## Order of work

1. G2 in the wallet: Fee Juice balance, bridging from L1 with `L1FeeJuicePortalManager` and claiming with `FeeJuicePaymentMethodWithClaim`; tested on testnet, where Fee Juice also exists.
2. G3: ask Aztec which private token contracts are live on Alpha; add a check that a listed token's class has the function our contracts call.
3. G6: agreements in the conversation (invitation messages, status, claim, refund, withdraw, cancel).
4. G5: deploy on Alpha (Stefan), record, preflight green.
5. Small caps, acknowledgement on; raise caps only with an audit.
