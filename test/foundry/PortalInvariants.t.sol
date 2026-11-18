// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PortalBase} from "./utils/PortalBase.sol";
import {HLPortal} from "../../contracts/portal/HLPortal.sol";
import {HLReceiver, HLReceiverFactory} from "../../contracts/portal/HLReceiver.sol";
import {AztecMessaging} from "../../contracts/portal/AztecMessaging.sol";
import {MockAztecOutbox} from "../../contracts/mocks/MockAztecMessaging.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";

/// Random sequences of deposits, receiver forwards and rescues, proven and unproven withdrawals,
/// guardian restrictions, admin relaxations and time. Ghost variables record what the contracts
/// must never do; the invariants below check them after every call.
contract PortalHandler is Test {
    uint256 internal constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    bytes32 internal constant RESCUE_TYPEHASH =
        keccak256("Rescue(address token,address to,uint256 amount,uint256 nonce,uint256 deadline)");

    HLPortal public portal;
    HLReceiverFactory public factory;
    MockAztecOutbox public outbox;
    MockERC20 public dai;
    bytes32 public l2;
    uint256 public version;
    address public admin;
    address public guardian;

    address[4] public actors;
    HLReceiver[3] public receivers;
    uint256[3] internal keys;

    uint256 public deposited;
    uint256 public withdrawn;
    uint256 public fundedToReceivers;
    uint256 public rescued;
    uint256 public forwarded;
    uint256 public outsideCaps; // deposits accepted outside the caps / pause in force
    uint256 public doubleSpends; // a proven withdrawal paid twice
    uint256 public unprovenPaid; // a withdrawal paid without a proof
    uint256 public badRescues; // a rescue accepted without the signer's signature
    uint256 public wrongCallerPaid; // a caller-bound withdrawal paid to another caller

    struct Proven {
        address recipient;
        uint256 amount;
        address caller;
        uint256 leaf;
        bool paid;
    }

    Proven[] public proven;
    uint256 internal nextLeaf = 1;

    constructor(HLPortal p, HLReceiverFactory f, MockAztecOutbox o, MockERC20 d, bytes32 l2Token, uint256 v, address a, address g) {
        portal = p;
        factory = f;
        outbox = o;
        dai = d;
        l2 = l2Token;
        version = v;
        admin = a;
        guardian = g;
        actors = [makeAddr("a0"), makeAddr("a1"), makeAddr("a2"), makeAddr("a3")];
        for (uint256 i; i < 3; ++i) {
            keys[i] = uint256(keccak256(abi.encode("rescue", i))) % 1e70 + 1;
            receivers[i] = HLReceiver(payable(f.deploy(bytes32(uint256(1000 + i)), vm.addr(keys[i]))));
        }
    }

    function _asset() internal view returns (HLPortal.Asset memory a) {
        (a.l2Token, a.minDeposit, a.perDepositCap, a.perSenderDailyCap, a.globalDailyCap, a.enabled) = portal.assets(address(dai));
    }

    function _accepted(address who, uint256 amount) internal view returns (bool) {
        HLPortal.Asset memory a = _asset();
        uint256 day = block.timestamp / 1 days;
        return a.enabled && !portal.depositsPaused() && portal.successor() == address(0) && amount >= a.minDeposit
            && amount <= a.perDepositCap && portal.senderDayVolume(address(dai), who, day) + amount <= a.perSenderDailyCap
            && portal.globalDayVolume(address(dai), day) + amount <= a.globalDailyCap;
    }

    function deposit(uint256 who, uint256 amount, uint256 secret) external {
        address a = actors[who % 4];
        amount = bound(amount, 0, 2500 ether);
        bytes32 sh = bytes32(bound(secret, 1, FIELD - 1));
        dai.mint(a, amount);
        bool ok = _accepted(a, amount) && amount > 0;
        vm.startPrank(a);
        dai.approve(address(portal), amount);
        try portal.depositToAztecPrivate(address(dai), amount, sh) {
            deposited += amount;
            if (!ok) outsideCaps++;
        } catch {}
        vm.stopPrank();
    }

    function fundReceiver(uint256 i, uint256 amount) external {
        amount = bound(amount, 1, 3000 ether);
        dai.mint(address(receivers[i % 3]), amount);
        fundedToReceivers += amount;
    }

    function forward(uint256 i, uint256 amount, uint256 who) external {
        HLReceiver r = receivers[i % 3];
        uint256 bal = dai.balanceOf(address(r));
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        bool ok = _accepted(address(r), amount);
        vm.prank(actors[who % 4]);
        try r.forward(address(dai), amount) {
            deposited += amount;
            forwarded += amount;
            if (!ok) outsideCaps++;
        } catch {}
    }

    function rescue(uint256 i, uint256 amount, bool forge_, uint256 to) external {
        HLReceiver r = receivers[i % 3];
        uint256 bal = dai.balanceOf(address(r));
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        address dest = actors[to % 4];
        uint256 deadline = block.timestamp + 1 hours;
        uint256 key = forge_ ? keys[(i + 1) % 3] : keys[i % 3];
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", r.domainSeparator(), keccak256(abi.encode(RESCUE_TYPEHASH, address(dai), dest, amount, r.rescueNonce(), deadline)))
        );
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, digest);
        try r.rescue(address(dai), dest, amount, deadline, abi.encodePacked(rr, s, v)) {
            rescued += amount;
            if (forge_) badRescues++;
        } catch {}
    }

    function proveWithdrawal(uint256 to, uint256 amount, bool bind) external {
        amount = bound(amount, 1, 6000 ether);
        address recipient = actors[to % 4];
        address caller = bind ? actors[(to + 1) % 4] : address(0);
        uint256 leaf = nextLeaf++;
        outbox.prove(l2, version, address(portal), block.chainid, AztecMessaging.withdrawContent(recipient, amount, caller), 0, leaf);
        proven.push(Proven(recipient, amount, caller, leaf, false));
    }

    function withdraw(uint256 idx, uint256 who) external {
        if (proven.length == 0) return;
        Proven storage p = proven[idx % proven.length];
        address sender = actors[who % 4];
        bool withCaller = p.caller != address(0);
        HLPortal.OutboxProof memory proof = HLPortal.OutboxProof(0, 1, p.leaf, new bytes32[](0));
        vm.prank(sender);
        try portal.withdraw(address(dai), p.recipient, p.amount, withCaller, false, proof) {
            if (p.paid) doubleSpends++;
            if (withCaller && sender != p.caller) wrongCallerPaid++;
            p.paid = true;
            withdrawn += p.amount;
        } catch {}
    }

    function withdrawUnproven(uint256 to, uint256 amount, uint256 leaf) external {
        amount = bound(amount, 1, 6000 ether);
        HLPortal.OutboxProof memory proof = HLPortal.OutboxProof(0, 1, bound(leaf, 1_000_000, type(uint64).max), new bytes32[](0));
        try portal.withdraw(address(dai), actors[to % 4], amount, false, false, proof) {
            unprovenPaid++;
            withdrawn += amount;
        } catch {}
    }

    function guardianAct(uint256 action, uint64 x) external {
        vm.startPrank(guardian);
        uint256 a = action % 4;
        if (a == 0) portal.pauseDeposits();
        else if (a == 1) try portal.pauseWithdrawals(uint64(bound(x, 1, 3 days))) {} catch {}
        else if (a == 2) portal.disableAsset(address(dai));
        else {
            HLPortal.Asset memory cur = _asset();
            portal.lowerCaps(address(dai), cur.perDepositCap / 2, cur.perSenderDailyCap / 2, cur.globalDailyCap / 2);
        }
        vm.stopPrank();
    }

    function adminRelax(uint256 caps) external {
        uint128 c = uint128(bound(caps, 2 ether, 2000 ether));
        HLPortal.Asset memory a = HLPortal.Asset(l2, 1 ether, c, c * 2, c * 5, true);
        vm.startPrank(admin);
        portal.unpauseDeposits();
        portal.queueAsset(address(dai), a);
        vm.stopPrank();
    }

    function adminExecute() external {
        vm.prank(admin);
        try portal.executeAsset(address(dai)) {} catch {}
    }

    function strangerTriesRoles(uint256 who, address x) external {
        vm.startPrank(actors[who % 4]);
        try portal.queueAdmin(x) {} catch {}
        try portal.acceptAdmin() {} catch {}
        try portal.queueGuardian(x) {} catch {}
        try portal.unpauseDeposits() {} catch {}
        try portal.queueSunset(x) {} catch {}
        vm.stopPrank();
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 1, 3 days));
    }

    function provenCount() external view returns (uint256) {
        return proven.length;
    }

    function receiver(uint256 i) external view returns (HLReceiver) {
        return receivers[i];
    }
}

