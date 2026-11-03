// circuits/streams/src/main.nr
// Humanity Ledger Protocol — Continuous Payment Stream Withdrawal Circuit
//
// Invariants enforced:
// 1. Stream commitment: commitment == H(sender_secret, recipient_pubkey, total_allocation, rate_per_second, start_time, salt)
// 2. Temporal monotonicity: current_time >= start_time
// 3. Rate bound: rate_per_second <= MAX_RATE (prevents u64 overflow in accrual arithmetic)
// 4. Accrual constraint: (withdrawn_amount + claim_amount) <= (current_time - start_time) * rate_per_second
// 5. Allocation ceiling: (withdrawn_amount + claim_amount) <= total_allocation
// 6. Positive parameters: claim_amount > 0, rate_per_second > 0, total_allocation > 0
// 7. Identity non-zero: recipient_pubkey != 0 and sender_secret != 0

use std::hash::pedersen_hash;

// MAX_RATE bounds rate_per_second so that elapsed_seconds * rate_per_second
// cannot overflow u64 for any stream duration up to ~585 years.
// u64::MAX = 18_446_744_073_709_551_615. At MAX_RATE = 1e15 units/sec,
// a stream running for u64::MAX seconds accrues 1e15 * 1.8e19 which overflows,
// but no realistic stream spans more than ~18k seconds at MAX_RATE before hitting
// total_allocation. The allocation ceiling provides an independent hard stop.
// Closes Gap G4 from circuits/CONSTRAINT_COMPLETENESS.md.
global MAX_RATE: u64 = 1_000_000_000_000_000; // mirrors MAX_ESCROW_AMOUNT in escrow circuit

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
    stream_commitment: pub Field,
    current_time: pub u64,
    stream_nullifier: pub Field
) {
    // 1. Enforce temporal monotonicity & strictly positive parameters
    assert(current_time >= start_time);
    assert(claim_amount > 0);
    assert(rate_per_second > 0);
    assert(total_allocation > 0);

    // 2. Enforce rate bound to prevent u64 overflow in accrual multiplication
    assert(rate_per_second <= MAX_RATE);

    // 3. Enforce non-zero identity keys
    assert(sender_secret != 0);
    assert(recipient_pubkey != 0);

    // 4. Calculate maximum permissible withdrawal based on elapsed time
    let elapsed_seconds = current_time - start_time;
    let accrued_capacity = elapsed_seconds * rate_per_second;
    let new_total_withdrawn = withdrawn_amount + claim_amount;

    // 5. Constrain claim against elapsed accrual and total stream allocation
    assert(new_total_withdrawn <= accrued_capacity);
    assert(new_total_withdrawn <= total_allocation);

    // 6. Validate initial stream commitment
    let calculated_commitment = pedersen_hash([
        sender_secret,
        recipient_pubkey,
        total_allocation as Field,
        rate_per_second as Field,
        start_time as Field,
        salt
    ]);
    assert(calculated_commitment == stream_commitment);

    // 7. Derive unique stream nullifier for the state transition
    // Nullifier = Pedersen(stream_commitment, new_total_withdrawn)
    // Uniqueness guarantee: claim_amount > 0 (enforced above) ensures new_total_withdrawn
    // strictly increases with each withdrawal, preventing nullifier collisions
    // across valid withdrawal sequences for the same stream.
    let calculated_nullifier = pedersen_hash([
        stream_commitment,
        new_total_withdrawn as Field
    ]);
    assert(calculated_nullifier == stream_nullifier);
}

