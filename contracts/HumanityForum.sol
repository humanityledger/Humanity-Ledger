// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./HumanityIdentityRegistry.sol";

/**
 * @title HumanityForum
 * @dev Replaces ForumTopic, ForumPost, ForumLike, NewsArticle Prisma models.
 * Operates purely via event emission to minimize L2 state bloat.
 */
contract HumanityForum {
    HumanityIdentityRegistry public identityRegistry;

    // Track state minimally just for existence/ownership (if needed)
    // Most data is served via an Indexer (The Graph/Envio) reading the events.
    uint256 public nextTopicId = 1;
    uint256 public nextPostId = 1;

    event TopicCreated(uint256 indexed topicId, address indexed author, string category, string ipfsContentHash);
    event PostCreated(uint256 indexed topicId, uint256 indexed postId, address indexed author, string ipfsContentHash);
    event ContentLiked(uint256 indexed topicId, uint256 postId, address indexed liker);

    error NotRegistered();
    error TopicNotFound();

    constructor(address _identity) {
        identityRegistry = HumanityIdentityRegistry(_identity);
    }

    modifier onlyRegistered() {
        if (!identityRegistry.isRegistered(msg.sender)) revert NotRegistered();
        _;
    }

    function createTopic(string calldata _category, string calldata _ipfsContentHash) external onlyRegistered {
        uint256 topicId = nextTopicId++;
        emit TopicCreated(topicId, msg.sender, _category, _ipfsContentHash);
    }

    function createPost(uint256 _topicId, string calldata _ipfsContentHash) external onlyRegistered {
        if (_topicId == 0 || _topicId >= nextTopicId) revert TopicNotFound();
        uint256 postId = nextPostId++;
        emit PostCreated(_topicId, postId, msg.sender, _ipfsContentHash);
    }

    function likeContent(uint256 _topicId, uint256 _postId) external onlyRegistered {
        if (_topicId == 0 || _topicId >= nextTopicId) revert TopicNotFound();
        emit ContentLiked(_topicId, _postId, msg.sender);
    }
}
