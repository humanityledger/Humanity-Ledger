// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title LedgerPass: Professional Gold Ticket Membership
/// @notice ERC-1155 implementation for exclusive Ledger Alert Network terminal access
contract LedgerPass is ERC1155, Ownable, ERC1155Supply, ReentrancyGuard {
    using Strings for uint256;

    // Token IDs
    uint256 public constant GOLD_TICKET = 1;
    uint256 public constant VANGUARD_TIER = 2;
    uint256 public constant LEDGER_TIER = 3;

    // Pricing & Supply
    uint256 public mintPrice = 0.5 ether;
    uint256 public maxSupply = 1000;
    
    bytes32 public whitelistMerkleRoot;
    bool public isPublicSaleActive = false;
    bool public isWhitelistSaleActive = false;

    // Royalty metrics (in basis points)
    uint256 private _royaltyBps = 500; // 5%
    address private _royaltyRecipient;

    string public baseURI;

    error SaleNotActive();
    error ExceedsSupply();
    error InsufficientPayment();
    error NotWhitelisted();

    constructor(string memory _initialBaseURI, address initialOwner) 
        ERC1155(_initialBaseURI)
        Ownable(initialOwner) 
    {
        baseURI = _initialBaseURI;
        _royaltyRecipient = initialOwner;
    }

    /// @notice Mints a Gold Ticket for Whitelisted wallets (Governance Partners)
    /// @param proof Merkle proof confirming the sender's inclusion
    function whitelistMint(bytes32[] calldata proof) external payable {
        if (!isWhitelistSaleActive) revert SaleNotActive();
        if (totalSupply(GOLD_TICKET) + 1 > maxSupply) revert ExceedsSupply();
        if (msg.value < mintPrice) revert InsufficientPayment();
        require(balanceOf(msg.sender, GOLD_TICKET) == 0, "Max 1 per wallet");

        // Verify Merkle Proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (!MerkleProof.verify(proof, whitelistMerkleRoot, leaf)) revert NotWhitelisted();

        _mint(msg.sender, GOLD_TICKET, 1, "");
    }

    /// @notice Public Mint for Retail Pass
    function mint() external payable {
        if (!isPublicSaleActive) revert SaleNotActive();
        if (totalSupply(GOLD_TICKET) + 1 > maxSupply) revert ExceedsSupply();
        if (msg.value < mintPrice) revert InsufficientPayment();
        require(balanceOf(msg.sender, GOLD_TICKET) == 0, "Max 1 per wallet");

        _mint(msg.sender, GOLD_TICKET, 1, "");
    }

    // --- Admin Functions ---

    function setURI(string memory newuri) external onlyOwner {
        baseURI = newuri;
        _setURI(newuri);
    }

    function togglePublicSale() external onlyOwner {
        isPublicSaleActive = !isPublicSaleActive;
    }

    function toggleWhitelistSale() external onlyOwner {
        isWhitelistSaleActive = !isWhitelistSaleActive;
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }

    function setWhitelistRoot(bytes32 root) external onlyOwner {
        whitelistMerkleRoot = root;
    }

    function withdraw() external onlyOwner nonReentrant {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Withdraw Failed");
    }

    // EIP-2981 Royalty Info
    function royaltyInfo(uint256 /* _tokenId */, uint256 _salePrice) external view returns (address, uint256) {
        uint256 royaltyAmount = (_salePrice * _royaltyBps) / 10000;
        return (_royaltyRecipient, royaltyAmount);
    }

    // The following functions are overrides required by Solidity.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._update(from, to, ids, values);
    }
}
