// circuits/identity_v2/src/main.nr
// Humanity Ledger Protocol — anonymous identity with sanction screening, v2.
//
// Status: experimental, not pinned, not used by the app. See
// docs/zk/MASTER_PROMPT.md and docs/zk/V2_CIRCUITS.md. The long-term plan is
// an aztec-nr credential note with SingleUseClaim per scope (task R-10).
//
// What changes from v1 (circuits/identity):
// - G3: membership in a depth-32 tree instead of depth 1 (anonymity set up to
//   2^32 instead of 2). Closes ZK-05 (first half).
// - G2: the sanction list is a committed, updatable set: the prover supplies
//   the list privately and the circuit checks it hashes to the public
//   `sanction_root`, then checks the jurisdiction is not in it. Governance
//   changes the root, not the circuit. (Option B of the sanction design: a
//   bounded list of SANCTION_SLOTS entries, zero-padded.)
// - G5 / ZK-04: Poseidon2 with distinct domain separators for leaf, node and
//   nullifier, so a nullifier can never equal a leaf.
// - The leaf commits to a key hash of the secret, never to the secret itself.
//
// Still true: the jurisdiction in a leaf is whatever the issuer inserted. The
// circuit proves "the issuer's leaf for me carries a jurisdiction that is not on
// today's sanction list", not anything about the person beyond that.

use hl_lib::{assert_not_in, key_of, list_root, merkle_root, poseidon2_hash, zero_roots, SEP_LEAF, SEP_SCOPE_NULLIFIER};

global DEPTH: u32 = 32;
global SANCTION_SLOTS: u32 = 16;

fn leaf_of(identity_secret: Field, jurisdiction: Field) -> Field {
    poseidon2_hash([SEP_LEAF, key_of(identity_secret), jurisdiction])
}

fn scoped_nullifier_of(identity_secret: Field, scope: Field) -> Field {
    poseidon2_hash([SEP_SCOPE_NULLIFIER, identity_secret, scope])
}

