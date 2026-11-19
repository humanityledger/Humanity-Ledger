// TXE tests for PrivateEscrow (run with `aztec test` after `aztec compile` of
// this crate and of ../test_token). Master prompt task A.3: deposit -> claim,
// deposit -> refund after the deadline, one settlement per escrow, escrows
// isolated from each other, balances checked on the token.
//
// The token is the test-only contracts/aztec/test_token, called through raw
// selectors so this crate does not depend on it.

use crate::{quote_protocol_fee, PrivateEscrow};
use aztec::{
    context::calls::{PrivateCall, UtilityCall},
    protocol::{
        abis::function_selector::FunctionSelector, address::AztecAddress, hash::poseidon2_hash_with_separator,
        traits::ToField,
    },
    test::helpers::{
        authwit::add_private_authwit_from_call,
        test_environment::{CallPrivateOptions, ExecuteUtilityOptions, TestEnvironment},
    },
};

global DOM_SEP__CLAIM_SECRET: u32 = 718293041;
global CLAIM_SECRET: Field = 0xc1a1;
// Alpha classes charge no protocol fee (OD-7, 18 November 2026): the recipient gets it all.
global AMOUNT: u128 = 20000;
global FEE: u128 = 0;
global NET: u128 = 20000;
// OD-2: 100 HLC at 6 decimals, the same value as MAX_AMOUNT in main.nr.
global MAX_AMOUNT: u128 = 100000000;
global MINTED: u128 = 100000;
global LOCK: u64 = 600;

struct Setup {
    env: TestEnvironment,
    token: AztecAddress,
    escrow: AztecAddress,
    sender: AztecAddress,
    recipient: AztecAddress,
}

unconstrained fn mint(env: TestEnvironment, token: AztecAddress, to: AztecAddress, amount: u128) {
    let call: PrivateCall<15, 2, ()> = PrivateCall::new(
        token,
        FunctionSelector::from_signature("mint_to_private((Field),u128)"),
        "mint_to_private",
        [to.to_field(), amount as Field],
    );
    env.call_private(to, call);
}

unconstrained fn transfer_call(
    token: AztecAddress,
    from: AztecAddress,
    to: AztecAddress,
    amount: u128,
    nonce: Field,
) -> PrivateCall<19, 4, ()> {
    PrivateCall::new(
        token,
        FunctionSelector::from_signature("transfer_in_private((Field),(Field),u128,Field)"),
        "transfer_in_private",
        [from.to_field(), to.to_field(), amount as Field, nonce],
    )
}

unconstrained fn balance(env: TestEnvironment, token: AztecAddress, owner: AztecAddress) -> u128 {
    let call: UtilityCall<18, 1, u128> = UtilityCall::new(
        token,
        FunctionSelector::from_signature("balance_of_private((Field))"),
        "balance_of_private",
        [owner.to_field()],
    );
    env.execute_utility_opts(ExecuteUtilityOptions::new().with_from(owner), call)
}

unconstrained fn setup() -> Setup {
    let mut env = TestEnvironment::new();
    // Contract accounts: deposit needs the sender's authwit for the token pull.
    let sender = env.create_contract_account();
    let recipient = env.create_contract_account();
    let token = env.deploy("../test_token/@test_token/TestToken").without_initializer();
    let escrow = env.deploy("PrivateEscrow").with_public_initializer(
        sender,
        PrivateEscrow::interface().constructor(token),
    );
    mint(env, token, sender, MINTED);
    Setup { env, token, escrow, sender, recipient }
}

unconstrained fn deposit(s: Setup, escrow_id: Field, nonce: Field) -> u64 {
    let deadline = s.env.last_block_timestamp() + LOCK;
    add_private_authwit_from_call(s.env, s.sender, s.escrow, transfer_call(s.token, s.sender, s.escrow, AMOUNT, nonce));
    let secret_hash = poseidon2_hash_with_separator([CLAIM_SECRET], DOM_SEP__CLAIM_SECRET);
    s.env.call_private(
        s.sender,
        PrivateEscrow::at(s.escrow).deposit(s.recipient, AMOUNT, deadline, secret_hash, escrow_id, nonce),
    );
    deadline
}

