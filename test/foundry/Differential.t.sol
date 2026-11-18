// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AztecMessaging} from "../../contracts/portal/AztecMessaging.sol";
import {PortalVectors} from "./vectors/PortalVectors.sol";

/// Solidity side of the differential vectors (scripts/security/portal-vectors.mjs). The same
/// vectors are checked by test/unit/portal/content-vectors.test.ts (TypeScript) and by
/// contents_match_the_differential_vectors in contracts/aztec/portal_token/src/test.nr (Noir).
contract DifferentialTest is Test {
    function test_mint_to_private_contents() public pure {
        uint256[24] memory a = PortalVectors.mintAmounts();
        bytes32[24] memory c = PortalVectors.mintContents();
        for (uint256 i; i < a.length; ++i) assertEq(AztecMessaging.mintToPrivateContent(a[i]), c[i]);
    }

    function test_withdraw_contents() public pure {
        address[12] memory r = PortalVectors.withdrawRecipients();
        uint256[12] memory a = PortalVectors.withdrawAmounts();
        address[12] memory c = PortalVectors.withdrawCallers();
        bytes32[12] memory w = PortalVectors.withdrawContents();
        for (uint256 i; i < r.length; ++i) assertEq(AztecMessaging.withdrawContent(r[i], a[i], c[i]), w[i]);
    }

    /// The encoding is the ABI one: selector, then 32-byte words, truncated sha256 in a field.
    function testFuzz_withdraw_content_is_the_abi_encoding(address r, uint256 amount, address c) public pure {
        bytes memory data = abi.encodeWithSignature("withdraw(address,uint256,address)", r, amount, c);
        assertEq(data.length, 100);
        bytes32 h = sha256(data);
        assertEq(AztecMessaging.withdrawContent(r, amount, c), bytes32(uint256(h) >> 8));
    }

    function testFuzz_sha256ToField_is_a_field_element(bytes memory data) public pure {
        assertLt(uint256(AztecMessaging.sha256ToField(data)), 21888242871839275222246405745257275088548364400416034343698204186575808495617);
    }

    function testFuzz_mint_content_is_the_abi_encoding(uint256 amount) public pure {
        bytes32 h = sha256(abi.encodeWithSignature("mint_to_private(uint256)", amount));
        assertEq(AztecMessaging.mintToPrivateContent(amount), bytes32(uint256(h) >> 8));
    }
}
