// TXE tests for LedgerSponsor (aztec test). Signatures were made off-chain with a fixed test-only
// key (11..11), over the V2 digest defined in voucher.nr for the TXE instance
// 0x11ff7071e585e2ac7ffab17511d9d8cb919c6975d059e98670e294572c6975b8, chain 1, version 1;
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
global SIG_V2: [u8; 64] = [0x17, 0xde, 0xef, 0x32, 0x96, 0x50, 0xdd, 0x97, 0xa4, 0xf9, 0x1a, 0x5a, 0x9b, 0x0d, 0xd1, 0xe9, 0x7e, 0x3a, 0x5b, 0x34, 0xa4, 0x34, 0x59, 0x96, 0x80, 0xb5, 0x5e, 0x39, 0x7a, 0x90, 0xe4, 0x7b, 0x26, 0xa0, 0x7d, 0x22, 0x59, 0x80, 0xa3, 0x86, 0xff, 0x09, 0x18, 0x5d, 0x7d, 0x69, 0xb8, 0xc9, 0x7a, 0xfc, 0xcd, 0x2f, 0xab, 0xb5, 0x82, 0x9d, 0xb2, 0x47, 0x10, 0x3a, 0xae, 0x42, 0x17, 0x8d];
// A V1 voucher (digest without instance and network) for the same id and expiry, signed by the same key.
global SIG_V1_OLD: [u8; 64] = [0x20, 0xbd, 0x3a, 0xda, 0xfc, 0x4e, 0x36, 0x07, 0xb0, 0xb4, 0x77, 0x9c, 0x95, 0xab, 0x1f, 0x4d, 0x7d, 0x4c, 0x17, 0x95, 0x10, 0x28, 0x6f, 0x86, 0x4e, 0x1f, 0xe2, 0xd7, 0xdb, 0x1d, 0xae, 0x40, 0x36, 0x5c, 0x52, 0x05, 0xd0, 0x4b, 0xf4, 0xfd, 0x87, 0x4a, 0x10, 0xe6, 0x76, 0xa5, 0xc2, 0x34, 0x5d, 0x58, 0xa9, 0x31, 0x00, 0xd0, 0xc2, 0x88, 0x34, 0xcb, 0x0a, 0x22, 0xce, 0x84, 0x53, 0x61];
global SIG_V2_EXPIRED: [u8; 64] = [0x57, 0x9e, 0x81, 0x27, 0xdf, 0xf2, 0x2b, 0xba, 0x7f, 0xf0, 0xc8, 0x70, 0xb3, 0x48, 0x1e, 0x81, 0xf9, 0x23, 0xff, 0x18, 0x05, 0xf8, 0x66, 0x9e, 0xce, 0x4d, 0x14, 0x6b, 0x9d, 0x4f, 0x23, 0x2d, 0x52, 0x44, 0xc3, 0x97, 0x11, 0x59, 0x5a, 0x15, 0xb7, 0x0f, 0xa0, 0xd0, 0xa3, 0x06, 0x44, 0x89, 0x1a, 0xd6, 0x98, 0x61, 0x4e, 0xc0, 0x7a, 0x74, 0xbd, 0xe7, 0x82, 0xdf, 0xa6, 0x08, 0x56, 0xaa];

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
global TXE_INSTANCE: Field = 0x11ff7071e585e2ac7ffab17511d9d8cb919c6975d059e98670e294572c6975b8;

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

#[test(should_fail_with = "LedgerSponsor: zero voucher")]
unconstrained fn voucher_id_zero_is_refused() {
    let (env, user, sponsor) = setup();
    env.call_private(user, LedgerSponsor::at(sponsor).sponsor(0, FUTURE, SIGNER_X, SIGNER_Y, SIG_V2));
}

// The constructor refuses a deployment that could never pay (no key) or never refuse (no cap).
#[test(should_fail_with = "LedgerSponsor: zero key")]
unconstrained fn the_constructor_refuses_a_zero_key() {
    let mut env = TestEnvironment::new();
    let user = env.create_contract_account();
    let _ = env.deploy("LedgerSponsor").with_public_initializer(
        user,
        LedgerSponsor::interface().constructor(0, 0, SIGNER_FIELDS[2], SIGNER_FIELDS[3], CAP),
    );
}

#[test(should_fail_with = "LedgerSponsor: zero cap")]
unconstrained fn the_constructor_refuses_a_zero_cap() {
    let mut env = TestEnvironment::new();
    let user = env.create_contract_account();
    let _ = env.deploy("LedgerSponsor").with_public_initializer(
        user,
        LedgerSponsor::interface().constructor(SIGNER_FIELDS[0], SIGNER_FIELDS[1], SIGNER_FIELDS[2], SIGNER_FIELDS[3], 0),
    );
}

// Not covered in TXE, and why:
// - the phase change: TXE stops at the fee-payer election (above), before end_setup, so a missing
//   #[allow_phase_change] passes every TXE test and fails every real transaction ("Phase change
//   detected", Alpha, 15 Nov 2026). test/unit/aztec/phase-change.test.ts checks the attribute on every
//   private function that ends the setup phase.
// - "fee above cap": the vectors are signed for the instance deployed with CAP; an instance with a
//   small cap has another address, so its vouchers would need new vectors from a TXE run. The check's
//   place and its Field comparison are pinned by test/unit/aztec/ledger-sponsor.test.ts.
// - a voucher used twice: TXE runs the call in the revertible phase, so the first use reverts at the
//   fee-payer election and its nullifier is never kept. On Alpha the node rejects the duplicate
//   nullifier; docs/SPONSOR.md lists it in the checks after deployment.
