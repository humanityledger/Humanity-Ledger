// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title ZKVerifier (Groth16 — alt_bn128 / BN254)
 * @notice Cryptographic on-chain verifier for ZKAuth proofs.
 *
 * Uses EVM precompiles:
 *   0x06 — ecAdd (BN254 G1 point addition)
 *   0x07 — ecMul (BN254 G1 scalar multiplication)
 *   0x08 — ecPairing (BN254 pairing check — the core Groth16 validity test)
 *
 * HOW TO USE FOR MAINNET:
 *   1. Compile your Noir/snarkjs circuit and run: `snarkjs groth16 exportsolidityverifier`
 *   2. Copy the generated vKey values into setVerifyingKey().
 *   3. Deploy and call setVerifyingKey() with the correct ceremony parameters.
 *   4. Wire ZKEventVerifier.setVerifier(address(this)).
 *
 * SECURITY: vKey is immutable after initialization (one-time setup).
 */
contract ZKVerifier is Ownable2Step {
    struct Proof {
        uint256[2] a;   // G1 point
        uint256[2][2] b; // G2 point
        uint256[2] c;   // G1 point
    }

    // Groth16 Verification Key — BN254
    struct VerifyingKey {
        uint256[2] alfa1;
        uint256[2][2] beta2;
        uint256[2][2] gamma2;
        uint256[2][2] delta2;
        uint256[2][] IC; // One per public input + 1
    }

    VerifyingKey internal vk;
    bool public vkInitialized;

    event VerificationSucceeded(address indexed user, bytes32 indexed root);
    event VerificationFailed(address indexed user);
    event VKeyInitialized();

    error VKeyAlreadySet();
    error VKeyNotSet();
    error InvalidProof();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice One-time initialization of the Groth16 verifying key from trusted setup.
     * @dev Call this immediately after deployment with the snarkjs-exported vKey.
     */
    function initVerifyingKey(
        uint256[2] calldata alfa1,
        uint256[2][2] calldata beta2,
        uint256[2][2] calldata gamma2,
        uint256[2][2] calldata delta2,
        uint256[2][] calldata IC
    ) external onlyOwner {
        if (vkInitialized) revert VKeyAlreadySet();
        vk.alfa1 = alfa1;
        vk.beta2 = beta2;
        vk.gamma2 = gamma2;
        vk.delta2 = delta2;
        for (uint256 i = 0; i < IC.length; i++) {
            vk.IC.push(IC[i]);
        }
        vkInitialized = true;
        emit VKeyInitialized();
    }

    /**
     * @notice Verifies a Groth16 proof against public signals using EVM pairing precompile.
     * @param _proof  Proof struct (A, B, C points on BN254).
     * @param _input  Public inputs (length must equal vk.IC.length - 1).
     * @return true if the proof is cryptographically valid.
     */
    function verifyProof(Proof memory _proof, uint256[] memory _input) public returns (bool) {
        if (!vkInitialized) revert VKeyNotSet();
        require(_input.length + 1 == vk.IC.length, "ZKVerifier: wrong input length");

        // Compute the linear combination: vk_x = IC[0] + sum(input[i] * IC[i+1])
        uint256[2] memory vk_x = vk.IC[0];
        for (uint256 i = 0; i < _input.length; i++) {
            uint256[2] memory scaled = _ecMul(vk.IC[i + 1], _input[i]);
            vk_x = _ecAdd(vk_x, scaled);
        }

        // Pairing check: e(A, B) = e(alpha, beta) * e(vk_x, gamma) * e(C, delta)
        bool valid = _pairingCheck(_proof, vk_x);

        if (valid) {
            // Only emit if called from an EOA or authorised contract (not internal)
            if (msg.sender != address(this)) {
                emit VerificationSucceeded(msg.sender, bytes32(_input[0]));
            }
        } else {
            if (msg.sender != address(this)) {
                emit VerificationFailed(msg.sender);
            }
        }

        return valid;
    }

    // ── Internal: EVM precompile wrappers ────────────────────────────────────

    function _ecAdd(uint256[2] memory p1, uint256[2] memory p2) internal view returns (uint256[2] memory r) {
        uint256[4] memory input = [p1[0], p1[1], p2[0], p2[1]];
        bool success;
        assembly {
            success := staticcall(gas(), 0x06, input, 0x80, r, 0x40)
        }
        require(success, "ZKVerifier: ecAdd failed");
    }

    function _ecMul(uint256[2] memory p, uint256 s) internal view returns (uint256[2] memory r) {
        uint256[3] memory input = [p[0], p[1], s];
        bool success;
        assembly {
            success := staticcall(gas(), 0x07, input, 0x60, r, 0x40)
        }
        require(success, "ZKVerifier: ecMul failed");
    }

    function _pairingCheck(Proof memory proof, uint256[2] memory vk_x) internal view returns (bool) {
        // Encode 4 pairings: (A,B), (alpha,beta), (vk_x,gamma), (C,delta)
        // Each pairing is: G1.x, G1.y, G2.x[1], G2.x[0], G2.y[1], G2.y[0]  (6 * 4 = 24 words)
        uint256[24] memory input;

        // Pairing 1: e(-A, B)
        // Negate A: (x, -y mod p)
        uint256 q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
        input[0]  = proof.a[0];
        input[1]  = q - (proof.a[1] % q);
        input[2]  = proof.b[1][0]; input[3]  = proof.b[1][1];
        input[4]  = proof.b[0][0]; input[5]  = proof.b[0][1];

        // Pairing 2: e(alpha, beta)
        input[6]  = vk.alfa1[0]; input[7]  = vk.alfa1[1];
        input[8]  = vk.beta2[1][0]; input[9]  = vk.beta2[1][1];
        input[10] = vk.beta2[0][0]; input[11] = vk.beta2[0][1];

        // Pairing 3: e(vk_x, gamma)
        input[12] = vk_x[0]; input[13] = vk_x[1];
        input[14] = vk.gamma2[1][0]; input[15] = vk.gamma2[1][1];
        input[16] = vk.gamma2[0][0]; input[17] = vk.gamma2[0][1];

        // Pairing 4: e(C, delta)
        input[18] = proof.c[0]; input[19] = proof.c[1];
        input[20] = vk.delta2[1][0]; input[21] = vk.delta2[1][1];
        input[22] = vk.delta2[0][0]; input[23] = vk.delta2[0][1];

        uint256[1] memory out;
        bool success;
        assembly {
            success := staticcall(gas(), 0x08, input, 0x300, out, 0x20)
        }
        require(success, "ZKVerifier: pairing check failed");
        return out[0] == 1;
    }
}
