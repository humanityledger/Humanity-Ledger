// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title SafeContracts (The Citadel Standard)
 * @notice Abstract base for LedgerAlert ID.fi contracts.
 * @dev Implements Emergency Stop (Circuit Breaker) and Reentrancy Protections.
 */
abstract contract SafeContracts is Pausable, ReentrancyGuard, AccessControl {
    
    // ROLES
    bytes32 public constant EMERGENCY_ADMIN_ROLE = keccak256("EMERGENCY_ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Emergency Pause Trigger
     * @dev Only callable by EMERGENCY_ADMIN or DEFAULT_ADMIN.
     *      Does NOT allow withdrawing funds, only freezing state.
     */
    function emergencyPause() external onlyRole(EMERGENCY_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Resume Operations
     * @dev Only DEFAULT_ADMIN (Multisig) can unpause to prevent rogue resume.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Modifier to ensure functions are called by operators or admins.
     */
    modifier onlyAuth() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "Citadel: Unauthorized"
        );
        _;
    }
}

