// circuits/streams/src/main.nr
// Humanity Ledger Protocol — Continuous Payment Stream Withdrawal Circuit
//
// Invariants enforced:
// 1. Stream commitment: commitment == H(sender_secret, recipient_pubkey, total_allocation, rate_per_second, start_time, salt)
// 2. Temporal monotonicity: current_time >= start_time
// 3. Accrual constraint: (withdrawn_amount + claim_amount) <= (current_time - start_time) * rate_per_second
// 4. Allocation ceiling: (withdrawn_amount + claim_amount) <= total_allocation
// 5. Positive parameters: claim_amount > 0, rate_per_second > 0, total_allocation > 0
// 6. Identity non-zero: recipient_pubkey != 0 and sender_secret != 0

use std::hash::pedersen_hash;

fn main(
    // Private inputs (witness)
    sender_secret: Field,
    recipient_pubkey: Field,
    total_allocation: u64,
    rate_per_second: u64,
    start_time: u64,
    withdrawn_amount: u64,
    claim_amount: u64,
    salt: Field,

    // Public inputs
    pub stream_commitment: Field,
    pub current_time: u64,
    pub stream_nullifier: Field
) {
    // 1. Enforce temporal monotonicity & strictly positive parameters
    assert(current_time >= start_time);
    assert(claim_amount > 0);
    assert(rate_per_second > 0);
    assert(total_allocation > 0);

    // 2. Enforce non-zero identity keys
    assert(sender_secret != 0);
    assert(recipient_pubkey != 0);

    // 3. Calculate maximum permissible withdrawal based on elapsed time
    let elapsed_seconds = current_time - start_time;
    let accrued_capacity = elapsed_seconds * rate_per_second;
    let new_total_withdrawn = withdrawn_amount + claim_amount;

    // 4. Constrain claim against elapsed accrual and total stream allocation
    assert(new_total_withdrawn <= accrued_capacity);
    assert(new_total_withdrawn <= total_allocation);

    // 5. Validate initial stream commitment
    let calculated_commitment = pedersen_hash([
        sender_secret,
        recipient_pubkey,
        total_allocation as Field,
        rate_per_second as Field,
        start_time as Field,
        salt
    ]);
    assert(calculated_commitment == stream_commitment);

    // 6. Derive unique stream nullifier for the state transition
    let calculated_nullifier = pedersen_hash([
        stream_commitment,
        new_total_withdrawn as Field
    ]);
    assert(calculated_nullifier == stream_nullifier);
}
