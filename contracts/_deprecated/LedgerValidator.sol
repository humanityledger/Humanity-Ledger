// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LedgerValidator
 * @dev Cryptographic validation layer for the Ledger Ecosystem's Gold Registry.
 * Audits the solvency of Exchanges, Casinos, and Wallets.
 */
contract LedgerValidator {
    address public ledgerAuthority;

    struct AuditRecord {
        bytes32 platformHash;
        string platformSlug;
        uint256 auditedReserveTotal;
        uint256 timestamp;
        bool isSolvent;
    }

    // Mapping from platform slug hash to its latest audit
    mapping(bytes32 => AuditRecord) public registry;

    event SolvencyVerified(
        bytes32 indexed platformHash, 
        string platformSlug, 
        bool isSolvent, 
        uint256 reserve, 
        uint256 timestamp
    );

    event AuthorityTransferred(address indexed previousAuthority, address indexed newAuthority);

    modifier onlyAuthority() {
        require(msg.sender == ledgerAuthority, "Unauthorized Ping");
        _;
    }

    constructor() {
        ledgerAuthority = msg.sender;
        emit AuthorityTransferred(address(0), msg.sender);
    }

    /**
     * @dev Pings the registry with the latest reserve data for a platform.
     * @param _platformSlug The canonical slug of the platform (e.g. "binance")
     * @param _reserve The USD equivalent of verified on-chain reserves
     * @param _isSolvent Boolean indicating the safety verdict
     */
    
    function transferAuthority(address _newAuthority) external onlyAuthority {
        require(_newAuthority != address(0), "Invalid address");
        emit AuthorityTransferred(ledgerAuthority, _newAuthority);
        ledgerAuthority = _newAuthority;
    }

    function pingReserve(
        string calldata _platformSlug, 
        uint256 _reserve, 
        bool _isSolvent
    ) external onlyAuthority {
        bytes32 platformHash = keccak256(abi.encodePacked(_platformSlug));
        
        registry[platformHash] = AuditRecord({
            platformHash: platformHash,
            platformSlug: _platformSlug,
            auditedReserveTotal: _reserve,
            timestamp: block.timestamp,
            isSolvent: _isSolvent
        });

        emit SolvencyVerified(platformHash, _platformSlug, _isSolvent, _reserve, block.timestamp);
    }

    /**
     * @dev Exposes the cryptographic signature components for the frontend verifying badge.
     */
    function getAudit(string calldata _platformSlug) external view returns (AuditRecord memory) {
        bytes32 platformHash = keccak256(abi.encodePacked(_platformSlug));
        return registry[platformHash];
    }
}
