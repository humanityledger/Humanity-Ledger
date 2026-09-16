// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./HumanityIdentityRegistry.sol";
import "./HumanityPaymaster.sol";
import "./HumanityLedgerChat.sol";
import "./HumanityAcademySBT.sol";
import "./EcosystemWarRoom.sol";
import "./HumanityAcademyCore.sol";
import "./HumanityTimeLockVault.sol";
import "./HumanityForum.sol";
import "./HumanityQdToken.sol";
import "./HumanityOmnichainBridge.sol";

/**
 * @title HumanityLedgerCore
 * @dev The Central Nervous System of the Humanity Ledger Full On-Chain Architecture.
 * Acts as a master registry and router for all Mini-Apps. Phase 4 Omnipotent Edition.
 */
contract HumanityLedgerCore is Ownable {
    
    // Phase 1
    HumanityIdentityRegistry public identityRegistry;
    HumanityPaymaster public paymaster;
    HumanityLedgerChat public ledgerChat;
    HumanityAcademySBT public academySBT;
    EcosystemWarRoom public warRoom;

    // Phase 3 & 4
    HumanityOmnichainBridge public omnichainBridge;
    HumanityAcademyCore public academyCore;
    HumanityTimeLockVault public timeLockVault;
    HumanityForum public forum;
    HumanityQdToken public qdToken;

    event SystemUpgraded(string moduleName, address newAddress);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Initialize or upgrade the core modules of the ecosystem (Phase 1)
     */
    function setPhase1Modules(
        address _identity,
        address _paymaster,
        address _chat,
        address _academySBT,
        address _warRoom
    ) external onlyOwner {
        identityRegistry = HumanityIdentityRegistry(_identity);
        paymaster = HumanityPaymaster(_paymaster);
        ledgerChat = HumanityLedgerChat(_chat);
        academySBT = HumanityAcademySBT(_academySBT);
        warRoom = EcosystemWarRoom(_warRoom);
        emit SystemUpgraded("Phase 1 Modules", address(this));
    }

    /**
     * @dev Initialize or upgrade the core modules of the ecosystem (Phase 3 & 4)
     */
    function setPhase4Modules(
        address _omnichain,
        address _academyCore,
        address _timeLockVault,
        address _forum,
        address _qdToken
    ) external onlyOwner {
        omnichainBridge = HumanityOmnichainBridge(_omnichain);
        academyCore = HumanityAcademyCore(_academyCore);
        timeLockVault = HumanityTimeLockVault(_timeLockVault);
        forum = HumanityForum(_forum);
        qdToken = HumanityQdToken(_qdToken);
        emit SystemUpgraded("Phase 4 Modules", address(this));
    }

    /**
     * @dev Retrieve all module addresses in a single call for the Next.js Frontend
     */
    function getSystemConfiguration() external view returns (
        address identity,
        address pm,
        address chat,
        address acadSBT,
        address war,
        address omni,
        address acadCore,
        address vault,
        address frm,
        address qd
    ) {
        return (
            address(identityRegistry),
            address(paymaster),
            address(ledgerChat),
            address(academySBT),
            address(warRoom),
            address(omnichainBridge),
            address(academyCore),
            address(timeLockVault),
            address(forum),
            address(qdToken)
        );
    }
}
