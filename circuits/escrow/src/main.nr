// circuits/escrow/src/main.nr
// Humanity Ledger Protocol — Private Escrow Release Circuit
//
// Invariants enforced:
// 1. Escrow commitment binding: commitment == H(sender_secret, recipient_pubkey, amount, salt)
// 2. Temporal validity: current_timestamp <= deadline
// 3. Nullifier derivation: nullifier == H(sender_secret, salt)
// 4. Positive amount: amount > 0
// 5. Value ceiling: amount <= MAX_ESCROW_AMOUNT (overflow protection)
// 6. Identity non-zero: recipient_pubkey != 0 and sender_secret != 0

use std::hash::pedersen_hash;

global MAX_ESCROW_AMOUNT: u64 = 1_000_000_000_000_000; // 1 Billion standard units (1e15)

fn main(
    // Private inputs (witness)
    sender_secret: Field,
    recipient_pubkey: Field,
    amount: u64,
    salt: Field,
    
    // Public inputs
    pub escrow_commitment: Field,
    pub nullifier: Field,
    pub deadline: u64,
    pub current_timestamp: u64
) {
    // 1. Enforce amount is strictly positive and within protocol maximum bounds
    assert(amount > 0);
    assert(amount <= MAX_ESCROW_AMOUNT);

    // 2. Enforce non-zero identity keys
    assert(sender_secret != 0);
    assert(recipient_pubkey != 0);

    // 3. Enforce temporal boundary: release must occur before or at deadline
    assert(current_timestamp <= deadline);

    // 4. Verify escrow commitment
    let calculated_commitment = pedersen_hash([
        sender_secret,
        recipient_pubkey,
        amount as Field,
        salt
    ]);
    assert(calculated_commitment == escrow_commitment);

    // 5. Verify unique nullifier to prevent double release
    let calculated_nullifier = pedersen_hash([sender_secret, salt]);
    assert(calculated_nullifier == nullifier);
}

#[test]
fn test_valid_escrow() {
    let sender = 12345;
    let recipient = 67890;
    let amt: u64 = 1000;
    let salt = 999;
    let deadline: u64 = 1800000000;
    let now: u64 = 1750000000;

    let commitment = pedersen_hash([sender, recipient, amt as Field, salt]);
    let nullifier = pedersen_hash([sender, salt]);

    main(sender, recipient, amt, salt, commitment, nullifier, deadline, now);
}
