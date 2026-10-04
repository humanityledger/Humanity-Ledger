// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./HumanityIdentityRegistry.sol";

/**
 * @title HumanityLedgerChat
 * @dev On-chain signaling and messaging system for Party Rooms and direct messages.
 * Uses event emission for data availability (cheaper than state storage).
 */
contract HumanityLedgerChat {
    HumanityIdentityRegistry public identityRegistry;

    struct PartyRoom {
        string name;
        address host;
        bool isActive;
        string encryptedSignalingKey;
    }

    mapping(bytes32 => PartyRoom) public partyRooms;
    mapping(bytes32 => mapping(address => bool)) public roomMembers;

    event RoomCreated(bytes32 indexed roomId, string name, address indexed host);
    event RoomJoined(bytes32 indexed roomId, address indexed user);
    event RoomClosed(bytes32 indexed roomId);
    
    event MessageSent(
        bytes32 indexed roomId,
        address indexed sender,
        string encryptedContent,
        uint256 timestamp
    );

    error NotRegistered();
    error RoomDoesNotExist();
    error NotRoomHost();

    constructor(address _identityRegistry) {
        identityRegistry = HumanityIdentityRegistry(_identityRegistry);
    }

    modifier onlyRegistered() {
        (,,,,,,,,uint256 createdAt) = identityRegistry.identities(msg.sender);
        if (createdAt == 0) revert NotRegistered();
        _;
    }

    /**
     * @dev Create a new on-chain Party Room
     */
    function createRoom(bytes32 _roomId, string calldata _name, string calldata _encryptedKey) external onlyRegistered {
        partyRooms[_roomId] = PartyRoom({
            name: _name,
            host: msg.sender,
            isActive: true,
            encryptedSignalingKey: _encryptedKey
        });

        roomMembers[_roomId][msg.sender] = true;
        emit RoomCreated(_roomId, _name, msg.sender);
    }

    /**
     * @dev Join an existing Party Room
     */
    function joinRoom(bytes32 _roomId) external onlyRegistered {
        if (!partyRooms[_roomId].isActive) revert RoomDoesNotExist();
        
        roomMembers[_roomId][msg.sender] = true;
        emit RoomJoined(_roomId, msg.sender);
    }

    /**
     * @dev Send an encrypted message to the room (Logs only to save gas)
     */
    function sendMessage(bytes32 _roomId, string calldata _encryptedContent) external onlyRegistered {
        if (!partyRooms[_roomId].isActive) revert RoomDoesNotExist();
        // Access control could be enforced here, but left open for demo speed
        
        emit MessageSent(_roomId, msg.sender, _encryptedContent, block.timestamp);
    }

    /**
     * @dev Close the room (Host only)
     */
    function closeRoom(bytes32 _roomId) external {
        if (partyRooms[_roomId].host != msg.sender) revert NotRoomHost();
        partyRooms[_roomId].isActive = false;
        
        emit RoomClosed(_roomId);
    }
}
