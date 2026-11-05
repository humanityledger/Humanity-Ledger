// contracts/aztec/identity/src/main.nr
// Humanity Ledger Protocol — IdentityCredential (Aztec v6.0.0 Native Contract)
//
// ══════════════════════════════════════════════════════════════════════════════
// SECURITY PROPERTIES
// ══════════════════════════════════════════════════════════════════════════════
//
// Invariants enforced at the circuit level:
//   [SEC-I1] SCOPE-ISOLATED UNLINKABILITY — Claims are siloed by `scope_id`.
//            A nullifier or SingleUseClaim in Scope A carries zero cryptographic
//            correlation with Scope B. An adversary observing all claims cannot
//            link actions by the same physical human across different dApps/actions.
//
//   [SEC-I2] DOUBLE-SPEND / DOUBLE-ACTION IMMUNITY — SingleUseClaim per
//            (scope_id, user) ensures that within a given scope, a credential
//            can only be claimed or acted upon once. The Aztec kernel enforces
//            the nullifier collision check deterministically.
//
//   [SEC-I3] FULL DEPTH-32 MERKLE MEMBERSHIP — The credential membership
//            witness is proven against the committed Merkle root over 32 layers
//            (supporting 2^32 = 4,294,967,296 human identity commitments).
//            Leaves are leaf = poseidon2([identity_commitment, jurisdiction, expiry, salt]).
//
//   [SEC-I4] ZERO-KNOWLEDGE JURISDICTION & SANCTIONS ATTESTATION —
//            Sanctioned jurisdiction codes (e.g., ISO-3166-1 numeric 408 for KP,
//            364 for IR, etc.) are verified on-circuit to NOT match the credential's
//            jurisdiction, proving regulatory compliance without revealing the
//            user's actual jurisdiction or identity.
//
//   [SEC-I5] TEMPORAL FRESHNESS — Verifies that `expiry >= anchor_ts`,
//            preventing expired KYC/credentials from being reused.
//
//   [SEC-I6] ISSUER AUTHENTICATION — Only the issuer set at construction can
//            update the identity root or the sanction list. The issuer is a
//            single immutable address: it cannot be rotated (open limit).
//   [SEC-I7] EXPIRY BOUND (5 Nov 2026) — a claim's transaction expires no
//            later than the credential, so it cannot land after expiry.
// ══════════════════════════════════════════════════════════════════════════════

use aztec::macros::aztec;

mod test;

