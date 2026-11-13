// TXE tests for LedgerSponsor (aztec test). Signatures were made off-chain with a fixed test-only
// key (11..11), over the digest defined in voucher.nr; see scripts/aztec/sponsor-test-vectors.mjs.

use crate::LedgerSponsor;
use crate::voucher::voucher_digest;
use aztec::{
    protocol::{address::AztecAddress, traits::ToField},
    test::helpers::test_environment::{ExecuteUtilityOptions, TestEnvironment},
};

global SIGNER_X: [u8; 32] = [0x4f, 0x35, 0x5b, 0xdc, 0xb7, 0xcc, 0x0a, 0xf7, 0x28, 0xef, 0x3c, 0xce, 0xb9, 0x61, 0x5d, 0x90, 0x68, 0x4b, 0xb5, 0xb2, 0xca, 0x5f, 0x85, 0x9a, 0xb0, 0xf0, 0xb7, 0x04, 0x07, 0x58, 0x71, 0xaa];
global SIGNER_Y: [u8; 32] = [0x38, 0x5b, 0x6b, 0x1b, 0x8e, 0xad, 0x80, 0x9c, 0xa6, 0x74, 0x54, 0xd9, 0x68, 0x3f, 0xcf, 0x2b, 0xa0, 0x34, 0x56, 0xd6, 0xfe, 0x2c, 0x4a, 0xbe, 0x2b, 0x07, 0xf0, 0xfb, 0xdb, 0xb2, 0xf1, 0xc1];
global SIGNER_FIELDS: [Field; 4] = [0x4f355bdcb7cc0af728ef3cceb9615d90, 0x684bb5b2ca5f859ab0f0b704075871aa, 0x385b6b1b8ead809ca67454d9683fcf2b, 0xa03456d6fe2c4abe2b07f0fbdbb2f1c1];
global SIG_V1: [u8; 64] = [0x20, 0xbd, 0x3a, 0xda, 0xfc, 0x4e, 0x36, 0x07, 0xb0, 0xb4, 0x77, 0x9c, 0x95, 0xab, 0x1f, 0x4d, 0x7d, 0x4c, 0x17, 0x95, 0x10, 0x28, 0x6f, 0x86, 0x4e, 0x1f, 0xe2, 0xd7, 0xdb, 0x1d, 0xae, 0x40, 0x36, 0x5c, 0x52, 0x05, 0xd0, 0x4b, 0xf4, 0xfd, 0x87, 0x4a, 0x10, 0xe6, 0x76, 0xa5, 0xc2, 0x34, 0x5d, 0x58, 0xa9, 0x31, 0x00, 0xd0, 0xc2, 0x88, 0x34, 0xcb, 0x0a, 0x22, 0xce, 0x84, 0x53, 0x61];
global SIG_EXPIRED: [u8; 64] = [0x6d, 0x61, 0xed, 0x23, 0x87, 0xa5, 0x2f, 0xbf, 0x1f, 0x0d, 0xb8, 0xe3, 0x87, 0xc5, 0x58, 0x2d, 0x31, 0x90, 0xcf, 0x3a, 0x14, 0x7c, 0x1d, 0x19, 0x2d, 0xe7, 0x2b, 0x45, 0xb7, 0xb1, 0xa8, 0x10, 0x3a, 0xa6, 0xe1, 0xa2, 0x7b, 0x19, 0x2d, 0xe0, 0xda, 0x6f, 0x04, 0xb2, 0xc3, 0xef, 0x11, 0xa0, 0x7b, 0x49, 0x3b, 0xff, 0xe9, 0x21, 0xec, 0x96, 0xd6, 0xd5, 0xd3, 0xb0, 0x3a, 0x4b, 0xbc, 0x05];

// Far above any TXE default gas settings.
global CAP: u128 = 0xffffffffffffffffffffffffffffff;
global FUTURE: u64 = 4102444800;

unconstrained fn setup() -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();
    let user = env.create_contract_account();
    let sponsor = env.deploy("LedgerSponsor").with_public_initializer(
        user,
        LedgerSponsor::interface().constructor(SIGNER_FIELDS[0], SIGNER_FIELDS[1], SIGNER_FIELDS[2], SIGNER_FIELDS[3], CAP),
    );
    (env, user, sponsor)
}

#[test]
unconstrained fn digest_matches_the_server_bytes() {
    // sha256("HL-SPONSOR-V2\0\0\0" || 0x..1234 || 1 || 2070860440 || 1 || 4102444800 as u64 BE), computed with Node.
    let d = voucher_digest(0x1234, 1, 2070860440, 1, FUTURE);
    assert(d[0] == 0xdd);
    assert(d[1] == 0xea);
    assert(d[31] == 0x9d);
}

unconstrained fn binding(env: TestEnvironment, user: AztecAddress, sponsor: AztecAddress) -> [Field; 3] {
    env.execute_utility_opts(ExecuteUtilityOptions::new().with_from(user), LedgerSponsor::at(sponsor).voucher_binding())
}

// Prints what a voucher for the TXE instance must name, so scripts/aztec/sponsor-test-vectors.mjs can
// sign the exact bytes. The address is deterministic for a fresh TestEnvironment (checked below).
#[test]
unconstrained fn the_binding_names_this_instance_and_network() {
    let (env, user, sponsor) = setup();
    let b = binding(env, user, sponsor);
    let instance = b[0];
    let chain = b[1];
    let version = b[2];
    std::println(f"[SPONSOR-V2 binding] address {instance} chain {chain} version {version}");
    assert(b[0] == sponsor.to_field());
    let (env2, user2, sponsor2) = setup();
    assert(sponsor2 == sponsor, "TXE sponsor address is not deterministic");
    let b2 = binding(env2, user2, sponsor2);
    assert((b2[1] == b[1]) & (b2[2] == b[2]));
}

// TXE runs a test call in the revertible phase, so the fee-payer election itself cannot succeed
// here (in a real transaction the fee payment call runs first, in setup). Reaching that assertion
// proves every check before it passed: expiry, signer, signature, fee cap and the voucher nullifier.
#[test(should_fail_with = "fee payer must be elected during the setup phase")]
unconstrained fn a_valid_voucher_passes_every_check_up_to_the_fee_payer_election() {
    let (env, user, sponsor) = setup();
    env.call_private(user, LedgerSponsor::at(sponsor).sponsor(1, FUTURE, SIGNER_X, SIGNER_Y, SIG_V1));
}

#[test(should_fail_with = "LedgerSponsor: bad signature")]
unconstrained fn a_signature_for_another_voucher_is_refused() {
    let (env, user, sponsor) = setup();
    env.call_private(user, LedgerSponsor::at(sponsor).sponsor(3, FUTURE, SIGNER_X, SIGNER_Y, SIG_V1));
}

#[test(should_fail_with = "LedgerSponsor: voucher expired")]
unconstrained fn an_expired_voucher_is_refused() {
    let (env, user, sponsor) = setup();
    env.call_private(user, LedgerSponsor::at(sponsor).sponsor(2, 1, SIGNER_X, SIGNER_Y, SIG_EXPIRED));
}

#[test(should_fail_with = "LedgerSponsor: unknown signer")]
unconstrained fn another_key_is_refused() {
    let (env, user, sponsor) = setup();
    env.call_private(user, LedgerSponsor::at(sponsor).sponsor(1, FUTURE, SIGNER_Y, SIGNER_X, SIG_V1));
}
