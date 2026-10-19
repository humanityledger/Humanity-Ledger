// ==============================================================================
// zk.money Private Vault Contract for Aztec Network
// Architecture: Humanity Ledger Sovereign Privacy Messenger × Aztec Network
// Designed for native confidential payments within Ledger Chat
// ==============================================================================

contract ZkMoneyVault {
    use dep::aztec::prelude::{
        AztecAddress,
        FunctionSelector,
        PrivateContext,
        PublicContext,
        Context,
        NoteHeader,
        Map,
        PublicMutable,
    };
    use dep::value_note::{
        balance_utils,
        value_note::{ValueNote, VALUE_NOTE_LEN},
    };
    use dep::easy_private_state::EasyPrivateUint;

    // --- Storage layout ---
    struct Storage {
        // Balances of shielded accounts (stored as UTXO note trees)
        balances: Map<AztecAddress, EasyPrivateUint>,
        // Total shielded supply per token
        total_supply: PublicMutable<Field>,
        // Portal address on Ethereum L1
        portal_address: PublicMutable<Field>,
        // Admin address for contract upgrades
        admin: PublicMutable<AztecAddress>,
    }

    // --- Constructor ---
    #[aztec(private)]
    fn constructor(admin_address: AztecAddress, l1_portal: Field) {
        context.call_public_function(
            context.this_address(),
            FunctionSelector::from_signature("_init_public(AztecAddress,Field)"),
            [admin_address.to_field(), l1_portal]
        );
    }

    #[aztec(public)]
    internal fn _init_public(admin_address: AztecAddress, l1_portal: Field) {
        storage.admin.write(admin_address);
        storage.portal_address.write(l1_portal);
        storage.total_supply.write(0);
    }

    // --- Private Transfer (100% Confidential within Chat) ---
    // Transfers amount from msg_sender to recipient with hidden sender, recipient, and amount
    #[aztec(private)]
    fn transfer(recipient: AztecAddress, amount: Field) {
        let sender = context.msg_sender();
        
        // Decrement sender's note tree
        storage.balances.at(sender).sub(amount);

        // Increment recipient's note tree (encrypted with recipient's incoming viewing key)
        storage.balances.at(recipient).add(amount, recipient);
    }

    // --- Batch Private Transfer for Community Distributions & Freelance Milestones ---
    #[aztec(private)]
    fn batch_transfer(
        recipient_1: AztecAddress, amount_1: Field,
        recipient_2: AztecAddress, amount_2: Field,
        recipient_3: AztecAddress, amount_3: Field
    ) {
        // [H1 FIX]: Prevent Field arithmetic overflow
        amount_1.assert_max_bit_size::<120>();
        amount_2.assert_max_bit_size::<120>();
        amount_3.assert_max_bit_size::<120>();

        let sender = context.msg_sender();
        let total = amount_1 + amount_2 + amount_3;
        total.assert_max_bit_size::<120>();
        
        storage.balances.at(sender).sub(total);
        
        if amount_1 != 0 {
            storage.balances.at(recipient_1).add(amount_1, recipient_1);
        }
        if amount_2 != 0 {
            storage.balances.at(recipient_2).add(amount_2, recipient_2);
        }
        if amount_3 != 0 {
            storage.balances.at(recipient_3).add(amount_3, recipient_3);
        }
    }

    // --- Shielding: Deposit L1 Tokens into Aztec Shielded Notes ---
    // Consumes content commitment from L1 portal and mints private notes
    #[aztec(private)]
    fn shield(
        to: AztecAddress,
        amount: Field,
        secret_hash_for_l1_to_l2_message: Field
    ) {
        // [H1 FIX]: Enforce amount bounds to prevent wrap-around
        amount.assert_max_bit_size::<120>();

        // Consume L1 to L2 message from portal binding (to, amount, secret_hash)
        let content_hash = dep::aztec::hash::compute_message_hash([to.to_field(), amount, secret_hash_for_l1_to_l2_message]);
        context.consume_l1_to_l2_message(
            storage.portal_address.read(),
            content_hash,
            secret_hash_for_l1_to_l2_message
        );

        // Add private value note for recipient
        storage.balances.at(to).add(amount, to);

        // Increment public supply in rollup
        context.call_public_function(
            context.this_address(),
            FunctionSelector::from_signature("_increase_supply(Field)"),
            [amount]
        );
    }

    #[aztec(public)]
    internal fn _increase_supply(amount: Field) {
        let current = storage.total_supply.read();
        storage.total_supply.write(current + amount);
    }

    // --- Unshielding: Burn Shielded Notes and Send Outbox Message to L1 Portal ---
    #[aztec(private)]
    fn unshield(
        recipient_on_l1: Field,
        amount: Field
    ) {
        let sender = context.msg_sender();
        
        // Burn private notes from sender
        storage.balances.at(sender).sub(amount);

        // Send outbox message to Ethereum L1 portal
        context.message_portal(
            storage.portal_address.read(),
            recipient_on_l1,
            amount
        );

        // Decrement public supply
        context.call_public_function(
            context.this_address(),
            FunctionSelector::from_signature("_decrease_supply(Field)"),
            [amount]
        );
    }

    #[aztec(public)]
    internal fn _decrease_supply(amount: Field) {
        let current = storage.total_supply.read();
        assert(current >= amount, "insufficient supply");
        storage.total_supply.write(current - amount);
    }

    // --- Confidential Balance Query (Private Viewing Key only) ---
    unconstrained fn get_balance(owner: AztecAddress) -> pub Field {
        storage.balances.at(owner).view_notes()
    }

    // --- Public Queries ---
    unconstrained fn get_total_supply() -> pub Field {
        storage.total_supply.read()
    }

    unconstrained fn get_portal_address() -> pub Field {
        storage.portal_address.read()
    }
}
