// TXE tests for PaymentStream (run with `aztec test` after `aztec compile` of
// this crate and of ../test_token). Master prompt task A.3: partial
// withdrawals replace the stream note, accrual bounds every withdrawal, one
// stream per salt; sender cancel (SEC-S12) splits accrued and unaccrued and
// shares one state nullifier with withdrawals.

use crate::{cancel_fee, quote_protocol_fee, PaymentStream};
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
// OD-2: 100 HLC at 6 decimals, the same value as MAX_AMOUNT in main.nr. OD-7: no protocol fee.
global MAX_AMOUNT: u128 = 100000000;

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
    // No fee (OD-7): the recipient receives the whole 20.
    assert(balance(s.env, s.token, s.recipient) == 20);

    // The replacement note carries withdrawn = 20: only 10 more have accrued.
    withdraw(s, 1, 10);
    assert(balance(s.env, s.token, s.recipient) == 30);
    assert(balance(s.env, s.token, s.streams) == TOTAL - 30);
    // Conservation: nothing went to TREASURY.
    assert(
        balance(s.env, s.token, s.sender) + balance(s.env, s.token, s.recipient) + balance(s.env, s.token, s.streams)
            == MINTED,
    );
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
    // No fee: the recipient receives the whole total.
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
    // No fee (OD-7): 100 from stream 1 and 50 from stream 2.
    assert(balance(s.env, s.token, s.recipient) == 150);
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

// SEC-S11: with a rate so large that elapsed * rate overflows u128, the stream is still
// withdrawable once fully accrued. The total is the alpha maximum (OD-2).
#[test]
unconstrained fn a_huge_rate_does_not_lock_the_stream() {
    let mut env = TestEnvironment::new();
    let sender = env.create_contract_account();
    let recipient = env.create_contract_account();
    let token = env.deploy("../test_token/@test_token/TestToken").without_initializer();
    let streams = env.deploy("PaymentStream").with_public_initializer(
        sender,
        PaymentStream::interface().constructor(token),
    );
    let big: u128 = 0x80000000000000000000000000000000; // 2^127
    mint(env, token, sender, MAX_AMOUNT);
    let start = env.last_block_timestamp();
    add_private_authwit_from_call(env, sender, streams, transfer_call(token, sender, streams, MAX_AMOUNT, 21));
    env.call_private(sender, PaymentStream::at(streams).create_stream(recipient, MAX_AMOUNT, big, start, 7, 21));
    env.mine_block_at(start + 10); // 10 * 2^127 > u128::MAX
    env.call_private_opts(
        recipient,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).withdraw(7, 200000),
    );
    assert(balance(env, token, recipient) == 200000);
    assert(balance(env, token, streams) == MAX_AMOUNT - 200000);
}

// OD-2: a stream above the alpha maximum is refused before any token moves.
#[test(should_fail_with = "above the alpha maximum")]
unconstrained fn a_stream_above_the_alpha_maximum_is_refused() {
    let s = setup();
    mint(s.env, s.token, s.sender, MAX_AMOUNT + 1);
    let start = s.env.last_block_timestamp();
    add_private_authwit_from_call(s.env, s.sender, s.streams, transfer_call(s.token, s.sender, s.streams, MAX_AMOUNT + 1, 22));
    s.env.call_private(
        s.sender,
        PaymentStream::at(s.streams).create_stream(s.recipient, MAX_AMOUNT + 1, RATE, start, 8, 22),
    );
}

#[test(should_fail_with = "self-stream forbidden")]
unconstrained fn a_stream_to_oneself_fails() {
    let s = setup();
    let start = s.env.last_block_timestamp();
    add_private_authwit_from_call(s.env, s.sender, s.streams, transfer_call(s.token, s.sender, s.streams, TOTAL, 31));
    s.env.call_private(
        s.sender,
        PaymentStream::at(s.streams).create_stream(s.sender, TOTAL, RATE, start, 9, 31),
    );
}

unconstrained fn cancel(s: Setup, caller: AztecAddress, salt: Field) {
    s.env.call_private_opts(
        caller,
        CallPrivateOptions::new().with_additional_scopes([s.streams]),
        PaymentStream::at(s.streams).cancel(salt),
    );
}

