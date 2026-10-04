// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EcosystemWarRoom
 * @dev On-Chain registry for Ecosystem events, matrices, and Gold Registry Audits.
 * Replaces EcosystemWarRoomData and GoldRegistryAudit PostgreSQL tables.
 */
contract EcosystemWarRoom is Ownable {

    struct GoldAudit {
        uint256 timestamp;
        uint256 totalOunces;
        string auditorSignature;
        string ipfsReportHash; // Decentralized storage reference
    }

    struct KineticMatrix {
        bytes32 matrixId;
        string category;
        int256 sentimentScore; // -100 to 100
        uint256 timestamp;
    }

    GoldAudit[] public goldAudits;
    mapping(bytes32 => KineticMatrix[]) public matrices;

    event GoldAuditRegistered(uint256 timestamp, uint256 totalOunces, string ipfsHash);
    event KineticMatrixUpdated(bytes32 indexed matrixId, int256 sentimentScore);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Register a physical gold audit on-chain via Oracle/Admin
     */
    function registerGoldAudit(
        uint256 _totalOunces,
        string calldata _auditorSignature,
        string calldata _ipfsReportHash
    ) external onlyOwner {
        goldAudits.push(GoldAudit({
            timestamp: block.timestamp,
            totalOunces: _totalOunces,
            auditorSignature: _auditorSignature,
            ipfsReportHash: _ipfsReportHash
        }));

        emit GoldAuditRegistered(block.timestamp, _totalOunces, _ipfsReportHash);
    }

    /**
     * @dev Update a Kinetic Matrix state (e.g. DeFi sentiment)
     */
    function updateKineticMatrix(
        bytes32 _matrixId,
        string calldata _category,
        int256 _sentimentScore
    ) external onlyOwner {
        matrices[_matrixId].push(KineticMatrix({
            matrixId: _matrixId,
            category: _category,
            sentimentScore: _sentimentScore,
            timestamp: block.timestamp
        }));

        emit KineticMatrixUpdated(_matrixId, _sentimentScore);
    }

    /**
     * @dev Fetch latest Gold Audit
     */
    function getLatestGoldAudit() external view returns (GoldAudit memory) {
        require(goldAudits.length > 0, "No audits found");
        return goldAudits[goldAudits.length - 1];
    }
}
