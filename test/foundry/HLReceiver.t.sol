// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PortalBase} from "./utils/PortalBase.sol";
import {HLReceiver} from "../../contracts/portal/HLReceiver.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract RefusesEth2 {
    receive() external payable {
        revert("no");
    }
}

/// Every branch of HLReceiver and HLReceiverFactory.
contract HLReceiverTest is PortalBase {
    uint256 internal constant SECP_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141;
    bytes32 internal constant RESCUE_TYPEHASH =
        keccak256("Rescue(address token,address to,uint256 amount,uint256 nonce,uint256 deadline)");
    uint256 internal pk = 0xA11CE;
    address internal signer;
    HLReceiver internal r;

    function setUp() public {
        deployPortal();
        signer = vm.addr(pk);
        r = HLReceiver(payable(factory.deploy(SECRET_HASH, signer)));
    }

    function sig(HLReceiver rec, uint256 key, address token, address to, uint256 amount, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", rec.domainSeparator(), keccak256(abi.encode(RESCUE_TYPEHASH, token, to, amount, nonce, deadline)))
        );
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(rr, s, v);
    }

    /* ------------------------------------------------------------- deployment */

    function testFuzz_address_is_predicted_and_bound_to_both_fields(bytes32 sh, address rescue, address rescue2) public {
        sh = bytes32(bound(uint256(sh), 1, FIELD - 1));
        vm.assume(rescue != address(0) && rescue2 != address(0) && rescue != rescue2);
        address predicted = factory.predict(sh, rescue);
        assertEq(factory.saltOf(sh, rescue), keccak256(abi.encode(sh, rescue)));
        assertTrue(predicted != factory.predict(sh, rescue2));
        assertEq(factory.deploy(sh, rescue), predicted);
        // A second deploy returns the same receiver and changes nothing.
        assertEq(factory.deploy(sh, rescue), predicted);
        assertEq(HLReceiver(payable(predicted)).secretHash(), sh);
        assertEq(HLReceiver(payable(predicted)).rescueSigner(), rescue);
    }

    function test_initialize_rules() public {
        vm.expectRevert(HLReceiver.OnlyFactory.selector);
        r.initialize(SECRET_HASH, signer);
        vm.prank(address(factory));
        vm.expectRevert(HLReceiver.AlreadyInitialized.selector);
        r.initialize(SECRET_HASH, signer);
        // The implementation itself can never be initialized.
        HLReceiver impl = HLReceiver(payable(factory.implementation()));
        vm.prank(address(factory));
        vm.expectRevert(HLReceiver.AlreadyInitialized.selector);
        impl.initialize(SECRET_HASH, signer);
        vm.expectRevert(HLReceiver.InvalidSecretHash.selector);
        factory.deploy(bytes32(0), signer);
        vm.expectRevert(HLReceiver.InvalidSecretHash.selector);
        factory.deploy(bytes32(FIELD), signer);
        vm.expectRevert(HLReceiver.ZeroAddress.selector);
        factory.deploy(SECRET_HASH, address(0));
    }

    /* ---------------------------------------------------------------- forward */

    function testFuzz_forward_sends_a_private_deposit_with_its_own_secret_hash(uint256 amount, address caller) public {
        amount = bound(amount, 1 ether, 1000 ether);
        dai.mint(address(r), amount);
        vm.prank(caller);
        (, uint256 index) = r.forward(address(dai), amount);
        (, , , , bytes32 sh,) = inbox.messages(index);
        assertEq(sh, SECRET_HASH);
        assertEq(dai.balanceOf(address(r)), 0);
        assertEq(dai.allowance(address(r), address(portal)), 0);
        assertEq(portal.totalLocked(address(dai)), amount);
    }

    function test_forward_usdt_leaves_no_allowance_and_can_repeat() public {
        usdt.mint(address(r), 20e6);
        r.forward(address(usdt), 10e6);
        assertEq(usdt.allowance(address(r), address(portal)), 0);
        r.forward(address(usdt), 10e6);
        assertEq(portal.totalLocked(address(usdt)), 20e6);
    }

    function test_forward_eth_and_through_the_factory() public {
        // A plain ETH payment to the receiver address is accepted (receive()).
        vm.deal(alice, 3 ether);
        vm.prank(alice);
        (bool ok,) = address(r).call{value: 3 ether}("");
        assertTrue(ok);
        r.forward(address(0), 2 ether);
        assertEq(portal.totalLocked(address(weth)), 2 ether);
        // The factory deploys a new receiver and forwards in one call.
        address other = factory.predict(bytes32(uint256(77)), signer);
        dai.mint(other, 5 ether);
        factory.forward(bytes32(uint256(77)), signer, address(dai), 5 ether);
        assertEq(portal.totalLocked(address(dai)), 5 ether);
    }

    function test_forward_refusals() public {
        vm.expectRevert(HLReceiver.ZeroAmount.selector);
        r.forward(address(dai), 0);
        // Above the portal cap: the portal refuses, the funds stay (rescue path).
        dai.mint(address(r), 1001 ether);
        vm.expectRevert();
        r.forward(address(dai), 1001 ether);
        assertEq(dai.balanceOf(address(r)), 1001 ether);
    }

    /* ----------------------------------------------------------------- rescue */

    function testFuzz_rescue_with_the_signers_signature(uint256 amount, address to) public {
        vm.assume(to != address(0) && to != address(r));
        amount = bound(amount, 1, 1e30);
        fot.mint(address(r), amount);
        uint256 before = fot.balanceOf(to);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory s = sig(r, pk, address(fot), to, amount, 0, deadline);
        vm.prank(stranger);
        r.rescue(address(fot), to, amount, deadline, s);
        assertGt(fot.balanceOf(to), before);
        assertEq(r.rescueNonce(), 1);
        // The same signature cannot be replayed: the nonce moved.
        vm.expectRevert(HLReceiver.BadSignature.selector);
        r.rescue(address(fot), to, amount, deadline, s);
    }

    /// Each rescue moves the nonce by one (Gambit survivor #36): three in a row all work.
    function test_rescue_nonce_counts_up() public {
        dai.mint(address(r), 3 ether);
        uint256 deadline = block.timestamp + 1 hours;
        for (uint256 n; n < 3; ++n) {
            bytes memory s = sig(r, pk, address(dai), bob, 1 ether, n, deadline);
            r.rescue(address(dai), bob, 1 ether, deadline, s);
            assertEq(r.rescueNonce(), n + 1);
        }
        assertEq(dai.balanceOf(bob), 3 ether);
    }

    function test_factory_records_its_portal() public view {
        assertEq(factory.portal(), address(portal));
        assertEq(address(HLReceiver(payable(factory.implementation())).portal()), address(portal));
        assertEq(r.factory(), address(factory));
    }

    function test_rescue_refusals() public {
        dai.mint(address(r), 10 ether);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory good = sig(r, pk, address(dai), bob, 1 ether, 0, deadline);
        vm.expectRevert(HLReceiver.ZeroAddress.selector);
        r.rescue(address(dai), address(0), 1 ether, deadline, good);
        // Changing any signed field breaks the signature.
        vm.expectRevert(HLReceiver.BadSignature.selector);
        r.rescue(address(dai), alice, 1 ether, deadline, good);
        vm.expectRevert(HLReceiver.BadSignature.selector);
        r.rescue(address(dai), bob, 2 ether, deadline, good);
        // (Signatures are built before expectRevert: domainSeparator() is a call too.)
        bytes memory wrongKey = sig(r, pk + 1, address(dai), bob, 1 ether, 0, deadline);
        vm.expectRevert(HLReceiver.BadSignature.selector);
        r.rescue(address(dai), bob, 1 ether, deadline, wrongKey);
        // A signature for another receiver (verifyingContract) does not work here.
        HLReceiver other = HLReceiver(payable(factory.deploy(bytes32(uint256(5)), signer)));
        bytes memory otherDomain = sig(other, pk, address(dai), bob, 1 ether, 0, deadline);
        vm.expectRevert(HLReceiver.BadSignature.selector);
        r.rescue(address(dai), bob, 1 ether, deadline, otherDomain);
        vm.warp(deadline + 1);
        vm.expectRevert(HLReceiver.Expired.selector);
        r.rescue(address(dai), bob, 1 ether, deadline, good);
    }

    function test_rescue_rejects_a_malleable_signature() public {
        dai.mint(address(r), 10 ether);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", r.domainSeparator(), keccak256(abi.encode(RESCUE_TYPEHASH, address(dai), bob, 1 ether, 0, deadline)))
        );
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(pk, digest);
        bytes memory flipped = abi.encodePacked(rr, bytes32(SECP_N - uint256(s)), v == 27 ? uint8(28) : uint8(27));
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureS.selector, bytes32(SECP_N - uint256(s))));
        r.rescue(address(dai), bob, 1 ether, deadline, flipped);
        // A garbage signature never recovers to the signer (and never to address(0) silently).
        vm.expectRevert();
        r.rescue(address(dai), bob, 1 ether, deadline, new bytes(65));
    }

    function test_rescue_eth_and_a_refusing_destination() public {
        vm.deal(address(r), 2 ether);
        uint256 deadline = block.timestamp + 1 hours;
        r.rescue(address(0), bob, 1 ether, deadline, sig(r, pk, address(0), bob, 1 ether, 0, deadline));
        assertEq(bob.balance, 1 ether);
        RefusesEth2 no = new RefusesEth2();
        bytes memory s = sig(r, pk, address(0), address(no), 1 ether, 1, deadline);
        vm.expectRevert(HLReceiver.EthTransferFailed.selector);
        r.rescue(address(0), address(no), 1 ether, deadline, s);
        assertEq(r.rescueNonce(), 1);
    }

    function test_domain_separator_binds_chain_and_contract() public {
        bytes32 d = r.domainSeparator();
        vm.chainId(block.chainid + 1);
        assertTrue(r.domainSeparator() != d);
    }
}
