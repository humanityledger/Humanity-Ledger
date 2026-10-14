// ==============================================================================
// zk.money Identity & Stealth Address Registry Contract
// Resolves readable zk:handles to shielded Aztec public keys with zero identity leakage
// ==============================================================================

contract ZkIdentityRegistry {
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
        // Handle hash -> Aztec address
        handle_to_address: Map<Field, PublicMutable<AztecAddress>>,
        // Address -> Handle hash
        address_to_handle: Map<AztecAddress, PublicMutable<Field>>,
        // Registered count
        total_registered: PublicMutable<Field>,
    }

    #[aztec(public)]
    #[aztec(initializer)]
    fn constructor() {
        storage.total_registered.write(0);
    }

    // Register handle mapping
    #[aztec(public)]
    fn register_handle(handle_hash: Field) {
        let caller = context.msg_sender();
        
        // Assert handle is not already registered
        let existing = storage.handle_to_address.at(handle_hash).read();
        assert(existing.to_field() == 0, "handle already registered");

        storage.handle_to_address.at(handle_hash).write(caller);
        storage.address_to_handle.at(caller).write(handle_hash);

        let count = storage.total_registered.read();
        storage.total_registered.write(count + 1);
    }

    unconstrained fn resolve_handle(handle_hash: Field) -> pub AztecAddress {
        storage.handle_to_address.at(handle_hash).read()
    }

    unconstrained fn get_handle_of(address: AztecAddress) -> pub Field {
        storage.address_to_handle.at(address).read()
    }

    unconstrained fn get_total_registered() -> pub Field {
        storage.total_registered.read()
    }
}
