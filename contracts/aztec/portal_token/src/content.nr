// Message contents shared with contracts/portal/AztecMessaging.sol (sha256ToField of the ABI encoding).

use aztec::protocol::hash::sha256_to_field;

/// sha256ToField(abi.encodeWithSignature("mint_to_private(uint256)", amount)), as HLPortal builds it.
pub fn mint_to_private_content(amount: u128) -> Field {
    // keccak256("mint_to_private(uint256)")[0..4]
    let selector: [u8; 4] = [0x8b, 0x3a, 0xf5, 0xe8];
    let amount_bytes: [u8; 32] = (amount as Field).to_be_bytes();
    let mut data = [0 as u8; 36];
    for i in 0..4 {
        data[i] = selector[i];
    }
    for i in 0..32 {
        data[4 + i] = amount_bytes[i];
    }
    sha256_to_field(data)
}

/// sha256ToField(abi.encodeWithSignature("withdraw(address,uint256,address)", recipient, amount, caller)).
pub fn withdraw_content(recipient: Field, amount: u128, caller_on_l1: Field) -> Field {
    // keccak256("withdraw(address,uint256,address)")[0..4]
    let selector: [u8; 4] = [0x69, 0x32, 0x8d, 0xec];
    let recipient_bytes: [u8; 32] = recipient.to_be_bytes();
    let amount_bytes: [u8; 32] = (amount as Field).to_be_bytes();
    let caller_bytes: [u8; 32] = caller_on_l1.to_be_bytes();
    let mut data = [0 as u8; 100];
    for i in 0..4 {
        data[i] = selector[i];
    }
    for i in 0..32 {
        data[4 + i] = recipient_bytes[i];
        data[36 + i] = amount_bytes[i];
        data[68 + i] = caller_bytes[i];
    }
    sha256_to_field(data)
}
