// contracts/aztec/streams/src/main.nr
// Humanity Ledger Protocol — PaymentStream (Aztec v6.0.0 Native Contract)
//
// ══════════════════════════════════════════════════════════════════════════════
// DESIGN: Continuous Payment Stream with Anchor-Block Accrual
// ══════════════════════════════════════════════════════════════════════════════
//
// A stream locks `total` tokens and releases them at `rate` tokens-per-second
// starting at `start` (unix timestamp). The recipient calls withdraw() to pull
// accrued tokens at any time. Each withdrawal pops the old StreamNote and
// emits a new one with updated `withdrawn` — preserving stream continuity.
//
// Accrual formula (all arithmetic in u128 to prevent overflow):
//   accrued = (anchor_ts - start) * rate
//   claimable = min(accrued, total) - withdrawn
//
// ══════════════════════════════════════════════════════════════════════════════
// SECURITY PROPERTIES
// ══════════════════════════════════════════════════════════════════════════════
//
//   [SEC-S1] NULLIFIER PER WITHDRAWAL STATE — Each StreamNote emission
//            produces a unique nullifier bound to the note hash via PrivateSet.
//            After pop_notes(), the old note is nullified; the new note gets a
//            fresh hash. An adversary cannot replay a prior withdrawal.
//
//   [SEC-S2] NHK-DERIVED NULLIFIER — The Aztec kernel derives the nullifier
//            using request_nhk_app() + domain separation. An adversary cannot
//            compute the nullifier without the recipient's spending key.
//
//   [SEC-S3] ANCHOR TIMESTAMP LOWER BOUND — Read from get_anchor_block_header().
//            The sequencer guarantees the actual inclusion timestamp is at least
//            the anchor timestamp. Accrual is conservative: recipient cannot
//            claim unaccrued tokens.
//
//   [SEC-S4] U128 OVERFLOW PROTECTION — All arithmetic uses u128. Intermediate
//            products are bounded to u128::MAX.
//
//   [SEC-S5] NO CANCEL (removed 3 Nov 2026) — the first version's cancel()
//            popped notes from the sender's set, where no stream note exists,
//            so it could never succeed. A sender cancel needs its own note and
//            a nullifier shared with withdrawals; open design question (R-09).
//
//   [SEC-S10] ONE STREAM PER CALL — withdraw selects the note by `salt` (the
//            stream id) with limit 1. The first version popped up to 16 notes
//            and used the first, destroying the recipient's other streams.
//
//   [SEC-S6] TOKEN CUSTODY — Tokens pulled and transferred via private token calls.
//
//   [SEC-S7] START TIME GUARD — create_stream asserts start <= anchor_ts.
//
//   [SEC-S8] RATE & TOTAL POSITIVE — Both asserted > 0 at stream creation.
//
//   [SEC-S9] EXPIRATION BOUNDING — set_expiration_timestamp bounds inclusion window.
//
//   [SEC-S11] OVERFLOW-FREE ACCRUAL (4 Nov 2026) — accrual is capped before
//            multiplying, so a large rate can no longer overflow u128 and lock
//            a stream. create_stream also refuses a stream to oneself.
//
//   [SEC-S12] SENDER CANCEL (5 Nov 2026) — every stream state has an index and
//            a state nullifier H(salt, sender, recipient, index) emitted by
//            both withdraw and cancel, so a state is either withdrawn from or
//            cancelled, never both. Withdrawals deliver a copy of the next
//            state to the sender, who cancels from the latest copy. Accrual is
//            measured at the anchor block and a cancel must land within
//            600 s of it, so an old anchor withholds at most 600 * rate from
//            the recipient. Closes the SEC-S5 gap above.
// ══════════════════════════════════════════════════════════════════════════════

use aztec::macros::aztec;

mod test;

