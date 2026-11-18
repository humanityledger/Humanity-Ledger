// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AztecMessaging, IAztecInbox, IAztecOutbox, IWETH9} from "./AztecMessaging.sol";

/**
 * @title HLPortal
 * @notice Humanity Ledger's L1 portal into Aztec: DAI, USDC, USDT and WETH (ETH is wrapped).
 *
 * Deposit:  the asset is locked here and an L1->L2 message is sent to that asset's Aztec token
 *           (contracts/aztec/portal_token). Its content is mint_to_private(amount); its secret hash
 *           is chosen by the depositor. The message names NO Aztec recipient: the holder of the
 *           secret claims the amount privately, into any account (docs/PORTAL.md §2).
 * Withdraw: the Aztec token burns a private balance and sends an L2->L1 message
 *           withdraw(recipient, amount, caller). Anyone presents it here with its Outbox proof;
 *           the Outbox marks it consumed and the asset goes to `recipient`.
 *
 * INVARIANTS (docs/PORTAL.md §4; test/portal/HLPortal.test.ts)
 *   I1  totalLocked[t] == sum(deposits of t) - sum(withdrawals of t), and the balance of t held
 *       here is >= totalLocked[t]. Every deposit locks exactly the amount its message carries
 *       (balance delta checked: fee-on-transfer and rebasing tokens are refused).
 *   I2  Tokens leave this contract ONLY through withdraw(), and only against an L2->L1 message
 *       consumed by the Aztec Outbox, from the asset's own Aztec token. There is no sweep, no
 *       admin transfer, no upgrade path.
 *   I3  An asset's Aztec token address is set once, at registration, and never changes: messages
 *       in flight always remain withdrawable.
 *   I4  Restrictions are immediate, relaxations are delayed: the guardian or admin can pause
 *       deposits, disable an asset or lower caps at once; enabling, raising caps, changing roles
 *       and sunsetting wait TIMELOCK (2 days) after being queued, in public.
 *   I5  Exits cannot be blocked for long: withdrawals can be paused for at most 3 days, and not
 *       again until 4 days after the previous pause ended. A sunset closes deposits forever and
 *       never touches withdrawals.
 *   I6  Caps per asset: per deposit, per sending address per UTC day, and for everyone per UTC day.
 */
