// TXE tests for PortalToken (run with `aztec test` inside contracts/aztec/portal_token).
// A deposit message is seeded as the portal would send it (sender = the portal's L1 address,
// content = mint_to_private(amount)); the claim must use the right secret, amount and index, once.
// A claim with a wrong secret, amount or portal names a message hash that is not in the tree: the
// node refuses it when the PXE asks for its membership witness, before the circuit's own assert.

use crate::{content::{mint_to_private_content, withdraw_content}, PortalToken};
use aztec::{
    context::calls::UtilityCall,
    protocol::{
        abis::function_selector::FunctionSelector,
        address::{AztecAddress, EthAddress},
        traits::ToField,
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
    assert(withdraw_content(0xbeef, 4000, 0) == 0x0082b27f9b81bbea08119e9875dab341b46c3899d243dd4871fcd53f4c70dc74);
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

#[test(should_fail_with = "No L1 to L2 message found")]
unconstrained fn a_wrong_secret_claims_nothing() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET + 1, index));
}

#[test(should_fail_with = "No L1 to L2 message found")]
unconstrained fn a_wrong_amount_claims_nothing() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT + 1, SECRET, index));
}

#[test(should_fail_with = "No L1 to L2 message found")]
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

// Internal security review (18 November 2026): one negative test per assert.
#[test(should_fail_with = "zero portal")]
unconstrained fn a_zero_portal_is_refused_at_deployment() {
    let mut env = TestEnvironment::new();
    let alice = env.create_contract_account();
    let _ = env.deploy("PortalToken").with_public_initializer(
        alice,
        PortalToken::interface().constructor(EthAddress::zero(), 6),
    );
}

#[test(should_fail_with = "zero amount")]
unconstrained fn a_zero_claim_fails() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, 0, SECRET, index));
}

#[test(should_fail_with = "zero amount")]
unconstrained fn a_zero_withdrawal_fails() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET, index));
    s.env.call_private(
        s.alice,
        PortalToken::at(s.token).withdraw_private(s.alice, EthAddress::from_field(0xbeef), 0, EthAddress::zero(), 0),
    );
}

#[test(should_fail_with = "zero recipient")]
unconstrained fn a_withdrawal_to_the_zero_address_fails() {
    let s = setup();
    let index = seed_deposit(s, AMOUNT, SECRET);
    s.env.call_private(s.alice, PortalToken::at(s.token).claim_private(s.alice, AMOUNT, SECRET, index));
    s.env.call_private(
        s.alice,
        PortalToken::at(s.token).withdraw_private(s.alice, EthAddress::zero(), 4000, EthAddress::zero(), 0),
    );
}

