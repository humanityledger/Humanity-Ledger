// TXE tests for PaymentStream (run with `aztec test` after `aztec compile` of
// this crate and of ../test_token). Master prompt task A.3: partial
// withdrawals replace the stream note, accrual bounds every withdrawal, one
// stream per salt. Sender cancel is not tested because it does not exist: it
// was removed as unworkable in this design (SEC-S5, open question R-09).

use crate::PaymentStream;
use aztec::{
    context::calls::{PrivateCall, UtilityCall},
    protocol::{abis::function_selector::FunctionSelector, address::AztecAddress, traits::ToField},
    test::helpers::{
        authwit::add_private_authwit_from_call,
        test_environment::{CallPrivateOptions, ExecuteUtilityOptions, TestEnvironment},
    },
};

global TOTAL: u128 = 100;
global RATE: u128 = 1;
global MINTED: u128 = 1000;

struct Setup {
    env: TestEnvironment,
    token: AztecAddress,
    streams: AztecAddress,
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
    let sender = env.create_contract_account();
    let recipient = env.create_contract_account();
    let token = env.deploy("../test_token/@test_token/TestToken").without_initializer();
    let streams = env.deploy("PaymentStream").with_public_initializer(
        sender,
        PaymentStream::interface().constructor(token),
    );
    mint(env, token, sender, MINTED);
    Setup { env, token, streams, sender, recipient }
}

/// Opens a stream starting now; returns its start time.
unconstrained fn open(s: Setup, salt: Field, nonce: Field) -> u64 {
    let start = s.env.last_block_timestamp();
    add_private_authwit_from_call(s.env, s.sender, s.streams, transfer_call(s.token, s.sender, s.streams, TOTAL, nonce));
    s.env.call_private(
        s.sender,
        PaymentStream::at(s.streams).create_stream(s.recipient, TOTAL, RATE, start, salt, nonce),
    );
    start
}

unconstrained fn withdraw(s: Setup, salt: Field, amount: u128) {
    s.env.call_private_opts(
        s.recipient,
        CallPrivateOptions::new().with_additional_scopes([s.streams]),
        PaymentStream::at(s.streams).withdraw(salt, amount),
    );
}

#[test]
unconstrained fn create_stream_locks_the_total() {
    let s = setup();
    let _ = open(s, 1, 11);
    assert(balance(s.env, s.token, s.sender) == MINTED - TOTAL);
    assert(balance(s.env, s.token, s.streams) == TOTAL);
}

#[test]
unconstrained fn partial_withdrawals_add_up_and_replace_the_note() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 30);
    withdraw(s, 1, 20);
    assert(balance(s.env, s.token, s.recipient) == 20);

    // The replacement note carries withdrawn = 20: only 10 more have accrued.
    withdraw(s, 1, 10);
    assert(balance(s.env, s.token, s.recipient) == 30);
    assert(balance(s.env, s.token, s.streams) == TOTAL - 30);
}

#[test(should_fail_with = "insufficient accrued balance")]
unconstrained fn a_withdrawal_cannot_reuse_an_earlier_accrual() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 30);
    withdraw(s, 1, 20);
    // About 30 accrued and 20 already withdrawn: 40 is more than what is left.
    withdraw(s, 1, 40);
}

#[test(should_fail_with = "insufficient accrued balance")]
unconstrained fn cannot_withdraw_more_than_accrued() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 10);
    withdraw(s, 1, 90);
}

#[test]
unconstrained fn accrual_is_capped_at_the_total_and_the_note_is_consumed() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 1000);
    withdraw(s, 1, TOTAL);
    assert(balance(s.env, s.token, s.recipient) == TOTAL);
    assert(balance(s.env, s.token, s.streams) == 0);
}

#[test(should_fail_with = "no active stream note found")]
unconstrained fn a_drained_stream_has_no_note_left() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 1000);
    withdraw(s, 1, TOTAL);
    withdraw(s, 1, 1);
}

#[test]
unconstrained fn streams_are_isolated_by_salt() {
    let s = setup();
    let start = open(s, 1, 11);
    let _ = open(s, 2, 12);
    s.env.mine_block_at(start + 100);
    withdraw(s, 1, TOTAL);
    // Stream 2 is untouched by draining stream 1.
    withdraw(s, 2, 50);
    assert(balance(s.env, s.token, s.recipient) == TOTAL + 50);
}

#[test(should_fail_with = "no active stream note found")]
unconstrained fn only_the_recipient_can_withdraw() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 30);
    s.env.call_private_opts(
        s.sender,
        CallPrivateOptions::new().with_additional_scopes([s.streams]),
        PaymentStream::at(s.streams).withdraw(1, 10),
    );
}

#[test(should_fail_with = "start in future")]
unconstrained fn start_in_the_future_fails() {
    let s = setup();
    add_private_authwit_from_call(s.env, s.sender, s.streams, transfer_call(s.token, s.sender, s.streams, TOTAL, 1));
    s.env.call_private(
        s.sender,
        PaymentStream::at(s.streams).create_stream(s.recipient, TOTAL, RATE, s.env.last_block_timestamp() + 1000, 1, 1),
    );
}
