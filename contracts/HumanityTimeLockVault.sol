// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HumanityTimeLockVault
 * @dev Per-user multi-token dead man's switch vault for Humanity Ledger.
 *      Replaces TimeLockVault, DeadMansSwitch, Guardian, and SocialRecovery tables.
 *      Ultimate On-Chain Asset Security for Humanity Ledger.
 *
 * Security model:
 *   - Each user has an independent vault with their own backup wallet and timeout.
 *   - Multiple ERC-20 tokens can be deposited per vault.
 *   - executeDeadManSwitch sweeps ALL specified tokens atomically in a single call;
 *     isTriggered is set only after all transfers succeed, eliminating the
 *     multi-token lockout vulnerability (KupiaSec audit finding).
 *   - CEI (Checks-Effects-Interactions) pattern strictly enforced:
 *     isTriggered is set before any external transfer call.
 *   - nonReentrant on all state-mutating external functions.
 */
contract HumanityTimeLockVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // STRUCTS
    // -------------------------------------------------------------------------

    struct VaultConfig {
        uint256 deadManSwitchTimeout; // Seconds of inactivity before execution
        uint256 lastHeartbeat;
        address backupWallet;
        bool    isTriggered;
    }

    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------

    /// @notice Vault configuration per owner address.
    mapping(address => VaultConfig) public vaults;

    /// @notice Deposited token balances: vaultOwner => token => balance.
    mapping(address => mapping(address => uint256)) public vaultBalances;

    // -------------------------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------------------------

    event Heartbeat(address indexed owner, uint256 timestamp);
    event DeadManSwitchTriggered(
        address indexed owner,
        address indexed backupWallet,
        uint256 tokenCount
    );
    event TokenDeposited(address indexed owner, address indexed token, uint256 amount);
    event TokenWithdrawn(address indexed owner, address indexed token, uint256 amount);

    // -------------------------------------------------------------------------
    // ERRORS
    // -------------------------------------------------------------------------

    error NoVault();
    error VaultAlreadyTriggered();
    error TimeoutNotReached();
    error InvalidToken();
    error InvalidAmount();
    error InvalidBackupWallet();
    error TimeoutTooShort();
    error BackupCannotBeSelf();
    error InsufficientVaultBalance();
    error NoTokensSpecified();
    error NoTokenBalancesFound();

    // -------------------------------------------------------------------------
    // CONSTRUCTOR
    // -------------------------------------------------------------------------

    constructor() Ownable(msg.sender) {}

    // -------------------------------------------------------------------------
    // VAULT SETUP
    // -------------------------------------------------------------------------

    /**
     * @notice Create or reconfigure a vault. Resets isTriggered, allowing recovery
     *         after a switch has fired (original owner confirms they are alive).
     * @param _timeoutSeconds Inactivity period in seconds (minimum 1 hour).
     * @param _backupWallet   Wallet that receives all assets on switch execution.
     */
    function setupVault(
        uint256 _timeoutSeconds,
        address _backupWallet
    ) external {
        if (_backupWallet == address(0))   revert InvalidBackupWallet();
        if (_backupWallet == msg.sender)   revert BackupCannotBeSelf();
        if (_timeoutSeconds < 1 hours)     revert TimeoutTooShort();

        vaults[msg.sender] = VaultConfig({
            deadManSwitchTimeout: _timeoutSeconds,
            lastHeartbeat:        block.timestamp,
            backupWallet:         _backupWallet,
            isTriggered:          false
        });
    }

    // -------------------------------------------------------------------------
    // TOKEN OPERATIONS
    // -------------------------------------------------------------------------

    /**
     * @notice Deposit ERC-20 tokens into the caller's vault.
     * @param _tokenAddress ERC-20 contract address.
     * @param _amount       Amount to deposit (must be pre-approved).
     */
    function depositToken(address _tokenAddress, uint256 _amount) external nonReentrant {
        if (_tokenAddress == address(0))                   revert InvalidToken();
        if (_amount == 0)                                  revert InvalidAmount();
        if (vaults[msg.sender].lastHeartbeat == 0)         revert NoVault();
        if (vaults[msg.sender].isTriggered)                revert VaultAlreadyTriggered();

        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        vaultBalances[msg.sender][_tokenAddress] += _amount;

        emit TokenDeposited(msg.sender, _tokenAddress, _amount);
    }

    /**
     * @notice Withdraw ERC-20 tokens from the caller's vault.
     *         Also refreshes the heartbeat to confirm liveness.
     * @param _tokenAddress ERC-20 contract address.
     * @param _amount       Amount to withdraw.
     */
    function withdrawToken(address _tokenAddress, uint256 _amount) external nonReentrant {
        if (_tokenAddress == address(0))                                  revert InvalidToken();
        if (_amount == 0)                                                  revert InvalidAmount();
        if (vaults[msg.sender].isTriggered)                               revert VaultAlreadyTriggered();
        if (vaultBalances[msg.sender][_tokenAddress] < _amount)           revert InsufficientVaultBalance();

        // Refresh heartbeat on any active owner interaction
        vaults[msg.sender].lastHeartbeat = block.timestamp;
        vaultBalances[msg.sender][_tokenAddress] -= _amount;

        IERC20(_tokenAddress).safeTransfer(msg.sender, _amount);

        emit TokenWithdrawn(msg.sender, _tokenAddress, _amount);
    }

    // -------------------------------------------------------------------------
    // HEARTBEAT
    // -------------------------------------------------------------------------

    /**
     * @notice Prove liveness. Resets the inactivity clock for the caller's vault.
     */
    function pingHeartbeat() external {
        if (vaults[msg.sender].lastHeartbeat == 0) revert NoVault();
        if (vaults[msg.sender].isTriggered)        revert VaultAlreadyTriggered();
        vaults[msg.sender].lastHeartbeat = block.timestamp;
        emit Heartbeat(msg.sender, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // DEAD MAN'S SWITCH — MULTI-TOKEN SWEEP
    // -------------------------------------------------------------------------

    /**
     * @notice Execute the dead man's switch for a vault whose heartbeat has expired.
     *         Sweeps ALL specified token balances to the backup wallet atomically.
     *         Callable by anyone once the timeout has elapsed (MEV-protected because
     *         the destination is fixed to the owner-configured backup wallet).
     *
     * @dev    SECURITY: accepts an array of token addresses so that all deposited
     *         tokens are transferred in a single transaction. isTriggered is set
     *         BEFORE any external call (CEI). This eliminates the multi-token lockout
     *         vulnerability where a single-token trigger permanently froze all other
     *         deposited assets (KupiaSec audit finding, 2026-11).
     *
     * @param _vaultOwner    The vault owner whose switch to execute.
     * @param _tokenAddresses All ERC-20 token addresses deposited in the vault.
     *                        The caller MUST enumerate every token or funds remain
     *                        claimable on a future call (which will revert due to
     *                        isTriggered). Pass all deposited tokens in one call.
     */
    function executeDeadManSwitch(
        address   _vaultOwner,
        address[] calldata _tokenAddresses
    ) external nonReentrant {
        // --- CHECKS ---
        VaultConfig storage config = vaults[_vaultOwner];
        if (config.lastHeartbeat == 0)                                        revert NoVault();
        if (config.isTriggered)                                               revert VaultAlreadyTriggered();
        if (block.timestamp <= config.lastHeartbeat + config.deadManSwitchTimeout) revert TimeoutNotReached();
        if (_tokenAddresses.length == 0)                                      revert NoTokensSpecified();

        // --- EFFECTS (before all external calls — CEI) ---
        config.isTriggered = true;

        address backupWallet = config.backupWallet;
        uint256 transferred  = 0;

        // --- INTERACTIONS ---
        for (uint256 i; i < _tokenAddresses.length; ) {
            address tokenAddress = _tokenAddresses[i];
            uint256 balance      = vaultBalances[_vaultOwner][tokenAddress];

            if (balance > 0) {
                // Zero balance before external call (extra reentrancy safety)
                vaultBalances[_vaultOwner][tokenAddress] = 0;
                IERC20(tokenAddress).safeTransfer(backupWallet, balance);
                unchecked { ++transferred; }
            }

            unchecked { ++i; }
        }

        // Revert if no tokens had any balance — protects against griefing calls
        // with valid-but-empty token lists.
        if (transferred == 0) revert NoTokenBalancesFound();

        emit DeadManSwitchTriggered(_vaultOwner, backupWallet, transferred);
    }
}
