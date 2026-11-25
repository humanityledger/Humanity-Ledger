// circuits/hl_lib/src/lib.nr
// Humanity Ledger Protocol — shared helpers for the v2 circuits.
//
// Closes gap G5 (Pedersen -> Poseidon2) and finding ZK-04 (no domain
// separation) for the v2 circuits:
// - Every hash is Poseidon2 over BN254 with a distinct domain separator as its
//   first input, so a leaf, a node, a nullifier and a commitment can never be
//   the same value by construction.
// - `poseidon2_hash` is the sponge used by noir-lang/poseidon `Poseidon2::hash`
//   (rate 3, capacity 1, IV = message length * 2^64) built directly on the
//   standard library permutation, so no external dependency is needed.
//   Equality with Aztec's `poseidon2_hash` has not been checked against a test
//   vector; soundness of these circuits does not depend on it.

// Domain separators: ASCII labels encoded as field elements.
pub global SEP_KEY: Field = 0x686c2e76322e6b6579; // "hl.v2.key"
pub global SEP_LEAF: Field = 0x686c2e76322e6c656166; // "hl.v2.leaf"
pub global SEP_NODE: Field = 0x686c2e76322e6e6f6465; // "hl.v2.node"
pub global SEP_SCOPE_NULLIFIER: Field = 0x686c2e76322e73636f70655f6e756c6c6966696572; // "hl.v2.scope_nullifier"
pub global SEP_SANCTION_LIST: Field = 0x686c2e76322e73616e6374696f6e5f6c697374; // "hl.v2.sanction_list"
pub global SEP_ESCROW: Field = 0x686c2e76322e657363726f77; // "hl.v2.escrow"
pub global SEP_ESCROW_SETTLED: Field = 0x686c2e76322e657363726f775f736574746c6564; // "hl.v2.escrow_settled"
pub global SEP_STREAM: Field = 0x686c2e76322e73747265616d; // "hl.v2.stream"
pub global SEP_STREAM_STATE: Field = 0x686c2e76322e73747265616d5f7374617465; // "hl.v2.stream_state"

global TWO_POW_64: Field = 18446744073709551616;

/// Poseidon2 sponge hash of a fixed-length input.
pub fn poseidon2_hash<let N: u32>(input: [Field; N]) -> Field {
    let mut state: [Field; 4] = [0, 0, 0, (N as Field) * TWO_POW_64];
    let mut cache_size: u32 = 0;
    for i in 0..N {
        if cache_size == 3 {
            state = std::hash::poseidon2_permutation(state);
            cache_size = 0;
        }
        state[cache_size] += input[i];
        cache_size += 1;
    }
    state = std::hash::poseidon2_permutation(state);
    state[0]
}

/// Public key hash of a secret. Parties are identified by this hash, not by a
/// curve point (gap G1 does not arise in v2).
pub fn key_of(secret: Field) -> Field {
    poseidon2_hash([SEP_KEY, secret])
}

/// Root of a binary Merkle path. `is_right[i]` is true when the running node is
/// the right child at level i.
pub fn merkle_root<let D: u32>(leaf: Field, siblings: [Field; D], is_right: [bool; D]) -> Field {
    let mut node = leaf;
    for i in 0..D {
        node = if is_right[i] {
            poseidon2_hash([SEP_NODE, siblings[i], node])
        } else {
            poseidon2_hash([SEP_NODE, node, siblings[i]])
        };
    }
    node
}

/// Commitment to a fixed-size list (used for the sanction list).
pub fn list_root<let N: u32>(list: [Field; N]) -> Field {
    poseidon2_hash([SEP_SANCTION_LIST, poseidon2_hash(list)])
}

/// Asserts `value` is not in `list`. Callers must forbid `value == 0` when the
/// list is padded with zeros.
pub fn assert_not_in<let N: u32>(value: Field, list: [Field; N]) {
    for i in 0..N {
        assert(list[i] != value);
    }
}

/// Roots of all-zero subtrees: zero_roots[i] is the root of an empty subtree of
/// height i (leaves are 0). Used by tests and tree builders.
pub fn zero_roots<let D: u32>() -> [Field; D] {
    let mut roots = [0; D];
    let mut node = 0;
    for i in 0..D {
        roots[i] = node;
        node = poseidon2_hash([SEP_NODE, node, node]);
    }
    roots
}

#[test]
fn separators_are_distinct() {
    let seps = [
        SEP_KEY, SEP_LEAF, SEP_NODE, SEP_SCOPE_NULLIFIER, SEP_SANCTION_LIST, SEP_ESCROW,
        SEP_ESCROW_SETTLED, SEP_STREAM, SEP_STREAM_STATE,
    ];
    for i in 0..9 {
        for j in 0..9 {
            if i != j {
                assert(seps[i] != seps[j]);
            }
        }
    }
}

#[test]
fn hash_depends_on_length_and_order() {
    assert(poseidon2_hash([1, 2]) != poseidon2_hash([2, 1]));
    assert(poseidon2_hash([1, 2]) != poseidon2_hash([1, 2, 0]));
    assert(poseidon2_hash([1, 2, 3, 4]) != poseidon2_hash([1, 2, 3, 5]));
}

#[test]
fn merkle_root_changes_with_position() {
    let siblings = [11, 22, 33];
    let left = merkle_root(7, siblings, [false, false, false]);
    let right = merkle_root(7, siblings, [true, false, false]);
    assert(left != right);
}

#[test(should_fail)]
fn assert_not_in_rejects_member() {
    assert_not_in(5, [1, 5, 9]);
}
