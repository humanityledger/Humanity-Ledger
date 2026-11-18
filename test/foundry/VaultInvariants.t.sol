// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HumanTimeLock} from "../../contracts/civilization/HumanTimeLock.sol";
import {HumanityTimeLockVault} from "../../contracts/HumanityTimeLockVault.sol";
import {LedgerDeadmanSwitch} from "../../contracts/security/LedgerDeadmanSwitch.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";

/* ======================================================== HumanTimeLock */

contract TimeLockHandler is Test {
    HumanTimeLock public tl;
    address[3] public users;
    mapping(address => uint256) public maxUnlock;
    uint256 public held;
    uint256 public earlyWithdrawals;

    constructor(HumanTimeLock t) {
        tl = t;
        users = [makeAddr("u0"), makeAddr("u1"), makeAddr("u2")];
    }

    function lock(uint256 who, uint256 value, uint256 duration) external {
        address u = users[who % 3];
        value = bound(value, 1, 100 ether);
        duration = bound(duration, 1, 400 days);
        vm.deal(u, value);
        vm.prank(u);
        tl.lock{value: value}(duration);
        held += value;
        if (block.timestamp + duration > maxUnlock[u]) maxUnlock[u] = block.timestamp + duration;
    }

    function withdraw(uint256 who) external {
        address u = users[who % 3];
        (uint256 amount,) = tl.locks(u);
        bool early = block.timestamp < maxUnlock[u];
        vm.prank(u);
        try tl.withdraw() {
            held -= amount;
            if (early) earlyWithdrawals++;
        } catch {}
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 1, 60 days));
    }
}

/* ================================================ HumanityTimeLockVault */

contract VaultHandler is Test {
    HumanityTimeLockVault public v;
    MockERC20 public token;
    address[3] public owners;
    address public backup;
    mapping(address => uint256) public lastActive;
    mapping(address => uint256) public timeoutOf;
    uint256 public earlyTriggers;
    uint256 public strangerTookFunds;
    uint256 public deposited;
    uint256 public withdrawnByOwners;
    uint256 public sweptToBackup;

    constructor(HumanityTimeLockVault vault, MockERC20 t) {
        v = vault;
        token = t;
        owners = [makeAddr("o0"), makeAddr("o1"), makeAddr("o2")];
        backup = makeAddr("backup");
    }

    function setup(uint256 who, uint256 timeout) external {
        address o = owners[who % 3];
        timeout = bound(timeout, 1 hours, 30 days);
        vm.prank(o);
        v.setupVault(timeout, backup);
        lastActive[o] = block.timestamp;
        timeoutOf[o] = timeout;
    }

    function deposit(uint256 who, uint256 amount) external {
        address o = owners[who % 3];
        amount = bound(amount, 1, 1e24);
        token.mint(o, amount);
        vm.startPrank(o);
        token.approve(address(v), amount);
        try v.depositToken(address(token), amount) {
            deposited += amount;
        } catch {}
        vm.stopPrank();
    }

    function withdraw(uint256 who, uint256 amount) external {
        address o = owners[who % 3];
        uint256 bal = v.vaultBalances(o, address(token));
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(o);
        try v.withdrawToken(address(token), amount) {
            withdrawnByOwners += amount;
            lastActive[o] = block.timestamp;
        } catch {}
    }

    function ping(uint256 who) external {
        address o = owners[who % 3];
        vm.prank(o);
        try v.pingHeartbeat() {
            lastActive[o] = block.timestamp;
        } catch {}
    }

    function execute(uint256 who, uint256 caller) external {
        address o = owners[who % 3];
        uint256 bal = v.vaultBalances(o, address(token));
        (, , , bool triggered) = v.vaults(o);
        bool early = !triggered && block.timestamp <= lastActive[o] + timeoutOf[o];
        uint256 before = token.balanceOf(backup);
        vm.prank(address(uint160(0xC0FFEE + caller % 5)));
        try v.executeDeadManSwitch(o) {
            if (early) earlyTriggers++;
            uint256 moved = token.balanceOf(backup) - before;
            if (moved != bal) strangerTookFunds++;
            sweptToBackup += moved;
        } catch {}
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 1, 20 days));
    }
}

