// LedgerSponsor: pays the network fee of a transaction for a Ledger Chat user who has no Fee Juice,
// once per voucher, up to a fixed maximum fee. Proposal P1 in docs/MAINNET_READINESS.md.
//
// Why vouchers: an unconditional sponsor (like the testnet SponsoredFPC) pays for anyone's
// transactions and is drained by the first script that finds it. Here the Ledger Chat server
// decides who is sponsored (signed-in wallets, a few transactions each, a daily ceiling) and signs a
// one-use voucher; this contract checks the signature against the key fixed at deployment, burns the
// voucher with a nullifier, refuses a transaction whose maximum fee exceeds the cap, and only then
// elects itself fee payer. The voucher is not bound to an account (account deployment runs before
// the account exists); a leaked voucher pays for at most one capped transaction.
//
// Funding: bridge AZTEC through the FeeJuicePortal to this contract's address and claim it. To change
// the key or the cap, deploy a new instance and move the funds.

use aztec::macros::aztec;

pub mod voucher;
mod test;

#[aztec]
pub contract LedgerSponsor {
    use aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol::{
            abis::function_selector::FunctionSelector, constants::FEE_JUICE_ADDRESS,
            hash::poseidon2_hash_with_separator, traits::ToField,
        },
        state_vars::PublicImmutable,
    };
    use crate::voucher::{halves, voucher_digest};

    global DOM_SEP__VOUCHER: u32 = 718293101;
    global MAX_TX_LIFETIME: u64 = 3600;
    global FEE_JUICE_CLAIM_SELECTOR: FunctionSelector =
        FunctionSelector::from_signature("claim((Field),u128,Field,Field)");

    #[storage]
    struct Storage<Context> {
        // The sponsor key's public coordinates, each as two 16-byte halves.
        x_hi: PublicImmutable<Field, Context>,
        x_lo: PublicImmutable<Field, Context>,
        y_hi: PublicImmutable<Field, Context>,
        y_lo: PublicImmutable<Field, Context>,
        // The largest maximum fee (gas limits x max fees per gas) this contract pays for one transaction.
        max_fee: PublicImmutable<u128, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(x_hi: Field, x_lo: Field, y_hi: Field, y_lo: Field, max_fee: u128) {
        assert((x_hi != 0) | (x_lo != 0), "LedgerSponsor: zero key");
        assert(max_fee > 0, "LedgerSponsor: zero cap");
        self.storage.x_hi.initialize(x_hi);
        self.storage.x_lo.initialize(x_lo);
        self.storage.y_hi.initialize(y_hi);
        self.storage.y_lo.initialize(y_lo);
        self.storage.max_fee.initialize(max_fee);
    }

    /// Claims Fee Juice bridged from Ethereum to this contract's address (FeeJuicePortal deposit with
    /// this contract as recipient). Anyone holding the deposit's secret may call it; the Fee Juice can
    /// only ever land on this contract.
    #[external("private")]
    fn fund(amount: u128, secret: Field, message_leaf_index: Field) {
        let _ = self.context.call_private_function(
            FEE_JUICE_ADDRESS,
            FEE_JUICE_CLAIM_SELECTOR,
            [self.context.this_address().to_field(), amount as Field, secret, message_leaf_index],
        );
    }

    /// Called first in a transaction (setup phase). Pays its fee if the voucher is valid and unused.
    #[external("private")]
    fn sponsor(voucher_id: Field, expires_at: u64, signer_x: [u8; 32], signer_y: [u8; 32], signature: [u8; 64]) {
        let anchor_ts = self.context.get_anchor_block_header().timestamp() as u64;
        assert(voucher_id != 0, "LedgerSponsor: zero voucher");
        assert(expires_at > anchor_ts, "LedgerSponsor: voucher expired");

        let (x_hi, x_lo) = halves(signer_x);
        let (y_hi, y_lo) = halves(signer_y);
        assert(
            (x_hi == self.storage.x_hi.read()) & (x_lo == self.storage.x_lo.read())
                & (y_hi == self.storage.y_hi.read()) & (y_lo == self.storage.y_lo.read()),
            "LedgerSponsor: unknown signer",
        );
        let digest = voucher_digest(voucher_id, expires_at);
        assert(
            std::ecdsa_secp256k1::verify_signature(signer_x, signer_y, signature, digest),
            "LedgerSponsor: bad signature",
        );

        // Compared as Fields: a huge fee must not wrap around a u128 cast.
        let settings = self.context.gas_settings();
        let max_fee = settings.gas_limits.compute_fee(settings.max_fees_per_gas);
        let cap = self.storage.max_fee.read() as Field;
        assert(max_fee.lt(cap) | (max_fee == cap), "LedgerSponsor: fee above cap");

        // One use per voucher: a second transaction with the same id is rejected by the node.
        self.context.push_nullifier_unsafe(poseidon2_hash_with_separator([voucher_id], DOM_SEP__VOUCHER));

        let latest = anchor_ts + MAX_TX_LIFETIME;
        self.context.set_expiration_timestamp(if expires_at < latest { expires_at } else { latest });
        self.context.set_as_fee_payer();
        self.context.end_setup();
    }
}
