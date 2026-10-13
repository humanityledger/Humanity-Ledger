// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Phase 6: Cross-Chain System & Deployment
// EVM L1 Oracle to bridge public mempool data to Aztec L2

import "@openzeppelin/contracts/access/Ownable.sol";

interface IAztecInbox {
    function sendL2Message(bytes32 recipient, bytes32 content) external returns (bytes32);
}

contract AztecOracleL1 is Ownable {
    address public aztecInboxAddress;
    
    event IntelligenceRouted(bytes32 indexed l2Recipient, bytes32 indexed contentHash);
    
    constructor(address _aztecInbox) Ownable(msg.sender) {
        aztecInboxAddress = _aztecInbox;
    }
    
    // Bridge verified Ledger alerts into the Private Shielded Pool
    function pushLedgerAlertToAztec(bytes32 l2Recipient, bytes32 txDataHash) external onlyOwner {
        // Enforce System rules
        require(txDataHash != bytes32(0), "Invalid Active Data");
        
        bytes32 messageHash = IAztecInbox(aztecInboxAddress).sendL2Message(
            l2Recipient,
            txDataHash
        );
        
        emit IntelligenceRouted(l2Recipient, messageHash);
    }
}
