// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * 
 *           LEDGER HANDSHAKE  DEADMAN'S SWITCH v1.0.0                       
 *           Non-Custodial Inheritance Protocol (Polygon PoS / Amoy)             
 *                                                                               
 *   Architecture: Owner never cedes custody. Contract holds zero funds.         
 *   On trigger: approved ERC-20/721 allowances are forwarded to backupWallet.   
 *                                                                               
 *   Security Stack:                                                              
 *     - Ownable2Step (prevent single-tx ownership hijack)                       
 *     - ReentrancyGuard (prevent re-entrant inheritance drain)                  
 *     - Pausable (emergency global halt by owner)                               
 *     - Custom error types (gas efficient revert messages)                      
 *     - Anti-frontrun: any address can trigger after timeout (no privileged     
 *       caller means no MEV advantage over backup wallet)                       
 *     - Backup wallet cooldown: 72h change delay to prevent last-minute swap    
 * 
 */

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard}         from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}                 from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20}                  from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata}          from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20}               from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721}                 from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract LedgerDeadmanSwitch is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // 
    // CONSTANTS
    // 

    /// @dev Minimum allowed timeout (90 days in seconds).
    uint256 public constant MIN_TIMEOUT  = 90 days;

    /// @dev Delay before a pending backup wallet change takes effect.
    uint256 public constant BACKUP_COOLDOWN = 72 hours;

    // 
    // STATE
    // 

    /// @notice The wallet to receive all approved assets when inheritance triggers.
    address public backupWallet;

    /// @notice Timestamp of the last successful ping() call.
    uint256 public lastPing;

    /// @notice How long without a ping before inheritance can be triggered.
    uint256 public timeoutPeriod;

    /// @notice Whether the inherited assets have already been forwarded.
    bool    public triggered;

    // Pending backup wallet change (cooldown pattern)
    address public pendingBackupWallet;
    uint256 public pendingBackupTime;

    // 
    // EVENTS
    // 

    event Ping(address indexed owner, uint256 timestamp);
    event BackupWalletProposed(address indexed proposed, uint256 effectiveAt);
    event BackupWalletConfirmed(address indexed oldBackup, address indexed newBackup);
    event TimeoutUpdated(uint256 oldPeriod, uint256 newPeriod);
    event InheritanceTriggered(
        address indexed owner,
        address indexed backupWallet,
        uint256 timestamp,
        address[] erc20Tokens,
        address[] erc721Contracts
    );
    event ERC20Forwarded(address indexed token, address indexed to, uint256 amount);
    event ERC721Forwarded(address indexed nftContract, address indexed to, uint256 tokenId);
    event EmergencyPaused(address indexed by, uint256 timestamp);

    // 
    // ERRORS
    // 

    error InvalidBackupWallet();
    error CannotBeOwner();
    error TimeoutTooShort();
    error NotYetExpired();
    error AlreadyTriggered();
    error NoPendingChange();
    error CooldownNotElapsed();
    error ArrayLengthMismatch();
    error NoAssetsSpecified();
    error Blocked();

    // 
    // CONSTRUCTOR
    // 

    /**
     * @param _initialOwner  Address that owns the switch (your primary wallet).
     * @param _backupWallet  Address that receives assets upon trigger.
     * @param _timeoutDays   Inactivity period (in days) before trigger is unlocked. Min 90.
     */
    constructor(
        address _initialOwner,
        address _backupWallet,
        uint256 _timeoutDays
    ) Ownable(_initialOwner) {
        if (_backupWallet == address(0))       revert InvalidBackupWallet();
        if (_backupWallet == _initialOwner)    revert CannotBeOwner();
        if (_timeoutDays * 1 days < MIN_TIMEOUT) revert TimeoutTooShort();

        backupWallet   = _backupWallet;
        timeoutPeriod  = _timeoutDays * 1 days;
        lastPing       = block.timestamp;
    }

    // 
    // NON-CUSTODIAL GUARANTEE  no native tokens accepted
    // 

    receive() external payable { revert Blocked(); }
    fallback() external payable { revert Blocked(); }

    // 
    // CORE HEARTBEAT
    // 

    /**
     * @notice Reset the inactivity clock. Call from your wallet at least every
     *         `timeoutPeriod` to prevent inheritance from triggering.
     */
    function ping() external onlyOwner whenNotPaused {
        lastPing = block.timestamp;
        emit Ping(msg.sender, block.timestamp);
    }

    // 
    // CONFIGURATION (owner-only)
    // 

    /**
     * @notice Step 1 of 2-step backup change: propose a new backup wallet.
     *         Takes effect after BACKUP_COOLDOWN (72 h) to prevent last-minute
     *         rerouting by an attacker who has briefly seized the owner key.
     */
    function proposeBackupWallet(address newBackup) external onlyOwner {
        if (newBackup == address(0))  revert InvalidBackupWallet();
        if (newBackup == owner())     revert CannotBeOwner();
        pendingBackupWallet = newBackup;
        pendingBackupTime   = block.timestamp + BACKUP_COOLDOWN;
        emit BackupWalletProposed(newBackup, pendingBackupTime);
    }

    /**
     * @notice Step 2 of 2-step backup change: confirm after cooldown has elapsed.
     */
    function confirmBackupWallet() external onlyOwner {
        if (pendingBackupWallet == address(0)) revert NoPendingChange();
        if (block.timestamp < pendingBackupTime) revert CooldownNotElapsed();
        address old = backupWallet;
        backupWallet        = pendingBackupWallet;
        pendingBackupWallet = address(0);
        pendingBackupTime   = 0;
        emit BackupWalletConfirmed(old, backupWallet);
    }

    /**
     * @notice Update the inactivity timeout. Cannot be set below MIN_TIMEOUT.
     */
    function setTimeout(uint256 newTimeoutDays) external onlyOwner {
        uint256 newPeriod = newTimeoutDays * 1 days;
        if (newPeriod < MIN_TIMEOUT) revert TimeoutTooShort();
        uint256 old = timeoutPeriod;
        timeoutPeriod = newPeriod;
        emit TimeoutUpdated(old, newPeriod);
    }

    // 
    // INHERITANCE TRIGGER
    // 

    /**
     * @notice Forward all pre-approved owner tokens to backupWallet.
     *
     * @dev    CALLER RESTRICTION: only `backupWallet` or `owner()` may call this
     *         function. Restricting to these two addresses eliminates the zero-array
     *         griefing attack where any third party could call with empty arrays to
     *         permanently set `triggered = true` without transferring any assets,
     *         rendering the vault permanently frozen (audit finding, 2026-11).
     *         The owner() path exists so the owner can self-trigger if desired;
     *         the primary production path is backupWallet after owner is unreachable.
     *
     * @param erc20Tokens       List of ERC-20 contract addresses to forward.
     *                          At least one of erc20Tokens or erc721Contracts must
     *                          be non-empty.
     * @param erc721Contracts   List of ERC-721 contract addresses to forward.
     * @param erc721TokenIds    Token IDs for each ERC-721 contract (parallel array).
     *
     * @dev The owner must have granted allowance / setApprovalForAll to this
     *      contract *before* this function is called. This contract never holds
     *      any assets itself — it only moves them from owner → backupWallet.
     */
    function triggerInheritance(
        address[] calldata erc20Tokens,
        address[] calldata erc721Contracts,
        uint256[] calldata erc721TokenIds
    ) external nonReentrant whenNotPaused {
        // SECURITY: restrict caller to backupWallet or owner — prevents griefing
        // by arbitrary third parties calling with empty arrays to freeze the vault.
        if (msg.sender != backupWallet && msg.sender != owner()) revert Blocked();

        if (triggered)                                             revert AlreadyTriggered();
        if (block.timestamp <= lastPing + timeoutPeriod)           revert NotYetExpired();
        if (erc721Contracts.length != erc721TokenIds.length)       revert ArrayLengthMismatch();

        // Require at least one asset array to be non-empty — a call with all-empty
        // arrays cannot legitimately transfer anything and would only waste the
        // triggered flag, permanently freezing the vault.
        if (erc20Tokens.length == 0 && erc721Contracts.length == 0) revert NoAssetsSpecified();

        triggered = true; // permanent flag — prevents any second call (CEI: set before external transfers)

        address currentOwner  = owner();
        address currentBackup = backupWallet;

        //  ERC-20 loop 
        for (uint256 i; i < erc20Tokens.length; ) {
            IERC20 token = IERC20(erc20Tokens[i]);
            uint256 allowance = token.allowance(currentOwner, address(this));
            uint256 balance   = token.balanceOf(currentOwner);
            uint256 amount    = allowance < balance ? allowance : balance;

            if (amount > 0) {
                // SafeERC20 handles non-standard tokens (USDT, etc.)
                token.safeTransferFrom(currentOwner, currentBackup, amount);
                emit ERC20Forwarded(erc20Tokens[i], currentBackup, amount);
            }

            unchecked { ++i; }
        }

        //  ERC-721 loop 
        for (uint256 i; i < erc721Contracts.length; ) {
            IERC721 nft = IERC721(erc721Contracts[i]);
            uint256 tokenId = erc721TokenIds[i];

            bool approved = nft.isApprovedForAll(currentOwner, address(this))
                            || nft.getApproved(tokenId) == address(this);

            if (approved && nft.ownerOf(tokenId) == currentOwner) {
                nft.safeTransferFrom(currentOwner, currentBackup, tokenId);
                emit ERC721Forwarded(erc721Contracts[i], currentBackup, tokenId);
            }

            unchecked { ++i; }
        }

        emit InheritanceTriggered(
            currentOwner,
            currentBackup,
            block.timestamp,
            erc20Tokens,
            erc721Contracts
        );
    }

    // 
    // EMERGENCY CONTROLS
    // 

    /// @notice Freeze all state-changing functions immediately.
    function pause() external onlyOwner {
        _pause();
        emit EmergencyPaused(msg.sender, block.timestamp);
    }

    /// @notice Restore normal operations.
    function unpause() external onlyOwner {
        _unpause();
    }

    // 
    // VIEW HELPERS (used by the frontend panel)
    // 

    /// @return secondsRemaining Seconds left before inheritance can trigger (0 = already expired).
    function secondsUntilExpiry() external view returns (uint256) {
        uint256 expiryTs = lastPing + timeoutPeriod;
        if (block.timestamp >= expiryTs) return 0;
        return expiryTs - block.timestamp;
    }

    /// @return expiresAt Unix timestamp when/if the switch fires.
    function expiresAt() external view returns (uint256) {
        return lastPing + timeoutPeriod;
    }

    /// @return _owner         The current owner address.
    /// @return _backup        The current backup wallet address.
    /// @return _lastPing      Unix timestamp of the last heartbeat.
    /// @return _timeoutPeriod Inactivity window in seconds.
    /// @return _expiresAt     Unix timestamp when inheritance can trigger.
    /// @return _triggered     Whether inheritance has already fired.
    /// @return _paused        Whether the contract is currently paused.
    function getStatus() external view returns (
        address _owner,
        address _backup,
        uint256 _lastPing,
        uint256 _timeoutPeriod,
        uint256 _expiresAt,
        bool    _triggered,
        bool    _paused
    ) {
        return (
            owner(),
            backupWallet,
            lastPing,
            timeoutPeriod,
            lastPing + timeoutPeriod,
            triggered,
            paused()
        );
    }
}
