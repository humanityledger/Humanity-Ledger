// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HumanityTimeLockVault
 * @dev Replaces TimeLockVault, DeadMansSwitch, Guardian, and SocialRecovery tables.
 * Ultimate On-Chain Asset Security for Humanity Ledger.
 */
contract HumanityTimeLockVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
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

    // Tracks deposited balances per vault owner per token: vaultOwner => token => balance
    mapping(address => mapping(address => uint256)) public vaultBalances;

    event Heartbeat(address indexed owner, uint256 timestamp);
    event DeadManSwitchTriggered(address indexed owner, address backupWallet);
    event SocialRecoveryInitiated(address indexed owner, address newWallet);
    event TokenDeposited(address indexed owner, address indexed token, uint256 amount);
    event TokenWithdrawn(address indexed owner, address indexed token, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function setupVault(uint256 _timeoutSeconds, address _backupWallet, address[] calldata _guardians) external {
        require(_backupWallet != address(0), "Invalid backup wallet");
        require(_backupWallet != msg.sender, "Backup cannot be self");
        require(_timeoutSeconds >= 1 hours, "Timeout must be at least 1 hour");

        vaults[msg.sender] = VaultConfig({
            deadManSwitchTimeout: _timeoutSeconds,
            lastHeartbeat: block.timestamp,
            backupWallet: _backupWallet,
            isTriggered: false
        });

        vaultGuardians[msg.sender] = _guardians;
    }

    function depositToken(address _tokenAddress, uint256 _amount) external nonReentrant {
        require(_tokenAddress != address(0), "Invalid token");
        require(_amount > 0, "Amount must be > 0");
        require(vaults[msg.sender].lastHeartbeat > 0, "Vault not initialized");

        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        vaultBalances[msg.sender][_tokenAddress] += _amount;

        emit TokenDeposited(msg.sender, _tokenAddress, _amount);
    }

    function withdrawToken(address _tokenAddress, uint256 _amount) external nonReentrant {
        require(_tokenAddress != address(0), "Invalid token");
        require(_amount > 0, "Amount must be > 0");
        require(vaultBalances[msg.sender][_tokenAddress] >= _amount, "Insufficient vault balance");

        vaultBalances[msg.sender][_tokenAddress] -= _amount;
        vaults[msg.sender].lastHeartbeat = block.timestamp; // Refresh heartbeat on withdrawal

        IERC20(_tokenAddress).safeTransfer(msg.sender, _amount);

        emit TokenWithdrawn(msg.sender, _tokenAddress, _amount);
    }

    function pingHeartbeat() external {
        require(vaults[msg.sender].lastHeartbeat > 0, "No vault");
        vaults[msg.sender].lastHeartbeat = block.timestamp;
        emit Heartbeat(msg.sender, block.timestamp);
    }

    /**
     * @dev Anyone can trigger this if the heartbeat expires (MEV protected by fixed backup wallet).
     * Transfers ONLY the specific vault owner's deposited token balance to the configured backup wallet.
     */
    function executeDeadManSwitch(address _vaultOwner, address _tokenAddress) external nonReentrant {
        VaultConfig storage config = vaults[_vaultOwner];
        require(config.lastHeartbeat > 0, "No vault");
        require(!config.isTriggered, "Already triggered");
        require(block.timestamp > config.lastHeartbeat + config.deadManSwitchTimeout, "Timeout not reached");

        uint256 balance = vaultBalances[_vaultOwner][_tokenAddress];
        require(balance > 0, "No balance in vault for token");

        // Checks-Effects-Interactions pattern: update state before external transfer
        config.isTriggered = true;
        vaultBalances[_vaultOwner][_tokenAddress] = 0;

        IERC20(_tokenAddress).safeTransfer(config.backupWallet, balance);

        emit DeadManSwitchTriggered(_vaultOwner, config.backupWallet);
    }
}
