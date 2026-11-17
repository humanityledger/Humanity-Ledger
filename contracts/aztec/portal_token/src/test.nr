// TXE tests for PortalToken (run with `aztec test` inside contracts/aztec/portal_token).
// A deposit message is seeded as the portal would send it (sender = the portal's L1 address,
// content = mint_to_private(amount)); the claim must use the right secret, amount and index, once.

use crate::{mint_to_private_content, PortalToken};
use aztec::{
    context::calls::UtilityCall,
    protocol::{
        abis::function_selector::FunctionSelector,
        address::{AztecAddress, EthAddress},
        traits::{FromField, ToField},
    },
    test::helpers::test_environment::{ExecuteUtilityOptions, TestEnvironment},
};

global SECRET: Field = 0x5ec2e7;
global AMOUNT: u128 = 25000000;
global PORTAL: Field = 0x1111111111111111111111111111111111111111;

struct Setup {
    env: TestEnvironment,
    token: AztecAddress,
    alice: AztecAddress,
    bob: AztecAddress,
}

unconstrained fn setup() -> Setup {
    let mut env = TestEnvironment::new();
    let alice = env.create_contract_account();
    let bob = env.create_contract_account();
    let token = env.deploy("PortalToken").with_public_initializer(
        alice,
        PortalToken::interface().constructor(EthAddress::from_field(PORTAL), 6),
    );
    Setup { env, token, alice, bob }
}

unconstrained fn seed_deposit(s: Setup, amount: u128, secret: Field) -> Field {
    s.env.send_l1_to_l2_message(mint_to_private_content(amount), secret, EthAddress::from_field(PORTAL), s.token)
}

unconstrained fn balance(s: Setup, owner: AztecAddress) -> u128 {
    let call: UtilityCall<18, 1, u128> = UtilityCall::new(
        s.token,
        FunctionSelector::from_signature("balance_of_private((Field))"),
        "balance_of_private",
        [owner.to_field()],
    );
    s.env.execute_utility_opts(ExecuteUtilityOptions::new().with_from(owner), call)
}

#[test]
unconstrained fn contents_match_the_portal() {
    // The same vectors as test/unit/portal/receivers.test.ts and the Solidity side
    // (sha256ToField of abi.encodeWithSignature(...)).
    assert(mint_to_private_content(25000000) == 0x00e90eec23412b6f89fb744d00d81c1153b7be8eed3b116fc650df4da1b2b8c3);
    assert(crate::withdraw_content(0xbeef, 4000, 0) == 0x0082b27f9b81bbea08119e9875dab341b46c3899d243dd4871fcd53f4c70dc74);
}

#[test]
unconstrained fn claim_credits_a_private_balance() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET, index));
    assert(balance(s, s.alice) == AMOUNT);
}

#[test]
unconstrained fn anyone_with_the_secret_claims_into_any_account() {
    // The message names no recipient: bob claims into his own account with the secret.
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.bob, PortalToken::at(s.token).claim_private(s.bob, AMOUNT, SECRET, index));
    assert(balance(s, s.bob) == AMOUNT);
    assert(balance(s, s.alice) == 0);
}

#[test(should_fail)]
unconstrained fn a_message_is_claimed_once() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET, index));
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET, index));
}

#[test(should_fail_with = "Message not in state")]
unconstrained fn a_wrong_secret_claims_nothing() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET + 1, index));
}

#[test(should_fail_with = "Message not in state")]
unconstrained fn a_wrong_amount_claims_nothing() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT + 1, SECRET, index));
}

#[test(should_fail_with = "Message not in state")]
unconstrained fn a_message_from_another_portal_claims_nothing() {
    let s = setup();
    let index = s.env.send_l1_to_l2_message(mint_to_private_content(AMOUNT), SECRET, EthAddress::from_field(0x2222), s.token);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET, index));
}

#[test]
unconstrained fn transfer_moves_the_private_balance() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET, index));
    s.env.call_private(s.alice, PortalToken::at(s.token).transfer_in_private(s.alice, s.bob, 1000, 0));
    assert(balance(s, s.alice) == AMOUNT - 1000);
    assert(balance(s, s.bob) == 1000);
}

#[test]
unconstrained fn withdraw_burns_the_private_balance() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET, index));
    s.env.call_private(
        s.alice,
        PortalToken::at(s.token).withdraw_private(s.alice, EthAddress::from_field(0xbeef), 4000, EthAddress::zero(), 0),
    );
    assert(balance(s, s.alice) == AMOUNT - 4000);
}

#[test(should_fail_with = "Balance too low")]
unconstrained fn withdraw_more_than_the_balance_fails() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET, index));
    s.env.call_private(
        s.alice,
        PortalToken::at(s.token).withdraw_private(s.alice, EthAddress::from_field(0xbeef), AMOUNT + 1, EthAddress::zero(), 0),
    );
}

#[test(should_fail)]
unconstrained fn withdraw_from_someone_else_needs_their_authwit() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET, index));
    s.env.call_private(
        s.bob,
        PortalToken::at(s.token).withdraw_private(s.alice, EthAddress::from_field(0xbeef), 1000, EthAddress::zero(), 7),
    );
}
