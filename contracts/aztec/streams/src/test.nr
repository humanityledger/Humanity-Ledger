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
    // Fee 1 on 20, so the recipient's note is 19. The stream lost the gross 20.
    assert(balance(s.env, s.token, s.recipient) == 19);

    // The replacement note carries withdrawn = 20: only 10 more have accrued.
    withdraw(s, 1, 10);
    assert(balance(s.env, s.token, s.recipient) == 28);
    assert(balance(s.env, s.token, s.streams) == TOTAL - 30);
    assert(
        balance(s.env, s.token, s.sender) + balance(s.env, s.token, s.recipient) + balance(s.env, s.token, s.streams)
            == MINTED - 2,
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
    // Fee on 100 is 1. net + fee = the deposit.
    assert(balance(s.env, s.token, s.recipient) == 99);
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
    // 99 from stream 1 and 49 from stream 2.
    assert(balance(s.env, s.token, s.recipient) == 148);
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

// SEC-S11: with a rate so large that elapsed * rate overflows u128, the
// stream is still withdrawable once fully accrued.
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
    mint(env, token, sender, big);
    let start = env.last_block_timestamp();
    add_private_authwit_from_call(env, sender, streams, transfer_call(token, sender, streams, big, 21));
    env.call_private(sender, PaymentStream::at(streams).create_stream(recipient, big, big, start, 7, 21));
    env.mine_block_at(start + 10); // 10 * 2^127 > u128::MAX
    // A slice under the cap. Fee on 200_000 at 50 bps is 1_000.
    env.call_private_opts(
        recipient,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).withdraw(7, 200000),
    );
    assert(balance(env, token, recipient) == 199000);
    assert(balance(env, token, streams) == big - 200000);
}

#[test(should_fail_with = "fee exceeds tx cap")]
unconstrained fn a_withdrawal_of_the_whole_huge_stream_is_refused() {
    let mut env = TestEnvironment::new();
    let sender = env.create_contract_account();
    let recipient = env.create_contract_account();
    let token = env.deploy("../test_token/@test_token/TestToken").without_initializer();
    let streams = env.deploy("PaymentStream").with_public_initializer(
        sender,
        PaymentStream::interface().constructor(token),
    );
    let big: u128 = 0x80000000000000000000000000000000;
    mint(env, token, sender, big);
    let start = env.last_block_timestamp();
    add_private_authwit_from_call(env, sender, streams, transfer_call(token, sender, streams, big, 22));
    env.call_private(sender, PaymentStream::at(streams).create_stream(recipient, big, big, start, 8, 22));
    env.mine_block_at(start + 10);
    env.call_private_opts(
        recipient,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).withdraw(8, big),
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
    // Accrued 40 to 42, fee 1, so the recipient receives 39 to 41.
    assert((paid >= 39) & (paid <= 41));
    assert(balance(s.env, s.token, s.sender) == MINTED - paid - 1);
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
    assert((paid == 0) | (paid == 9) | (paid == 19));
    let fee: u128 = if paid == 0 { 0 } else { 1 };
    assert(balance(s.env, s.token, s.sender) == MINTED - paid - fee);
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
    // Withdrawal fee 1 plus cancel fee 1. Recipient net is 58 to 61.
    assert((paid >= 58) & (paid <= 61));
    assert(balance(s.env, s.token, s.sender) == MINTED - paid - 2);
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

// Baseline, not a bypass: create_stream does not quote `total`. A stream of
// 2_000_000_000 is created even though one withdrawal of that total would
// exceed TX_CAP. Two slices of 1_000_000_000 each pay fee == TX_CAP (5_000_000)
// and net 995_000_000. Conservation: recipient == total - 2 * fee.
#[test]
unconstrained fn a_large_stream_settles_in_slices_each_at_the_tx_cap() {
    let mut env = TestEnvironment::new();
    let sender = env.create_contract_account();
    let recipient = env.create_contract_account();
    let token = env.deploy("../test_token/@test_token/TestToken").without_initializer();
    let streams = env.deploy("PaymentStream").with_public_initializer(
        sender,
        PaymentStream::interface().constructor(token),
    );
    let slice: u128 = 1000000000;
    let total: u128 = slice * 2;
    mint(env, token, sender, total);
    let start = env.last_block_timestamp();
    add_private_authwit_from_call(env, sender, streams, transfer_call(token, sender, streams, total, 61));
    env.call_private(sender, PaymentStream::at(streams).create_stream(recipient, total, total, start, 61, 61));
    env.mine_block_at(start + 10);
    env.call_private_opts(
        recipient,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).withdraw(61, slice),
    );
    assert(balance(env, token, recipient) == 995000000);
    assert(balance(env, token, streams) == total - slice);
    env.call_private_opts(
        recipient,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).withdraw(61, slice),
    );
    assert(balance(env, token, recipient) == 1990000000);
    assert(balance(env, token, streams) == 0);
    assert(balance(env, token, sender) == 0);
    assert(balance(env, token, sender) + balance(env, token, recipient) + balance(env, token, streams) == total - 10000000);
}

