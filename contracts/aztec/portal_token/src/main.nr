// contracts/aztec/portal_token/src/main.nr
// Humanity Ledger Protocol — PortalToken (Aztec v6.0.0 contract)
//
// Status: experimental, UNCOMPILED in the session that wrote it (no Aztec toolchain there). The
// "Aztec contracts" workflow compiles it and runs src/test.nr. Not audited. Not deployed anywhere.
//
// One instance per L1 asset of contracts/portal/HLPortal.sol (DAI, USDC, USDT, WETH): the private
// Aztec side of the portal. It is the token and the bridge in one contract, so that:
//
//   claim_private     consumes the portal's L1->L2 message mint_to_private(amount) with the secret
//                     behind its secret hash, and credits `recipient`'s PRIVATE balance. The
//                     recipient is a private input: it is in no message and in no public state.
//                     The message nullifier is poseidon2(message_hash, secret): it cannot be tied to
//                     the message without the secret. There is NO public total supply, so a claim
//                     changes no public storage at all (a token whose mint updates a public supply
//                     would publish the amount at the moment of the claim).
//   transfer_in_private  the standard private transfer, same signature and authwit rule as the
//                     Aztec token, so the wallet and the agreement contracts can move it.
//   withdraw_private  burns a private balance and sends the L2->L1 message
//                     withdraw(recipient, amount, caller_on_l1) to the portal. NOTE: an L2->L1
//                     message is public: the L1 recipient and the amount are visible, attached to
//                     the transaction that burned them (docs/PORTAL.md §3).
//
// INVARIANT (with HLPortal I1): the sum of all private balances of an instance equals
// (amounts claimed) - (amounts withdrawn), and every amount claimed was locked on L1 by exactly one
// message; every amount withdrawn on L1 was burned here first. Nothing else mints or burns.
//
// No admin, no owner, no pause, no upgrade. The portal address and decimals are set at deployment.

use aztec::macros::aztec;

// The message contents live in their own module: at this level `aztec` names the macro imported
// above, so a path through the aztec crate does not resolve here.
pub mod content;
mod test;

#[aztec]
pub contract PortalToken {
    use aztec::{
        macros::{functions::{authorize_once, external, initializer}, storage::storage},
        messages::delivery::MessageDelivery,
        protocol::{address::{AztecAddress, EthAddress}, traits::ToField},
        state_vars::{Owned, PublicImmutable},
    };
    use balance_set::BalanceSet;

    #[storage]
    struct Storage<Context> {
        balances: Owned<BalanceSet<Context>, Context>,
        portal: PublicImmutable<EthAddress, Context>,
        decimals: PublicImmutable<u8, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(portal: EthAddress, decimals: u8) {
        assert(!portal.is_zero(), "PortalToken: zero portal");
        self.storage.portal.initialize(portal);
        self.storage.decimals.initialize(decimals);
    }

    /// Claims a private deposit of the portal into `recipient`'s private balance. Whoever knows
    /// `secret` can claim; the message carries no recipient. One claim per message (nullifier).
    #[external("private")]
    fn claim_private(recipient: AztecAddress, amount: u128, secret: Field, message_leaf_index: Field) {
        assert(amount > 0, "PortalToken: zero amount");
        let portal = self.storage.portal.read();
        let content = crate::content::mint_to_private_content(amount);
        self.context.consume_l1_to_l2_message(content, [secret], portal, message_leaf_index);
        self.storage.balances.at(recipient).add(amount).deliver(MessageDelivery::onchain_constrained());
    }

    #[authorize_once("from", "authwit_nonce")]
    #[external("private")]
    fn transfer_in_private(from: AztecAddress, to: AztecAddress, amount: u128, authwit_nonce: Field) {
        self.storage.balances.at(from).sub(amount).deliver(MessageDelivery::onchain_constrained());
        self.storage.balances.at(to).add(amount).deliver(MessageDelivery::onchain_constrained());
    }

    /// Burns `amount` from `from` and asks the portal to pay `recipient` on Ethereum. With
    /// `caller_on_l1` zero, anyone may execute the withdrawal on L1; otherwise only that address.
    #[authorize_once("from", "authwit_nonce")]
    #[external("private")]
    fn withdraw_private(
        from: AztecAddress,
        recipient: EthAddress,
        amount: u128,
        caller_on_l1: EthAddress,
        authwit_nonce: Field,
    ) {
        assert(amount > 0, "PortalToken: zero amount");
        assert(!recipient.is_zero(), "PortalToken: zero recipient");
        self.storage.balances.at(from).sub(amount).deliver(MessageDelivery::onchain_constrained());
        let portal = self.storage.portal.read();
        self.context.message_portal(
            portal,
            crate::content::withdraw_content(recipient.to_field(), amount, caller_on_l1.to_field()),
        );
    }

    #[external("utility")]
    unconstrained fn balance_of_private(owner: AztecAddress) -> u128 {
        self.storage.balances.at(owner).balance_of()
    }

    #[external("utility")]
    unconstrained fn portal_address() -> EthAddress {
        self.storage.portal.read()
    }
}
