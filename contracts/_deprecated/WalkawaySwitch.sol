// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WalkawaySwitch v3
 * @author System Akashic Ledger (SAL)
 * @notice A decentralized deadman switch that transfers protocol ownership to a 
 * community multisig after exactly 180 days of founder inactivity.
 */
contract WalkawaySwitch is Ownable2Step, Pausable, ReentrancyGuard {
    //  PARAMETERS 
    
    // Exactly 180 days of thermodynamic silence trigger the switch
    uint256 public constant INACTIVITY_THRESHOLD = 180 days;
    
    // Track the last confirmed heartbeat of the founder
    uint256 public lastHeartbeat;
    
    // The designated community identity (Safe Multisig)
    address public immutable COMMUNITY_MULTISIG;

    //  EVENTS 

    event HeartbeatUpdated(address indexed founder, uint256 timestamp);
    event OwnershipTransferredToCommunity(address indexed communityMultisig, uint256 timestamp);
    event EmergencyPauseTriggered(address indexed administrator);

    //  CONSTRUCTOR 

    /**
     * @param _communityMultisig The address of the community-governed Multisig (Safe).
     * Provisioned as: 0x78831C25c86eA2a78A6127fC2Ccb95E612D87b4a
     */
    constructor(address _communityMultisig) Ownable(msg.sender) {
        require(_communityMultisig != address(0), "SAL: Invalid multisig address");
        COMMUNITY_MULTISIG = _communityMultisig;
        lastHeartbeat = block.timestamp;
    }

    //  FUNCTIONS 

    /**
     * @notice Allows the founder to prove "liveness" and reset the 180-day countdown.
     */
    function sendHeartbeat() external onlyOwner {
        lastHeartbeat = block.timestamp;
        emit HeartbeatUpdated(msg.sender, block.timestamp);
    }

    /**
     * @notice Publicly callable function to trigger the ownership transfer after expiry.
     * Can only be triggered if the threshold has passed since the last heartbeat.
     */
    function checkWalkaway() external nonReentrant whenNotPaused {
        require(
            block.timestamp >= lastHeartbeat + INACTIVITY_THRESHOLD, 
            "SAL: Threshold period not yet elapsed"
        );
        
        // Finalize the handover to community control
        // FIX: Use public transferOwnership() to trigger Ownable2Step pending-accept mechanism.
        // _transferOwnership() (internal) bypasses the 2-step and assigns owner directly.
        transferOwnership(COMMUNITY_MULTISIG);
        
        emit OwnershipTransferredToCommunity(COMMUNITY_MULTISIG, block.timestamp);
    }

    //  SECURITY 

    function pause() external onlyOwner {
        _pause();
        emit EmergencyPauseTriggered(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
