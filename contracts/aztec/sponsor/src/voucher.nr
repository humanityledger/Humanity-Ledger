// The voucher a Ledger Chat server signs so LedgerSponsor pays one transaction's fee.
//
//   digest = sha256( "HL-SPONSOR-V2" padded to 16 bytes
//                    || contract address (32 bytes, big-endian)
//                    || chain id (32 bytes) || rollup version (32 bytes)
//                    || voucher_id (32 bytes) || expires_at (8 bytes, big-endian) )
//
// signed with ECDSA over secp256k1 (low-s, 64 bytes r || s) by the sponsor key whose public key
// was fixed at deployment. The server reproduces exactly these bytes (lib/aztec/sponsor-voucher.ts).
//
// V2 (finding SP-5, docs/security/AUDIT_2026-11-13.md): the digest names the sponsor instance, the
// chain and the rollup version. A V1 voucher covered only the id and the expiry, so it paid once on
// every instance that trusted the same key (a testnet and a mainnet instance, or an old and a new one
// during a key rotation). A V2 voucher is valid on exactly one instance of one network.

pub global TAG: [u8; 16] = [0x48, 0x4c, 0x2d, 0x53, 0x50, 0x4f, 0x4e, 0x53, 0x4f, 0x52, 0x2d, 0x56, 0x32, 0, 0, 0];

pub fn voucher_digest(contract: Field, chain_id: Field, version: Field, voucher_id: Field, expires_at: u64) -> [u8; 32] {
    let c: [u8; 32] = contract.to_be_bytes();
    let ch: [u8; 32] = chain_id.to_be_bytes();
    let v: [u8; 32] = version.to_be_bytes();
    let id: [u8; 32] = voucher_id.to_be_bytes();
    let mut msg: [u8; 152] = [0; 152];
    for i in 0..16 {
        msg[i] = TAG[i];
    }
    for i in 0..32 {
        msg[16 + i] = c[i];
        msg[48 + i] = ch[i];
        msg[80 + i] = v[i];
        msg[112 + i] = id[i];
    }
    for i in 0..8 {
        let shift: u64 = ((7 - i) * 8) as u64;
        msg[144 + i] = ((expires_at >> shift) & 0xff) as u8;
    }
    sha256::digest(msg)
}

/// A 32-byte coordinate as two 16-byte big-endian halves (each fits in a Field).
pub fn halves(b: [u8; 32]) -> (Field, Field) {
    let mut hi: Field = 0;
    let mut lo: Field = 0;
    for i in 0..16 {
        hi = hi * 256 + b[i] as Field;
        lo = lo * 256 + b[16 + i] as Field;
    }
    (hi, lo)
}
