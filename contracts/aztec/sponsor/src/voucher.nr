// The voucher a Ledger Chat server signs so LedgerSponsor pays one transaction's fee.
//
//   digest = sha256( "HL-SPONSOR-V1" padded to 16 bytes || voucher_id (32 bytes, big-endian)
//                    || expires_at (8 bytes, big-endian) )
//
// signed with ECDSA over secp256k1 (low-s, 64 bytes r || s) by the sponsor key whose public key
// was fixed at deployment. The server reproduces exactly these bytes (lib/aztec/sponsor-voucher.ts).

pub global TAG: [u8; 16] = [0x48, 0x4c, 0x2d, 0x53, 0x50, 0x4f, 0x4e, 0x53, 0x4f, 0x52, 0x2d, 0x56, 0x31, 0, 0, 0];

pub fn voucher_digest(voucher_id: Field, expires_at: u64) -> [u8; 32] {
    let id: [u8; 32] = voucher_id.to_be_bytes();
    let mut msg: [u8; 56] = [0; 56];
    for i in 0..16 {
        msg[i] = TAG[i];
    }
    for i in 0..32 {
        msg[16 + i] = id[i];
    }
    for i in 0..8 {
        let shift: u8 = ((7 - i) * 8) as u8;
        msg[48 + i] = ((expires_at >> shift) & 0xff) as u8;
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
