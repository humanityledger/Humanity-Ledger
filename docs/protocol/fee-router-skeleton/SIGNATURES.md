# Private function signatures (comments only)

Not a source file. No body, no selector encoding, no call, no deploy. Names describe the baseline. They are not an ABI commitment beyond `docs/protocol/FEE_CONTRACT_SPEC.md`.

The fee moves only by the existing private token transfer, on settlement. Authwit nonce stays 0. The token call stays the raw `transfer_in_private` selector while Q3 is OPEN. Deposit does not take a fee. A refund pays the full amount and no fee.

## Formula

Section 1 of the spec. The only evaluation a future contract may use. Do not form `amount * feeBps` as one product.

```text
// q = amount / 10000
// r = amount % 10000
// proportional = q * FEE_BPS + ceil(r * FEE_BPS / 10000)
// fee = max(min_fee_for_this_path, proportional)
// refuse when fee * 10000 > amount * MAX_FEE_SHARE_BPS
// refuse when fee > TX_CAP
// net = amount - fee
// min_fee_for_this_path is MIN_FEE on escrow settlement and 0 on a stream withdrawal
```

`ceil(r * FEE_BPS / 10000)` is the same ceiling as `lib/protocol/fees.ts` (`ceilBps`). That TypeScript file is the tested arithmetic. This skeleton does not change it.

## Signatures

```text
// protocol_fee(amount, min_fee_for_this_path) -> fee, net
//   returns a refusal instead of a fee when the share check or TX_CAP fails

// escrow_deposit(amount)
//   does not transfer a fee
//   refuses the deposit when protocol_fee(amount, MIN_FEE) would refuse
//   so an agreement that can never pay its fee is never created

// escrow_claim(amount)
//   protocol_fee(amount, MIN_FEE) must succeed
//   private transfer of net to the claimer
//   private transfer of fee to TREASURY
//   one fee note; no second note; no burn note

// escrow_refund(amount)
//   private transfer of amount to the sender
//   no fee transfer

// stream_withdraw(withdrawable)
//   protocol_fee(withdrawable, 0) must succeed
//   private transfer of net to the recipient
//   private transfer of fee to TREASURY

// stream_cancel_accrued(accrued)
//   fee only on the accrued part paid to the recipient, with min fee 0
//   the remainder returns to the sender with no fee
```

There is no `pause`, no `set_fee_params`, no `trigger_buyback`, no oracle read, no daily accumulator, and no admin withdraw. `Ownable2Step` is not part of this Aztec path. It remains a note for a possible later L1 contract, which this directory does not contain.

Changing a constant later is a new class id, checked by the client, not a storage write. See spec section 4.
