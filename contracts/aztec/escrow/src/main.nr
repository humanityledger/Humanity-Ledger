// contracts/aztec/escrow/src/main.nr
// Humanity Ledger Protocol — PrivateEscrow (Aztec v6.0.0 contract)
//
// Status: experimental. TXE tests in src/test.nr run in CI (workflow "Aztec
// contracts"); keyed instances run on Aztec testnet (workflow "Aztec escrow
// e2e (testnet)", receipts in docs/AZTEC_TESTNET_DEPLOYMENTS.md). Not audited.
// Review notes in docs/zk/AZTEC_CONTRACTS_REVIEW.md.
//
// Flow
//   deposit: the sender's tokens move to this contract; two copies of the same
//            EscrowNote are created, one owned by the recipient (claim) and one
//            owned by the sender (refund), identified by `escrow_id`.
//   claim:   the recipient pops its copy, reveals the claim secret and must be
//            included before the deadline.
//   refund:  the sender pops its copy after the deadline.
//   Both publish the same settlement nullifier, so an escrow settles once.
//   escrow_view (utility, runs in the caller's PXE, never proven): the terms
//            of an escrow as the contract stores them, and whether it has
//            settled, so a party can check an invitation against the note
//            instead of trusting the invitation's own fields.
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
// Custody: this contract holds private token balances, so it is deployed with
// its own keys, one instance per agreement, and the parties hold the secret
// (lib/aztec/keyed-deploy.ts, lib/aztec/agreements.ts).

use aztec::macros::aztec;

mod test;

#[aztec]
pub contract PrivateEscrow {
    use aztec::{
        macros::{
            functions::{external, initializer, view},
            notes::note,
            storage::storage,
        },
        messages::delivery::MessageDelivery,
        note::{
            note_getter_options::NoteGetterOptions, note_interface::NoteProperties,
            note_viewer_options::NoteViewerOptions,
        },
        oracle::nullifiers::check_nullifier_exists,
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

    /// What escrow_view returns. `note` is all zeros when `found` is false.
    #[derive(Deserialize, Serialize)]
    pub struct EscrowView {
        pub found: bool,
        pub settled: bool,
        pub note: EscrowNote,
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

        // The deposit must land before its own deadline: otherwise a delayed
        // transaction would create an escrow that is already refundable and
        // never claimable.
        let latest = anchor_ts + MAX_TX_LIFETIME;
        self.context.set_expiration_timestamp(if deadline < latest { deadline } else { latest });

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

    /// The escrow `escrow_id` as `owner`'s PXE holds it: the recipient's claim
    /// copy, or else the sender's refund copy, and whether the settlement
    /// nullifier exists. After a claim the recipient's copy is consumed, so the
    /// recipient sees `found == false`; the sender still sees its copy, with
    /// `settled == true`. Runs locally and is never proven: it informs the
    /// client, it does not authorise anything. Asking the node whether the
    /// settlement nullifier exists tells the node which nullifier this client
    /// is interested in, as any note sync does.
    #[external("utility")]
    unconstrained fn escrow_view(owner: AztecAddress, escrow_id: Field) -> EscrowView {
        let claims = self.storage.claims.at(owner).view_notes(
            NoteViewerOptions::new().select(EscrowNote::properties().escrow_id, Comparator.EQ, escrow_id).set_limit(1),
        );
        let notes = if claims.len() > 0 {
            claims
        } else {
            self.storage.refunds.at(owner).view_notes(
                NoteViewerOptions::new()
                    .select(EscrowNote::properties().escrow_id, Comparator.EQ, escrow_id)
                    .set_limit(1),
            )
        };
        if notes.len() == 0 {
            EscrowView {
                found: false,
                settled: false,
                note: EscrowNote {
                    escrow_id: 0,
                    sender: AztecAddress::zero(),
                    recipient: AztecAddress::zero(),
                    amount: 0,
                    deadline: 0,
                    claim_secret_hash: 0,
                },
            }
        } else {
            let note = notes.get(0);
            let settled = check_nullifier_exists(
                poseidon2_hash_with_separator(
                    [note.escrow_id, note.sender.to_field(), note.recipient.to_field()],
                    DOM_SEP__ESCROW_SETTLED,
                ),
            );
            EscrowView { found: true, settled, note }
        }
    }
}
