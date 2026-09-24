// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Quantum Dots (QDS) - Humanity Ledger Sovereign Token
 * @dev Implements the Deflationary Burn Mechanism described in the Master Thesis.
 * A fixed percentage of tokens is burned on specific protocol transactions 
 * to ensure long-term macro-economic stability.
 */
contract QDSToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;
    uint256 public burnRateBasisPoints = 300; // 3% of fees burned initially

    // Mapping for Paymasters and official protocol contracts that bypass fees
    mapping(address => bool) public isExemptFromBurn;

    event DeflationaryBurn(address indexed from, uint256 amount);

    constructor() ERC20("Quantum Dots", "QDS") Ownable(msg.sender) {
        _mint(msg.sender, MAX_SUPPLY);
        isExemptFromBurn[msg.sender] = true;
    }

    /**
     * @dev Overrides transfer to implement the protocol's burn mechanic if applicable.
     * In the AppChain, standard transfers might be free, but protocol fees (Studio, RWA)
     * will trigger this burn mechanism.
     */
    function processProtocolFee(address user, uint256 feeAmount) external {
        require(balanceOf(user) >= feeAmount, "Insufficient QDS for fee");
        
        uint256 burnAmount = (feeAmount * burnRateBasisPoints) / 10000;
        uint256 treasuryAmount = feeAmount - burnAmount;

        // Burn the deflationary portion forever
        _burn(user, burnAmount);
        emit DeflationaryBurn(user, burnAmount);

        // Send the rest to the protocol treasury (or DAO)
        _transfer(user, owner(), treasuryAmount);
    }

    function setBurnRate(uint256 newRateBps) external onlyOwner {
        require(newRateBps <= 1000, "Burn rate cannot exceed 10%");
        burnRateBasisPoints = newRateBps;
    }

    function setExemption(address account, bool exempt) external onlyOwner {
        isExemptFromBurn[account] = exempt;
    }
}
