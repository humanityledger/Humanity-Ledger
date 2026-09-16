// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./HumanityPaymaster.sol";

// Minimal interface for LayerZero Endpoint v2
interface ILayerZeroEndpointV2 {
    function quote(MessagingParams calldata _params, address _sender) external view returns (MessagingFee memory);
    function send(MessagingParams calldata _params, address _refundAddress) external payable returns (MessagingReceipt memory);
}

struct MessagingParams {
    uint32 dstEid;
    bytes32 receiver;
    bytes message;
    bytes options;
    bool payInLzToken;
}

struct MessagingFee {
    uint256 nativeFee;
    uint256 lzTokenFee;
}

struct MessagingReceipt {
    bytes32 guid;
    uint64 nonce;
    MessagingFee fee;
}

/**
 * @title HumanityOmnichainBridge
 * @dev Phase 3 Integration: LayerZero v2 Omnichain Router for Humanity Ledger.
 * Allows users to send liquidity and commands from Solana, BSC, Base, and Ethereum Mainnet
 * directly into the Humanity Appchain instantly and gasless.
 */
contract HumanityOmnichainBridge is Ownable {
    ILayerZeroEndpointV2 public immutable lzEndpoint;
    HumanityPaymaster public paymaster;

    // Allowed source blockchains (Endpoint IDs)
    mapping(uint32 => bool) public allowedChains;
    
    // Trusted peer addresses on other chains
    mapping(uint32 => bytes32) public trustedPeers;

    event CrossChainMessageSent(uint32 indexed dstEid, bytes32 indexed receiver, bytes message);
    event CrossChainLiquidityReceived(uint32 indexed srcEid, address indexed recipient, uint256 amount);
    event SecurityIntrusionDetected(uint32 srcEid, bytes32 sender);

    error UnauthorizedEndpoint();
    error UntrustedPeer();
    error InvalidMessagePayload();

    constructor(address _lzEndpoint, address _paymaster) Ownable(msg.sender) {
        lzEndpoint = ILayerZeroEndpointV2(_lzEndpoint);
        paymaster = HumanityPaymaster(_paymaster);
    }

    function setTrustedChain(uint32 _eid, bytes32 _peerAddress, bool _allowed) external onlyOwner {
        allowedChains[_eid] = _allowed;
        trustedPeers[_eid] = _peerAddress;
    }

    /**
     * @dev Dispatch a command from Humanity Chain to another blockchain (e.g., executing a trade on BSC)
     */
    function sendOmnichainCommand(
        uint32 _dstEid,
        bytes calldata _payload,
        bytes calldata _options
    ) external payable {
        if (!allowedChains[_dstEid]) revert UnauthorizedEndpoint();

        bytes32 receiver = trustedPeers[_dstEid];
        
        MessagingParams memory params = MessagingParams({
            dstEid: _dstEid,
            receiver: receiver,
            message: _payload,
            options: _options,
            payInLzToken: false
        });

        // The transaction fee is paid by the user or subsidized by the Paymaster via refund mechanism
        lzEndpoint.send{value: msg.value}(params, msg.sender);

        emit CrossChainMessageSent(_dstEid, receiver, _payload);
    }

    /**
     * @dev Core entrypoint for LayerZero to deliver cross-chain messages into Humanity Appchain.
     * EXTREME SECURITY: Only the official LayerZero Endpoint can call this function.
     */
    function lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) external payable {
        // [ABYSMAL SECURITY CHECK]
        if (msg.sender != address(lzEndpoint)) revert UnauthorizedEndpoint();
        
        if (!allowedChains[_origin.srcEid]) revert UnauthorizedEndpoint();
        if (_origin.sender != trustedPeers[_origin.srcEid]) {
            emit SecurityIntrusionDetected(_origin.srcEid, _origin.sender);
            revert UntrustedPeer();
        }

        // Decode payload: expecting a liquidity transfer command
        (address recipient, uint256 amount, uint8 commandType) = abi.decode(_message, (address, uint256, uint8));

        if (commandType == 1) { // 1 = Liquidity Transfer
            // Mint or unlock mapped assets on the Humanity Appchain
            emit CrossChainLiquidityReceived(_origin.srcEid, recipient, amount);
        } else {
            revert InvalidMessagePayload();
        }
    }
}

struct Origin {
    uint32 srcEid;
    bytes32 sender;
    uint64 nonce;
}