// claim/refund spend the escrow contract's own token notes, so the call needs
// the escrow's scope as well as the caller's.
unconstrained fn claim(s: Setup, escrow_id: Field, secret: Field) {
    s.env.call_private_opts(
        s.recipient,
        CallPrivateOptions::new().with_additional_scopes([s.escrow]),
        PrivateEscrow::at(s.escrow).claim(escrow_id, secret),
    );
}

unconstrained fn refund(s: Setup, escrow_id: Field) {
    s.env.call_private_opts(
        s.sender,
        CallPrivateOptions::new().with_additional_scopes([s.escrow]),
        PrivateEscrow::at(s.escrow).refund(escrow_id),
    );
}

#[test]
unconstrained fn deposit_then_claim_moves_the_funds() {
    let s = setup();
    let _ = deposit(s, 1, 11);
    assert(balance(s.env, s.token, s.sender) == MINTED - AMOUNT);
    assert(balance(s.env, s.token, s.escrow) == AMOUNT);

    claim(s, 1, CLAIM_SECRET);
    assert(balance(s.env, s.token, s.recipient) == NET);
    assert(balance(s.env, s.token, s.escrow) == 0);
    // No fee: sender and recipient together hold everything minted; nothing went to TREASURY.
    assert(balance(s.env, s.token, s.sender) + balance(s.env, s.token, s.recipient) == MINTED - FEE);
    assert(balance(s.env, s.token, s.sender) + balance(s.env, s.token, s.recipient) == MINTED);
}

#[test]
unconstrained fn refund_after_the_deadline_returns_the_funds() {
    let s = setup();
    let deadline = deposit(s, 1, 11);
    s.env.mine_block_at(deadline + 1);
    refund(s, 1);
    assert(balance(s.env, s.token, s.sender) == MINTED);
    assert(balance(s.env, s.token, s.recipient) == 0);
    assert(balance(s.env, s.token, s.escrow) == 0);
}

#[test(should_fail_with = "deadline not reached")]
unconstrained fn early_refund_fails() {
    let s = setup();
    let _ = deposit(s, 1, 11);
    refund(s, 1);
}

#[test(should_fail_with = "escrow expired")]
unconstrained fn claim_after_the_deadline_fails() {
    let s = setup();
    let deadline = deposit(s, 1, 11);
    s.env.mine_block_at(deadline + 1);
    claim(s, 1, CLAIM_SECRET);
}

#[test(should_fail_with = "invalid claim secret")]
unconstrained fn wrong_claim_secret_fails() {
    let s = setup();
    let _ = deposit(s, 1, 11);
    claim(s, 1, CLAIM_SECRET + 1);
}

// After a claim, the sender still holds the refund copy of the note, but the
// settlement nullifier is already on chain: the refund must not land.
#[test(should_fail)]
unconstrained fn claimed_escrow_cannot_also_be_refunded() {
    let s = setup();
    let deadline = deposit(s, 1, 11);
    claim(s, 1, CLAIM_SECRET);
    s.env.mine_block_at(deadline + 1);
    refund(s, 1);
}

#[test(should_fail_with = "escrow not found")]
unconstrained fn escrow_cannot_be_claimed_twice() {
    let s = setup();
    let _ = deposit(s, 1, 11);
    claim(s, 1, CLAIM_SECRET);
    claim(s, 1, CLAIM_SECRET);
}

#[test]
unconstrained fn concurrent_escrows_are_isolated() {
    let s = setup();
    let _ = deposit(s, 1, 11);
    let deadline_2 = deposit(s, 2, 12);
    assert(balance(s.env, s.token, s.escrow) == 2 * AMOUNT);

    // Claiming escrow 1 leaves escrow 2 intact (the first version popped
    // every note of the recipient and destroyed the others).
    claim(s, 1, CLAIM_SECRET);
    assert(balance(s.env, s.token, s.recipient) == NET);
    assert(balance(s.env, s.token, s.escrow) == AMOUNT);

    // Escrow 2 can still be refunded after its deadline.
    s.env.mine_block_at(deadline_2 + 1);
    refund(s, 2);
    assert(balance(s.env, s.token, s.sender) == MINTED - AMOUNT);
    assert(balance(s.env, s.token, s.escrow) == 0);
}

