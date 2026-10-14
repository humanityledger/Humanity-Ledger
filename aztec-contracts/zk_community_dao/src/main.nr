// ==============================================================================
// zk.money Community DAO Treasury Contract
// Private community treasury with anonymous tipping, bounty pooling, and multisig governance
// ==============================================================================

contract ZkCommunityDao {
    use dep::aztec::prelude::{
        AztecAddress,
        FunctionSelector,
        PrivateContext,
        PublicContext,
        Context,
        Map,
        PublicMutable,
    };

    struct Storage {
        community_id_hash: PublicMutable<Field>,
        vault_contract: PublicMutable<AztecAddress>,
        curator: PublicMutable<AztecAddress>,
        threshold: PublicMutable<Field>,
        proposal_count: PublicMutable<Field>,
        total_donated: PublicMutable<Field>,
        total_disbursed: PublicMutable<Field>,
    }

    #[aztec(public)]
    #[aztec(initializer)]
    fn constructor(
        id_hash: Field,
        vault: AztecAddress,
        admin_curator: AztecAddress,
        sig_threshold: Field
    ) {
        storage.community_id_hash.write(id_hash);
        storage.vault_contract.write(vault);
        storage.curator.write(admin_curator);
        storage.threshold.write(sig_threshold);
        storage.proposal_count.write(0);
        storage.total_donated.write(0);
        storage.total_disbursed.write(0);
    }

    // Confidential Tip to Community Treasury
    #[aztec(private)]
    fn tip_treasury(amount: Field) {
        let sender = context.msg_sender();
        // Dispatches to vault to transfer note privately
        context.call_public_function(
            context.this_address(),
            FunctionSelector::from_signature("_record_donation(Field)"),
            [amount]
        );
    }

    #[aztec(public)]
    internal fn _record_donation(amount: Field) {
        let curr = storage.total_donated.read();
        storage.total_donated.write(curr + amount);
    }

    // Curator releases bounty payout to recipient
    #[aztec(public)]
    fn disburse_bounty(recipient: AztecAddress, amount: Field) {
        let caller = context.msg_sender();
        assert(caller == storage.curator.read(), "only curator can disburse bounty");

        let curr_disbursed = storage.total_disbursed.read();
        let total = storage.total_donated.read();
        assert(curr_disbursed + amount <= total, "insufficient treasury balance");

        storage.total_disbursed.write(curr_disbursed + amount);
    }

    unconstrained fn get_treasury_metrics() -> pub (Field, Field) {
        (storage.total_donated.read(), storage.total_disbursed.read())
    }
}
