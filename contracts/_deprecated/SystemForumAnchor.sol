// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SystemForumAnchor
 * @dev Immutable on-chain anchor for forum content. Posts are hashed into a daily Merkle Tree
 * and the root is submitted here by the decentralized relay. This provides absolute mathematical
 * proof of content existence and non-repudiation.
 */
contract SystemForumAnchor is EIP712, Ownable {
    // Merkle roots by day ID (timestamp / 86400)
    mapping(uint256 => bytes32) public dailyRoots;
    
    // Struct representing a single signed forum post
    struct ForumPost {
        address author;
        string contentCID; // IPFS/Arweave CID
        uint256 timestamp;
    }

    bytes32 private constant FORUM_POST_TYPEHASH = keccak256(
        "ForumPost(address author,string contentCID,uint256 timestamp)"
    );

    event RootAnchored(uint256 indexed dayId, bytes32 root);

    constructor() EIP712("LedgerAlertNetwork", "1") Ownable(msg.sender) {}

    /**
     * @dev Called by the Relayer (Paymaster) to commit the daily batch of posts
     */
    function anchorDailyRoot(uint256 dayId, bytes32 merkleRoot) external onlyOwner {
        require(dailyRoots[dayId] == bytes32(0), "Root already anchored for this day");
        dailyRoots[dayId] = merkleRoot;
        emit RootAnchored(dayId, merkleRoot);
    }

    /**
     * @dev Cryptographically verifies a specific post against an anchored daily root
     */
    function verifyPostInclusion(
        uint256 dayId,
        ForumPost calldata post,
        bytes32[] calldata proof
    ) external view returns (bool) {
        bytes32 root = dailyRoots[dayId];
        require(root != bytes32(0), "No root anchored for this day");

        // Hash the struct according to EIP-712
        bytes32 structHash = keccak256(
            abi.encode(
                FORUM_POST_TYPEHASH,
                post.author,
                keccak256(bytes(post.contentCID)),
                post.timestamp
            )
        );

        // Calculate the EIP-712 hash digest
        bytes32 digest = _hashTypedDataV4(structHash);

        // Verify the Merkle proof
        return MerkleProof.verify(proof, root, digest);
    }
}