// SEC-S12: the recipient gets what accrued, the sender the rest, nothing stays.
#[test]
unconstrained fn cancel_mid_stream_splits_accrued_and_the_rest() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 40);
    cancel(s, s.sender, 1);
    let paid = balance(s.env, s.token, s.recipient);
    // Accrued 40 to 42, no fee: the recipient receives all of it.
    assert((paid >= 40) & (paid <= 42));
    assert(balance(s.env, s.token, s.sender) == MINTED - paid);
    assert(balance(s.env, s.token, s.streams) == 0);
}

unconstrained fn open_rate(s: Setup, salt: Field, nonce: Field, rate: u128) -> u64 {
    let start = s.env.last_block_timestamp();
    add_private_authwit_from_call(s.env, s.sender, s.streams, transfer_call(s.token, s.sender, s.streams, TOTAL, nonce));
    s.env.call_private(
        s.sender,
        PaymentStream::at(s.streams).create_stream(s.recipient, TOTAL, rate, start, salt, nonce),
    );
    start
}

// Rate 10 so a 1 or 2 second drift accrues 10 or 20, which clears the 10% share.
// Dust (rate 1) is covered by cancel_with_dust_accrued_pays_it_without_fee (IA-01).
#[test]
unconstrained fn cancel_before_any_accrual_returns_everything() {
    let s = setup();
    let start = open_rate(s, 1, 11, 10);
    s.env.mine_block_at(start);
    cancel(s, s.sender, 1);
    let paid = balance(s.env, s.token, s.recipient);
    assert((paid == 0) | (paid == 10) | (paid == 20));
    assert(balance(s.env, s.token, s.sender) == MINTED - paid);
    assert(balance(s.env, s.token, s.streams) == 0);
}

#[test]
unconstrained fn cancel_after_a_withdrawal_pays_only_what_is_left() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 30);
    withdraw(s, 1, 20);
    s.env.mine_block_at(start + 60);
    // The sender cancels from the copy the withdrawal delivered (index 1).
    cancel(s, s.sender, 1);
    let paid = balance(s.env, s.token, s.recipient);
    // No fee on the withdrawal or the cancel: the recipient holds all that accrued, 60 to 63.
    assert((paid >= 60) & (paid <= 63));
    assert(balance(s.env, s.token, s.sender) == MINTED - paid);
    assert(balance(s.env, s.token, s.streams) == 0);
}

#[test(should_fail_with = "stream not found")]
unconstrained fn a_second_cancel_fails() {
    let s = setup();
    let start = open_rate(s, 1, 11, 10);
    s.env.mine_block_at(start);
    cancel(s, s.sender, 1);
    cancel(s, s.sender, 1);
}

// The recipient's note survives the cancel, but withdrawing from it emits the
// state nullifier the cancel already emitted.
#[test(should_fail)]
unconstrained fn a_withdrawal_after_cancel_fails() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 40);
    cancel(s, s.sender, 1);
    withdraw(s, 1, 10);
}

#[test(should_fail_with = "stream not found")]
unconstrained fn only_the_sender_can_cancel() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 40);
    cancel(s, s.recipient, 1);
}

// With a second stream funding the same instance, a withdrawal after a cancel
// can only be stopped by the shared state nullifier, not by an empty balance.
#[test(should_fail)]
unconstrained fn a_withdrawal_after_cancel_fails_with_funds_left() {
    let s = setup();
    let start = open(s, 1, 11);
    let _ = open(s, 2, 12);
    s.env.mine_block_at(start + 40);
    cancel(s, s.sender, 1);
    assert(balance(s.env, s.token, s.streams) == TOTAL);
    withdraw(s, 1, 10);
}

// After a withdrawal the sender holds copies at index 0 and 1. Once index 1 is
// cancelled, the stale index-0 copy cannot cancel again: its state nullifier
// was emitted by the withdrawal. Stream 2 keeps funds in the contract.
#[test(should_fail)]
unconstrained fn a_cancel_from_a_stale_copy_fails_with_funds_left() {
    let s = setup();
    let start = open(s, 1, 11);
    let _ = open(s, 2, 12);
    s.env.mine_block_at(start + 30);
    withdraw(s, 1, 20);
    s.env.mine_block_at(start + 60);
    cancel(s, s.sender, 1);
    assert(balance(s.env, s.token, s.streams) == TOTAL);
    cancel(s, s.sender, 1);
}

// SEC-S13: stream_view returns the live state to either party and skips the
// sender's stale copies.
unconstrained fn view(s: Setup, owner: AztecAddress, salt: Field) -> crate::PaymentStream::StreamView {
    s.env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(owner),
        PaymentStream::at(s.streams).stream_view(owner, salt),
    )
}

