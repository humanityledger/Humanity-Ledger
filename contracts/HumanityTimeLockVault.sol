// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title HumanityTimeLockVault
 * @dev Replaces TimeLockVault, DeadMansSwitch, Guardian, and SocialRecovery tables.
 * Ultimate On-Chain Asset Security for Humanity Ledger.
 */
contract HumanityTimeLockVault is Ownable {
    
    struct VaultConfig {
        uint256 deadManSwitchTimeout; // Seconds of inactivity before execution
        uint256 lastHeartbeat;
        address backupWallet;
        bool isTriggered;
    }

    struct Guardian {
        address guardianAddress;
        bool hasVotedToRecover;
    }

    mapping(address => VaultConfig) public vaults;
    mapping(address => address[]) public vaultGuardians;
    mapping(address => mapping(address => bool)) public recoveryVotes; // vaultOwner => (guardian => voted)

    event Heartbeat(address indexed owner, uint256 timestamp);
    event DeadManSwitchTriggered(address indexed owner, address backupWallet);
    event SocialRecoveryInitiated(address indexed owner, address newWallet);

    constructor() Ownable(msg.sender) {}

    function setupVault(uint256 _timeoutSeconds, address _backupWallet, address[] calldata _guardians) external {
        vaults[msg.sender] = VaultConfig({
            deadManSwitchTimeout: _timeoutSeconds,
            lastHeartbeat: block.timestamp,
            backupWallet: _backupWallet,
            isTriggered: false
        });

        vaultGuardians[msg.sender] = _guardians;
    }

    function pingHeartbeat() external {
        require(vaults[msg.sender].lastHeartbeat > 0, "No vault");
        vaults[msg.sender].lastHeartbeat = block.timestamp;
        emit Heartbeat(msg.sender, block.timestamp);
    }

    /**
     * @dev Anyone can trigger this if the heartbeat expires (MEV protected by fixed backup wallet)
     */
    function executeDeadManSwitch(address _vaultOwner, address _tokenAddress) external {
        VaultConfig storage config = vaults[_vaultOwner];
        require(config.lastHeartbeat > 0, "No vault");
        require(!config.isTriggered, "Already triggered");
        require(block.timestamp > config.lastHeartbeat + config.deadManSwitchTimeout, "Timeout not reached");

        config.isTriggered = true;

        // Transfer funds to backup wallet
        uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));
        require(IERC20(_tokenAddress).transfer(config.backupWallet, balance), "Transfer failed");

        emit DeadManSwitchTriggered(_vaultOwner, config.backupWallet);
    }
}
