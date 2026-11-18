// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {PortalBase} from "./utils/PortalBase.sol";
import {HLPortal} from "../../contracts/portal/HLPortal.sol";
import {AztecMessaging} from "../../contracts/portal/AztecMessaging.sol";

/// WETH whose deposit() credits nothing: the portal must refuse to send a message for it (I1).
contract ShortWETH {
    mapping(address => uint256) public balanceOf;
    function deposit() external payable {}
    function withdraw(uint256) external {}
}

/// A recipient that refuses ETH.
contract RefusesEth {
    receive() external payable {
        revert("no");
    }
}

/// Every branch of HLPortal, with fuzzed amounts where the amount matters. Hardhat has the
/// scenario suite (test/portal/HLPortal.test.ts); this one is what coverage and Gambit measure.
contract HLPortalTest is PortalBase {
    function setUp() public {
        deployPortal();
    }

    /* ------------------------------------------------------------ constructor */

    function test_constructor_refuses_zero_addresses() public {
        for (uint256 i; i < 5; ++i) {
            // A fresh array each time: memory arrays are references.
            address[5] memory b = [address(inbox), address(outbox), address(weth), admin, guardian];
            b[i] = address(0);
            vm.expectRevert(HLPortal.ZeroAddress.selector);
            new HLPortal(b[0], b[1], VERSION, b[2], b[3], b[4]);
        }
    }

    /* ---------------------------------------------------------------- deposit */

    function testFuzz_deposit_locks_exactly_and_sends_amount_only(uint256 amount) public {
        amount = bound(amount, 1 ether, 1000 ether);
        fundAndApprove(alice, amount);
        vm.prank(alice);
        (bytes32 key, uint256 index) = portal.depositToAztecPrivate(address(dai), amount, SECRET_HASH);
        assertEq(dai.balanceOf(address(portal)), amount);
        assertEq(portal.totalLocked(address(dai)), amount);
        (address sender, bytes32 recipient, uint256 version, bytes32 content, bytes32 sh, uint256 idx) = inbox.messages(index);
        assertEq(sender, address(portal));
        assertEq(recipient, L2_DAI);
        assertEq(version, VERSION);
        assertEq(content, AztecMessaging.mintToPrivateContent(amount));
        assertEq(sh, SECRET_HASH);
        assertEq(idx, index);
        assertTrue(key != bytes32(0));
    }

    function test_deposit_refusals() public {
        fundAndApprove(alice, 10_000 ether);
        vm.startPrank(alice);
        vm.expectRevert(HLPortal.AssetNotEnabled.selector);
        portal.depositToAztecPrivate(address(fot), 1 ether, SECRET_HASH);
        vm.expectRevert(HLPortal.ZeroAmount.selector);
        portal.depositToAztecPrivate(address(dai), 0, SECRET_HASH);
        vm.expectRevert(HLPortal.InvalidSecretHash.selector);
        portal.depositToAztecPrivate(address(dai), 1 ether, bytes32(0));
        vm.expectRevert(HLPortal.InvalidSecretHash.selector);
        portal.depositToAztecPrivate(address(dai), 1 ether, bytes32(FIELD));
        vm.expectRevert(HLPortal.BelowMinimum.selector);
        portal.depositToAztecPrivate(address(dai), 1 ether - 1, SECRET_HASH);
        vm.expectRevert(HLPortal.AboveDepositCap.selector);
        portal.depositToAztecPrivate(address(dai), 1000 ether + 1, SECRET_HASH);
        portal.depositToAztecPrivate(address(dai), 1000 ether, SECRET_HASH);
        portal.depositToAztecPrivate(address(dai), 1000 ether, SECRET_HASH);
        vm.expectRevert(HLPortal.AboveSenderDailyCap.selector);
        portal.depositToAztecPrivate(address(dai), 1 ether, SECRET_HASH);
        vm.stopPrank();
        assertEq(portal.remainingToday(address(dai), alice), 0);
    }

    function test_global_daily_cap_and_the_next_day() public {
        address[3] memory who = [alice, bob, stranger];
        for (uint256 i; i < 3; ++i) fundAndApprove(who[i], 3000 ether);
        vm.startPrank(alice);
        portal.depositToAztecPrivate(address(dai), 1000 ether, SECRET_HASH);
        portal.depositToAztecPrivate(address(dai), 1000 ether, SECRET_HASH);
        vm.stopPrank();
        vm.startPrank(bob);
        portal.depositToAztecPrivate(address(dai), 1000 ether, SECRET_HASH);
        portal.depositToAztecPrivate(address(dai), 1000 ether, SECRET_HASH);
        vm.stopPrank();
        // Global 5000: 1000 left, stranger's own cap 2000: min is 1000, also the per-deposit cap.
        assertEq(portal.remainingToday(address(dai), stranger), 1000 ether);
        vm.startPrank(stranger);
        portal.depositToAztecPrivate(address(dai), 999 ether, SECRET_HASH);
        assertEq(portal.remainingToday(address(dai), stranger), 1 ether);
        vm.expectRevert(HLPortal.AboveGlobalDailyCap.selector);
        portal.depositToAztecPrivate(address(dai), 2 ether, SECRET_HASH);
        vm.stopPrank();
        vm.warp(block.timestamp + 1 days);
        assertEq(portal.today(), block.timestamp / 1 days);
        assertEq(portal.remainingToday(address(dai), alice), 1000 ether);
    }

    function test_fee_on_transfer_token_is_refused_I1() public {
        register(address(fot), defaultAsset(bytes32(uint256(0x44))));
        fot.mint(alice, 10 ether);
        vm.startPrank(alice);
        fot.approve(address(portal), 10 ether);
        vm.expectRevert(HLPortal.AmountMismatch.selector);
        portal.depositToAztecPrivate(address(fot), 5 ether, SECRET_HASH);
        vm.stopPrank();
    }

    function testFuzz_eth_deposit_wraps(uint256 amount) public {
        amount = bound(amount, 1 ether, 1000 ether);
        vm.deal(alice, amount);
        vm.prank(alice);
        portal.depositEthToAztecPrivate{value: amount}(SECRET_HASH);
        assertEq(weth.balanceOf(address(portal)), amount);
        assertEq(portal.totalLocked(address(weth)), amount);
    }

    /// Gambit survivor #20 (run 44275884943): the balance check must hold with WETH already held.
    function test_second_eth_deposit_checks_the_difference() public {
        vm.deal(alice, 5 ether);
        vm.startPrank(alice);
        portal.depositEthToAztecPrivate{value: 2 ether}(SECRET_HASH);
        portal.depositEthToAztecPrivate{value: 3 ether}(SECRET_HASH);
        vm.stopPrank();
        assertEq(portal.totalLocked(address(weth)), 5 ether);
    }

    function test_eth_deposit_with_a_short_weth_is_refused() public {
        ShortWETH w = new ShortWETH();
        HLPortal p = new HLPortal(address(inbox), address(outbox), VERSION, address(w), admin, guardian);
        vm.prank(admin);
        p.queueAsset(address(w), defaultAsset(L2_WETH));
        vm.warp(block.timestamp + p.TIMELOCK());
        vm.prank(admin);
        p.executeAsset(address(w));
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vm.expectRevert(HLPortal.AmountMismatch.selector);
        p.depositEthToAztecPrivate{value: 2 ether}(SECRET_HASH);
    }

    function test_usdt_style_token_deposits() public {
        usdt.mint(alice, 10e6);
        vm.startPrank(alice);
        usdt.approve(address(portal), 10e6);
        portal.depositToAztecPrivate(address(usdt), 10e6, SECRET_HASH);
        vm.stopPrank();
        assertEq(portal.totalLocked(address(usdt)), 10e6);
    }

    function test_unexpected_eth_is_refused() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(portal).call{value: 1 ether}("");
        assertFalse(ok);
    }

    /* --------------------------------------------------------------- withdraw */

    function _deposit(uint256 amount) internal {
        fundAndApprove(alice, amount);
        vm.prank(alice);
        portal.depositToAztecPrivate(address(dai), amount, SECRET_HASH);
    }

    function testFuzz_withdraw_pays_the_proven_amount_once(uint256 amount, address to) public {
        vm.assume(to != address(0) && to != address(portal));
        amount = bound(amount, 1, 1000 ether);
        _deposit(1000 ether);
        HLPortal.OutboxProof memory p = prove(L2_DAI, to, amount, address(0), 7);
        uint256 before = dai.balanceOf(to);
        vm.prank(stranger);
        portal.withdraw(address(dai), to, amount, false, false, p);
        assertEq(dai.balanceOf(to) - before, amount);
        assertEq(portal.totalLocked(address(dai)), 1000 ether - amount);
        vm.expectRevert(bytes("Outbox: already consumed"));
        portal.withdraw(address(dai), to, amount, false, false, p);
    }

    function test_withdraw_refusals() public {
        _deposit(100 ether);
        HLPortal.OutboxProof memory p = prove(L2_DAI, bob, 10 ether, address(0), 1);
        vm.expectRevert(HLPortal.ZeroAmount.selector);
        portal.withdraw(address(dai), bob, 0, false, false, p);
        vm.expectRevert(HLPortal.ZeroAddress.selector);
        portal.withdraw(address(dai), address(0), 10 ether, false, false, p);
        vm.expectRevert(HLPortal.AssetNotEnabled.selector);
        portal.withdraw(address(fot), bob, 10 ether, false, false, p);
        // A different amount is a different message: not in the tree.
        vm.expectRevert(bytes("Outbox: not in tree"));
        portal.withdraw(address(dai), bob, 11 ether, false, false, p);
    }

    function test_withdraw_cannot_exceed_what_is_locked() public {
        _deposit(10 ether);
        HLPortal.OutboxProof memory p = prove(L2_DAI, bob, 11 ether, address(0), 1);
        vm.expectRevert(HLPortal.NotLocked.selector);
        portal.withdraw(address(dai), bob, 11 ether, false, false, p);
    }

    function test_withdraw_bound_to_a_caller() public {
        _deposit(10 ether);
        HLPortal.OutboxProof memory p = prove(L2_DAI, bob, 5 ether, alice, 2);
        vm.prank(stranger);
        vm.expectRevert(bytes("Outbox: not in tree"));
        portal.withdraw(address(dai), bob, 5 ether, true, false, p);
        vm.prank(alice);
        portal.withdraw(address(dai), bob, 5 ether, true, false, p);
        assertEq(dai.balanceOf(bob), 5 ether);
    }

    function test_weth_withdraw_unwrapped_or_not() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        portal.depositEthToAztecPrivate{value: 10 ether}(SECRET_HASH);
        HLPortal.OutboxProof memory p1 = prove(L2_WETH, bob, 3 ether, address(0), 1);
        portal.withdraw(address(weth), bob, 3 ether, false, true, p1);
        assertEq(bob.balance, 3 ether);
        HLPortal.OutboxProof memory p2 = prove(L2_WETH, bob, 2 ether, address(0), 2);
        portal.withdraw(address(weth), bob, 2 ether, false, false, p2);
        assertEq(weth.balanceOf(bob), 2 ether);
        // unwrap on a token that is not WETH pays the token.
        _deposit(10 ether);
        HLPortal.OutboxProof memory p3 = prove(L2_DAI, bob, 1 ether, address(0), 3);
        portal.withdraw(address(dai), bob, 1 ether, false, true, p3);
        assertEq(dai.balanceOf(bob), 1 ether);
    }

    function test_eth_to_a_refusing_recipient_reverts_and_leaves_the_message() public {
        RefusesEth r = new RefusesEth();
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        portal.depositEthToAztecPrivate{value: 10 ether}(SECRET_HASH);
        HLPortal.OutboxProof memory p = prove(L2_WETH, address(r), 1 ether, address(0), 1);
        vm.expectRevert(HLPortal.EthTransferFailed.selector);
        portal.withdraw(address(weth), address(r), 1 ether, false, true, p);
        // The message was not consumed: it can still be paid as WETH.
        portal.withdraw(address(weth), address(r), 1 ether, false, false, p);
        assertEq(weth.balanceOf(address(r)), 1 ether);
    }

    /* ------------------------------------------------- restrictions (I4, I5) */

    function test_pause_and_unpause_deposits() public {
        fundAndApprove(alice, 10 ether);
        vm.prank(stranger);
        vm.expectRevert(HLPortal.NotGuardianOrAdmin.selector);
        portal.pauseDeposits();
        vm.prank(guardian);
        portal.pauseDeposits();
        vm.prank(alice);
        vm.expectRevert(HLPortal.DepositsClosed.selector);
        portal.depositToAztecPrivate(address(dai), 1 ether, SECRET_HASH);
        assertEq(portal.remainingToday(address(dai), alice), 0);
        vm.prank(guardian);
        vm.expectRevert(HLPortal.NotAdmin.selector);
        portal.unpauseDeposits();
        vm.prank(admin);
        portal.unpauseDeposits();
        vm.prank(alice);
        portal.depositToAztecPrivate(address(dai), 1 ether, SECRET_HASH);
    }

    function test_withdrawal_pause_is_bounded_I5() public {
        _deposit(10 ether);
        vm.startPrank(guardian);
        vm.expectRevert(HLPortal.PauseTooLong.selector);
        portal.pauseWithdrawals(0);
        uint64 max = uint64(portal.MAX_WITHDRAW_PAUSE());
        vm.expectRevert(HLPortal.PauseTooLong.selector);
        portal.pauseWithdrawals(max + 1);
        portal.pauseWithdrawals(max);
        vm.stopPrank();
        HLPortal.OutboxProof memory p = prove(L2_DAI, bob, 1 ether, address(0), 1);
        vm.expectRevert(HLPortal.WithdrawalsPausedError.selector);
        portal.withdraw(address(dai), bob, 1 ether, false, false, p);
        vm.warp(block.timestamp + max);
        portal.withdraw(address(dai), bob, 1 ether, false, false, p);
        // Cooldown before the next pause.
        vm.prank(guardian);
        vm.expectRevert(HLPortal.PauseNotAllowedYet.selector);
        portal.pauseWithdrawals(1);
        vm.warp(block.timestamp + portal.WITHDRAW_PAUSE_COOLDOWN());
        vm.prank(guardian);
        portal.pauseWithdrawals(1);
    }

    function test_disable_and_lower_caps() public {
        vm.prank(stranger);
        vm.expectRevert(HLPortal.NotGuardianOrAdmin.selector);
        portal.disableAsset(address(dai));
        vm.startPrank(guardian);
        vm.expectRevert(HLPortal.InvalidCaps.selector);
        portal.lowerCaps(address(dai), 1001 ether, 1 ether, 1 ether);
        vm.expectRevert(HLPortal.InvalidCaps.selector);
        portal.lowerCaps(address(dai), 1 ether, 2001 ether, 1 ether);
        vm.expectRevert(HLPortal.InvalidCaps.selector);
        portal.lowerCaps(address(dai), 1 ether, 1 ether, 5001 ether);
        portal.lowerCaps(address(dai), 10 ether, 20 ether, 30 ether);
        (, uint128 minD, uint128 perDep, uint128 perSender, uint128 global_, bool enabled) = portal.assets(address(dai));
        assertEq(minD, 1 ether);
        assertEq(perDep, 10 ether);
        assertEq(perSender, 20 ether);
        assertEq(global_, 30 ether);
        assertTrue(enabled);
        portal.disableAsset(address(dai));
        vm.stopPrank();
        assertEq(portal.remainingToday(address(dai), alice), 0);
        fundAndApprove(alice, 10 ether);
        vm.prank(alice);
        vm.expectRevert(HLPortal.AssetNotEnabled.selector);
        portal.depositToAztecPrivate(address(dai), 1 ether, SECRET_HASH);
    }

    /// With nothing queued, a restriction emits no cancellation (Gambit survivor #112).
    function test_restriction_without_a_queue_emits_no_cancellation() public {
        vm.recordLogs();
        vm.startPrank(guardian);
        portal.lowerCaps(address(dai), 10 ether, 10 ether, 10 ether);
        portal.disableAsset(address(dai));
        vm.stopPrank();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) assertTrue(logs[i].topics[0] != HLPortal.AssetQueueCancelled.selector);
    }

    /// An executed change is spent: executing again finds nothing (Gambit survivor #132).
    function test_executed_asset_change_is_spent() public {
        vm.prank(admin);
        portal.queueAsset(address(dai), asset(L2_DAI, 1 ether, 1500 ether, 2000 ether, 5000 ether));
        vm.warp(block.timestamp + portal.TIMELOCK());
        vm.startPrank(admin);
        portal.executeAsset(address(dai));
        (, uint64 eta) = portal.pendingAsset(address(dai));
        assertEq(eta, 0);
        vm.expectRevert(HLPortal.NothingQueued.selector);
        portal.executeAsset(address(dai));
        vm.stopPrank();
    }

    /// IR-02: a restriction drops a relaxation queued before it.
    function test_IR02_restriction_drops_the_queued_relaxation() public {
        vm.prank(admin);
        portal.queueAsset(address(dai), asset(L2_DAI, 1 ether, 1500 ether, 2000 ether, 5000 ether));
        vm.prank(guardian);
        portal.disableAsset(address(dai));
        (, uint64 eta) = portal.pendingAsset(address(dai));
        assertEq(eta, 0);
        vm.warp(block.timestamp + portal.TIMELOCK());
        vm.prank(admin);
        vm.expectRevert(HLPortal.NothingQueued.selector);
        portal.executeAsset(address(dai));

        vm.prank(admin);
        portal.queueAsset(address(dai), asset(L2_DAI, 1 ether, 1500 ether, 2000 ether, 5000 ether));
        vm.prank(guardian);
        portal.lowerCaps(address(dai), 0, 0, 0);
        (, eta) = portal.pendingAsset(address(dai));
        assertEq(eta, 0);
    }

    /* ------------------------------------------------------- timelock (I3, I4) */

    function test_queue_asset_rules() public {
        vm.prank(stranger);
        vm.expectRevert(HLPortal.NotAdmin.selector);
        portal.queueAsset(address(dai), defaultAsset(L2_DAI));
        vm.startPrank(admin);
        vm.expectRevert(HLPortal.ZeroAddress.selector);
        portal.queueAsset(address(0), defaultAsset(L2_DAI));
        vm.expectRevert(HLPortal.ZeroAddress.selector);
        portal.queueAsset(address(dai), defaultAsset(bytes32(0)));
        vm.expectRevert(HLPortal.AssetAlreadyBound.selector);
        portal.queueAsset(address(dai), defaultAsset(bytes32(uint256(0x99))));
        vm.expectRevert(HLPortal.InvalidCaps.selector);
        portal.queueAsset(address(dai), asset(L2_DAI, 2000 ether, 1000 ether, 2000 ether, 5000 ether));
        vm.expectRevert(HLPortal.InvalidCaps.selector);
        portal.queueAsset(address(dai), asset(L2_DAI, 1 ether, 3000 ether, 2000 ether, 5000 ether));
        vm.expectRevert(HLPortal.InvalidCaps.selector);
        portal.queueAsset(address(dai), asset(L2_DAI, 1 ether, 1000 ether, 6000 ether, 5000 ether));
        portal.queueAsset(address(dai), asset(L2_DAI, 1 ether, 1500 ether, 2000 ether, 5000 ether));
        vm.expectRevert(HLPortal.TooEarly.selector);
        portal.executeAsset(address(dai));
        vm.stopPrank();
        vm.prank(stranger);
        vm.expectRevert(HLPortal.NotGuardianOrAdmin.selector);
        portal.cancelAsset(address(dai));
        vm.prank(guardian);
        portal.cancelAsset(address(dai));
        vm.warp(block.timestamp + portal.TIMELOCK());
        vm.prank(admin);
        vm.expectRevert(HLPortal.NothingQueued.selector);
        portal.executeAsset(address(dai));
        vm.prank(stranger);
        vm.expectRevert(HLPortal.NotAdmin.selector);
        portal.executeAsset(address(dai));
    }

    function testFuzz_execute_before_eta_reverts(uint256 dt) public {
        dt = bound(dt, 0, portal.TIMELOCK() - 1);
        vm.prank(admin);
        portal.queueAsset(address(dai), asset(L2_DAI, 1 ether, 1500 ether, 2000 ether, 5000 ether));
        vm.warp(block.timestamp + dt);
        vm.prank(admin);
        vm.expectRevert(HLPortal.TooEarly.selector);
        portal.executeAsset(address(dai));
    }

    function test_admin_rotation() public {
        vm.prank(stranger);
        vm.expectRevert(HLPortal.NotAdmin.selector);
        portal.queueAdmin(bob);
        vm.startPrank(admin);
        vm.expectRevert(HLPortal.ZeroAddress.selector);
        portal.queueAdmin(address(0));
        portal.queueAdmin(bob);
        vm.stopPrank();
        vm.prank(stranger);
        vm.expectRevert(HLPortal.NotAdmin.selector);
        portal.acceptAdmin();
        vm.prank(bob);
        vm.expectRevert(HLPortal.TooEarly.selector);
        portal.acceptAdmin();
        vm.warp(block.timestamp + portal.TIMELOCK());
        vm.prank(bob);
        portal.acceptAdmin();
        assertEq(portal.admin(), bob);
        assertEq(portal.pendingAdmin(), address(0));
        assertEq(portal.pendingAdminEta(), 0);
        // Nobody is pending any more: even the zero address cannot accept.
        vm.prank(address(0));
        vm.expectRevert(HLPortal.NotAdmin.selector);
        portal.acceptAdmin();
    }

    function test_guardian_rotation() public {
        vm.startPrank(admin);
        vm.expectRevert(HLPortal.ZeroAddress.selector);
        portal.queueGuardian(address(0));
        vm.expectRevert(HLPortal.NothingQueued.selector);
        portal.executeGuardian();
        portal.queueGuardian(bob);
        vm.expectRevert(HLPortal.TooEarly.selector);
        portal.executeGuardian();
        vm.warp(block.timestamp + portal.TIMELOCK());
        portal.executeGuardian();
        vm.stopPrank();
        assertEq(portal.guardian(), bob);
        assertEq(portal.pendingGuardian(), address(0));
        assertEq(portal.pendingGuardianEta(), 0);
        vm.prank(guardian);
        vm.expectRevert(HLPortal.NotAdmin.selector);
        portal.queueGuardian(guardian);
    }

    function test_sunset_closes_deposits_and_keeps_withdrawals() public {
        _deposit(10 ether);
        vm.startPrank(admin);
        vm.expectRevert(HLPortal.ZeroAddress.selector);
        portal.queueSunset(address(0));
        vm.expectRevert(HLPortal.NothingQueued.selector);
        portal.executeSunset();
        portal.queueSunset(bob);
        vm.expectRevert(HLPortal.TooEarly.selector);
        portal.executeSunset();
        vm.warp(block.timestamp + portal.TIMELOCK());
        portal.executeSunset();
        assertEq(portal.pendingSuccessor(), address(0));
        vm.expectRevert(HLPortal.NothingQueued.selector);
        portal.executeSunset();
        vm.stopPrank();
        assertEq(portal.successor(), bob);
        fundAndApprove(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(HLPortal.DepositsClosed.selector);
        portal.depositToAztecPrivate(address(dai), 1 ether, SECRET_HASH);
        assertEq(portal.remainingToday(address(dai), alice), 0);
        HLPortal.OutboxProof memory p = prove(L2_DAI, bob, 10 ether, address(0), 1);
        portal.withdraw(address(dai), bob, 10 ether, false, false, p);
        assertEq(portal.totalLocked(address(dai)), 0);
    }

    function test_remaining_today_when_the_sender_is_the_limit() public {
        fundAndApprove(alice, 2000 ether);
        vm.startPrank(alice);
        portal.depositToAztecPrivate(address(dai), 1000 ether, SECRET_HASH);
        portal.depositToAztecPrivate(address(dai), 1500 ether - 1000 ether, SECRET_HASH);
        vm.stopPrank();
        assertEq(portal.remainingToday(address(dai), alice), 500 ether);
        // Caps lowered below what was already deposited today: nothing remains, no underflow.
        vm.prank(guardian);
        portal.lowerCaps(address(dai), 10 ether, 10 ether, 10 ether);
        assertEq(portal.remainingToday(address(dai), alice), 0);
        assertEq(portal.remainingToday(address(dai), bob), 0);
    }
}