#[test]
unconstrained fn stream_view_shows_the_live_state_to_both_parties() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 30);
    for owner in [s.recipient, s.sender] {
        let v = view(s, owner, 1);
        assert(v.found & v.live);
        assert(v.note.index == 0);
        assert(v.note.total == TOTAL);
        assert((v.available >= 30) & (v.available <= 32));
    }
    assert(!view(s, s.recipient, 2).found);
}

#[test]
unconstrained fn stream_view_skips_the_senders_stale_copy() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 30);
    withdraw(s, 1, 20);
    let v = view(s, s.sender, 1);
    assert(v.found & v.live);
    assert(v.note.index == 1);
    assert(v.note.withdrawn == 20);
    let r = view(s, s.recipient, 1);
    assert(r.live & (r.note.index == 1));
}

#[test]
unconstrained fn stream_view_shows_a_cancelled_stream_as_not_live() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 30);
    withdraw(s, 1, 20);
    s.env.mine_block_at(start + 60);
    cancel(s, s.sender, 1);
    let r = view(s, s.recipient, 1);
    assert(r.found & !r.live & (r.available == 0));
    let v = view(s, s.sender, 1);
    assert(v.found & !v.live);
}

// ── SEC-S14: one stream per (salt, sender) ──────────────────────────────────
// UNCOMPILED in the session that wrote it: run `aztec test` in CI.

#[test(should_fail)]
unconstrained fn a_second_stream_with_the_same_salt_fails() {
    let s = setup();
    let _ = open(s, 1, 11);
    // Fresh authwit nonce: the failure is the creation nullifier, not a reused authwit.
    let _ = open(s, 1, 12);
}

#[test]
unconstrained fn distinct_salts_from_one_sender_still_work() {
    let s = setup();
    let start = open(s, 1, 11);
    let _ = open(s, 2, 12);
    assert(balance(s.env, s.token, s.streams) == 2 * TOTAL);
    // Long enough that stream 2, opened a moment later, has accrued at least 10.
    s.env.mine_block_at(start + 20);
    withdraw(s, 1, 10);
    cancel(s, s.sender, 2);
    // Stream 1 still holds what was not withdrawn; stream 2 is fully paid out.
    assert(balance(s.env, s.token, s.streams) == TOTAL - 10);
}

// Before the fix this stream was created and its funds could never move: the
// index-0 state nullifier of (1, sender, recipient) already existed.
#[test(should_fail)]
unconstrained fn a_salt_cannot_be_reused_after_cancel() {
    let s = setup();
    let start = open_rate(s, 1, 11, 10);
    s.env.mine_block_at(start);
    cancel(s, s.sender, 1);
    let _ = open(s, 1, 12);
}

#[test]
unconstrained fn section_1_vectors_and_stream_fee_quotes() {
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
    assert(row_huge.fee == 1020847100762815390390123822295304635);
    assert(row_huge.net == 339261519820175648072984483609472906820);

    // Stream minimum is 0. 10 pays 1. 9 is refused. 5 is refused.
    let ten = quote_protocol_fee(10, 50, 0, 1000, 5000000);
    assert(ten.ok & (ten.fee == 1) & (ten.net == 9));
    let nine = quote_protocol_fee(9, 50, 0, 1000, 5000000);
    assert(!nine.ok & (nine.reason == 1));
    let five = quote_protocol_fee(5, 50, 0, 1000, 5000000);
    assert(!five.ok & (five.reason == 1));
}

// OD-2 and OD-7: a stream of exactly the alpha maximum settles in two slices, in full.
#[test]
unconstrained fn the_alpha_maximum_streams_in_full_without_fee() {
    let mut env = TestEnvironment::new();
    let sender = env.create_contract_account();
    let recipient = env.create_contract_account();
    let token = env.deploy("../test_token/@test_token/TestToken").without_initializer();
    let streams = env.deploy("PaymentStream").with_public_initializer(
        sender,
        PaymentStream::interface().constructor(token),
    );
    let slice: u128 = MAX_AMOUNT / 2;
    mint(env, token, sender, MAX_AMOUNT);
    let start = env.last_block_timestamp();
    add_private_authwit_from_call(env, sender, streams, transfer_call(token, sender, streams, MAX_AMOUNT, 61));
    env.call_private(sender, PaymentStream::at(streams).create_stream(recipient, MAX_AMOUNT, MAX_AMOUNT, start, 61, 61));
    env.mine_block_at(start + 10);
    env.call_private_opts(
        recipient,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).withdraw(61, slice),
    );
    assert(balance(env, token, recipient) == slice);
    env.call_private_opts(
        recipient,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).withdraw(61, MAX_AMOUNT - slice),
    );
    assert(balance(env, token, recipient) == MAX_AMOUNT);
    assert(balance(env, token, streams) == 0);
    assert(balance(env, token, sender) == 0);
}

