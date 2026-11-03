// contracts/aztec/escrow/src/main.nr
// Humanity Ledger Protocol — PrivateEscrow (Aztec v6.0.0 Native Contract)
//
// ══════════════════════════════════════════════════════════════════════════════
// SECURITY THREAT MODEL: Nation-State / Lazarus Group Adversary
// ══════════════════════════════════════════════════════════════════════════════
//
// Security invariants enforced at the circuit level:
//   [SEC-1]  COMMITMENT BINDING — EscrowNote commitment binds
//            (sender, recipient, amount, deadline, claim_secret_hash, salt).
//   [SEC-2]  NULLIFIER DOMAIN SEPARATION — Every note nullifier emitted by
//            PrivateSet::pop_notes is siloed and derived with nhk_app.
//   [SEC-3]  CLAIM-SECRET BINDING — Recipient must reveal `claim_secret`
//            such that poseidon2([claim_secret], DOM_SEP) == claim_secret_hash.
//   [SEC-4]  TEMPORAL INTEGRITY — Expiration timestamp bounds transaction lifetime.
//            Claim requires anchor_ts <= deadline; refund requires anchor_ts > deadline.
//   [SEC-5]  TOKEN CUSTODY via Private Calls — Tokens are transferred via
//            transfer_in_private on the protocol token contract.
//   [SEC-6]  ONCHAIN CONSTRAINED DELIVERY — Delivery to recipient is
//            MessageDelivery::onchain_constrained().
//   [SEC-7]  AMOUNT RANGE — All amounts are u128 (overflow-safe).
//   [SEC-8]  NO SELF-DEAL — Prohibits sender == recipient.
// ══════════════════════════════════════════════════════════════════════════════

use aztec::macros::aztec;

#[aztec]
contract PrivateEscrow {
    use aztec::{
        macros::{
            functions::{external, initializer, view},
            notes::note,
            storage::storage,
        },
        messages::delivery::MessageDelivery,
        note::note_getter_options::NoteGetterOptions,
        protocol::{
            abis::function_selector::FunctionSelector,
            address::AztecAddress,
            hash::poseidon2_hash_with_separator,
            traits::{Deserialize, Packable, Serialize, ToField},
        },
        state_vars::{Owned, PrivateSet, PublicImmutable},
    };
    use std::cmp::Eq;

    global DOM_SEP__CLAIM_SECRET: u32 = 718293041;
    global TRANSFER_IN_PRIVATE_SELECTOR: FunctionSelector =
        FunctionSelector::from_signature("transfer_in_private((Field),(Field),u128,Field)");

    // ─── Note Definition ─────────────────────────────────────────────────────
    #[derive(Deserialize, Eq, Packable, Serialize)]
    #[note]
    pub struct EscrowNote {
        pub sender: AztecAddress,
        pub recipient: AztecAddress,
        pub amount: u128,
        pub deadline: u64,
        pub claim_secret_hash: Field,
        pub salt: Field,
    }

    // ─── Storage ─────────────────────────────────────────────────────────────
    #[storage]
    struct Storage<Context> {
        escrow_notes: Owned<PrivateSet<EscrowNote, Context>, Context>,
        token: PublicImmutable<AztecAddress, Context>,
    }

    // ─── Constructor ─────────────────────────────────────────────────────────
    #[initializer]
    #[external("public")]
    fn constructor(token_address: AztecAddress) {
        self.storage.token.initialize(token_address);
    }

    // ─── External Private Functions ───────────────────────────────────────────

    /// Deposit tokens into conditional escrow for recipient.
    #[external("private")]
    fn deposit(
        recipient: AztecAddress,
        amount: u128,
        deadline: u64,
        claim_secret_hash: Field,
        salt: Field,
        authwit_nonce: Field,
    ) {
        let sender = self.msg_sender();
        assert(sender != recipient, "PrivateEscrow: self-deposit forbidden");
        assert(amount > 0, "PrivateEscrow: zero amount");

        self.context.set_expiration_timestamp(deadline);

        // Pull tokens from sender into this contract via private call
        let token_addr = self.storage.token.read();
        let _ = self.context.call_private_function(
            token_addr,
            TRANSFER_IN_PRIVATE_SELECTOR,
            [sender.to_field(), self.context.this_address().to_field(), amount as Field, authwit_nonce],
        );

        let note = EscrowNote {
            sender,
            recipient,
            amount,
            deadline,
            claim_secret_hash,
            salt,
        };

        // Deliver note to recipient with onchain constrained delivery
        self.storage.escrow_notes.at(recipient).insert(note)
            .deliver(MessageDelivery::onchain_constrained());
    }

    /// Claim escrowed tokens by revealing the claim secret preimage.
    #[external("private")]
    fn claim(claim_secret: Field, amount: u128) {
        let claimer = self.msg_sender();
        let anchor_ts = self.context.get_anchor_block_header().timestamp() as u64;

        let notes = self.storage.escrow_notes.at(claimer).pop_notes(NoteGetterOptions::new());
        assert(notes.len() > 0, "PrivateEscrow: no escrow note found");

        let note = notes.get_unchecked(0);

        // Verify claim secret preimage
        let expected_hash = poseidon2_hash_with_separator([claim_secret], DOM_SEP__CLAIM_SECRET);
        assert(expected_hash == note.claim_secret_hash, "PrivateEscrow: invalid claim secret");

        // Enforce timelock validity
        assert(anchor_ts <= note.deadline, "PrivateEscrow: escrow expired");
        assert(note.amount == amount, "PrivateEscrow: amount mismatch");

        // Release tokens to claimer
        let token_addr = self.storage.token.read();
        let _ = self.context.call_private_function(
            token_addr,
            TRANSFER_IN_PRIVATE_SELECTOR,
            [self.context.this_address().to_field(), claimer.to_field(), amount as Field, 0],
        );
    }

    /// Refund tokens to sender after deadline has elapsed.
    #[external("private")]
    fn refund(amount: u128) {
        let sender = self.msg_sender();
        let anchor_ts = self.context.get_anchor_block_header().timestamp() as u64;

        let notes = self.storage.escrow_notes.at(sender).pop_notes(NoteGetterOptions::new());
        assert(notes.len() > 0, "PrivateEscrow: no escrow note for refund");

        let note = notes.get_unchecked(0);

        // Refund is only available strictly after deadline
        assert(anchor_ts > note.deadline, "PrivateEscrow: timelock active");
        assert(note.sender == sender, "PrivateEscrow: not the depositor");
        assert(note.amount == amount, "PrivateEscrow: amount mismatch");

        // Return tokens to depositor
        let token_addr = self.storage.token.read();
        let _ = self.context.call_private_function(
            token_addr,
            TRANSFER_IN_PRIVATE_SELECTOR,
            [self.context.this_address().to_field(), sender.to_field(), amount as Field, 0],
        );
    }

    // ─── Utility ─────────────────────────────────────────────────────────────

    #[external("public")]
    #[view]
    fn get_token() -> pub AztecAddress {
        self.storage.token.read()
    }
}
