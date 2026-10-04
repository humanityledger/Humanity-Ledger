// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./HumanityIdentityRegistry.sol";

/**
 * @title HumanityPaymaster
 * @dev ERC-4337 Paymaster that subsidizes gas fees for users on Humanity Ledger.
 * Ensures the "gasless" experience so the transition to Ethereum is invisible.
 */
contract HumanityPaymaster is Ownable {
    HumanityIdentityRegistry public identityRegistry;

    // Mapping to track gas sponsored per user to prevent Sybil/DDoS attacks
    mapping(address => uint256) public sponsoredGas;
    
    uint256 public constant MAX_SPONSORED_GAS_PER_USER = 500 ether; // High limit for the 6-hour sprint demo

    error IdentityNotRegistered();
    error GasLimitExceeded();
    error NotAuthorizedEntryPoint();

    address public entryPoint;

    constructor(address _identityRegistry, address _entryPoint) Ownable(msg.sender) {
        identityRegistry = HumanityIdentityRegistry(_identityRegistry);
        entryPoint = _entryPoint;
    }

    /**
     * @dev Validates if the Paymaster will sponsor the transaction.
     * Only sponsors if the sender has a registered Humanity Identity.
     */
    function validatePaymasterUserOp(
        // userOp parameters omitted for abstraction in this conceptual contract
        address sender,
        uint256 requiredPreFund
    ) external returns (bytes memory context, uint256 validationData) {
        if (msg.sender != entryPoint) revert NotAuthorizedEntryPoint();

        // 1. Check if the user is registered in the Identity Registry
        (,,,,,,,,uint256 createdAt) = identityRegistry.identities(sender);
        
        if (createdAt == 0) revert IdentityNotRegistered();

        // 2. Rate limiting / Gas capping
        if (sponsoredGas[sender] + requiredPreFund > MAX_SPONSORED_GAS_PER_USER) {
            revert GasLimitExceeded();
        }

        // 3. Approve sponsorship
        sponsoredGas[sender] += requiredPreFund;
        
        // Return 0 for validation success (ERC-4337 spec)
        return ("", 0);
    }

    /**
     * @dev Fund the paymaster (called by the Treasury)
     */
    receive() external payable {}

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        to.transfer(amount);
    }
}
