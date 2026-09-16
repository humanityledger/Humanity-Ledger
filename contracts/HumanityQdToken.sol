// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HumanityQdToken
 * @dev The native transaction token replacing `QdTransaction` Prisma tables.
 * Can be minted by the system for rewards, quests, and purchases.
 */
contract HumanityQdToken is ERC20, Ownable {
    
    // Whitelisted contracts (like WarRoom or Academy) that can mint QD tokens as rewards
    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    constructor() ERC20("Quantum Dollar", "QD") Ownable(msg.sender) {
        // Initial supply to treasury
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals()); 
    }

    function addMinter(address _minter) external onlyOwner {
        minters[_minter] = true;
        emit MinterAdded(_minter);
    }

    function removeMinter(address _minter) external onlyOwner {
        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }

    function mint(address to, uint256 amount) external {
        require(minters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _mint(to, amount);
    }
}
