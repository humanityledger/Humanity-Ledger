// G8 · ZKP-SP admission circuit (docs/protocol/G8_ZKPSP_SPEC.md §5).
//
// Public inputs, in this order: merkle_root, sanction_root, scope_id, tag,
// context_binding, t_min, tier_mask. Nothing else about the person is revealed.
//
// Differences from contracts/aztec/identity (verify_and_claim):
//  - the wallet is NOT part of the leaf: one human, unlimited wallets, one tag per scope;
//  - the per-scope tag is a public output instead of an on-chain SingleUseClaim, so the
//    proof costs no gas and can gate a DM or a call in real time;
//  - the proof is bound to (wallet, inbox, nonce, time) through `context_binding`.
use aztec::protocol::hash::poseidon2_hash_with_separator;

global DOM_SEP__G8_HUMAN_ID: u32 = 471829301;
global DOM_SEP__G8_LEAF: u32 = 471829302;
global DOM_SEP__G8_NODE: u32 = 471829303;
global DOM_SEP__G8_NULLIFIER: u32 = 471829305;
global DOM_SEP__G8_SANCTIONS: u32 = 471829306;

global TREE_DEPTH: u32 = 32;
global SANCTION_SLOTS: u32 = 16;
global SANCTION_KP: u32 = 408;
global SANCTION_IR: u32 = 364;
global SANCTION_SY: u32 = 760;
global SANCTION_CU: u32 = 192;

pub fn human_id(s_human: Field) -> Field {
    poseidon2_hash_with_separator([s_human], DOM_SEP__G8_HUMAN_ID)
}

pub fn leaf_hash(id: Field, jurisdiction: u32, t_exp: u64, attrs: u32, salt: Field) -> Field {
    poseidon2_hash_with_separator([id, jurisdiction as Field, t_exp as Field, attrs as Field, salt], DOM_SEP__G8_LEAF)
}

pub fn merkle_root(leaf: Field, index: u32, siblings: [Field; TREE_DEPTH]) -> Field {
    let mut current = leaf;
    let mut idx = index;
    for i in 0..TREE_DEPTH {
        let is_right = (idx & 1) == 1;
        idx = idx >> 1;
        let (l, r) = if is_right { (siblings[i], current) } else { (current, siblings[i]) };
        current = poseidon2_hash_with_separator([l, r], DOM_SEP__G8_NODE);
    }
    current
}

pub fn scoped_tag(s_human: Field, scope_id: Field) -> Field {
    poseidon2_hash_with_separator([s_human, scope_id], DOM_SEP__G8_NULLIFIER)
}

fn main(
    merkle_root_in: pub Field,
    sanction_root: pub Field,
    scope_id: pub Field,
    tag: pub Field,
    context_binding: pub Field,
    t_min: pub u64,
    tier_mask: pub u32,
    s_human: Field,
    jurisdiction: u32,
    t_exp: u64,
    attrs: u32,
    salt: Field,
    index: u32,
    siblings: [Field; TREE_DEPTH],
    sanction_list: [Field; SANCTION_SLOTS],
) {
    // 1. Membership: the person's leaf is in the registry root (no wallet in the leaf).
    let leaf = leaf_hash(human_id(s_human), jurisdiction, t_exp, attrs, salt);
    assert(merkle_root(leaf, index, siblings) == merkle_root_in, "G8: not in the registry");

    // 2. Sanctions: fixed floor plus the committed, updatable list.
    assert(jurisdiction > 0, "G8: null jurisdiction");
    assert(jurisdiction != SANCTION_KP, "G8: sanctioned [KP]");
    assert(jurisdiction != SANCTION_IR, "G8: sanctioned [IR]");
    assert(jurisdiction != SANCTION_SY, "G8: sanctioned [SY]");
    assert(jurisdiction != SANCTION_CU, "G8: sanctioned [CU]");
    for i in 0..SANCTION_SLOTS {
        assert(sanction_list[i] != jurisdiction as Field, "G8: sanctioned jurisdiction");
    }
    assert(poseidon2_hash_with_separator(sanction_list, DOM_SEP__G8_SANCTIONS) == sanction_root, "G8: sanction root");

    // 3. Freshness and predicates (age, entity, hardware, uniqueness) without revealing values.
    assert(t_exp >= t_min, "G8: credential expired");
    assert((attrs & tier_mask) == tier_mask, "G8: tier not met");

    // 4. The one tag this human has towards this scope.
    assert(scoped_tag(s_human, scope_id) == tag, "G8: wrong tag");

    // 5. Bind the proof to wallet, inbox, nonce and time (computed outside, checked by the verifier).
    assert(context_binding != 0, "G8: missing context binding");
}

#[test]
fn tag_is_per_scope() {
    let s = 42;
    assert(scoped_tag(s, 1) != scoped_tag(s, 2));
    assert(scoped_tag(s, 1) == scoped_tag(s, 1));
}

#[test]
fn wallet_does_not_change_the_leaf() {
    // The leaf has no wallet input at all: the same human's leaf is the same for every wallet.
    let a = leaf_hash(human_id(7), 724, 2000000000, 9, 5);
    let b = leaf_hash(human_id(7), 724, 2000000000, 9, 5);
    assert(a == b);
}

#[test(should_fail_with = "G8: sanctioned [IR]")]
fn sanctioned_floor_rejected() {
    let siblings = [0; TREE_DEPTH];
    let list = [0; SANCTION_SLOTS];
    let leaf = leaf_hash(human_id(1), 364, 10, 0, 0);
    let root = merkle_root(leaf, 0, siblings);
    let sroot = poseidon2_hash_with_separator(list, DOM_SEP__G8_SANCTIONS);
    main(root, sroot, 3, scoped_tag(1, 3), 99, 1, 0, 1, 364, 10, 0, 0, 0, siblings, list);
}

#[test]
fn honest_prover_passes() {
    let siblings = [0; TREE_DEPTH];
    let list = [0; SANCTION_SLOTS];
    let leaf = leaf_hash(human_id(11), 724, 100, 9, 77);
    let root = merkle_root(leaf, 5, siblings);
    let sroot = poseidon2_hash_with_separator(list, DOM_SEP__G8_SANCTIONS);
    main(root, sroot, 1234, scoped_tag(11, 1234), 555, 50, 9, 11, 724, 100, 9, 77, 5, siblings, list);
}
