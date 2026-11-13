// TXE tests for LedgerSponsor (aztec test). Signatures were made off-chain with a fixed test-only
// key (11..11), over the V2 digest defined in voucher.nr for the TXE instance
// 0x2c8dac6596b1ce2388c87d0a989c823d0a9ed527a9e18d6abdd5ee7daea4fab3, chain 1, version 1;
// see scripts/aztec/sponsor-test-vectors.mjs.

use crate::LedgerSponsor;
use crate::voucher::voucher_digest;
use aztec::{
    protocol::{address::AztecAddress, traits::ToField},
    test::helpers::test_environment::{ExecuteUtilityOptions, TestEnvironment},
};

global SIGNER_X: [u8; 32] = [0x4f, 0x35, 0x5b, 0xdc, 0xb7, 0xcc, 0x0a, 0xf7, 0x28, 0xef, 0x3c, 0xce, 0xb9, 0x61, 0x5d, 0x90, 0x68, 0x4b, 0xb5, 0xb2, 0xca, 0x5f, 0x85, 0x9a, 0xb0, 0xf0, 0xb7, 0x04, 0x07, 0x58, 0x71, 0xaa];
global SIGNER_Y: [u8; 32] = [0x38, 0x5b, 0x6b, 0x1b, 0x8e, 0xad, 0x80, 0x9c, 0xa6, 0x74, 0x54, 0xd9, 0x68, 0x3f, 0xcf, 0x2b, 0xa0, 0x34, 0x56, 0xd6, 0xfe, 0x2c, 0x4a, 0xbe, 0x2b, 0x07, 0xf0, 0xfb, 0xdb, 0xb2, 0xf1, 0xc1];
global SIGNER_FIELDS: [Field; 4] = [0x4f355bdcb7cc0af728ef3cceb9615d90, 0x684bb5b2ca5f859ab0f0b704075871aa, 0x385b6b1b8ead809ca67454d9683fcf2b, 0xa03456d6fe2c4abe2b07f0fbdbb2f1c1];
global SIG_V2: [u8; 64] = [0x7f, 0x7e, 0xd4, 0xe5, 0xad, 0x7b, 0x5f, 0xe0, 0x88, 0x06, 0xb1, 0x6b, 0xe6, 0xf0, 0x76, 0xb3, 0x89, 0x6a, 0x66, 0x30, 0xb7, 0xb8, 0xad, 0xd3, 0x70, 0x47, 0x57, 0xc8, 0x3e, 0x1d, 0xd1, 0xfb, 0x36, 0x6e, 0x2c, 0xe1, 0x5c, 0x0e, 0xbe, 0x98, 0x83, 0x07, 0xea, 0x91, 0x8b, 0xcf, 0x31, 0xbb, 0x5a, 0x85, 0x2c, 0x6c, 0x74, 0x17, 0x32, 0xc7, 0x09, 0x78, 0x29, 0xef, 0x87, 0x55, 0x59, 0x64];
// A V1 voucher (digest without instance and network) for the same id and expiry, signed by the same key.
global SIG_V1_OLD: [u8; 64] = [0x20, 0xbd, 0x3a, 0xda, 0xfc, 0x4e, 0x36, 0x07, 0xb0, 0xb4, 0x77, 0x9c, 0x95, 0xab, 0x1f, 0x4d, 0x7d, 0x4c, 0x17, 0x95, 0x10, 0x28, 0x6f, 0x86, 0x4e, 0x1f, 0xe2, 0xd7, 0xdb, 0x1d, 0xae, 0x40, 0x36, 0x5c, 0x52, 0x05, 0xd0, 0x4b, 0xf4, 0xfd, 0x87, 0x4a, 0x10, 0xe6, 0x76, 0xa5, 0xc2, 0x34, 0x5d, 0x58, 0xa9, 0x31, 0x00, 0xd0, 0xc2, 0x88, 0x34, 0xcb, 0x0a, 0x22, 0xce, 0x84, 0x53, 0x61];
global SIG_V2_EXPIRED: [u8; 64] = [0x57, 0xa1, 0x57, 0xaa, 0x44, 0x59, 0xa3, 0x21, 0x44, 0xb9, 0xcd, 0xc9, 0x21, 0x01, 0x59, 0xa0, 0xba, 0x11, 0x06, 0x23, 0xcc, 0x68, 0x49, 0x7d, 0xb1, 0x42, 0x37, 0x83, 0xae, 0x68, 0x8c, 0xca, 0x17, 0x48, 0xe5, 0xbf, 0xaa, 0xa7, 0x02, 0xfa, 0x1d, 0x63, 0x2a, 0xdf, 0xe9, 0xa0, 0xac, 0xee, 0xc9, 0xcc, 0x89, 0x7e, 0xad, 0x0a, 0x45, 0xf0, 0xd8, 0x6c, 0xc5, 0xc6, 0x47, 0x4b, 0xb7, 0x97];

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