contract HLPortal is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Asset {
        bytes32 l2Token; // Aztec address of the portal_token instance for this asset (set once)
        uint128 minDeposit; // below this a deposit is refused (dust would cost the claimer a fee each)
        uint128 perDepositCap;
        uint128 perSenderDailyCap;
        uint128 globalDailyCap;
        bool enabled;
    }

    /// Inclusion proof of an L2->L1 message in the Outbox (epoch root, as Aztec v6.0.0 consumes it).
    struct OutboxProof {
        uint256 epoch;
        uint256 numCheckpointsInEpoch;
        uint256 leafIndex;
        bytes32[] path;
    }

    struct Pending {
        Asset asset;
        uint64 eta;
    }

    uint256 public constant TIMELOCK = 2 days;
    uint256 public constant MAX_WITHDRAW_PAUSE = 3 days;
    uint256 public constant WITHDRAW_PAUSE_COOLDOWN = 4 days;

    IAztecInbox public immutable inbox;
    IAztecOutbox public immutable outbox;
    uint256 public immutable rollupVersion;
    IWETH9 public immutable weth;

    address public admin;
    address public guardian;

    mapping(address token => Asset) public assets;
    mapping(address token => uint256) public totalLocked;
    mapping(address token => mapping(uint256 day => uint256)) public globalDayVolume;
    mapping(address token => mapping(address sender => mapping(uint256 day => uint256))) public senderDayVolume;

    mapping(address token => Pending) public pendingAsset;
    address public pendingAdmin;
    uint64 public pendingAdminEta;
    address public pendingGuardian;
    uint64 public pendingGuardianEta;
    address public pendingSuccessor;
    uint64 public pendingSunsetEta;

    bool public depositsPaused;
    uint64 public withdrawalsPausedUntil;
    /// The next withdrawal pause may not start before this time (I5).
    uint64 public nextWithdrawPauseAllowedAt;
    /// Non-zero once sunset: deposits are closed forever and point here.
    address public successor;

    event AssetQueued(address indexed token, Asset asset, uint64 eta);
    event AssetSet(address indexed token, Asset asset);
    event AssetQueueCancelled(address indexed token);
    event AssetDisabled(address indexed token, address by);
    event CapsLowered(address indexed token, uint128 perDepositCap, uint128 perSenderDailyCap, uint128 globalDailyCap, address by);
    event DepositToAztecPrivate(
        address indexed token,
        address indexed sender,
        uint256 amount,
        bytes32 indexed secretHash,
        bytes32 key,
        uint256 index
    );
    event Withdrawal(address indexed token, address indexed recipient, uint256 amount, address caller, uint256 epoch, uint256 leafIndex);
    event DepositsPaused(address by);
    event DepositsUnpaused(address by);
    event WithdrawalsPaused(uint64 until, address by);
    event AdminQueued(address indexed admin, uint64 eta);
    event AdminChanged(address indexed admin);
    event GuardianQueued(address indexed guardian, uint64 eta);
    event GuardianChanged(address indexed guardian);
    event SunsetQueued(address indexed successor, uint64 eta);
    event Sunset(address indexed successor);

    error NotAdmin();
    error NotGuardianOrAdmin();
    error ZeroAddress();
    error AssetNotEnabled();
    error AssetAlreadyBound();
    error InvalidCaps();
    error NothingQueued();
    error TooEarly();
    error DepositsClosed();
    error WithdrawalsPausedError();
    error PauseNotAllowedYet();
    error PauseTooLong();
    error BelowMinimum();
    error AboveDepositCap();
    error AboveSenderDailyCap();
    error AboveGlobalDailyCap();
    error AmountMismatch();
    error InvalidSecretHash();
    error ZeroAmount();
    error NotLocked();
    error EthTransferFailed();
    error UnexpectedEth();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyGuardianOrAdmin() {
        if (msg.sender != guardian && msg.sender != admin) revert NotGuardianOrAdmin();
        _;
    }

    constructor(address _inbox, address _outbox, uint256 _rollupVersion, address _weth, address _admin, address _guardian) {
        if (_inbox == address(0) || _outbox == address(0) || _weth == address(0) || _admin == address(0) || _guardian == address(0)) {
            revert ZeroAddress();
        }
        inbox = IAztecInbox(_inbox);
        outbox = IAztecOutbox(_outbox);
        rollupVersion = _rollupVersion;
        weth = IWETH9(_weth);
        admin = _admin;
        guardian = _guardian;
    }

    /* ----------------------------------------------------------------- deposit */

    /// Locks `amount` of `token` and sends its private deposit message. Returns the Inbox key and index.
    function depositToAztecPrivate(address token, uint256 amount, bytes32 secretHash)
        external
        nonReentrant
        returns (bytes32 key, uint256 index)
    {
        Asset memory a = _checkDeposit(token, amount, secretHash);
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        // I1: exactly `amount` arrived, or the message would promise more than is locked.
        if (IERC20(token).balanceOf(address(this)) - before != amount) revert AmountMismatch();
        return _send(token, a, amount, secretHash);
    }

    /// Wraps the ETH sent and deposits it as WETH.
    function depositEthToAztecPrivate(bytes32 secretHash) external payable nonReentrant returns (bytes32 key, uint256 index) {
        Asset memory a = _checkDeposit(address(weth), msg.value, secretHash);
        uint256 before = IERC20(address(weth)).balanceOf(address(this));
        weth.deposit{value: msg.value}();
        if (IERC20(address(weth)).balanceOf(address(this)) - before != msg.value) revert AmountMismatch();
        return _send(address(weth), a, msg.value, secretHash);
    }

    function _checkDeposit(address token, uint256 amount, bytes32 secretHash) internal returns (Asset memory a) {
        if (successor != address(0) || depositsPaused) revert DepositsClosed();
        a = assets[token];
        if (!a.enabled) revert AssetNotEnabled();
        if (amount == 0) revert ZeroAmount();
        if (uint256(secretHash) == 0 || uint256(secretHash) >= AztecMessaging.FIELD_MODULUS) revert InvalidSecretHash();
        if (amount < a.minDeposit) revert BelowMinimum();
        if (amount > a.perDepositCap) revert AboveDepositCap();
        uint256 day = block.timestamp / 1 days;
        uint256 senderDay = senderDayVolume[token][msg.sender][day] + amount;
        if (senderDay > a.perSenderDailyCap) revert AboveSenderDailyCap();
        uint256 globalDay = globalDayVolume[token][day] + amount;
        if (globalDay > a.globalDailyCap) revert AboveGlobalDailyCap();
        senderDayVolume[token][msg.sender][day] = senderDay;
        globalDayVolume[token][day] = globalDay;
    }

    function _send(address token, Asset memory a, uint256 amount, bytes32 secretHash) internal returns (bytes32 key, uint256 index) {
        totalLocked[token] += amount;
        (key, index) = inbox.sendL2Message(
            AztecMessaging.L2Actor({actor: a.l2Token, version: rollupVersion}),
            AztecMessaging.mintToPrivateContent(amount),
            secretHash
        );
        emit DepositToAztecPrivate(token, msg.sender, amount, secretHash, key, index);
    }

    /* ---------------------------------------------------------------- withdraw */

    /**
     * Pays out a withdrawal proven by the Aztec Outbox. Anyone can call it unless the Aztec side
     * bound the withdrawal to a caller (withCaller). For WETH, `unwrap` pays ETH instead.
     */
    function withdraw(address token, address recipient, uint256 amount, bool withCaller, bool unwrap, OutboxProof calldata proof)
        external
        nonReentrant
    {
        if (block.timestamp < withdrawalsPausedUntil) revert WithdrawalsPausedError();
        if (amount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();
        bytes32 l2Token = assets[token].l2Token;
        if (l2Token == bytes32(0)) revert AssetNotEnabled();
        address caller = withCaller ? msg.sender : address(0);
        _consume(l2Token, AztecMessaging.withdrawContent(recipient, amount, caller), proof);
        // I1: a withdrawal can never exceed what was deposited.
        if (totalLocked[token] < amount) revert NotLocked();
        totalLocked[token] -= amount;
        emit Withdrawal(token, recipient, amount, caller, proof.epoch, proof.leafIndex);
        if (unwrap && token == address(weth)) {
            weth.withdraw(amount);
            // Slither arbitrary-send-eth: the recipient is fixed by the Outbox-proven message.
            // slither-disable-next-line arbitrary-send-eth
            (bool ok,) = recipient.call{value: amount}("");
            if (!ok) revert EthTransferFailed();
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }
    }

    function _consume(bytes32 l2Token, bytes32 content, OutboxProof calldata proof) internal {
        outbox.consume(
            AztecMessaging.L2ToL1Msg({
                sender: AztecMessaging.L2Actor({actor: l2Token, version: rollupVersion}),
                recipient: AztecMessaging.L1Actor({actor: address(this), chainId: block.chainid}),
                content: content
            }),
            proof.epoch,
            proof.numCheckpointsInEpoch,
            proof.leafIndex,
            proof.path
        );
    }

    /// Only WETH may send ETH here (unwrapping a withdrawal).
    receive() external payable {
        if (msg.sender != address(weth)) revert UnexpectedEth();
    }

    /* ------------------------------------------- immediate restrictions (I4) */

    function pauseDeposits() external onlyGuardianOrAdmin {
        depositsPaused = true;
        emit DepositsPaused(msg.sender);
    }

    /// Unpausing relaxes, but deposits are bounded by the caps: the admin may do it at once.
    function unpauseDeposits() external onlyAdmin {
        depositsPaused = false;
        emit DepositsUnpaused(msg.sender);
    }

    /// I5: at most MAX_WITHDRAW_PAUSE, then a cooldown before the next one.
    function pauseWithdrawals(uint64 duration) external onlyGuardianOrAdmin {
        if (duration == 0 || duration > MAX_WITHDRAW_PAUSE) revert PauseTooLong();
        if (block.timestamp < nextWithdrawPauseAllowedAt) revert PauseNotAllowedYet();
        uint64 until = uint64(block.timestamp) + duration;
        withdrawalsPausedUntil = until;
        nextWithdrawPauseAllowedAt = until + uint64(WITHDRAW_PAUSE_COOLDOWN);
        emit WithdrawalsPaused(until, msg.sender);
    }

    function disableAsset(address token) external onlyGuardianOrAdmin {
        assets[token].enabled = false;
        _dropQueuedAsset(token);
        emit AssetDisabled(token, msg.sender);
    }

    /// Lowers caps at once; any value above the current one is refused.
    function lowerCaps(address token, uint128 perDepositCap, uint128 perSenderDailyCap, uint128 globalDailyCap)
        external
        onlyGuardianOrAdmin
    {
        Asset storage a = assets[token];
        if (perDepositCap > a.perDepositCap || perSenderDailyCap > a.perSenderDailyCap || globalDailyCap > a.globalDailyCap) {
            revert InvalidCaps();
        }
        a.perDepositCap = perDepositCap;
        a.perSenderDailyCap = perSenderDailyCap;
        a.globalDailyCap = globalDailyCap;
        _dropQueuedAsset(token);
        emit CapsLowered(token, perDepositCap, perSenderDailyCap, globalDailyCap, msg.sender);
    }

    /// IR-02 (internal security review, 18 Nov 2026): an emergency restriction also drops any
    /// relaxation queued before it. Otherwise a change queued earlier (higher caps, enabled = true)
    /// could still be executed after the guardian disabled the asset or lowered its caps, undoing the
    /// restriction without a new, public TIMELOCK. Grants no new power: the guardian could already
    /// call cancelAsset. The admin can queue again, in public, and wait the full delay.
    function _dropQueuedAsset(address token) private {
        if (pendingAsset[token].eta != 0) {
            delete pendingAsset[token];
            emit AssetQueueCancelled(token);
        }
    }

    /* ---------------------------------------------- delayed relaxations (I4) */

    /// Registers an asset or changes its caps / enables it. The Aztec token is fixed at first registration (I3).
    function queueAsset(address token, Asset calldata asset) external onlyAdmin {
        if (token == address(0) || asset.l2Token == bytes32(0)) revert ZeroAddress();
        bytes32 bound = assets[token].l2Token;
        if (bound != bytes32(0) && bound != asset.l2Token) revert AssetAlreadyBound();
        if (
            asset.minDeposit > asset.perDepositCap || asset.perDepositCap > asset.perSenderDailyCap
                || asset.perSenderDailyCap > asset.globalDailyCap
        ) revert InvalidCaps();
        uint64 eta = uint64(block.timestamp + TIMELOCK);
        pendingAsset[token] = Pending({asset: asset, eta: eta});
        emit AssetQueued(token, asset, eta);
    }

    function executeAsset(address token) external onlyAdmin {
        Pending memory p = pendingAsset[token];
        if (p.eta == 0) revert NothingQueued();
        if (block.timestamp < p.eta) revert TooEarly();
        // Re-checked: another asset cannot have bound this token meanwhile, but keep I3 explicit.
        bytes32 bound = assets[token].l2Token;
        if (bound != bytes32(0) && bound != p.asset.l2Token) revert AssetAlreadyBound();
        assets[token] = p.asset;
        delete pendingAsset[token];
        emit AssetSet(token, p.asset);
    }

    /// The guardian can cancel a queued relaxation too: a compromised admin cannot push one through.
    function cancelAsset(address token) external onlyGuardianOrAdmin {
        delete pendingAsset[token];
        emit AssetQueueCancelled(token);
    }

    function queueAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        pendingAdmin = newAdmin;
        pendingAdminEta = uint64(block.timestamp + TIMELOCK);
        emit AdminQueued(newAdmin, pendingAdminEta);
    }

    /// The new admin accepts after the delay (proves the key works).
    function acceptAdmin() external {
        if (msg.sender != pendingAdmin || pendingAdmin == address(0)) revert NotAdmin();
        if (block.timestamp < pendingAdminEta) revert TooEarly();
        admin = pendingAdmin;
        pendingAdmin = address(0);
        pendingAdminEta = 0;
        emit AdminChanged(admin);
    }

    function queueGuardian(address newGuardian) external onlyAdmin {
        if (newGuardian == address(0)) revert ZeroAddress();
        pendingGuardian = newGuardian;
        pendingGuardianEta = uint64(block.timestamp + TIMELOCK);
        emit GuardianQueued(newGuardian, pendingGuardianEta);
    }

    function executeGuardian() external onlyAdmin {
        if (pendingGuardian == address(0)) revert NothingQueued();
        if (block.timestamp < pendingGuardianEta) revert TooEarly();
        guardian = pendingGuardian;
        pendingGuardian = address(0);
        pendingGuardianEta = 0;
        emit GuardianChanged(guardian);
    }

    /// Migration (Aztec upgrade or a new portal): deposits close forever, withdrawals stay open (I5).
    function queueSunset(address newSuccessor) external onlyAdmin {
        if (newSuccessor == address(0)) revert ZeroAddress();
        pendingSuccessor = newSuccessor;
        pendingSunsetEta = uint64(block.timestamp + TIMELOCK);
        emit SunsetQueued(newSuccessor, pendingSunsetEta);
    }

    function executeSunset() external onlyAdmin {
        if (pendingSuccessor == address(0)) revert NothingQueued();
        if (block.timestamp < pendingSunsetEta) revert TooEarly();
        successor = pendingSuccessor;
        pendingSuccessor = address(0);
        emit Sunset(successor);
    }

    /* -------------------------------------------------------------------- views */

    function today() external view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /// What `sender` may still deposit of `token` today (0 when closed).
    function remainingToday(address token, address sender) external view returns (uint256) {
        Asset memory a = assets[token];
        if (!a.enabled || depositsPaused || successor != address(0)) return 0;
        uint256 day = block.timestamp / 1 days;
        uint256 s = senderDayVolume[token][sender][day];
        uint256 g = globalDayVolume[token][day];
        uint256 bySender = a.perSenderDailyCap > s ? a.perSenderDailyCap - s : 0;
        uint256 byGlobal = a.globalDailyCap > g ? a.globalDailyCap - g : 0;
        uint256 m = bySender < byGlobal ? bySender : byGlobal;
        return m < a.perDepositCap ? m : a.perDepositCap;
    }
}
