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
     * @dev Process protocol fee with strict authorization and allowance enforcement.
     * Prevents arbitrary third-party callers from unauthorized deflationary burning
     * or transferring user balances. Caller must be the user, the protocol owner,
     * an authorized exempt contract, or have sufficient ERC-20 allowance.
     */
    function processProtocolFee(address user, uint256 feeAmount) external {
        require(user != address(0), "Invalid user address");
        require(feeAmount > 0, "Fee amount must be greater than zero");
        require(balanceOf(user) >= feeAmount, "Insufficient QDS for fee");

        // Enforce authorization & allowance protection against unauthorized third-party burn
        if (msg.sender != user && msg.sender != owner() && !isExemptFromBurn[msg.sender]) {
            _spendAllowance(user, msg.sender, feeAmount);
        }
        
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
