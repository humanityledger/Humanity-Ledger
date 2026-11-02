// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Studio Provenance Hash Registry
 * @dev The Smart Contract backend for the Studio Mini-App. 
 * Anchors SHA-256 hashes of digital creations to prove authorship and timestamp.
 */
contract StudioProvenance {
    
    struct Document {
        address author;
        uint256 timestamp;
        string metadataURI; // Optional IPFS link to metadata (not the file itself)
    }

    // Maps SHA-256 Hash => Document Details
    mapping(bytes32 => Document) public anchoredDocuments;

    event DocumentAnchored(bytes32 indexed documentHash, address indexed author, uint256 timestamp);

    /**
     * @dev Anchors a new document hash. Fails if the hash already exists.
     */
    function anchorDocument(bytes32 documentHash, string calldata metadataURI) external {
        require(anchoredDocuments[documentHash].timestamp == 0, "Document hash already anchored by another user");
        
        anchoredDocuments[documentHash] = Document({
            author: msg.sender,
            timestamp: block.timestamp,
            metadataURI: metadataURI
        });

        emit DocumentAnchored(documentHash, msg.sender, block.timestamp);
    }

    /**
     * @dev Verifies if a given hash is anchored and returns the author and time.
     */
    function verifyDocument(bytes32 documentHash) external view returns (address author, uint256 timestamp, string memory metadataURI) {
        Document memory doc = anchoredDocuments[documentHash];
        require(doc.timestamp != 0, "Document not found in registry");
        return (doc.author, doc.timestamp, doc.metadataURI);
    }
}
