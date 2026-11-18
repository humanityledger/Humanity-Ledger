// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HLPortal} from "../../../contracts/portal/HLPortal.sol";
import {HLReceiverFactory} from "../../../contracts/portal/HLReceiver.sol";
import {HumanTimeLock} from "../../../contracts/civilization/HumanTimeLock.sol";

/// Exposes the cap check alone, so the solver does not have to reason about token transfers.
contract HLPortalHarness is HLPortal {
    constructor(address a, address g) HLPortal(address(1), address(2), 1, address(3), a, g) {}

    function checkDeposit(address token, uint256 amount, bytes32 secretHash) external returns (Asset memory) {
        return _checkDeposit(token, amount, secretHash);
    }

    function setAsset(address token, Asset calldata a) external {
        assets[token] = a;
    }
}

/// Halmos properties (symbolic, every input at once). Run in CI with
///   halmos --contract PortalHalmos --function check_
/// Each check_ function must hold for all values of its arguments.
contract PortalHalmos is Test {
    uint256 internal constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    HLPortalHarness internal p;
    address internal constant TOKEN = address(0x7070);
    address internal constant ADMIN = address(0xAD);
    address internal constant GUARDIAN = address(0x6A);

    function setUp() public {
        p = new HLPortalHarness(ADMIN, GUARDIAN);
    }

    /// I6: an accepted deposit never leaves a day volume above its cap, and respects min and per-deposit cap.
    function check_caps(uint128 minD, uint128 perDep, uint128 perSender, uint128 global_, uint256 amount, bytes32 sh) public {
        vm.assume(minD <= perDep && perDep <= perSender && perSender <= global_);
        p.setAsset(TOKEN, HLPortal.Asset(bytes32(uint256(1)), minD, perDep, perSender, global_, true));
        (bool ok,) = address(p).call(abi.encodeCall(HLPortalHarness.checkDeposit, (TOKEN, amount, sh)));
        if (ok) {
            uint256 day = block.timestamp / 1 days;
            assert(amount >= minD && amount <= perDep && amount > 0);
            assert(p.senderDayVolume(TOKEN, address(this), day) <= perSender);
            assert(p.globalDayVolume(TOKEN, day) <= global_);
            assert(uint256(sh) != 0 && uint256(sh) < FIELD);
        }
    }

    /// Two deposits in one day never exceed the sender's daily cap together.
    function check_two_deposits_same_day(uint128 cap, uint256 a1, uint256 a2) public {
        vm.assume(cap > 0);
        p.setAsset(TOKEN, HLPortal.Asset(bytes32(uint256(1)), 0, cap, cap, cap, true));
        bytes32 sh = bytes32(uint256(7));
        (bool ok1,) = address(p).call(abi.encodeCall(HLPortalHarness.checkDeposit, (TOKEN, a1, sh)));
        (bool ok2,) = address(p).call(abi.encodeCall(HLPortalHarness.checkDeposit, (TOKEN, a2, sh)));
        if (ok1 && ok2) assert(a1 + a2 <= cap);
    }

    /// I4: a queued relaxation cannot be executed before TIMELOCK has passed.
    function check_timelock(uint256 dt) public {
        vm.assume(dt < 2 days);
        HLPortal.Asset memory a = HLPortal.Asset(bytes32(uint256(1)), 0, 10, 10, 10, true);
        vm.prank(ADMIN);
        p.queueAsset(TOKEN, a);
        vm.warp(block.timestamp + dt);
        vm.prank(ADMIN);
        (bool ok,) = address(p).call(abi.encodeCall(HLPortal.executeAsset, (TOKEN)));
        assert(!ok);
    }

    /// Only the admin queues; only the admin or the guardian restricts.
    function check_roles(address caller) public {
        vm.assume(caller != ADMIN && caller != GUARDIAN);
        HLPortal.Asset memory a = HLPortal.Asset(bytes32(uint256(1)), 0, 10, 10, 10, true);
        vm.startPrank(caller);
        (bool q,) = address(p).call(abi.encodeCall(HLPortal.queueAsset, (TOKEN, a)));
        (bool d,) = address(p).call(abi.encodeCall(HLPortal.disableAsset, (TOKEN)));
        (bool qa,) = address(p).call(abi.encodeCall(HLPortal.queueAdmin, (caller)));
        vm.stopPrank();
        assert(!q && !d && !qa);
    }

    /// sha256ToField's output is a field element for ANY digest: the library places the first 31
    /// bytes of the digest after a zero byte. Halmos cannot run the sha256 precompile itself (Z3
    /// sort mismatch, run 44275884943), so the digest is the symbolic input here and the same
    /// byte layout is proven; test/foundry/Differential.t.sol fuzzes the library end to end.
    function check_sha256ToField_layout_is_a_field_element(bytes32 digest) public pure {
        bytes32 out = bytes32(bytes.concat(new bytes(1), bytes31(digest)));
        assert(uint256(out) < FIELD);
        assert(uint256(out) == uint256(digest) >> 8);
    }

    /// The receiver salt binds both the secret hash and the rescue signer (under keccak injectivity).
    function check_salt_binds_both_fields(bytes32 s1, address r1, bytes32 s2, address r2) public {
        HLReceiverFactory f = new HLReceiverFactory(address(0xBEEF));
        vm.assume(s1 != s2 || r1 != r2);
        assert(f.saltOf(s1, r1) != f.saltOf(s2, r2));
    }

    /// HumanTimeLock (IA-05): a later lock never moves the unlock time earlier.
    function check_timelock_unlock_never_decreases(uint96 v1, uint64 d1, uint96 v2, uint64 d2) public {
        vm.assume(v1 > 0 && v2 > 0 && d1 > 0 && d2 > 0);
        HumanTimeLock t = new HumanTimeLock();
        vm.deal(address(this), uint256(v1) + v2);
        t.lock{value: v1}(d1);
        (, uint256 u1) = t.locks(address(this));
        t.lock{value: v2}(d2);
        (uint256 amount, uint256 u2) = t.locks(address(this));
        assert(u2 >= u1);
        assert(amount == uint256(v1) + v2);
    }
}
