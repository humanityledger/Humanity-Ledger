// ==============================================================================
// zk.money Multi-Milestone Shielded Escrow Contract
// Designed for Ledger Chat private freelance settlements & community bounties
// ==============================================================================

contract ZkEscrow {
    use dep::aztec::prelude::{
        AztecAddress,
        FunctionSelector,
        PrivateContext,
        PublicContext,
        Context,
        Map,
        PublicMutable,
    };

    struct MilestoneState {
        amount: Field,
        approved: bool,
        claimed: bool,
    }

    struct Storage {
        // Escrow state mapping: escrow_id -> state
        escrow_vault: PublicMutable<AztecAddress>, // ZkMoneyVault address
        sender: PublicMutable<AztecAddress>,
        recipient: PublicMutable<AztecAddress>,
        arbitrator: PublicMutable<AztecAddress>,
        total_amount: PublicMutable<Field>,
        released_amount: PublicMutable<Field>,
        status: PublicMutable<Field>, // 0: Locked, 1: Released, 2: Disputed, 3: Cancelled
        expiry_block: PublicMutable<Field>,
    }

    #[aztec(public)]
    #[aztec(initializer)]
    fn constructor(
        vault_address: AztecAddress,
        sender_addr: AztecAddress,
        recipient_addr: AztecAddress,
        arbitrator_addr: AztecAddress,
        amount: Field,
        expiry: Field
    ) {
        storage.escrow_vault.write(vault_address);
        storage.sender.write(sender_addr);
        storage.recipient.write(recipient_addr);
        storage.arbitrator.write(arbitrator_addr);
        storage.total_amount.write(amount);
        storage.released_amount.write(0);
        storage.status.write(0); // 0 = Locked
        storage.expiry_block.write(expiry);
    }

    // Sender or Arbitrator releases a milestone portion to recipient
    #[aztec(public)]
    fn release_milestone(amount: Field) {
        let caller = context.msg_sender();
        let s = storage.sender.read();
        let a = storage.arbitrator.read();
        assert((caller == s) | (caller == a), "unauthorized: must be sender or arbitrator");
        assert(storage.status.read() != 3, "escrow is cancelled");

        let released = storage.released_amount.read();
        let total = storage.total_amount.read();
        let new_released = released + amount;
        assert(new_released <= total, "release exceeds total amount");

        storage.released_amount.write(new_released);

        if new_released == total {
            storage.status.write(1); // 1 = Released
        }
    }

    // Sender or Recipient can raise a dispute
    #[aztec(public)]
    fn raise_dispute() {
        let caller = context.msg_sender();
        let s = storage.sender.read();
        let r = storage.recipient.read();
        assert((caller == s) | (caller == r), "unauthorized");
        assert(storage.status.read() == 0, "can only dispute locked escrow");

        storage.status.write(2); // 2 = Disputed
    }

    // Arbitrator resolves dispute with final allocation
    #[aztec(public)]
    fn resolve_dispute(refund_to_sender: Field, pay_to_recipient: Field) {
        let caller = context.msg_sender();
        assert(caller == storage.arbitrator.read(), "only arbitrator can resolve");
        assert(storage.status.read() == 2, "escrow not disputed");

        let total = storage.total_amount.read() - storage.released_amount.read();
        assert(refund_to_sender + pay_to_recipient == total, "resolution does not match remaining balance");

        storage.released_amount.write(storage.total_amount.read());
        storage.status.write(1); // Mark resolved
    }

    // Cancel escrow if expired and no milestones released
    #[aztec(public)]
    fn cancel_expired(current_block: Field) {
        assert(current_block > storage.expiry_block.read(), "not expired yet");
        assert(storage.released_amount.read() == 0, "milestones already released");
        storage.status.write(3); // 3 = Cancelled
    }

    unconstrained fn get_status() -> pub Field {
        storage.status.read()
    }

    unconstrained fn get_released_amount() -> pub Field {
        storage.released_amount.read()
    }

    unconstrained fn get_total_amount() -> pub Field {
        storage.total_amount.read()
    }
}
