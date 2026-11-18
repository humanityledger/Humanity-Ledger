// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HLPortal} from "../../../contracts/portal/HLPortal.sol";
import {HLReceiverFactory} from "../../../contracts/portal/HLReceiver.sol";
import {AztecMessaging} from "../../../contracts/portal/AztecMessaging.sol";
import {MockAztecInbox, MockAztecOutbox, MockWETH9, MockUSDT} from "../../../contracts/mocks/MockAztecMessaging.sol";
import {MockERC20} from "../../../contracts/mocks/MockERC20.sol";
import {MockFeeOnTransferERC20} from "../../../contracts/mocks/MockFeeOnTransferERC20.sol";

/// Shared deployment for the Foundry portal suites: the same assets and caps as test/portal/HLPortal.test.ts.
abstract contract PortalBase is Test {
    uint256 internal constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 internal constant VERSION = 679261766;
    bytes32 internal constant L2_DAI = bytes32(uint256(0x1d));
    bytes32 internal constant L2_WETH = bytes32(uint256(0x2e));
    bytes32 internal constant L2_USDT = bytes32(uint256(0x3f));
    bytes32 internal constant SECRET_HASH = bytes32(uint256(123456789));

    address internal admin = makeAddr("admin");
    address internal guardian = makeAddr("guardian");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    MockAztecInbox internal inbox;
    MockAztecOutbox internal outbox;
    MockWETH9 internal weth;
    MockERC20 internal dai;
    MockUSDT internal usdt;
    MockFeeOnTransferERC20 internal fot;
    HLPortal internal portal;
    HLReceiverFactory internal factory;

    function asset(bytes32 l2, uint128 minD, uint128 perDep, uint128 perSender, uint128 global_) internal pure returns (HLPortal.Asset memory) {
        return HLPortal.Asset({l2Token: l2, minDeposit: minD, perDepositCap: perDep, perSenderDailyCap: perSender, globalDailyCap: global_, enabled: true});
    }

    function defaultAsset(bytes32 l2) internal pure returns (HLPortal.Asset memory) {
        return asset(l2, 1 ether, 1000 ether, 2000 ether, 5000 ether);
    }

    function register(address token, HLPortal.Asset memory a) internal {
        vm.prank(admin);
        portal.queueAsset(token, a);
        vm.warp(block.timestamp + portal.TIMELOCK());
        vm.prank(admin);
        portal.executeAsset(token);
    }

    function deployPortal() internal {
        vm.warp(1_800_000_000);
        inbox = new MockAztecInbox();
        outbox = new MockAztecOutbox();
        weth = new MockWETH9();
        dai = new MockERC20();
        usdt = new MockUSDT();
        fot = new MockFeeOnTransferERC20();
        portal = new HLPortal(address(inbox), address(outbox), VERSION, address(weth), admin, guardian);
        factory = new HLReceiverFactory(address(portal));
        register(address(dai), defaultAsset(L2_DAI));
        register(address(weth), defaultAsset(L2_WETH));
        register(address(usdt), asset(L2_USDT, 1e6, 1000e6, 2000e6, 5000e6));
    }

    function fundAndApprove(address who, uint256 amount) internal {
        dai.mint(who, amount);
        vm.prank(who);
        dai.approve(address(portal), amount);
    }

    /// Registers a withdrawal message as proven in the mock Outbox and returns its proof.
    function prove(bytes32 l2, address recipient, uint256 amount, address caller, uint256 leaf)
        internal
        returns (HLPortal.OutboxProof memory p)
    {
        outbox.prove(l2, VERSION, address(portal), block.chainid, AztecMessaging.withdrawContent(recipient, amount, caller), 0, leaf);
        p = HLPortal.OutboxProof({epoch: 0, numCheckpointsInEpoch: 1, leafIndex: leaf, path: new bytes32[](0)});
    }
}
