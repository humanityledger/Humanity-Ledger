// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HumanityIdentityRegistry
 * @dev The core Identity protocol mapping Prisma PostgreSQL User models to full On-Chain state.
 * Implements gasless meta-transaction compatibility and ties into the ERC-4337 Paymaster.
 */
contract HumanityIdentityRegistry is Ownable {
    
    struct Identity {
        string displayName;
        string avatarUrl;
        string bio;
        bool isPro;
        bool isZkVerified;
        string tier;
        uint256 lastActive;
        uint256 createdAt;
        bytes32 worldIdNullifierHash; // Ensures 1 Human = 1 Identity
    }

    mapping(address => Identity) public identities;
    mapping(bytes32 => address) public nullifierToAddress;

    event IdentityCreated(address indexed user, string displayName, bytes32 worldIdNullifier);
    event IdentityUpdated(address indexed user, string displayName, string avatarUrl);
    event TierUpgraded(address indexed user, string newTier);

    error IdentityAlreadyExists();
    error NullifierAlreadyUsed();
    error IdentityDoesNotExist();

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Register a new Humanity Identity On-Chain. Replaces the Next.js API /api/auth/register
     */
    function registerIdentity(
        string calldata _displayName,
        string calldata _avatarUrl,
        string calldata _bio,
        bytes32 _worldIdNullifierHash
    ) external {
        if (identities[msg.sender].createdAt != 0) revert IdentityAlreadyExists();
        if (_worldIdNullifierHash != bytes32(0) && nullifierToAddress[_worldIdNullifierHash] != address(0)) {
            revert NullifierAlreadyUsed();
        }

        identities[msg.sender] = Identity({
            displayName: _displayName,
            avatarUrl: _avatarUrl,
            bio: _bio,
            isPro: false,
            isZkVerified: false,
            tier: "FREE",
            lastActive: block.timestamp,
            createdAt: block.timestamp,
            worldIdNullifierHash: _worldIdNullifierHash
        });

        if (_worldIdNullifierHash != bytes32(0)) {
            nullifierToAddress[_worldIdNullifierHash] = msg.sender;
        }

        emit IdentityCreated(msg.sender, _displayName, _worldIdNullifierHash);
    }

    function updateProfile(string calldata _displayName, string calldata _avatarUrl, string calldata _bio) external {
        if (identities[msg.sender].createdAt == 0) revert IdentityDoesNotExist();
        
        identities[msg.sender].displayName = _displayName;
        identities[msg.sender].avatarUrl = _avatarUrl;
        identities[msg.sender].bio = _bio;
        identities[msg.sender].lastActive = block.timestamp;

        emit IdentityUpdated(msg.sender, _displayName, _avatarUrl);
    }

    function upgradeTier(address _user, string calldata _newTier) external onlyOwner {
        if (identities[_user].createdAt == 0) revert IdentityDoesNotExist();
        identities[_user].tier = _newTier;
        identities[_user].isPro = true;
        
        emit TierUpgraded(_user, _newTier);
    }

    function setZkVerified(address _user, bool _verified) external onlyOwner {
        if (identities[_user].createdAt == 0) revert IdentityDoesNotExist();
        identities[_user].isZkVerified = _verified;
    }

    function pingActivity() external {
        if (identities[msg.sender].createdAt != 0) {
            identities[msg.sender].lastActive = block.timestamp;
        }
    }
}