#[test(should_fail_with = "self-deposit forbidden")]
unconstrained fn self_deposit_fails() {
    let s = setup();
    add_private_authwit_from_call(s.env, s.sender, s.escrow, transfer_call(s.token, s.sender, s.escrow, AMOUNT, 1));
    s.env.call_private(
        s.sender,
        PrivateEscrow::at(s.escrow).deposit(s.sender, AMOUNT, s.env.last_block_timestamp() + LOCK, 5, 1, 1),
    );
}

// No authwit was added for nonce 99, so the token refuses to pull the funds.
#[test(should_fail)]
unconstrained fn deposit_without_authwit_fails() {
    let s = setup();
    s.env.call_private(
        s.sender,
        PrivateEscrow::at(s.escrow).deposit(s.recipient, AMOUNT, s.env.last_block_timestamp() + LOCK, 5, 1, 99),
    );
}

// escrow_view: the terms come from the note, and settlement is visible to the
// party whose copy survives it.
unconstrained fn view(s: Setup, owner: AztecAddress, escrow_id: Field) -> crate::PrivateEscrow::EscrowView {
    s.env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(owner),
        PrivateEscrow::at(s.escrow).escrow_view(owner, escrow_id),
    )
}

#[test]
unconstrained fn escrow_view_shows_the_stored_terms_to_both_parties() {
    let s = setup();
    let deadline = deposit(s, 1, 11);
    let secret_hash = poseidon2_hash_with_separator([CLAIM_SECRET], DOM_SEP__CLAIM_SECRET);
    for owner in [s.recipient, s.sender] {
        let v = view(s, owner, 1);
        assert(v.found & !v.settled);
        assert(v.note.escrow_id == 1);
        assert(v.note.sender == s.sender);
        assert(v.note.recipient == s.recipient);
        assert(v.note.amount == AMOUNT);
        assert(v.note.deadline == deadline);
        assert(v.note.claim_secret_hash == secret_hash);
    }
    assert(!view(s, s.recipient, 2).found);
}

#[test]
unconstrained fn escrow_view_reports_a_claimed_escrow_as_settled_to_the_sender() {
    let s = setup();
    let _ = deposit(s, 1, 11);
    claim(s, 1, CLAIM_SECRET);
    let sender_view = view(s, s.sender, 1);
    assert(sender_view.found & sender_view.settled);
    // The recipient's copy was consumed by the claim.
    assert(!view(s, s.recipient, 1).found);
}

#[test]
unconstrained fn escrow_view_reports_a_refunded_escrow_as_settled_to_the_recipient() {
    let s = setup();
    let deadline = deposit(s, 1, 11);
    s.env.mine_block_at(deadline + 1);
    refund(s, 1);
    let recipient_view = view(s, s.recipient, 1);
    assert(recipient_view.found & recipient_view.settled);
    assert(!view(s, s.sender, 1).found);
}

// ── Deposit nullifier: one deposit per (escrow_id, sender) ──────────────────
// UNCOMPILED in the session that wrote it: run `aztec test` in CI.

#[test(should_fail)]
unconstrained fn second_deposit_with_the_same_escrow_id_fails() {
    let s = setup();
    let _ = deposit(s, 1, 11);
    // Fresh authwit nonce: the failure is the deposit nullifier, not a reused authwit.
    let _ = deposit(s, 1, 12);
}

#[test]
unconstrained fn distinct_escrow_ids_from_one_sender_still_work() {
    let s = setup();
    let _ = deposit(s, 1, 11);
    let deadline = deposit(s, 2, 12);
    assert(balance(s.env, s.token, s.escrow) == 2 * AMOUNT);
    claim(s, 1, CLAIM_SECRET);
    s.env.mine_block_at(deadline + 1);
    refund(s, 2);
    assert(balance(s.env, s.token, s.recipient) == NET);
    assert(balance(s.env, s.token, s.sender) == MINTED - AMOUNT);
    assert(balance(s.env, s.token, s.escrow) == 0);
}

