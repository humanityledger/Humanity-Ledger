// circuits/streams_v2/src/main.nr
// Humanity Ledger Protocol — continuous payment stream withdrawal, v2.
//
// Status: experimental, not pinned, not used by the app. The long-term plan is
// an aztec-nr contract with a stream note (task R-09). See
// docs/zk/V2_CIRCUITS.md for what the verifier must store and check.
//
// What changes from v1 (circuits/streams):
// - ZK-01: v1 took `withdrawn_amount` as a free witness, so the same accrual
//   could be claimed again and again. v2 chains state: each withdrawal proves
//   it consumes `old_state` = H(stream, withdrawn_before, salt) and produces
//   `new_state` = H(stream, withdrawn_before + claim, salt'). The verifier keeps
//   one current state per stream, requires `old_state` to equal it and replaces
//   it with `new_state`. A proof that lies about `withdrawn_before` cannot match
//   the stored state.
// - ZK-02: payout address and deployment domain are public inputs.
// - ZK-03 / G1: the recipient proves knowledge of its own secret; the stream
//   commitment holds key hashes, not curve points.
// - G4 (liveness): accrual is computed in u128, so long streams at high rates
//   no longer overflow and fail.
// - G5 / ZK-04: Poseidon2 with domain separators.

use hl_lib::{key_of, poseidon2_hash, SEP_STREAM, SEP_STREAM_STATE};

global MAX_RATE: u64 = 1_000_000_000_000_000;

fn stream_commitment_of(
    sender_key: Field,
    recipient_key: Field,
    total: u64,
    rate: u64,
    start: u64,
    salt: Field,
    domain: Field,
) -> Field {
    poseidon2_hash([SEP_STREAM, sender_key, recipient_key, total as Field, rate as Field, start as Field, salt, domain])
}

fn state_of(stream_commitment: Field, withdrawn: u64, state_salt: Field) -> Field {
    poseidon2_hash([SEP_STREAM_STATE, stream_commitment, withdrawn as Field, state_salt])
}

fn main(
    // Private inputs
    recipient_secret: Field,
    sender_key: Field,
    total: u64,
    rate: u64,
    start: u64,
    salt: Field,
    withdrawn_before: u64,
    old_state_salt: Field,
    new_state_salt: Field,
    // Public inputs
    stream_commitment: pub Field,
    old_state: pub Field,
    new_state: pub Field,
    claim_amount: pub u64,
    payout_address: pub Field,
    current_time: pub u64,
    domain: pub Field,
) {
    assert(recipient_secret != 0);
    assert(sender_key != 0);
    assert(total > 0);
    assert(rate > 0);
    assert(rate <= MAX_RATE);
    assert(claim_amount > 0);
    assert(payout_address != 0);
    assert(current_time >= start);

    let recipient_key = key_of(recipient_secret);
    assert(stream_commitment_of(sender_key, recipient_key, total, rate, start, salt, domain) == stream_commitment);

    // The withdrawal consumes exactly the state the verifier holds.
    assert(state_of(stream_commitment, withdrawn_before, old_state_salt) == old_state);

    let withdrawn_after = (withdrawn_before as u128) + (claim_amount as u128);
    let accrued = ((current_time - start) as u128) * (rate as u128);
    assert(withdrawn_after <= accrued);
    assert(withdrawn_after <= (total as u128));

    assert(state_of(stream_commitment, withdrawn_after as u64, new_state_salt) == new_state);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

global RECIPIENT_SECRET: Field = 67890;
global SENDER_SECRET: Field = 12345;
global TOTAL: u64 = 10000;
global RATE: u64 = 10;
global START: u64 = 1000;
global SALT: Field = 999;
global DOMAIN: Field = 0xd0;
global PAYOUT: Field = 0xabc;

fn stream() -> Field {
    stream_commitment_of(key_of(SENDER_SECRET), key_of(RECIPIENT_SECRET), TOTAL, RATE, START, SALT, DOMAIN)
}

fn withdraw(before: u64, old_salt: Field, new_salt: Field, old_state: Field, claim: u64, now: u64) -> Field {
    let c = stream();
    let new_state = state_of(c, before + claim, new_salt);
    main(
        RECIPIENT_SECRET, key_of(SENDER_SECRET), TOTAL, RATE, START, SALT, before, old_salt, new_salt,
        c, old_state, new_state, claim, PAYOUT, now, DOMAIN,
    );
    new_state
}

#[test]
fn two_withdrawals_chain_state() {
    let c = stream();
    let s0 = state_of(c, 0, 1); // set by the sender when the stream is created
    // t = 1060: 600 accrued.
    let s1 = withdraw(0, 1, 2, s0, 300, 1060);
    let s2 = withdraw(300, 2, 3, s1, 300, 1060);
    assert(s0 != s1);
    assert(s1 != s2);
}

#[test(should_fail)]
fn zk01_replaying_withdrawn_zero_against_current_state_fails() {
    // The v1 attack: after withdrawing 300, claim again pretending nothing was
    // withdrawn. The verifier now holds s1, so old_state must be s1, and s1 does
    // not open to withdrawn = 0.
    let c = stream();
    let s0 = state_of(c, 0, 1);
    let s1 = withdraw(0, 1, 2, s0, 300, 1060);
    let _ = withdraw(0, 2, 3, s1, 600, 1060);
}

#[test]
fn zk01_a_proof_against_an_old_state_is_detectable() {
    // A prover can still build a proof that spends s0 a second time; the
    // circuit cannot know s0 was consumed. The verifier rejects it because
    // old_state (s0) differs from the state it stores (s1). This test records
    // that the two old_state values differ, which is what the verifier checks.
    let c = stream();
    let s0 = state_of(c, 0, 1);
    let s1 = withdraw(0, 1, 2, s0, 300, 1060);
    assert(s0 != s1);
}

#[test(should_fail)]
fn claim_beyond_accrual_fails() {
    let c = stream();
    let s0 = state_of(c, 0, 1);
    let s1 = withdraw(0, 1, 2, s0, 300, 1060);
    let _ = withdraw(300, 2, 3, s1, 301, 1060); // 601 > 600
}

#[test(should_fail)]
fn claim_beyond_total_fails() {
    let c = stream();
    let s0 = state_of(c, 0, 1);
    let _ = withdraw(0, 1, 2, s0, TOTAL + 1, 1_000_000);
}

#[test(should_fail)]
fn sender_secret_cannot_withdraw() {
    let c = stream();
    let s0 = state_of(c, 0, 1);
    let s1 = state_of(c, 100, 2);
    main(
        SENDER_SECRET, key_of(SENDER_SECRET), TOTAL, RATE, START, SALT, 0, 1, 2,
        c, s0, s1, 100, PAYOUT, 1060, DOMAIN,
    );
}

#[test(should_fail)]
fn before_start_fails() {
    let c = stream();
    let s0 = state_of(c, 0, 1);
    let _ = withdraw(0, 1, 2, s0, 1, START - 1);
}

#[test]
fn long_stream_at_max_rate_does_not_overflow() {
    // G4: (now - start) * rate exceeds u64 here; v2 computes it in u128.
    let c = stream_commitment_of(key_of(SENDER_SECRET), key_of(RECIPIENT_SECRET), 1_000_000, MAX_RATE, START, SALT, DOMAIN);
    let s0 = state_of(c, 0, 1);
    let s1 = state_of(c, 1, 2);
    main(
        RECIPIENT_SECRET, key_of(SENDER_SECRET), 1_000_000, MAX_RATE, START, SALT, 0, 1, 2,
        c, s0, s1, 1, PAYOUT, START + 100_000, DOMAIN,
    );
}
