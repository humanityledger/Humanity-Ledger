// circuits/escrow_v2/src/main.nr
// Humanity Ledger Protocol — private escrow release or refund, v2.
//
// Status: experimental, not pinned, not used by the app. The long-term plan is
// an aztec-nr contract with notes (task R-08). See docs/zk/V2_CIRCUITS.md for
// what the on-chain verifier must check alongside this proof.
//
// What changes from v1 (circuits/escrow):
// - ZK-03: the recipient claims with its own secret; the sender's secret is
//   never shared. The sender can refund after the deadline with its secret.
//   Both paths publish the same settlement nullifier, so an escrow settles once.
// - ZK-02: `payout_address` and `domain` (chain id + verifier contract, hashed
//   by the verifier) are public inputs; a copied proof pays the same address
//   on the same deployment only.
// - ZK-06: the deadline is inside the commitment, so the prover cannot pick a
//   later one. `current_timestamp` must still be checked by the verifier
//   against the block time.
// - G5 / ZK-04: Poseidon2 with domain separators.
// - G1: parties are key hashes, not unchecked curve points.

use hl_lib::{key_of, poseidon2_hash, SEP_ESCROW, SEP_ESCROW_SETTLED};

global MAX_ESCROW_AMOUNT: u64 = 1_000_000_000_000_000; // 10^15 base units

fn escrow_commitment_of(
    sender_key: Field,
    recipient_key: Field,
    amount: u64,
    deadline: u64,
    salt: Field,
    domain: Field,
) -> Field {
    poseidon2_hash([SEP_ESCROW, sender_key, recipient_key, amount as Field, deadline as Field, salt, domain])
}

fn settlement_nullifier_of(escrow_commitment: Field) -> Field {
    poseidon2_hash([SEP_ESCROW_SETTLED, escrow_commitment])
}

fn main(
    // Private inputs
    actor_secret: Field, // recipient's secret for a claim, sender's for a refund
    counterparty_key: Field, // the other party's key hash
    deadline: u64,
    salt: Field,
    // Public inputs
    escrow_commitment: pub Field,
    settlement_nullifier: pub Field,
    amount: pub u64,
    payout_address: pub Field,
    current_timestamp: pub u64,
    is_refund: pub bool,
    domain: pub Field,
) {
    assert(actor_secret != 0);
    assert(counterparty_key != 0);
    assert(amount > 0);
    assert(amount <= MAX_ESCROW_AMOUNT);
    assert(payout_address != 0);

    let actor_key = key_of(actor_secret);
    let (sender_key, recipient_key) = if is_refund {
        (actor_key, counterparty_key)
    } else {
        (counterparty_key, actor_key)
    };

    let commitment = escrow_commitment_of(sender_key, recipient_key, amount, deadline, salt, domain);
    assert(commitment == escrow_commitment);

    if is_refund {
        assert(current_timestamp > deadline);
    } else {
        assert(current_timestamp <= deadline);
    }

    assert(settlement_nullifier_of(escrow_commitment) == settlement_nullifier);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

global SENDER_SECRET: Field = 1111;
global RECIPIENT_SECRET: Field = 2222;
global AMOUNT: u64 = 5000;
global DEADLINE: u64 = 1_800_000_000;
global SALT: Field = 999;
global DOMAIN: Field = 0xd0;
global PAYOUT: Field = 0xabc;

fn commitment() -> Field {
    escrow_commitment_of(key_of(SENDER_SECRET), key_of(RECIPIENT_SECRET), AMOUNT, DEADLINE, SALT, DOMAIN)
}

fn claim_at(now: u64) {
    let c = commitment();
    main(RECIPIENT_SECRET, key_of(SENDER_SECRET), DEADLINE, SALT, c, settlement_nullifier_of(c), AMOUNT, PAYOUT, now, false, DOMAIN);
}

fn refund_at(now: u64) {
    let c = commitment();
    main(SENDER_SECRET, key_of(RECIPIENT_SECRET), DEADLINE, SALT, c, settlement_nullifier_of(c), AMOUNT, PAYOUT, now, true, DOMAIN);
}

#[test]
fn recipient_claims_before_deadline() {
    claim_at(DEADLINE - 10);
}

#[test]
fn recipient_claims_at_deadline() {
    claim_at(DEADLINE);
}

#[test(should_fail)]
fn recipient_claim_after_deadline_fails() {
    claim_at(DEADLINE + 1);
}

#[test]
fn sender_refunds_after_deadline() {
    refund_at(DEADLINE + 1);
}

#[test(should_fail)]
fn sender_refund_before_deadline_fails() {
    refund_at(DEADLINE);
}

#[test(should_fail)]
fn sender_cannot_claim_as_recipient() {
    // ZK-03: in v1 whoever knew the sender's secret could claim.
    let c = commitment();
    main(SENDER_SECRET, key_of(RECIPIENT_SECRET), DEADLINE, SALT, c, settlement_nullifier_of(c), AMOUNT, PAYOUT, DEADLINE - 10, false, DOMAIN);
}

#[test(should_fail)]
fn recipient_cannot_refund() {
    let c = commitment();
    main(RECIPIENT_SECRET, key_of(SENDER_SECRET), DEADLINE, SALT, c, settlement_nullifier_of(c), AMOUNT, PAYOUT, DEADLINE + 10, true, DOMAIN);
}

#[test(should_fail)]
fn later_deadline_than_committed_fails() {
    // ZK-06: the deadline is bound by the commitment.
    let c = commitment();
    main(RECIPIENT_SECRET, key_of(SENDER_SECRET), DEADLINE + 1000, SALT, c, settlement_nullifier_of(c), AMOUNT, PAYOUT, DEADLINE + 500, false, DOMAIN);
}

#[test(should_fail)]
fn other_deployment_domain_fails() {
    let c = commitment();
    main(RECIPIENT_SECRET, key_of(SENDER_SECRET), DEADLINE, SALT, c, settlement_nullifier_of(c), AMOUNT, PAYOUT, DEADLINE - 10, false, 0xd1);
}

#[test(should_fail)]
fn larger_amount_than_committed_fails() {
    let c = commitment();
    main(RECIPIENT_SECRET, key_of(SENDER_SECRET), DEADLINE, SALT, c, settlement_nullifier_of(c), AMOUNT + 1, PAYOUT, DEADLINE - 10, false, DOMAIN);
}

#[test(should_fail)]
fn zero_payout_address_fails() {
    let c = commitment();
    main(RECIPIENT_SECRET, key_of(SENDER_SECRET), DEADLINE, SALT, c, settlement_nullifier_of(c), AMOUNT, 0, DEADLINE - 10, false, DOMAIN);
}

#[test(should_fail)]
fn wrong_settlement_nullifier_fails() {
    let c = commitment();
    main(RECIPIENT_SECRET, key_of(SENDER_SECRET), DEADLINE, SALT, c, 0xbad, AMOUNT, PAYOUT, DEADLINE - 10, false, DOMAIN);
}

#[test]
fn claim_and_refund_share_one_settlement_nullifier() {
    let c = commitment();
    let n = settlement_nullifier_of(c);
    assert(n != c);
    // Both paths are checked against the same value in main.
    main(RECIPIENT_SECRET, key_of(SENDER_SECRET), DEADLINE, SALT, c, n, AMOUNT, PAYOUT, DEADLINE, false, DOMAIN);
    main(SENDER_SECRET, key_of(RECIPIENT_SECRET), DEADLINE, SALT, c, n, AMOUNT, PAYOUT, DEADLINE + 1, true, DOMAIN);
}