// BEGIN GENERATED VECTORS (scripts/security/portal-vectors.mjs)
#[test]
unconstrained fn contents_match_the_differential_vectors() {
    assert(mint_to_private_content(1) == 0x00b07d87bb8dcc3502bdd1b8e8bffa5456c877c31cf78b28a546742ba049dd01);
    assert(mint_to_private_content(2) == 0x006c0640d0da0ec1bc7ad073f10f066aef63eb38d05a7f6f7b9f52f9de79f6e0);
    assert(mint_to_private_content(999) == 0x003c635353363a572f48105c4869a3a4ce6648b3742faf07be378ca8926d3f1d);
    assert(mint_to_private_content(1000) == 0x0034b1a2d55fbf69e2364d46d34ec6624eb66f9bcb069f23b54d6c5ab83b2a14);
    assert(mint_to_private_content(25000000) == 0x00e90eec23412b6f89fb744d00d81c1153b7be8eed3b116fc650df4da1b2b8c3);
    assert(mint_to_private_content(1000000000000000000) == 0x0062d1424c71cf22faee99a047f6dd6cae866c69964d127636e961ec5d20f693);
    assert(mint_to_private_content(18446744073709551615) == 0x006e351dc8fd6c95229402610c1a293e8e0867da815101eb27c831aeda195cef);
    assert(mint_to_private_content(18446744073709551616) == 0x001633b9a59420013da1b79a47b3f61e6cbbaaf8c437d976472298c30ad02e85);
    assert(mint_to_private_content(340282366920938463463374607431768211454) == 0x003ab014c15796e96ffff9b8195711fba102c8c9b495ac177ec3a6b9b09e071d);
    assert(mint_to_private_content(340282366920938463463374607431768211455) == 0x00a1ad423bdb050926c253cd21bd34c21d40cee047216547f966b9cd1d3a9db4);
    assert(mint_to_private_content(265821656214594599085816066082816810628) == 0x00b208d026e1800b54ed0e83c5c9c92c2d66b83104d3f90f6201033bbc6105ab);
    assert(mint_to_private_content(91292752136937963495536274395479254141) == 0x00f57cb14fee6e53846617a9eff7056894b8a1e7d26f3db95dd75faa5e50ef38);
    assert(mint_to_private_content(37259955585865600758241667319978543034) == 0x00146b1cafd9dfab066eac88cc684d77d159f7b2e8c0b0ddbe03a0dabc036db2);
    assert(mint_to_private_content(57310730842960315276264998893921932538) == 0x00a7200ffce1be1057a3c228b14c6467cd86705a972b4c93d9120639cf92e079);
    assert(mint_to_private_content(232010063158344654441537643122233501307) == 0x00bf42cb5220375c4b93e32a9de7907abe9b341080a909510803dc5fa1c3ab0c);
    assert(mint_to_private_content(289672811720838593166832941865406925590) == 0x0044f729d99a165732cb7dab911e73d03cc87c133c06ec95a452796734b7074f);
    assert(mint_to_private_content(216534265852435600995520382795248396593) == 0x002a6b3b61ae05510655bbbba57d77db6c2e13a4addb7f9c4a957fd71662359e);
    assert(mint_to_private_content(132096182591156047045188887537818235139) == 0x002a4ed4a0c5cb2acfd97daec50654d58f19b491e12c9860b8164cd66fae0467);
    assert(mint_to_private_content(96070967117436753709798918186675865739) == 0x0090afb92422c42587568d2ec43c1674c6801b66e195d7754d98d0673ddb765e);
    assert(mint_to_private_content(33932508598795882646312725652681011577) == 0x00bdcc9385a42fd0d71662d5969f0005883b28fc94eeecefb216572754c6efda);
    assert(mint_to_private_content(231777460962775408247668899051030226389) == 0x0093e6f72b974843e38e5b291c4f8dcfc0edaf238030b6cf2100a27c27ae5f0c);
    assert(mint_to_private_content(69454222909868590743543493037334764883) == 0x0026f6e34dce1a3da673e791c034a81e7063b306f10c2e553c417b92c22e0b8f);
    assert(mint_to_private_content(313108221877019165887762429598145210895) == 0x00f4648ff24bbfdab31122fcfcdac407a0f6c403a476a11ef6b3a1b3d887605b);
    assert(mint_to_private_content(205547466903821374014347946099693188471) == 0x005d2975108a79ebaa9e2c8dd7bfbf200c848dbbb1c266131e5e64f8c3054830);
    assert(withdraw_content(0x0000000000000000000000000000000000000001, 1, 0x0000000000000000000000000000000000000000) == 0x001edff65da11c3716f927ef8b8a3a991dd455d91edd1e21f9f4e0201f5783d8);
    assert(withdraw_content(0x000000000000000000000000000000000000beef, 18446744073709551616, 0x8af20e32f1846308cfb9eead7d63e1f78a41e5d3) == 0x0015312bf2a5e89a9f7ccb8a4dbf60f42c24442450c89fc01e35f4d8fcc3f783);
    assert(withdraw_content(0xffffffffffffffffffffffffffffffffffffffff, 232010063158344654441537643122233501307, 0x9effde5ca72b21be4d092949f7784d2c40a630f2) == 0x00f27f57dc882a1ede80be4041955769df088b83376e1b2f80240dc447acc329);
    assert(withdraw_content(0x1af9b5fb1695eec6827df7dec0bc5ac96c064eaf, 69454222909868590743543493037334764883, 0x0000000000000000000000000000000000000000) == 0x0042beab68ebd0c4f115c6bd78006a310ec868b4a8bf753f0010af15ed20c609);
    assert(withdraw_content(0xea78f65d034ca516ccb383f18b26d430adc9e7f6, 25000000, 0x4f80595b5886845a3d3d2d72fa7cb171dace5ddc) == 0x00823aab12f399136f56d809276f4c4bc4fd3001ef989e9156c05ba0e98aa0ea);
    assert(withdraw_content(0x8af20e32f1846308cfb9eead7d63e1f78a41e5d3, 91292752136937963495536274395479254141, 0xa1de5dfd281703d3b8a234fee5e2be0ec5cb79fb) == 0x0016ddbc15edcbb10d5d96b546578b53fb3da6005f830ae492f25ad1ce1ff134);
    assert(withdraw_content(0x9effde5ca72b21be4d092949f7784d2c40a630f2, 96070967117436753709798918186675865739, 0x0000000000000000000000000000000000000000) == 0x006cf9d7388ee7325b852125e61bf0aae64c1089296f88b36100e42bd0cb5b41);
    assert(withdraw_content(0x285afe7b7c9c0bf42b0fd5f15a0bb830f9ad3c1a, 2, 0x25922cba48b9bdc5ccf9631b344c2ab1fe498d1b) == 0x0043acc0c56daada1c60405f58b411654ad996d679ab846dadc36138308f10d6);
    assert(withdraw_content(0x4f80595b5886845a3d3d2d72fa7cb171dace5ddc, 340282366920938463463374607431768211454, 0x0000000000000000000000000000000000000001) == 0x0047a51e5482ff8912b7cd4a4cdac7bddc2c1446a8e6a75271e0f70edac3eab6);
    assert(withdraw_content(0xa1de5dfd281703d3b8a234fee5e2be0ec5cb79fb, 289672811720838593166832941865406925590, 0x0000000000000000000000000000000000000000) == 0x001b3cbb17c00f904d5817e374c80e05eb74494bd8639cee9cc6b3ae15369f22);
    assert(withdraw_content(0x9a83d0fa3a230c9947c1a870936dd8ad9e5a2fb6, 313108221877019165887762429598145210895, 0xffffffffffffffffffffffffffffffffffffffff) == 0x0088b41f7e1e8fc9bc89ba8fdda51e99dd82470676fc52fd468ea37051e030a2);
    assert(withdraw_content(0x25922cba48b9bdc5ccf9631b344c2ab1fe498d1b, 1000000000000000000, 0x1af9b5fb1695eec6827df7dec0bc5ac96c064eaf) == 0x00461eb085b6579214120e88b41f9a4cdc403da6e998fc447e3d7a21113be1d6);
}
// END GENERATED VECTORS