contract PortalInvariantsTest is PortalBase {
    PortalHandler internal h;

    function setUp() public {
        deployPortal();
        h = new PortalHandler(portal, factory, outbox, dai, L2_DAI, VERSION, admin, guardian);
        targetContract(address(h));
    }

    /// I1: the portal holds at least what it promised on Aztec, and exactly deposits - withdrawals.
    function invariant_locked_equals_deposits_minus_withdrawals() public view {
        assertEq(portal.totalLocked(address(dai)), h.deposited() - h.withdrawn());
        assertGe(dai.balanceOf(address(portal)), portal.totalLocked(address(dai)));
    }

    /// I6: no deposit is accepted outside the caps, the pause or after a sunset.
    function invariant_no_deposit_outside_caps() public view {
        assertEq(h.outsideCaps(), 0);
    }

    /// I2: a withdrawal is paid only with a proof, once, and to the bound caller.
    function invariant_withdrawals_need_a_fresh_proof() public view {
        assertEq(h.unprovenPaid(), 0);
        assertEq(h.doubleSpends(), 0);
        assertEq(h.wrongCallerPaid(), 0);
    }

    /// Receivers: funds leave only into the portal or by the signer's rescue; no allowance stays.
    function invariant_receivers_conserve_and_leave_no_allowance() public view {
        uint256 held;
        for (uint256 i; i < 3; ++i) {
            HLReceiver r = h.receiver(i);
            held += dai.balanceOf(address(r));
            assertEq(dai.allowance(address(r), address(portal)), 0);
        }
        assertEq(h.badRescues(), 0);
        assertEq(held + h.rescued() + h.forwarded(), h.fundedToReceivers());
    }

    /// Roles never change without the timelock: the handler never runs the accept path as the admin.
    function invariant_roles_fixed() public view {
        assertEq(portal.admin(), admin);
        assertEq(portal.guardian(), guardian);
        assertEq(portal.successor(), address(0));
    }
}
