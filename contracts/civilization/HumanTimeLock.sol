// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HumanTimeLock
 * @notice Time-locked on-chain vault with reentrancy protection.
 */
contract HumanTimeLock is ReentrancyGuard {
    
    struct LockInfo {
        uint256 amount;
        uint256 unlockTime;
    }

    mapping(address => LockInfo) public locks;

    event Locked(address indexed user, uint256 amount, uint256 unlockTime);
    event Withdrawn(address indexed user, uint256 amount);

    /**
     * @notice Locks funds strictly until the target timestamp.
     * @param _duration Time in seconds (e.g. 31536000 for 1 year).
     */
    function lock(uint256 _duration) external payable nonReentrant {
        require(msg.value > 0, "Debe enviar valor");
        require(_duration > 0, "La duracion debe ser mayor a cero");

        LockInfo storage userLock = locks[msg.sender];
        userLock.amount += msg.value;
        userLock.unlockTime = block.timestamp + _duration;

        emit Locked(msg.sender, msg.value, userLock.unlockTime);
    }

    /**
     * @notice Releases locked funds. Reverts if unlock time has not arrived.
     */
    function withdraw() external nonReentrant {
        LockInfo storage userLock = locks[msg.sender];
        require(userLock.amount > 0, "No hay fondos bloqueados");
        require(block.timestamp >= userLock.unlockTime, "Aun no es el tiempo de desbloqueo");

        uint256 transferAmount = userLock.amount;
        userLock.amount = 0; // Prevent re-entrancy
        
        (bool success, ) = msg.sender.call{value: transferAmount}("");
        require(success, "Fallo transferencia ETH");

        emit Withdrawn(msg.sender, transferAmount);
    }
}