#[aztec]
pub contract PaymentStream {
    use aztec::{
        macros::{
            functions::{external, initializer, view},
            notes::note,
            storage::storage,
        },
        messages::delivery::MessageDelivery,
        note::{note_getter_options::{NoteGetterOptions, SortOrder}, note_interface::NoteProperties},
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

    global TRANSFER_IN_PRIVATE_SELECTOR: FunctionSelector =
        FunctionSelector::from_signature("transfer_in_private((Field),(Field),u128,Field)");

    // Separator of the per-state nullifier shared by withdraw and cancel
    // (SEC-S12). Distinct from every separator in contracts/aztec.
    global DOM_SEP__STREAM_STATE: u32 = 718293051;
    // A cancel measures accrual at its anchor block, which the sender's PXE
    // picks. Bounding how long after its anchor a cancel can land bounds what
    // an old anchor can withhold from the recipient: at most
    // CANCEL_MAX_TX_LIFETIME * rate (SEC-S12).
    global CANCEL_MAX_TX_LIFETIME: u64 = 600;

    // ─── StreamNote Definition ───────────────────────────────────────────────
    #[derive(Deserialize, Eq, Packable, Serialize)]
    #[note]
    pub struct StreamNote {
        pub sender: AztecAddress,
        pub recipient: AztecAddress,
        pub total: u128,
        pub rate: u128,
        pub start: u64,
        pub withdrawn: u128,
        pub salt: Field,
        /// State index: 0 at creation, +1 on every withdrawal.
        pub index: u32,
    }

    // ─── Storage ─────────────────────────────────────────────────────────────
    #[storage]
    struct Storage<Context> {
        stream_notes: Owned<PrivateSet<StreamNote, Context>, Context>,
        /// The sender's copy of each stream state, so the sender can cancel.
        sender_copies: Owned<PrivateSet<StreamNote, Context>, Context>,
        token: PublicImmutable<AztecAddress, Context>,
    }

    // ─── Constructor ─────────────────────────────────────────────────────────
    #[initializer]
    #[external("public")]
    fn constructor(token_address: AztecAddress) {
        self.storage.token.initialize(token_address);
    }

    // ─── External Private Functions ───────────────────────────────────────────

    /// Create a new payment stream locking `total` tokens at `rate` tokens/sec.
    #[external("private")]
    fn create_stream(
        recipient: AztecAddress,
        total: u128,
        rate: u128,
        start: u64,
        salt: Field,
        authwit_nonce: Field,
    ) {
        let sender = self.msg_sender();
        let anchor_ts = self.context.get_anchor_block_header().timestamp() as u64;

        assert(sender != recipient, "PaymentStream: self-stream forbidden");
        assert(total > 0, "PaymentStream: zero total");
        assert(rate > 0, "PaymentStream: zero rate");
        assert(start <= anchor_ts, "PaymentStream: start in future");

        // Pull tokens into payment stream contract via private call
        let token_addr = self.storage.token.read();
        let _ = self.context.call_private_function(
            token_addr,
            TRANSFER_IN_PRIVATE_SELECTOR,
            [sender.to_field(), self.context.this_address().to_field(), total as Field, authwit_nonce],
        );

        let note = StreamNote {
            sender,
            recipient,
            total,
            rate,
            start,
            withdrawn: 0,
            salt,
            index: 0,
        };

        self.storage.stream_notes.at(recipient).insert(note)
            .deliver(MessageDelivery::onchain_constrained());
        self.storage.sender_copies.at(sender).insert(note)
            .deliver(MessageDelivery::onchain_constrained());
    }

    /// Withdraw accrued tokens from the recipient's active stream.
    #[external("private")]
    fn withdraw(salt: Field, amount: u128) {
        let recipient = self.msg_sender();
        let anchor_ts = self.context.get_anchor_block_header().timestamp() as u64;

        // Bound transaction lifetime to prevent replay in distant blocks
        self.context.set_expiration_timestamp(anchor_ts + 1800);

        let notes = self.storage.stream_notes.at(recipient).pop_notes(
            NoteGetterOptions::new()
                .select(StreamNote::properties().salt, Comparator.EQ, salt)
                .set_limit(1),
        );
        assert(notes.len() > 0, "PaymentStream: no active stream note found");

        let note = notes.get_unchecked(0);

        // SEC-S12: one state nullifier per stream state, also emitted by
        // cancel. After a cancel at this state, this withdrawal cannot land.
        self.context.push_nullifier_unsafe(
            poseidon2_hash_with_separator(
                [note.salt, note.sender.to_field(), recipient.to_field(), note.index as Field],
                DOM_SEP__STREAM_STATE,
            ),
        );

        // Conservative accrual, capped at the total without overflow: once
        // elapsed > total / rate the stream is fully accrued, and below that
        // bound elapsed * rate <= total. Multiplying first could overflow u128
        // for a large rate and make every later withdrawal fail, locking the
        // stream's funds (SEC-S11).
        let elapsed = (anchor_ts - note.start) as u128;
        let total_claimable = if elapsed > note.total / note.rate {
            note.total
        } else {
            elapsed * note.rate
        };
        let claimable = total_claimable - note.withdrawn;

        assert(amount > 0, "PaymentStream: zero withdrawal");
        assert(amount <= claimable, "PaymentStream: insufficient accrued balance");

        let new_withdrawn = note.withdrawn + amount;

        // If stream is not yet completely drained, emit the next state to the
        // recipient, and a copy to the sender so that the sender can cancel it.
        if new_withdrawn < note.total {
            let updated_note = StreamNote {
                sender: note.sender,
                recipient,
                total: note.total,
                rate: note.rate,
                start: note.start,
                withdrawn: new_withdrawn,
                salt: note.salt,
                index: note.index + 1,
            };
            self.storage.stream_notes.at(recipient).insert(updated_note)
                .deliver(MessageDelivery::onchain_constrained());
            self.storage.sender_copies.at(note.sender).insert(updated_note)
                .deliver(MessageDelivery::onchain_constrained());
        }

        // Release accrued tokens to recipient
        let token_addr = self.storage.token.read();
        let _ = self.context.call_private_function(
            token_addr,
            TRANSFER_IN_PRIVATE_SELECTOR,
            [self.context.this_address().to_field(), recipient.to_field(), amount as Field, 0],
        );
    }

    // ─── Utility ─────────────────────────────────────────────────────────────

    #[external("public")]
    #[view]
    fn get_token() -> pub AztecAddress {
        self.storage.token.read()
    }

    /// Cancel a stream: the recipient is paid what has accrued and not yet
    /// been withdrawn, and the sender gets the rest back.
    ///
    /// The sender uses its copy of the latest stream state. Cancel and
    /// withdraw emit the same state nullifier (SEC-S12), so for any state only
    /// one of them can land: a withdrawal after a cancel fails, and a cancel
    /// from an outdated copy fails because that state's withdrawal already
    /// emitted the nullifier. Selecting the highest index is a hint to the
    /// PXE, not a constraint; soundness rests on the nullifier.
    #[external("private")]
    fn cancel(salt: Field) {
        let sender = self.msg_sender();
        let anchor_ts = self.context.get_anchor_block_header().timestamp() as u64;
        self.context.set_expiration_timestamp(anchor_ts + CANCEL_MAX_TX_LIFETIME);

        let copies = self.storage.sender_copies.at(sender).pop_notes(
            NoteGetterOptions::new()
                .select(StreamNote::properties().salt, Comparator.EQ, salt)
                .sort(StreamNote::properties().index, SortOrder.DESC)
                .set_limit(1),
        );
        assert(copies.len() > 0, "PaymentStream: stream not found");
        let note = copies.get_unchecked(0);
        assert(note.sender == sender, "PaymentStream: only the sender can cancel");

        self.context.push_nullifier_unsafe(
            poseidon2_hash_with_separator(
                [note.salt, sender.to_field(), note.recipient.to_field(), note.index as Field],
                DOM_SEP__STREAM_STATE,
            ),
        );

        // Accrued at the anchor block, with the same overflow-free cap as withdraw.
        let elapsed = (anchor_ts - note.start) as u128;
        let accrued = if elapsed > note.total / note.rate {
            note.total
        } else {
            elapsed * note.rate
        };
        let to_recipient = accrued - note.withdrawn;
        let to_sender = note.total - accrued;

        let token_addr = self.storage.token.read();
        if to_recipient > 0 {
            let _ = self.context.call_private_function(
                token_addr,
                TRANSFER_IN_PRIVATE_SELECTOR,
                [self.context.this_address().to_field(), note.recipient.to_field(), to_recipient as Field, 0],
            );
        }
        if to_sender > 0 {
            let _ = self.context.call_private_function(
                token_addr,
                TRANSFER_IN_PRIVATE_SELECTOR,
                [self.context.this_address().to_field(), sender.to_field(), to_sender as Field, 0],
            );
        }
    }
}