fn main(
    // Private inputs
    identity_secret: Field,
    jurisdiction: Field,
    siblings: [Field; DEPTH],
    is_right: [bool; DEPTH],
    sanction_list: [Field; SANCTION_SLOTS],
    // Public inputs
    identity_root: pub Field,
    sanction_root: pub Field,
    scope: pub Field,
    scoped_nullifier: pub Field,
) {
    assert(identity_secret != 0);
    // 0 pads the sanction list, so it can never be a jurisdiction.
    assert(jurisdiction != 0);

    let leaf = leaf_of(identity_secret, jurisdiction);
    assert(merkle_root(leaf, siblings, is_right) == identity_root);

    assert(list_root(sanction_list) == sanction_root);
    assert_not_in(jurisdiction, sanction_list);

    assert(scoped_nullifier_of(identity_secret, scope) == scoped_nullifier);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

global SECRET: Field = 12345;
global SPAIN: Field = 724; // ISO 3166-1 numeric
global SCOPE: Field = 42;

fn sanctions(first: Field, second: Field) -> [Field; SANCTION_SLOTS] {
    let mut list = [0; SANCTION_SLOTS];
    list[0] = first;
    list[1] = second;
    list
}

/// A tree where our leaf sits at index 0 and every other leaf is empty.
fn empty_path() -> ([Field; DEPTH], [bool; DEPTH]) {
    (zero_roots(), [false; DEPTH])
}

/// Same tree, but our leaf sits at index 5 (binary 101).
fn path_at_index_5() -> ([Field; DEPTH], [bool; DEPTH]) {
    let mut is_right = [false; DEPTH];
    is_right[0] = true;
    is_right[2] = true;
    (zero_roots(), is_right)
}

fn prove(
    jurisdiction: Field,
    siblings: [Field; DEPTH],
    is_right: [bool; DEPTH],
    root: Field,
    list: [Field; SANCTION_SLOTS],
    sanction_root: Field,
    scope: Field,
    nullifier: Field,
) {
    main(SECRET, jurisdiction, siblings, is_right, list, root, sanction_root, scope, nullifier);
}

#[test]
fn valid_membership_at_index_0() {
    let (siblings, is_right) = empty_path();
    let root = merkle_root(leaf_of(SECRET, SPAIN), siblings, is_right);
    let list = sanctions(408, 364);
    prove(SPAIN, siblings, is_right, root, list, list_root(list), SCOPE, scoped_nullifier_of(SECRET, SCOPE));
}

#[test]
fn valid_membership_at_index_5() {
    let (siblings, is_right) = path_at_index_5();
    let root = merkle_root(leaf_of(SECRET, SPAIN), siblings, is_right);
    let list = sanctions(408, 364);
    prove(SPAIN, siblings, is_right, root, list, list_root(list), SCOPE, scoped_nullifier_of(SECRET, SCOPE));
}

#[test(should_fail)]
fn wrong_index_fails() {
    let (siblings, is_right) = path_at_index_5();
    let root = merkle_root(leaf_of(SECRET, SPAIN), siblings, is_right);
    let (_, wrong) = empty_path();
    let list = sanctions(408, 364);
    prove(SPAIN, siblings, wrong, root, list, list_root(list), SCOPE, scoped_nullifier_of(SECRET, SCOPE));
}

#[test(should_fail)]
fn wrong_sibling_fails() {
    let (siblings, is_right) = empty_path();
    let root = merkle_root(leaf_of(SECRET, SPAIN), siblings, is_right);
    let mut tampered = siblings;
    tampered[17] = 99;
    let list = sanctions(408, 364);
    prove(SPAIN, tampered, is_right, root, list, list_root(list), SCOPE, scoped_nullifier_of(SECRET, SCOPE));
}

#[test(should_fail)]
fn sanctioned_jurisdiction_fails() {
    let (siblings, is_right) = empty_path();
    let root = merkle_root(leaf_of(SECRET, SPAIN), siblings, is_right);
    let list = sanctions(408, SPAIN);
    prove(SPAIN, siblings, is_right, root, list, list_root(list), SCOPE, scoped_nullifier_of(SECRET, SCOPE));
}

#[test(should_fail)]
fn list_not_matching_the_public_root_fails() {
    // The prover tries to hide SPAIN's sanction by supplying an older list.
    let (siblings, is_right) = empty_path();
    let root = merkle_root(leaf_of(SECRET, SPAIN), siblings, is_right);
    let current = sanctions(408, SPAIN);
    let older = sanctions(408, 364);
    prove(SPAIN, siblings, is_right, root, older, list_root(current), SCOPE, scoped_nullifier_of(SECRET, SCOPE));
}

#[test(should_fail)]
fn other_jurisdiction_than_the_leaf_fails() {
    let (siblings, is_right) = empty_path();
    let root = merkle_root(leaf_of(SECRET, 408), siblings, is_right);
    let list = sanctions(408, 364);
    // Claims SPAIN, but the issuer's leaf says 408.
    prove(SPAIN, siblings, is_right, root, list, list_root(list), SCOPE, scoped_nullifier_of(SECRET, SCOPE));
}

#[test(should_fail)]
fn wrong_nullifier_fails() {
    let (siblings, is_right) = empty_path();
    let root = merkle_root(leaf_of(SECRET, SPAIN), siblings, is_right);
    let list = sanctions(408, 364);
    prove(SPAIN, siblings, is_right, root, list, list_root(list), SCOPE, scoped_nullifier_of(SECRET, 43));
}

#[test(should_fail)]
fn zero_jurisdiction_fails() {
    let (siblings, is_right) = empty_path();
    let root = merkle_root(leaf_of(SECRET, 0), siblings, is_right);
    let list = sanctions(408, 364);
    prove(0, siblings, is_right, root, list, list_root(list), SCOPE, scoped_nullifier_of(SECRET, SCOPE));
}

#[test]
fn nullifier_never_equals_leaf_even_when_scope_equals_jurisdiction() {
    // ZK-04: in v1, scope == jurisdiction made the nullifier equal the leaf.
    assert(scoped_nullifier_of(SECRET, SPAIN) != leaf_of(SECRET, SPAIN));
}

#[test]
fn nullifiers_differ_per_scope() {
    assert(scoped_nullifier_of(SECRET, 1) != scoped_nullifier_of(SECRET, 2));
}