// Before the fix this deposit landed and its funds could never move: the
// settlement nullifier of (1, sender, recipient) already existed.
#[test(should_fail)]
unconstrained fn the_same_escrow_id_cannot_be_reused_after_settlement() {
    let s = setup();
    let _ = deposit(s, 1, 11);
    claim(s, 1, CLAIM_SECRET);
    let _ = deposit(s, 1, 12);
}

unconstrained fn deposit_amount(s: Setup, amount: u128, escrow_id: Field, nonce: Field) {
    let deadline = s.env.last_block_timestamp() + LOCK;
    add_private_authwit_from_call(s.env, s.sender, s.escrow, transfer_call(s.token, s.sender, s.escrow, amount, nonce));
    let secret_hash = poseidon2_hash_with_separator([CLAIM_SECRET], DOM_SEP__CLAIM_SECRET);
    s.env.call_private(
        s.sender,
        PrivateEscrow::at(s.escrow).deposit(s.recipient, amount, deadline, secret_hash, escrow_id, nonce),
    );
}

// OD-7: amounts the 16 November baseline refused for its fee (9_999 under the 10% share, 1 unit)
// are accepted and paid in full: the alpha class charges no fee.
#[test]
unconstrained fn small_amounts_are_paid_in_full_without_fee() {
    let s = setup();
    deposit_amount(s, 9999, 1, 11);
    claim(s, 1, CLAIM_SECRET);
    deposit_amount(s, 1, 2, 12);
    claim(s, 2, CLAIM_SECRET);
    assert(balance(s.env, s.token, s.recipient) == 10000);
    assert(balance(s.env, s.token, s.escrow) == 0);
    assert(balance(s.env, s.token, s.sender) == MINTED - 10000);
}

// OD-2: exactly the alpha maximum is accepted and claimed in full.
#[test]
unconstrained fn the_alpha_maximum_is_accepted_and_claimed_in_full() {
    let s = setup();
    mint(s.env, s.token, s.sender, MAX_AMOUNT);
    deposit_amount(s, MAX_AMOUNT, 1, 11);
    claim(s, 1, CLAIM_SECRET);
    assert(balance(s.env, s.token, s.recipient) == MAX_AMOUNT);
    assert(balance(s.env, s.token, s.escrow) == 0);
}

// Package 4: the exit at the maximum. A refund of 100 HLC after the deadline returns all of it, no fee.
#[test]
unconstrained fn the_alpha_maximum_is_refunded_in_full_without_fee() {
    let s = setup();
    mint(s.env, s.token, s.sender, MAX_AMOUNT);
    deposit_amount(s, MAX_AMOUNT, 1, 11);
    s.env.mine_block_at(s.env.last_block_timestamp() + LOCK + 1);
    refund(s, 1);
    assert(balance(s.env, s.token, s.sender) == MINTED + MAX_AMOUNT);
    assert(balance(s.env, s.token, s.escrow) == 0);
}

// Package 4 (internal review): the recipient cannot take the sender's refund, even after the deadline.
#[test(should_fail_with = "escrow not found")]
unconstrained fn the_recipient_cannot_take_the_refund() {
    let s = setup();
    let deadline = deposit(s, 1, 11);
    s.env.mine_block_at(deadline + 1);
    s.env.call_private_opts(
        s.recipient,
        CallPrivateOptions::new().with_additional_scopes([s.escrow]),
        PrivateEscrow::at(s.escrow).refund(1),
    );
}

// OD-2: one unit above the maximum is refused before any token moves.
#[test(should_fail_with = "above the alpha maximum")]
unconstrained fn above_the_alpha_maximum_is_refused() {
    let s = setup();
    mint(s.env, s.token, s.sender, MAX_AMOUNT + 1);
    deposit_amount(s, MAX_AMOUNT + 1, 1, 11);
}