/* ================================================== LedgerDeadmanSwitch */

contract DeadmanHandler is Test {
    LedgerDeadmanSwitch public d;
    MockERC20 public token;
    address public owner;
    address public backup;
    uint256 public lastPing;
    uint256 public earlyTriggers;
    uint256 public strangerTriggers;
    uint256 public backupSwaps; // backup changed before the cooldown

    constructor(LedgerDeadmanSwitch s, MockERC20 t, address o, address b) {
        d = s;
        token = t;
        owner = o;
        backup = b;
        lastPing = block.timestamp;
    }

    function ping() external {
        vm.prank(owner);
        try d.ping() {
            lastPing = block.timestamp;
        } catch {}
    }

    function proposeBackup(address n) external {
        vm.prank(owner);
        try d.proposeBackupWallet(n) {} catch {}
    }

    function confirmBackup() external {
        uint256 eta = d.pendingBackupTime();
        bool early = block.timestamp < eta;
        vm.prank(owner);
        try d.confirmBackupWallet() {
            if (early) backupSwaps++;
            backup = d.backupWallet();
        } catch {}
    }

    function trigger(uint256 who) external {
        address caller = who % 3 == 0 ? d.backupWallet() : who % 3 == 1 ? owner : makeAddr("stranger");
        bool early = block.timestamp <= lastPing + d.timeoutPeriod();
        address[] memory erc20 = new address[](1);
        erc20[0] = address(token);
        vm.prank(caller);
        try d.triggerInheritance(erc20, new address[](0), new uint256[](0)) {
            if (early) earlyTriggers++;
            if (caller != d.backupWallet() && caller != owner) strangerTriggers++;
        } catch {}
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 1, 40 days));
    }
}

contract VaultInvariantsTest is Test {
    HumanTimeLock internal tl;
    TimeLockHandler internal th;
    HumanityTimeLockVault internal vault;
    VaultHandler internal vh;
    LedgerDeadmanSwitch internal dms;
    DeadmanHandler internal dh;
    MockERC20 internal token;
    address internal owner = makeAddr("dms-owner");

    function setUp() public {
        vm.warp(1_800_000_000);
        token = new MockERC20();
        tl = new HumanTimeLock();
        th = new TimeLockHandler(tl);
        vault = new HumanityTimeLockVault();
        vh = new VaultHandler(vault, token);
        dms = new LedgerDeadmanSwitch(owner, makeAddr("dms-backup"), 90);
        token.mint(owner, 1_000_000 ether);
        vm.prank(owner);
        token.approve(address(dms), type(uint256).max);
        dh = new DeadmanHandler(dms, token, owner, makeAddr("dms-backup"));
        targetContract(address(th));
        targetContract(address(vh));
        targetContract(address(dh));
    }

    /// HumanTimeLock (IA-05): no withdrawal before the latest unlock time ever set; ETH is conserved.
    function invariant_timelock_never_shortens() public view {
        assertEq(th.earlyWithdrawals(), 0);
        assertEq(address(tl).balance, th.held());
    }

    /// HumanityTimeLockVault: the token balance equals the recorded balances; no early sweep.
    function invariant_vault_books_balance() public view {
        uint256 sum;
        for (uint256 i; i < 3; ++i) sum += vault.vaultBalances(vh.owners(i), address(token));
        assertEq(token.balanceOf(address(vault)), sum);
        assertEq(vh.deposited(), sum + vh.withdrawnByOwners() + vh.sweptToBackup());
        assertEq(vh.earlyTriggers(), 0);
        assertEq(vh.strangerTookFunds(), 0);
    }

    /// LedgerDeadmanSwitch: holds nothing, triggers only after the timeout and only for owner/backup.
    function invariant_deadman_rules() public view {
        assertEq(token.balanceOf(address(dms)), 0);
        assertEq(address(dms).balance, 0);
        assertEq(dh.earlyTriggers(), 0);
        assertEq(dh.strangerTriggers(), 0);
        assertEq(dh.backupSwaps(), 0);
    }
}