// The vectors below are signed for this exact binding. A change to the contract (its class id) moves
// the TXE address: rerun scripts/aztec/sponsor-test-vectors.mjs with the address this test reports.
global TXE_INSTANCE: Field = 0x2c8dac6596b1ce2388c87d0a989c823d0a9ed527a9e18d6abdd5ee7daea4fab3;

#[test]
unconstrained fn the_binding_names_this_instance_and_network() {
    let (env, user, sponsor) = setup();
    let b = binding(env, user, sponsor);
    let instance = b[0];
    let chain = b[1];
    let version = b[2];
    assert(instance == sponsor.to_field());
    assert(instance == TXE_INSTANCE, f"TXE instance moved to {instance} (chain {chain}, version {version}): regenerate the vectors");
    assert((chain == 1) & (version == 1));
}

// TXE runs a test call in the revertible phase, so the fee-payer election itself cannot succeed
// here (in a real transaction the fee payment call runs first, in setup). Reaching that assertion
// proves every check before it passed: expiry, signer, signature, fee cap and the voucher nullifier.
#[test(should_fail_with = "fee payer must be elected during the setup phase")]
unconstrained fn a_valid_voucher_passes_every_check_up_to_the_fee_payer_election() {
    let (env, user, sponsor) = setup();
    env.call_private(user, LedgerSponsor::at(sponsor).sponsor(1, FUTURE, SIGNER_X, SIGNER_Y, SIG_V2));
}

#[test(should_fail_with = "LedgerSponsor: bad signature")]
unconstrained fn a_signature_for_another_voucher_is_refused() {
    let (env, user, sponsor) = setup();
    env.call_private(user, LedgerSponsor::at(sponsor).sponsor(3, FUTURE, SIGNER_X, SIGNER_Y, SIG_V2));
}

#[test(should_fail_with = "LedgerSponsor: voucher expired")]
unconstrained fn an_expired_voucher_is_refused() {
    let (env, user, sponsor) = setup();
    env.call_private(user, LedgerSponsor::at(sponsor).sponsor(2, 1, SIGNER_X, SIGNER_Y, SIG_V2_EXPIRED));
}

// SP-5: a voucher signed over the V1 digest (no instance, no network) no longer verifies.
#[test(should_fail_with = "LedgerSponsor: bad signature")]
unconstrained fn a_v1_voucher_is_refused() {
    let (env, user, sponsor) = setup();
    env.call_private(user, LedgerSponsor::at(sponsor).sponsor(1, FUTURE, SIGNER_X, SIGNER_Y, SIG_V1_OLD));
}

#[test(should_fail_with = "LedgerSponsor: unknown signer")]
unconstrained fn another_key_is_refused() {
    let (env, user, sponsor) = setup();
    env.call_private(user, LedgerSponsor::at(sponsor).sponsor(1, FUTURE, SIGNER_Y, SIGNER_X, SIG_V2));
}
