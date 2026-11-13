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
 *   - The vault records every token it holds for an owner (at most MAX_TOKENS), and
 *     executeDeadManSwitch sweeps all of them to the backup wallet. It used to sweep only
 *     the tokens the caller listed and then refuse every later call, so anyone could fire
 *     it with one token after the timeout and freeze the others for good (owner and backup
 *     both locked out). After the trigger it may be called again: it sweeps what is left,
 *     such as a token whose transfer failed the first time.
 *   - Deposits credit what the vault actually received (balance difference), so a
 *     fee-on-transfer token cannot credit more than it delivered and drain other owners'
 *     balances of the same token.
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

    /// @notice Most distinct tokens one vault may hold: bounds the gas of a sweep.
    uint256 public constant MAX_TOKENS = 32;

    /// @dev Tokens ever deposited into each owner's vault, swept by executeDeadManSwitch.
    mapping(address => address[]) private _vaultTokens;
    mapping(address => mapping(address => bool)) private _isVaultToken;

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
    error NoTokenBalancesFound();
    error TooManyTokens();

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

        if (!_isVaultToken[msg.sender][_tokenAddress]) {
            if (_vaultTokens[msg.sender].length >= MAX_TOKENS) revert TooManyTokens();
            _isVaultToken[msg.sender][_tokenAddress] = true;
            _vaultTokens[msg.sender].push(_tokenAddress);
        }

        IERC20 token = IERC20(_tokenAddress);
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received == 0) revert InvalidAmount();
        vaultBalances[msg.sender][_tokenAddress] += received;

        emit TokenDeposited(msg.sender, _tokenAddress, received);
    }

    /// @notice Tokens recorded in `_vaultOwner`'s vault (the ones a sweep moves).
    function vaultTokens(address _vaultOwner) external view returns (address[] memory) {
        return _vaultTokens[_vaultOwner];
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
     * @notice Execute the dead man's switch for a vault whose heartbeat has expired: every token
     *         recorded in the vault goes to the owner-configured backup wallet. Callable by anyone
     *         once the timeout has elapsed; the destination is fixed, so a caller gains nothing.
     *         Callable again after the trigger to sweep what is left (a token whose transfer
     *         failed the first time).
     *
     * @dev    CEI: the trigger and each balance are written before the external call. A token
     *         whose transfer fails keeps its balance, so one bad token cannot block the others.
     */
    function executeDeadManSwitch(address _vaultOwner) external nonReentrant {
        VaultConfig storage config = vaults[_vaultOwner];
        if (config.lastHeartbeat == 0) revert NoVault();
        bool firstTrigger = !config.isTriggered;
        if (firstTrigger) {
            if (block.timestamp <= config.lastHeartbeat + config.deadManSwitchTimeout) revert TimeoutNotReached();
            config.isTriggered = true;
        }

        address backupWallet = config.backupWallet;
        address[] storage tokens = _vaultTokens[_vaultOwner];
        uint256 transferred = 0;

        for (uint256 i; i < tokens.length; ) {
            address tokenAddress = tokens[i];
            uint256 balance = vaultBalances[_vaultOwner][tokenAddress];
            if (balance > 0) {
                vaultBalances[_vaultOwner][tokenAddress] = 0;
                if (_tryTransfer(tokenAddress, backupWallet, balance)) {
                    unchecked { ++transferred; }
                } else {
                    vaultBalances[_vaultOwner][tokenAddress] = balance;
                }
            }
            unchecked { ++i; }
        }

        // The first trigger fires even with nothing to move (the vault is then closed to the owner,
        // which is what the timeout means); a later call that moves nothing is refused.
        if (!firstTrigger && transferred == 0) revert NoTokenBalancesFound();

        emit DeadManSwitchTriggered(_vaultOwner, backupWallet, transferred);
    }

    /// @dev ERC-20 transfer that reports failure instead of reverting (tokens with or without a return value).
    function _tryTransfer(address token, address to, uint256 amount) private returns (bool) {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!ok) return false;
        if (data.length == 0) return token.code.length > 0;
        return data.length >= 32 && abi.decode(data, (bool));
    }
}