// Section 1 vectors. Schedule is the fixture (30 / 500 / 500), not the D5 globals.
// tx cap is u128::MAX so the fixture rows are not refused by the baseline cap.
#[test]
unconstrained fn section_1_vectors_and_baseline_quotes() {
    let cap: u128 = 340282366920938463463374607431768211455;
    let refused_1 = quote_protocol_fee(1, 30, 500, 500, cap);
    assert(!refused_1.ok & (refused_1.reason == 1));
    let refused_9999 = quote_protocol_fee(9999, 30, 500, 500, cap);
    assert(!refused_9999.ok & (refused_9999.reason == 1));

    let row_10000 = quote_protocol_fee(10000, 30, 500, 500, cap);
    assert(row_10000.ok & (row_10000.fee == 500) & (row_10000.net == 9500));
    let row_10001 = quote_protocol_fee(10001, 30, 500, 500, cap);
    assert(row_10001.ok & (row_10001.fee == 500) & (row_10001.net == 9501));
    let row_166667 = quote_protocol_fee(166667, 30, 500, 500, cap);
    assert(row_166667.ok & (row_166667.fee == 501) & (row_166667.net == 166166));
    let row_166668 = quote_protocol_fee(166668, 30, 500, 500, cap);
    assert(row_166668.ok & (row_166668.fee == 501) & (row_166668.net == 166167));
    let row_1000000 = quote_protocol_fee(1000000, 30, 500, 500, cap);
    assert(row_1000000.ok & (row_1000000.fee == 3000) & (row_1000000.net == 997000));
    let row_1234567 = quote_protocol_fee(1234567, 30, 500, 500, cap);
    assert(row_1234567.ok & (row_1234567.fee == 3704) & (row_1234567.net == 1230863));
    let row_1e11 = quote_protocol_fee(100000000000, 30, 500, 500, cap);
    assert(row_1e11.ok & (row_1e11.fee == 300000000) & (row_1e11.net == 99700000000));
    let huge: u128 = 340282366920938463463374607431768211455;
    let row_huge = quote_protocol_fee(huge, 30, 500, 500, cap);
    assert(row_huge.ok);
    assert(row_huge.fee == 1020847100762815390390123822295304635);
    assert(row_huge.net == 339261519820175648072984483609472906820);
    assert(row_huge.fee + row_huge.net == huge);

    // D5 globals, escrow minimum 1000, cap 5_000_000.
    let edge = quote_protocol_fee(10000, 50, 1000, 1000, 5000000);
    assert(edge.ok & (edge.fee == 1000) & (edge.net == 9000));
    let under = quote_protocol_fee(9999, 50, 1000, 1000, 5000000);
    assert(!under.ok & (under.reason == 1));
    let at_cap = quote_protocol_fee(1000000000, 50, 1000, 1000, 5000000);
    assert(at_cap.ok & (at_cap.fee == 5000000) & (at_cap.net == 995000000));
    let over_cap = quote_protocol_fee(1000000001, 50, 1000, 1000, 5000000);
    assert(!over_cap.ok & (over_cap.reason == 2));
}


// Internal security review (18 November 2026): one negative test per reachable assert.
#[test(should_fail_with = "zero amount")]
unconstrained fn zero_amount_deposit_fails() {
    let s = setup();
    s.env.call_private(
        s.sender,
        PrivateEscrow::at(s.escrow).deposit(s.recipient, 0, s.env.last_block_timestamp() + LOCK, 5, 1, 1),
    );
}

#[test(should_fail_with = "deadline in the past")]
unconstrained fn deadline_in_the_past_fails() {
    let s = setup();
    s.env.call_private(
        s.sender,
        PrivateEscrow::at(s.escrow).deposit(s.recipient, AMOUNT, s.env.last_block_timestamp() - 1, 5, 1, 1),
    );
}

#[test(should_fail_with = "zero escrow id")]
unconstrained fn zero_escrow_id_fails() {
    let s = setup();
    s.env.call_private(
        s.sender,
        PrivateEscrow::at(s.escrow).deposit(s.recipient, AMOUNT, s.env.last_block_timestamp() + LOCK, 5, 0, 1),
    );
}

#[test(should_fail_with = "escrow not found")]
unconstrained fn refund_of_an_unknown_escrow_fails() {
    let s = setup();
    refund(s, 99);
}