// IA-01 (internal audit, 18 November 2026): a cancel never fails because of the fee.
#[test]
unconstrained fn cancel_fee_never_refuses() {
    // Dust under the 10% share: no fee.
    assert(cancel_fee(1, 50, 0, 1000, 5000000) == 0);
    assert(cancel_fee(9, 50, 0, 1000, 5000000) == 0);
    // Ordinary amount: the quoted fee.
    assert(cancel_fee(40, 50, 0, 1000, 5000000) == 1);
    assert(cancel_fee(1000000000, 50, 0, 1000, 5000000) == 5000000);
    // Above the cap: the cap, which is below the amount.
    assert(cancel_fee(2000000000, 50, 0, 1000, 5000000) == 5000000);
}

// Rate 1, cancelled in the block it starts: 0 to 2 units accrued. Before IA-01 a dust
// amount made the cancel revert (fee 1 above the 10% share). Now it is paid with no fee.
#[test]
unconstrained fn cancel_with_dust_accrued_pays_it_without_fee() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start);
    cancel(s, s.sender, 1);
    let paid = balance(s.env, s.token, s.recipient);
    assert(paid <= 2);
    assert(balance(s.env, s.token, s.sender) == MINTED - paid);
    assert(balance(s.env, s.token, s.streams) == 0);
}

// IA-01 with the alpha class: cancelling a stream of the alpha maximum mid-way pays the
// recipient everything accrued and returns the rest, with no fee (OD-7).
#[test]
unconstrained fn cancel_of_a_maximum_stream_pays_all_accrued_without_fee() {
    let mut env = TestEnvironment::new();
    let sender = env.create_contract_account();
    let recipient = env.create_contract_account();
    let token = env.deploy("../test_token/@test_token/TestToken").without_initializer();
    let streams = env.deploy("PaymentStream").with_public_initializer(
        sender,
        PaymentStream::interface().constructor(token),
    );
    let rate: u128 = 1000000;
    mint(env, token, sender, MAX_AMOUNT);
    let start = env.last_block_timestamp();
    add_private_authwit_from_call(env, sender, streams, transfer_call(token, sender, streams, MAX_AMOUNT, 71));
    env.call_private(sender, PaymentStream::at(streams).create_stream(recipient, MAX_AMOUNT, rate, start, 71, 71));
    env.mine_block_at(start + 20);
    env.call_private_opts(
        sender,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).cancel(71),
    );
    let paid = balance(env, token, recipient);
    let back = balance(env, token, sender);
    // Accrued 20_000_000 to 22_000_000.
    assert((paid >= 20000000) & (paid <= 22000000));
    assert(paid + back == MAX_AMOUNT);
    assert(balance(env, token, streams) == 0);
}

// Internal security review (18 November 2026): one negative test per reachable assert.
#[test(should_fail_with = "zero total")]
unconstrained fn a_zero_total_fails() {
    let s = setup();
    s.env.call_private(
        s.sender,
        PaymentStream::at(s.streams).create_stream(s.recipient, 0, RATE, s.env.last_block_timestamp(), 1, 1),
    );
}

#[test(should_fail_with = "zero rate")]
unconstrained fn a_zero_rate_fails() {
    let s = setup();
    s.env.call_private(
        s.sender,
        PaymentStream::at(s.streams).create_stream(s.recipient, TOTAL, 0, s.env.last_block_timestamp(), 1, 1),
    );
}

#[test(should_fail_with = "zero withdrawal")]
unconstrained fn a_zero_withdrawal_fails() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 40);
    withdraw(s, 1, 0);
}

// 1 unit: the 16 November baseline refused it (fee above the 10% share); the alpha class
// charges no fee, so it is paid (OD-7).
#[test]
unconstrained fn a_dust_withdrawal_is_paid_without_fee() {
    let s = setup();
    let start = open(s, 1, 11);
    s.env.mine_block_at(start + 40);
    withdraw(s, 1, 1);
    assert(balance(s.env, s.token, s.recipient) == 1);
}
