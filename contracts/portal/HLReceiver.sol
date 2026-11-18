// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {AztecMessaging} from "./AztecMessaging.sol";

interface IHLPortalDeposits {
    function depositToAztecPrivate(address token, uint256 amount, bytes32 secretHash) external returns (bytes32, uint256);
    function depositEthToAztecPrivate(bytes32 secretHash) external payable returns (bytes32, uint256);
}

/**
 * @title HLReceiver
 * @notice A receiver address (Nyx-style): an ordinary Ethereum address a person shares to be paid.
 *         Whatever arrives (ETH, or a token the portal accepts) is forwarded, by anyone, into the
 *         Humanity Ledger portal as a PRIVATE deposit whose secret hash is this receiver's.
 *
 * What a receiver stores, and why it links to nothing (docs/RECEIVER_ADDRESSES.md §3):
 *   secretHash    poseidon2([secret], DOM_SEP__SECRET_HASH), with secret = HKDF(account root, index).
 *                 A hash of a random-looking value: it reveals no Aztec address, no key, and no
 *                 relation to the person's other receivers (each has its own index).
 *   rescueSigner  an Ethereum address derived from the same root with another label. It signs
 *                 only rescues (below). It has never held funds and is used nowhere else.
 * The Aztec recipient is never written on Ethereum: the deposit message carries mint_to_private(amount)
 * and the secret hash; the person later claims it privately with the secret.
 *
 * Rescue: a token the portal does not accept, or an amount above the caps, can be sent back out by an
 * EIP-712 signature of rescueSigner (nonce, deadline). Revealing that signature links the receiver to
 * the rescue destination only.
 *
 * Clones (EIP-1167) of one implementation; the factory deploys them at a CREATE2 address computed
 * from (secretHash, rescueSigner), so the address can be shared before it exists.
 */
contract HLReceiver is ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant RESCUE_TYPEHASH =
        keccak256("Rescue(address token,address to,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant NAME_HASH = keccak256("Humanity Ledger receiver");
    bytes32 private constant VERSION_HASH = keccak256("1");

    address public immutable factory;
    IHLPortalDeposits public immutable portal;

    bytes32 public secretHash;
    address public rescueSigner;
    uint256 public rescueNonce;
    bool private initialized;

    event Forwarded(address indexed token, uint256 amount, bytes32 key, uint256 index);
    event Rescued(address indexed token, address indexed to, uint256 amount, uint256 nonce);

    error OnlyFactory();
    error AlreadyInitialized();
    error InvalidSecretHash();
    error ZeroAddress();
    error ZeroAmount();
    error Expired();
    error BadSignature();
    error EthTransferFailed();

    constructor(address _factory, address _portal) {
        factory = _factory;
        portal = IHLPortalDeposits(_portal);
        initialized = true; // the implementation itself is never usable
    }

    function initialize(bytes32 _secretHash, address _rescueSigner) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (initialized) revert AlreadyInitialized();
        if (uint256(_secretHash) == 0 || uint256(_secretHash) >= AztecMessaging.FIELD_MODULUS) revert InvalidSecretHash();
        if (_rescueSigner == address(0)) revert ZeroAddress();
        initialized = true;
        secretHash = _secretHash;
        rescueSigner = _rescueSigner;
    }

    receive() external payable {}

    /**
     * Forwards `amount` (address(0) = ETH) into the portal as a private deposit. Anyone may call:
     * the destination is fixed by this receiver's secret hash, so the caller can only choose when and
     * how much (within the balance), which lets a deposit be split under the portal's caps.
     */
    function forward(address token, uint256 amount) external nonReentrant returns (bytes32 key, uint256 index) {
        if (amount == 0) revert ZeroAmount();
        if (token == address(0)) {
            (key, index) = portal.depositEthToAztecPrivate{value: amount}(secretHash);
        } else {
            IERC20(token).forceApprove(address(portal), amount);
            (key, index) = portal.depositToAztecPrivate(token, amount, secretHash);
            // USDT-style tokens refuse a new allowance unless the old one is 0: leave none behind.
            IERC20(token).forceApprove(address(portal), 0);
        }
        emit Forwarded(token, amount, key, index);
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    /// Sends `amount` of `token` (address(0) = ETH) to `to`, authorised by rescueSigner.
    function rescue(address token, address to, uint256 amount, uint256 deadline, bytes calldata signature) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (block.timestamp > deadline) revert Expired();
        uint256 nonce = rescueNonce;
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator(), keccak256(abi.encode(RESCUE_TYPEHASH, token, to, amount, nonce, deadline)))
        );
        if (ECDSA.recover(digest, signature) != rescueSigner) revert BadSignature();
        rescueNonce = nonce + 1;
        emit Rescued(token, to, amount, nonce);
        if (token == address(0)) {
            // Slither arbitrary-send-eth: `to` is signed by rescueSigner, EIP-712 with nonce and deadline.
            // slither-disable-next-line arbitrary-send-eth
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert EthTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}

/**
 * @title HLReceiverFactory
 * @notice Deploys receivers at CREATE2 addresses and forwards through them. Permissionless: deploying
 *         or forwarding someone's receiver can only send its funds to its own fixed private deposit.
 */
contract HLReceiverFactory {
    address public immutable implementation;
    address public immutable portal;

    event ReceiverDeployed(address indexed receiver);

    constructor(address _portal) {
        portal = _portal;
        implementation = address(new HLReceiver(address(this), _portal));
    }

    function saltOf(bytes32 secretHash, address rescueSigner) public pure returns (bytes32) {
        return keccak256(abi.encode(secretHash, rescueSigner));
    }

    /// The receiver's address, deployed or not.
    function predict(bytes32 secretHash, address rescueSigner) public view returns (address) {
        return Clones.predictDeterministicAddress(implementation, saltOf(secretHash, rescueSigner), address(this));
    }

    function deploy(bytes32 secretHash, address rescueSigner) public returns (address receiver) {
        receiver = predict(secretHash, rescueSigner);
        if (receiver.code.length > 0) return receiver;
        // Slither unused-return: CREATE2: the clone is at `receiver`, predicted above; a failed create reverts.
        // slither-disable-next-line unused-return
        Clones.cloneDeterministic(implementation, saltOf(secretHash, rescueSigner));
        HLReceiver(payable(receiver)).initialize(secretHash, rescueSigner);
        emit ReceiverDeployed(receiver);
    }

    /// Deploys the receiver if needed, then forwards `amount` of `token` (address(0) = ETH) from it.
    function forward(bytes32 secretHash, address rescueSigner, address token, uint256 amount)
        external
        returns (bytes32 key, uint256 index)
    {
        address receiver = deploy(secretHash, rescueSigner);
        // Slither unused-return: both values are returned to the caller.
        // slither-disable-next-line unused-return
        return HLReceiver(payable(receiver)).forward(token, amount);
    }
}