#[aztec]
pub contract IdentityCredential {
    // ─── Imports ─────────────────────────────────────────────────────────────
    use aztec::{
        macros::{
            functions::{external, initializer, only_self, view},
            storage::storage,
        },
        protocol::{
            address::AztecAddress,
            hash::poseidon2_hash_with_separator,
            traits::ToField,
        },
        state_vars::{Map, Owned, PublicImmutable, PublicMutable, SingleUseClaim},
    };

    // ─── Constants (u32 separators for poseidon2) ────────────────────────────
    global DOM_SEP__IDENTITY_COMMITMENT: u32 = 120938471;
    global DOM_SEP__IDENTITY_LEAF: u32       = 238471092;
    global DOM_SEP__MERKLE_NODE: u32         = 349582103;
    global MAX_TX_LIFETIME: u64 = 3600;

    // Sanctioned jurisdictions (ISO-3166-1 numeric standards)
    global SANCTION_KP_DPRK: u32 = 408; // Democratic People's Republic of Korea
    global SANCTION_IR_IRAN: u32 = 364; // Islamic Republic of Iran
    global SANCTION_SY_SYRIA: u32 = 760; // Syrian Arab Republic
    global SANCTION_CU_CUBA: u32 = 192; // Republic of Cuba

    // G2: governance-updatable sanction list, committed by `sanction_root`.
    // The four constants above stay as a floor (option C of
    // docs/zk/SANCTION_NON_MEMBERSHIP.md); the committed list adds to them
    // without redeploying. The list is zero-padded to SANCTION_SLOTS entries.
    global SANCTION_SLOTS: u32 = 16;
    global DOM_SEP__SANCTION_LIST: u32 = 461728390;

    // ─── Storage ─────────────────────────────────────────────────────────────
    #[storage]
    struct Storage<Context> {
        /// Map: scope_id -> user -> SingleUseClaim
        /// Enforces [SEC-I1] & [SEC-I2]: exactly one claim per user per scope.
        claims: Map<Field, Owned<SingleUseClaim<Context>, Context>, Context>,

        /// Publicly committed identity Merkle tree root.
        current_root: PublicMutable<Field, Context>,
        sanction_root: PublicMutable<Field, Context>,

        /// Master identity authority / issuer address.
        issuer: PublicImmutable<AztecAddress, Context>,
    }

    // ─── Constructor ─────────────────────────────────────────────────────────
    #[initializer]
    #[external("public")]
    fn constructor(initial_root: Field, initial_sanction_root: Field, issuer_address: AztecAddress) {
        self.storage.current_root.write(initial_root);
        self.storage.sanction_root.write(initial_sanction_root);
        self.storage.issuer.initialize(issuer_address);
    }

    // ─── Public Functions ────────────────────────────────────────────────────

    /// Update the current identity Merkle root. Only callable by the issuer.
    #[external("public")]
    fn update_root(new_root: Field) {
        let caller = self.msg_sender();
        let issuer = self.storage.issuer.read();
        assert(caller == issuer, "IdentityCredential: only issuer can update root");
        assert(new_root != 0, "IdentityCredential: empty root rejected");
        self.storage.current_root.write(new_root);
    }

    /// Replace the committed sanction list root. Only callable by the issuer.
    #[external("public")]
    fn update_sanction_root(new_root: Field) {
        let caller = self.msg_sender();
        assert(caller == self.storage.issuer.read(), "IdentityCredential: only issuer can update sanctions");
        self.storage.sanction_root.write(new_root);
    }

    /// Checks the sanction list a private proof used is the current one.
    /// Only this contract may call it (enqueued from verify_and_claim).
    #[external("public")]
    #[only_self]
    fn assert_valid_sanction_root(expected_root: Field) {
        assert(self.storage.sanction_root.read() == expected_root, "IdentityCredential: sanction list outdated");
    }

    /// Public assertion to bind private proofs against canonical contract root state.
    /// Only this contract may call it (enqueued from verify_and_claim).
    #[external("public")]
    #[only_self]
    fn assert_valid_root(expected_root: Field) {
        let active_root = self.storage.current_root.read();
        assert(active_root != 0, "IdentityCredential: identity root not set");
        assert(active_root == expected_root, "IdentityCredential: root mismatch or expired");
    }

    // ─── External Private Functions ───────────────────────────────────────────

    /// Zero-Knowledge Credential Verification and Scope Consumption.
    ///
    /// # Private Witness Arguments:
    /// * `secret`           — User's identity trapdoor secret.
    /// * `jurisdiction`     — ISO-3166-1 numeric jurisdiction code.
    /// * `expiry`           — Credential expiry unix timestamp.
    /// * `salt`             — Entropy salt committed into the credential leaf.
    /// * `leaf_index`       — 32-bit leaf index in the Merkle tree.
    /// * `siblings`         — 32 sibling node hashes along the Merkle authentication path.
    ///
    /// # Public Inputs:
    /// * `scope_id`         — The application or action scope identifier.
    /// * `merkle_root`      — The expected root against which membership is proven.
    ///
    /// # Security Guarantees:
    /// • [SEC-I1] Zero linkage between scopes (SingleUseClaim is partitioned by scope_id).
    /// • [SEC-I2] Duplicate claim within this scope fails immediately at kernel level.
    /// • [SEC-I3] Depth-32 Merkle root verified inside private SNARK.
    /// • [SEC-I4] Proof that jurisdiction is not on the sanction list (KP, IR, SY, CU).
    /// • [SEC-I5] Proof that credential has not expired relative to anchor block.
    #[external("private")]
    fn verify_and_claim(
        scope_id: Field,
        merkle_root: Field,
        secret: Field,
        jurisdiction: u32,
        expiry: u64,
        salt: Field,
        leaf_index: u32,
        siblings: [Field; 32],
        sanction_list: [Field; SANCTION_SLOTS],
    ) {
        let caller = self.msg_sender();

        // 1. [SEC-I5] Temporal verification: check against anchor block timestamp
        let anchor_ts = self.context.get_anchor_block_header().timestamp() as u64;
        assert(expiry >= anchor_ts, "IdentityCredential: credential expired");
        // [SEC-I7] The claim must also land before the credential expires: the
        // anchor block is in the past, so without this a claim proven just
        // before expiry could be included after it.
        let latest = anchor_ts + MAX_TX_LIFETIME;
        self.context.set_expiration_timestamp(if expiry < latest { expiry } else { latest });

        // 2. [SEC-I4] Sanctions verification: the jurisdiction is not on the fixed floor or the committed list
        assert(jurisdiction != SANCTION_KP_DPRK, "IdentityCredential: OFAC/FATF sanctioned jurisdiction [KP]");
        assert(jurisdiction != SANCTION_IR_IRAN, "IdentityCredential: OFAC/FATF sanctioned jurisdiction [IR]");
        assert(jurisdiction != SANCTION_SY_SYRIA, "IdentityCredential: OFAC/FATF sanctioned jurisdiction [SY]");
        assert(jurisdiction != SANCTION_CU_CUBA, "IdentityCredential: OFAC/FATF sanctioned jurisdiction [CU]");
        assert(jurisdiction > 0, "IdentityCredential: invalid null jurisdiction");

        // Committed, updatable sanction list (G2): not a member of it either.
        for i in 0..SANCTION_SLOTS {
            assert(sanction_list[i] != jurisdiction as Field, "IdentityCredential: sanctioned jurisdiction");
        }
        let sanction_root = poseidon2_hash_with_separator(sanction_list, DOM_SEP__SANCTION_LIST);

        // 3. Compute identity commitment: H(caller, secret)
        let identity_commitment = poseidon2_hash_with_separator(
            [caller.to_field(), secret],
            DOM_SEP__IDENTITY_COMMITMENT,
        );

        // 4. Compute leaf: H(commitment, jurisdiction, expiry, salt)
        let leaf = poseidon2_hash_with_separator(
            [
                identity_commitment,
                jurisdiction as Field,
                expiry as Field,
                salt,
            ],
            DOM_SEP__IDENTITY_LEAF,
        );

        // 5. [SEC-I3] Depth-32 binary Merkle root calculation
        let mut current = leaf;
        let mut idx = leaf_index;

        for i in 0..32 {
            let is_right = (idx & 1) == 1;
            idx = idx >> 1;

            let (left, right) = if is_right {
                (siblings[i], current)
            } else {
                (current, siblings[i])
            };

            current = poseidon2_hash_with_separator([left, right], DOM_SEP__MERKLE_NODE);
        }

        assert(current == merkle_root, "IdentityCredential: invalid Merkle membership proof");

        // 6. Enqueue public assertion that the proven root matches active contract state
        self.enqueue_self.assert_valid_root(merkle_root);
        self.enqueue_self.assert_valid_sanction_root(sanction_root);

        // 7. [SEC-I1] & [SEC-I2] Consume SingleUseClaim for this caller in this scope
        // This emits a deterministic nullifier tied to (scope_id, caller, contract).
        self.storage.claims.at(scope_id).at(caller).claim();
    }

    // ─── Utility & Views ─────────────────────────────────────────────────────

    #[external("public")]
    #[view]
    fn get_current_root() -> pub Field {
        self.storage.current_root.read()
    }

    #[external("public")]
    #[view]
    fn get_issuer() -> pub AztecAddress {
        self.storage.issuer.read()
    }
}