// The same stream can pay a slice under the cap, then refuse one withdrawal
// whose fee is 5_000_001.
#[test(should_fail_with = "fee exceeds tx cap")]
unconstrained fn a_slice_above_the_tx_cap_is_refused_after_a_smaller_slice() {
    let mut env = TestEnvironment::new();
    let sender = env.create_contract_account();
    let recipient = env.create_contract_account();
    let token = env.deploy("../test_token/@test_token/TestToken").without_initializer();
    let streams = env.deploy("PaymentStream").with_public_initializer(
        sender,
        PaymentStream::interface().constructor(token),
    );
    let total: u128 = 2000000001;
    mint(env, token, sender, total);
    let start = env.last_block_timestamp();
    add_private_authwit_from_call(env, sender, streams, transfer_call(token, sender, streams, total, 62));
    env.call_private(sender, PaymentStream::at(streams).create_stream(recipient, total, total, start, 62, 62));
    env.mine_block_at(start + 10);
    env.call_private_opts(
        recipient,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).withdraw(62, 200000),
    );
    env.call_private_opts(
        recipient,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).withdraw(62, 1000000001),
    );
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

// Before IA-01 a recipient who never withdrew could block the sender's cancel once the fee
// on the accrued part exceeded TX_CAP (accrued above 1_000_000_000). Now the cancel pays the
// recipient the accrued part minus TX_CAP and returns the rest to the sender.
#[test]
unconstrained fn cancel_with_accrued_above_the_cap_charges_the_cap() {
    let mut env = TestEnvironment::new();
    let sender = env.create_contract_account();
    let recipient = env.create_contract_account();
    let token = env.deploy("../test_token/@test_token/TestToken").without_initializer();
    let streams = env.deploy("PaymentStream").with_public_initializer(
        sender,
        PaymentStream::interface().constructor(token),
    );
    let total: u128 = 4000000000;
    let rate: u128 = 100000000;
    mint(env, token, sender, total);
    let start = env.last_block_timestamp();
    add_private_authwit_from_call(env, sender, streams, transfer_call(token, sender, streams, total, 71));
    env.call_private(sender, PaymentStream::at(streams).create_stream(recipient, total, rate, start, 71, 71));
    env.mine_block_at(start + 20);
    env.call_private_opts(
        sender,
        CallPrivateOptions::new().with_additional_scopes([streams]),
        PaymentStream::at(streams).cancel(71),
    );
    let paid = balance(env, token, recipient);
    let back = balance(env, token, sender);
    // Accrued 2_000_000_000 to 2_200_000_000; the fee is TX_CAP.
    assert(paid >= 2000000000 - 5000000);
    assert(paid + back + 5000000 == total);
    assert(balance(env, token, streams) == 0);
}