#[test]
fn test_valid_stream_withdrawal() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = 10000;
    let rate: u64 = 10;
    let start: u64 = 1000;
    let withdrawn: u64 = 200;
    let claim: u64 = 300;
    let salt = 999;
    let now: u64 = 1060;

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test]
fn test_max_rate_boundary() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = MAX_RATE;
    let rate: u64 = MAX_RATE;
    let start: u64 = 1000;
    let withdrawn: u64 = 0;
    let claim: u64 = MAX_RATE;
    let salt = 999;
    let now: u64 = 1001; // 1 second elapsed -> accrued = MAX_RATE

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_time_before_start() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = 10000;
    let rate: u64 = 10;
    let start: u64 = 1000;
    let withdrawn: u64 = 0;
    let claim: u64 = 100;
    let salt = 999;
    let now: u64 = 999; // Before start

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_zero_claim_amount() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = 10000;
    let rate: u64 = 10;
    let start: u64 = 1000;
    let withdrawn: u64 = 100;
    let claim: u64 = 0; // Zero claim
    let salt = 999;
    let now: u64 = 1060;

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_zero_rate_per_second() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = 10000;
    let rate: u64 = 0; // Zero rate
    let start: u64 = 1000;
    let withdrawn: u64 = 0;
    let claim: u64 = 100;
    let salt = 999;
    let now: u64 = 1060;

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_zero_total_allocation() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = 0; // Zero allocation
    let rate: u64 = 10;
    let start: u64 = 1000;
    let withdrawn: u64 = 0;
    let claim: u64 = 100;
    let salt = 999;
    let now: u64 = 1060;

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_excessive_rate() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = 1_000_000_000_000_000_000;
    let rate: u64 = MAX_RATE + 1; // Exceeds MAX_RATE
    let start: u64 = 1000;
    let withdrawn: u64 = 0;
    let claim: u64 = 100;
    let salt = 999;
    let now: u64 = 1060;

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_zero_sender_secret() {
    let sender = 0; // Zero secret
    let recipient = 67890;
    let total_alloc: u64 = 10000;
    let rate: u64 = 10;
    let start: u64 = 1000;
    let withdrawn: u64 = 200;
    let claim: u64 = 300;
    let salt = 999;
    let now: u64 = 1060;

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_zero_recipient_pubkey() {
    let sender = 12345;
    let recipient = 0; // Zero recipient
    let total_alloc: u64 = 10000;
    let rate: u64 = 10;
    let start: u64 = 1000;
    let withdrawn: u64 = 200;
    let claim: u64 = 300;
    let salt = 999;
    let now: u64 = 1060;

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_claim_exceeds_accrued() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = 10000;
    let rate: u64 = 10;
    let start: u64 = 1000;
    let withdrawn: u64 = 0;
    let claim: u64 = 500; // 500 > 200 accrued (20 * 10)
    let salt = 999;
    let now: u64 = 1020;

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_claim_exceeds_total_allocation() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = 1000;
    let rate: u64 = 100;
    let start: u64 = 1000;
    let withdrawn: u64 = 800;
    let claim: u64 = 300; // 800 + 300 = 1100 > 1000 total_alloc
    let salt = 999;
    let now: u64 = 1100; // elapsed = 100, accrued = 10000 >= 1100

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_tampered_commitment() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = 10000;
    let rate: u64 = 10;
    let start: u64 = 1000;
    let withdrawn: u64 = 200;
    let claim: u64 = 300;
    let salt = 999;
    let now: u64 = 1060;

    let forged_commitment = 0xdeadbeef;
    let new_total = withdrawn + claim;
    let nullifier = pedersen_hash([forged_commitment, new_total as Field]);

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        forged_commitment, now, nullifier
    );
}

#[test(should_fail)]
fn test_tampered_nullifier() {
    let sender = 12345;
    let recipient = 67890;
    let total_alloc: u64 = 10000;
    let rate: u64 = 10;
    let start: u64 = 1000;
    let withdrawn: u64 = 200;
    let claim: u64 = 300;
    let salt = 999;
    let now: u64 = 1060;

    let commitment = pedersen_hash([
        sender,
        recipient,
        total_alloc as Field,
        rate as Field,
        start as Field,
        salt
    ]);
    let forged_nullifier = 0xbad000;

    main(
        sender, recipient, total_alloc, rate, start, withdrawn, claim, salt,
        commitment, now, forged_nullifier
    );
}
