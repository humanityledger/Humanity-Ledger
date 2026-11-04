// contracts/aztec/test_token/src/main.nr
//
// TEST ONLY — never deploy. A minimal private-balance token for the TXE tests
// of PrivateEscrow and PaymentStream. It exposes the one function those
// contracts call, `transfer_in_private((Field),(Field),u128,Field)`, with the
// same authwit rule as a standard token (`from` may call with nonce 0; anyone
// else needs `from`'s authwit for exactly these arguments). Unlike a real
// token, `mint_to_private` has no access control.

use aztec::macros::aztec;

#[aztec]
pub contract TestToken {
    use aztec::{
        macros::{functions::{authorize_once, external}, storage::storage},
        messages::delivery::MessageDelivery,
        protocol::address::AztecAddress,
        state_vars::Owned,
    };
    use balance_set::BalanceSet;

    #[storage]
    struct Storage<Context> {
        balances: Owned<BalanceSet<Context>, Context>,
    }

    /// Anyone can mint (test only).
    #[external("private")]
    fn mint_to_private(to: AztecAddress, amount: u128) {
        self.storage.balances.at(to).add(amount).deliver(MessageDelivery::onchain_constrained());
    }

    #[authorize_once("from", "authwit_nonce")]
    #[external("private")]
    fn transfer_in_private(from: AztecAddress, to: AztecAddress, amount: u128, authwit_nonce: Field) {
        self.storage.balances.at(from).sub(amount).deliver(MessageDelivery::onchain_constrained());
        self.storage.balances.at(to).add(amount).deliver(MessageDelivery::onchain_constrained());
    }

    #[external("utility")]
    unconstrained fn balance_of_private(owner: AztecAddress) -> u128 {
        self.storage.balances.at(owner).balance_of()
    }
}
