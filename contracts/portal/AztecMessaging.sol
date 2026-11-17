// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AztecMessaging
 * @notice The parts of Aztec's L1 messaging the Humanity Ledger portal uses, written against the
 *         Aztec v6.0.0 interfaces (aztec-packages tag v6.0.0, l1-contracts/src/core/interfaces/
 *         messagebridge/IInbox.sol and IOutbox.sol, libraries/DataStructures.sol, crypto/Hash.sol).
 *         Only the members called here are declared. `Epoch` is a uint256 user-defined type in
 *         Aztec, so it is a uint256 in the ABI.
 */
library AztecMessaging {
    /// BN254 scalar field modulus: a secret hash and every message content must be below it.
    uint256 internal constant FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct L1Actor {
        address actor;
        uint256 chainId;
    }

    struct L2Actor {
        bytes32 actor;
        uint256 version;
    }

    struct L2ToL1Msg {
        L2Actor sender;
        L1Actor recipient;
        bytes32 content;
    }

    /// sha256 truncated to 31 bytes, so the value fits a field element (Aztec Hash.sha256ToField).
    function sha256ToField(bytes memory data) internal pure returns (bytes32) {
        return bytes32(bytes.concat(new bytes(1), bytes31(sha256(data))));
    }

    /// Content of a private deposit message: the Aztec bridge rebuilds it from the claimed amount.
    /// The recipient is NOT part of it: whoever knows the secret behind the secret hash claims.
    function mintToPrivateContent(uint256 amount) internal pure returns (bytes32) {
        return sha256ToField(abi.encodeWithSignature("mint_to_private(uint256)", amount));
    }

    /// Content of a withdrawal message, as the Aztec token builds it in withdraw_private.
    function withdrawContent(address recipient, uint256 amount, address callerOnL1) internal pure returns (bytes32) {
        return sha256ToField(abi.encodeWithSignature("withdraw(address,uint256,address)", recipient, amount, callerOnL1));
    }
}

interface IAztecInbox {
    function sendL2Message(AztecMessaging.L2Actor memory recipient, bytes32 content, bytes32 secretHash)
        external
        returns (bytes32 key, uint256 index);
}

interface IAztecOutbox {
    function consume(
        AztecMessaging.L2ToL1Msg calldata message,
        uint256 epoch,
        uint256 numCheckpointsInEpoch,
        uint256 leafIndex,
        bytes32[] calldata path
    ) external;
}

interface IWETH9 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}
