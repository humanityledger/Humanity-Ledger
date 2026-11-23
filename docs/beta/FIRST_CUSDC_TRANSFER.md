# First private cUSDC transfer in Ledger Chat (23 November 2026)

The record of the first private payment in cUSDC (Clean USDC, issued by human.tech through its Shield bridge) between two members of the closed cUSDC beta ([`CUSDC_BETA.md`](CUSDC_BETA.md)), on Aztec Alpha (Aztec 6.0.0). The README cites this file for every value below.

Both member accounts were operated by the operator for this run, from two browser profiles on one machine. It shows the path works end to end on the real network. It is not a payment between two different people, so R8 stays open.

## The path

| Step | What happened | Evidence |
| --- | --- | --- |
| 1. Bridge in | 4.768584 USDC deposited with Shield (v6.0.0 deployment, private mode, "Aztec gas" on Auto) from the Ethereum account `0x1Ba9…f675` to a NULO wallet on Aztec, account `0x255e…7596`. It arrived as private cUSDC in about 4 minutes. Part of the deposit was converted to Fee Juice for the NULO account | Shield's "Your cUSDC arrived on Aztec" screen |
| 2. Into Ledger Chat | NULO sent 4.555692 cUSDC privately (private to private) to the Ledger Chat account `0x1cf28fb5c786f5d7587c3a97790cef3d5e4dc453d485efd0b463cb1a8e81fe42`. Fee about 1.429603 Fee Juice, paid by the NULO account | L2 block 46295, NULO's transaction screen |
| 3. Found by the wallet | The Ledger Chat wallet showed the balance only after NULO's address was added under Receive as a known sender. Aztec finds incoming notes only from senders the wallet knows | Wallet screen: private balance 4.555692 cUSDC |
| 4. Paid in the chat | Member A paid 1 cUSDC privately to member B (Ethereum account `0x812d…D1Ea`) | Transaction below |

## The transfer between the two members

| Field | Value |
| --- | --- |
| Transaction | `0x2aab3a187a96f645d838abd3291331d859d421f28e36f29941e2921fbc212a13` |
| Execution result | `success` |
| L2 block | 46420 |
| Slot, epoch | 53155, 1661 |
| Status when read | `checkpointed` |
| Fee charged | `1601110432803536700` base units, 1.6011 Fee Juice, paid by A's account |
| Amount, sender, recipient | Not visible on chain |
| Balances after (wallet screens, 14:07 CET) | A: 3.555692 cUSDC, 106.6983 Fee Juice. B: 1 cUSDC |
| Explorer | [aztecscan.xyz](https://aztecscan.xyz/tx-effects/0x2aab3a187a96f645d838abd3291331d859d421f28e36f29941e2921fbc212a13) |

The receipt fields were read with `node_getTxReceipt` from the public Aztec Alpha RPC `https://aztec-mainnet.drpc.org` on 23 November 2026.

## What it needed in the code

- **#239: the wallet trusts the contract cUSDC runs.** cUSDC is an instance of the AIP-20 Token of aztec-standards 6.0.0, class `0x2ff0939914ff64bd3f7979926dbe8cf3332bc2fee55928bf3cc9ca802568ea9f`, not of the reference Token of noir-contracts.js. Before #239 the wallet refused it with "token class is not one this client trusts".
  - The published artifact is kept with its debugging data removed (`lib/aztec/artifacts/aztec-standards-token-6.0.0.json`), and a test pins the class it computes.
  - The wallet recognises the two token ABIs by exact signatures (`lib/aztec/token-dialect.ts`).
  - Escrows and streams still require `transfer_in_private`, which this Token does not have, so cUSDC cannot back them.
- **#240: the token is chosen when a screen is drawn.** cUSDC is listed for a member only once their membership has been read, after the page loads. The Send screen had fixed its token list at load, so it offered "0 USDC" next to a cUSDC balance.

## Known gaps found in the run

- **Incoming cUSDC is not listed as activity.** The aztec-standards Token emits no private event on a private-to-private transfer. A received payment shows in the balance, but not in the wallet's activity. So, for cUSDC, the notice for incoming payments is not raised, and a payment request does not turn to "paid" on the requester's side; it stays "announced".
- **A sender outside the chat must be added by hand.** A payment from a wallet that is not a verified contact (here, NULO) is found only after its address is added under Receive.
- **Fee payers are public**, as for every transaction on Alpha.
