// TXE tests for IdentityCredential (run with `aztec test` after `aztec compile`).
// Master prompt task A.3: sanctions, authorised updates, one claim per scope.

use crate::IdentityCredential;
use aztec::{
    protocol::{address::AztecAddress, hash::poseidon2_hash_with_separator, traits::ToField},
    test::helpers::test_environment::TestEnvironment,
};

// Same separators as the contract.
global DOM_SEP__IDENTITY_COMMITMENT: u32 = 120938471;
global DOM_SEP__IDENTITY_LEAF: u32 = 238471092;
global DOM_SEP__MERKLE_NODE: u32 = 349582103;
global DOM_SEP__SANCTION_LIST: u32 = 461728390;

global SECRET: Field = 0x5ec2e7;
global SALT: Field = 0x5a17;
global SPAIN: u32 = 724;
global ONE_YEAR: u64 = 365 * 24 * 3600;

struct Setup {
    env: TestEnvironment,
    credential: AztecAddress,
    issuer: AztecAddress,
    user: AztecAddress,
    root: Field,
    expiry: u64,
}

unconstrained fn sanction_list(extra: Field) -> [Field; 16] {
    let mut list = [0; 16];
    list[0] = extra;
    list
}

unconstrained fn sanction_root(list: [Field; 16]) -> Field {
    poseidon2_hash_with_separator(list, DOM_SEP__SANCTION_LIST)
}

/// Root of a depth-32 tree whose leaf 0 is the user's credential and every
/// other node on the path is zero.
unconstrained fn credential_root(user: AztecAddress, jurisdiction: u32, expiry: u64) -> Field {
    let commitment = poseidon2_hash_with_separator([user.to_field(), SECRET], DOM_SEP__IDENTITY_COMMITMENT);
    let mut current = poseidon2_hash_with_separator(
        [commitment, jurisdiction as Field, expiry as Field, SALT],
        DOM_SEP__IDENTITY_LEAF,
    );
    for _ in 0..32 {
        current = poseidon2_hash_with_separator([current, 0], DOM_SEP__MERKLE_NODE);
    }
    current
}

unconstrained fn setup(jurisdiction: u32, extra_sanction: Field) -> Setup {
    let mut env = TestEnvironment::new();
    let issuer = env.create_light_account();
    let user = env.create_light_account();
    let expiry = env.last_block_timestamp() + ONE_YEAR;
    let root = credential_root(user, jurisdiction, expiry);
    let credential = env.deploy("IdentityCredential").with_public_initializer(
        issuer,
        IdentityCredential::interface().constructor(root, sanction_root(sanction_list(extra_sanction)), issuer),
    );
    Setup { env, credential, issuer, user, root, expiry }
}

unconstrained fn claim(s: Setup, scope: Field, jurisdiction: u32, expiry: u64, list: [Field; 16]) {
    let _ = s.env.call_private(
        s.user,
        IdentityCredential::at(s.credential).verify_and_claim(
            scope,
            s.root,
            SECRET,
            jurisdiction,
            expiry,
            SALT,
            0,
            [0; 32],
            list,
        ),
    );
}

#[test]
unconstrained fn valid_credential_claims_once_per_scope() {
    let s = setup(SPAIN, 250);
    claim(s, 1, SPAIN, s.expiry, sanction_list(250));
    // A different scope is a separate claim.
    claim(s, 2, SPAIN, s.expiry, sanction_list(250));
    assert(s.env.view_public(IdentityCredential::at(s.credential).get_current_root()) == s.root);
}

#[test(should_fail)]
unconstrained fn second_claim_in_the_same_scope_fails() {
    let s = setup(SPAIN, 250);
    claim(s, 7, SPAIN, s.expiry, sanction_list(250));
    claim(s, 7, SPAIN, s.expiry, sanction_list(250));
}

#[test(should_fail_with = "OFAC/FATF sanctioned jurisdiction [KP]")]
unconstrained fn fixed_sanction_floor_rejects_kp() {
    let s = setup(408, 250);
    claim(s, 1, 408, s.expiry, sanction_list(250));
}

#[test(should_fail_with = "IdentityCredential: sanctioned jurisdiction")]
unconstrained fn committed_sanction_list_rejects_a_member() {
    // 250 is not in the fixed floor, only in the committed list.
    let s = setup(250, 250);
    claim(s, 1, 250, s.expiry, sanction_list(250));
}

#[test(should_fail_with = "sanction list outdated")]
unconstrained fn proof_against_an_old_sanction_list_fails_after_an_update() {
    let s = setup(SPAIN, 250);
    s.env.call_public(s.issuer, IdentityCredential::at(s.credential).update_sanction_root(sanction_root(sanction_list(251))));
    claim(s, 1, SPAIN, s.expiry, sanction_list(250));
}

#[test]
unconstrained fn claim_against_the_updated_sanction_list_succeeds() {
    let s = setup(SPAIN, 250);
    s.env.call_public(s.issuer, IdentityCredential::at(s.credential).update_sanction_root(sanction_root(sanction_list(251))));
    claim(s, 1, SPAIN, s.expiry, sanction_list(251));
}

#[test(should_fail_with = "only issuer can update sanctions")]
unconstrained fn only_the_issuer_updates_the_sanction_list() {
    let s = setup(SPAIN, 250);
    s.env.call_public(s.user, IdentityCredential::at(s.credential).update_sanction_root(1));
}

#[test(should_fail_with = "only issuer can update root")]
unconstrained fn only_the_issuer_updates_the_root() {
    let s = setup(SPAIN, 250);
    s.env.call_public(s.user, IdentityCredential::at(s.credential).update_root(1));
}

#[test(should_fail_with = "root mismatch or expired")]
unconstrained fn proof_against_a_replaced_root_fails() {
    let s = setup(SPAIN, 250);
    s.env.call_public(s.issuer, IdentityCredential::at(s.credential).update_root(0x123));
    claim(s, 1, SPAIN, s.expiry, sanction_list(250));
}

#[test(should_fail_with = "invalid Merkle membership proof")]
unconstrained fn wrong_secret_is_not_a_member() {
    let s = setup(SPAIN, 250);
    let _ = s.env.call_private(
        s.user,
        IdentityCredential::at(s.credential).verify_and_claim(
            1, s.root, SECRET + 1, SPAIN, s.expiry, SALT, 0, [0; 32], sanction_list(250),
        ),
    );
}

#[test(should_fail_with = "credential expired")]
unconstrained fn expired_credential_fails() {
    let mut env = TestEnvironment::new();
    let issuer = env.create_light_account();
    let user = env.create_light_account();
    let expiry = env.last_block_timestamp() + 10;
    let root = credential_root(user, SPAIN, expiry);
    let credential = env.deploy("IdentityCredential").with_public_initializer(
        issuer,
        IdentityCredential::interface().constructor(root, sanction_root(sanction_list(250)), issuer),
    );
    env.mine_block_at(expiry + 100);
    let s = Setup { env, credential, issuer, user, root, expiry };
    claim(s, 1, SPAIN, expiry, sanction_list(250));
}
