// TXE tests for PrivateEscrow (run with `aztec test` after `aztec compile` of
// this crate and of ../test_token). Master prompt task A.3: deposit -> claim,
// deposit -> refund after the deadline, one settlement per escrow, escrows
// isolated from each other, balances checked on the token.
//
// The token is the test-only contracts/aztec/test_token, called through raw
// selectors so this crate does not depend on it.

use crate::PrivateEscrow;
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
global AMOUNT: u128 = 100;
global MINTED: u128 = 1000;
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
    assert(balance(s.env, s.token, s.recipient) == AMOUNT);
    assert(balance(s.env, s.token, s.escrow) == 0);
}

#[test]
unconstrained fn refund_after_the_deadline_returns_the_funds() {
    let s = setup();
    let deadline = deposit(s, 1, 11);
    s.env.mine_block_at(deadline + 1);
    refund(s, 1);
    assert(balance(s.env, s.token, s.sender) == MINTED);
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
    assert(balance(s.env, s.token, s.recipient) == AMOUNT);
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
