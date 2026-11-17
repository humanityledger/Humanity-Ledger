// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AztecMessaging} from "../portal/AztecMessaging.sol";

/// Test only. Records L1->L2 messages like the Aztec Inbox (key = sha256ToField of the message fields).
contract MockAztecInbox {
    struct Sent {
        address sender;
        bytes32 recipient;
        uint256 version;
        bytes32 content;
        bytes32 secretHash;
        uint256 index;
    }

    Sent[] public messages;

    event MessageSent(bytes32 indexed key, uint256 index, address sender, bytes32 recipient, bytes32 content, bytes32 secretHash);

    function sendL2Message(AztecMessaging.L2Actor memory recipient, bytes32 content, bytes32 secretHash)
        external
        returns (bytes32 key, uint256 index)
    {
        require(uint256(content) < AztecMessaging.FIELD_MODULUS, "content not a field");
        require(uint256(secretHash) < AztecMessaging.FIELD_MODULUS, "secret hash not a field");
        index = messages.length;
        messages.push(Sent(msg.sender, recipient.actor, recipient.version, content, secretHash, index));
        key = AztecMessaging.sha256ToField(abi.encode(msg.sender, block.chainid, recipient.actor, recipient.version, content, secretHash, index));
        emit MessageSent(key, index, msg.sender, recipient.actor, content, secretHash);
    }

    function count() external view returns (uint256) {
        return messages.length;
    }
}

/// Test only. The test "proves" an L2->L1 message by registering its hash; consume() checks it once.
contract MockAztecOutbox {
    mapping(bytes32 => bool) public valid;
    mapping(bytes32 => bool) public consumed;

    function messageHash(AztecMessaging.L2ToL1Msg calldata m, uint256 epoch, uint256 leafIndex) public pure returns (bytes32) {
        return keccak256(abi.encode(m.sender.actor, m.sender.version, m.recipient.actor, m.recipient.chainId, m.content, epoch, leafIndex));
    }

    function prove(bytes32 l2Sender, uint256 version, address l1Recipient, uint256 chainId, bytes32 content, uint256 epoch, uint256 leafIndex)
        external
    {
        valid[keccak256(abi.encode(l2Sender, version, l1Recipient, chainId, content, epoch, leafIndex))] = true;
    }

    function consume(AztecMessaging.L2ToL1Msg calldata m, uint256 epoch, uint256, uint256 leafIndex, bytes32[] calldata) external {
        require(m.recipient.actor == msg.sender, "Outbox: wrong recipient");
        bytes32 h = messageHash(m, epoch, leafIndex);
        require(valid[h], "Outbox: not in tree");
        require(!consumed[h], "Outbox: already consumed");
        consumed[h] = true;
    }
}

/// Test only. WETH9 behaviour.
contract MockWETH9 {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Transfer(address(0), msg.sender, msg.value);
    }

    function withdraw(uint256 wad) external {
        require(balanceOf[msg.sender] >= wad, "WETH: balance");
        balanceOf[msg.sender] -= wad;
        (bool ok,) = msg.sender.call{value: wad}("");
        require(ok, "WETH: send");
        emit Transfer(msg.sender, address(0), wad);
    }

    function totalSupply() external view returns (uint256) {
        return address(this).balance;
    }

    function approve(address guy, uint256 wad) external returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint256 wad) external returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint256 wad) public returns (bool) {
        require(balanceOf[src] >= wad, "WETH: balance");
        if (src != msg.sender && allowance[src][msg.sender] != type(uint256).max) {
            require(allowance[src][msg.sender] >= wad, "WETH: allowance");
            allowance[src][msg.sender] -= wad;
        }
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(src, dst, wad);
        return true;
    }
}

/// Test only. USDT-style: no return values, and approve refuses a non-zero -> non-zero change.
contract MockUSDT {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint8 public decimals = 6;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 value) external {
        require(value == 0 || allowance[msg.sender][spender] == 0, "USDT: approve from non-zero");
        allowance[msg.sender][spender] = value;
    }

    function transfer(address to, uint256 value) external {
        require(balanceOf[msg.sender] >= value, "USDT: balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
    }

    function transferFrom(address from, address to, uint256 value) external {
        require(balanceOf[from] >= value, "USDT: balance");
        require(allowance[from][msg.sender] >= value, "USDT: allowance");
        allowance[from][msg.sender] -= value;
        balanceOf[from] -= value;
        balanceOf[to] += value;
    }

    function totalSupply() external pure returns (uint256) {
        return 0;
    }
}
