// contracts/aztec/escrow/src/main.nr
// Humanity Ledger Protocol — PrivateEscrow (Aztec v6.0.0 contract)
//
// Status: experimental, compiled in CI (workflow "Aztec contracts"), no TXE
// tests yet, not deployed. Master prompt task R-08; review of the first version
// in docs/zk/AZTEC_CONTRACTS_REVIEW.md.
//
// Flow
//   deposit: the sender's tokens move to this contract; two copies of the same
//            EscrowNote are created, one owned by the recipient (claim) and one
//            owned by the sender (refund), identified by `escrow_id`.
//   claim:   the recipient pops its copy, reveals the claim secret and must be
//            included before the deadline.
//   refund:  the sender pops its copy after the deadline.
//   Both publish the same settlement nullifier, so an escrow settles once.
//
// Fixed from the first version (6c009e5a):
//   - refund popped notes from the sender's set, where no note existed, so a
//     refund could never succeed and unclaimed funds stayed locked;
//   - pop_notes without a selector popped up to 16 notes and used the first,
//     destroying the recipient's other escrows;
//   - deposit set the transaction expiration to the deadline, which Aztec
//     rejects when it is more than 24 h after the anchor block;
//   - claim only checked the anchor timestamp, so it could be included after
//     the deadline.
//
// Known limitation: this contract holds private token balances, so the PXE
// that executes claim/refund must be able to spend the contract's notes
// (contract deployed with public keys and its keys shared with the parties,
// as in the aztec-standards Escrow). That deployment path is not built yet.

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
        utils::comparison::Comparator,
    };
    use std::cmp::Eq;

    global DOM_SEP__CLAIM_SECRET: u32 = 718293041;
    global DOM_SEP__ESCROW_SETTLED: u32 = 718293042;
    // Upper bound for a claim's inclusion window; Aztec allows at most 24 h.
    global MAX_TX_LIFETIME: u64 = 3600;
    global TRANSFER_IN_PRIVATE_SELECTOR: FunctionSelector =
        FunctionSelector::from_signature("transfer_in_private((Field),(Field),u128,Field)");

    #[derive(Deserialize, Eq, Packable, Serialize)]
    #[note]
    pub struct EscrowNote {
        pub escrow_id: Field,
        pub sender: AztecAddress,
        pub recipient: AztecAddress,
        pub amount: u128,
        pub deadline: u64,
        pub claim_secret_hash: Field,
    }

    #[storage]
    struct Storage<Context> {
        claims: Owned<PrivateSet<EscrowNote, Context>, Context>,
        refunds: Owned<PrivateSet<EscrowNote, Context>, Context>,
        token: PublicImmutable<AztecAddress, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(token_address: AztecAddress) {
        self.storage.token.initialize(token_address);
    }

    /// Locks `amount` for `recipient` until `deadline`. `escrow_id` must be a
    /// fresh random value: it identifies the escrow and its settlement.
    #[external("private")]
    fn deposit(
        recipient: AztecAddress,
        amount: u128,
        deadline: u64,
        claim_secret_hash: Field,
        escrow_id: Field,
        authwit_nonce: Field,
    ) {
        let sender = self.msg_sender();
        let anchor_ts = self.context.get_anchor_block_header().timestamp() as u64;
        assert(sender != recipient, "PrivateEscrow: self-deposit forbidden");
        assert(amount > 0, "PrivateEscrow: zero amount");
        assert(deadline > anchor_ts, "PrivateEscrow: deadline in the past");
        assert(escrow_id != 0, "PrivateEscrow: zero escrow id");

        let token_addr = self.storage.token.read();
        let _ = self.context.call_private_function(
            token_addr,
            TRANSFER_IN_PRIVATE_SELECTOR,
            [sender.to_field(), self.context.this_address().to_field(), amount as Field, authwit_nonce],
        );

        let note = EscrowNote { escrow_id, sender, recipient, amount, deadline, claim_secret_hash };
        self.storage.claims.at(recipient).insert(note).deliver(MessageDelivery::onchain_constrained());
        self.storage.refunds.at(sender).insert(note).deliver(MessageDelivery::onchain_constrained());
    }

    /// The recipient claims before the deadline by revealing the claim secret.
    #[external("private")]
    fn claim(escrow_id: Field, claim_secret: Field) {
        let claimer = self.msg_sender();
        let anchor_ts = self.context.get_anchor_block_header().timestamp() as u64;

        let notes = self.storage.claims.at(claimer).pop_notes(
            NoteGetterOptions::new()
                .select(EscrowNote::properties().escrow_id, Comparator.EQ, escrow_id)
                .set_limit(1),
        );
        assert(notes.len() == 1, "PrivateEscrow: escrow not found");
        let note = notes.get(0);

        assert(
            poseidon2_hash_with_separator([claim_secret], DOM_SEP__CLAIM_SECRET) == note.claim_secret_hash,
            "PrivateEscrow: invalid claim secret",
        );

        // Included before the deadline: the anchor is in the past, and the
        // transaction expires no later than the deadline.
        assert(anchor_ts <= note.deadline, "PrivateEscrow: escrow expired");
        let latest = anchor_ts + MAX_TX_LIFETIME;
        self.context.set_expiration_timestamp(if note.deadline < latest { note.deadline } else { latest });

        // Settlement nullifier: same value for claim and refund, so only one lands.
        self.context.push_nullifier_unsafe(
            poseidon2_hash_with_separator(
                [note.escrow_id, note.sender.to_field(), note.recipient.to_field()],
                DOM_SEP__ESCROW_SETTLED,
            ),
        );

        let token_addr = self.storage.token.read();
        let _ = self.context.call_private_function(
            token_addr,
            TRANSFER_IN_PRIVATE_SELECTOR,
            [self.context.this_address().to_field(), claimer.to_field(), note.amount as Field, 0],
        );
    }

    /// The sender takes the funds back after the deadline.
    #[external("private")]
    fn refund(escrow_id: Field) {
        let sender = self.msg_sender();
        let anchor_ts = self.context.get_anchor_block_header().timestamp() as u64;

        let notes = self.storage.refunds.at(sender).pop_notes(
            NoteGetterOptions::new()
                .select(EscrowNote::properties().escrow_id, Comparator.EQ, escrow_id)
                .set_limit(1),
        );
        assert(notes.len() == 1, "PrivateEscrow: escrow not found");
        let note = notes.get(0);
        assert(note.sender == sender, "PrivateEscrow: not the depositor");

        // The anchor block is in the past, so now > deadline as well.
        assert(anchor_ts > note.deadline, "PrivateEscrow: deadline not reached");

        // Settlement nullifier: same value for claim and refund, so only one lands.
        self.context.push_nullifier_unsafe(
            poseidon2_hash_with_separator(
                [note.escrow_id, note.sender.to_field(), note.recipient.to_field()],
                DOM_SEP__ESCROW_SETTLED,
            ),
        );

        let token_addr = self.storage.token.read();
        let _ = self.context.call_private_function(
            token_addr,
            TRANSFER_IN_PRIVATE_SELECTOR,
            [self.context.this_address().to_field(), sender.to_field(), note.amount as Field, 0],
        );
    }

    #[external("public")]
    #[view]
    fn get_token() -> pub AztecAddress {
        self.storage.token.read()
    }
}
