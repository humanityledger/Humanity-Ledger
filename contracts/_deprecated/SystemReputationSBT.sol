// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title SystemReputationSBT
 * @notice Non-transferable Soulbound Token that evolves as users achieve platform milestones.
 * @dev Based on ERC-1155 with all transfer functions overridden to revert.
 *      The Biconomy Paymaster sponsors gas for minting and upgrades.
 *
 * Token IDs:
 *   0  Observer     (joined the platform)
 *   1  Analyst      (30 days active, 10 forum posts)
 *   2  Ledger Watcher(90 days active, Pro subscription, 50 forum posts)
 *   3  System    (365 days active, Genesis Ticket holder, 200 forum posts)
 */
contract SystemReputationSBT is ERC1155, Ownable {
    using Strings for uint256;

    //  Events 
    event SBTMinted(address indexed holder, uint256 tier);
    event SBTUpgraded(address indexed holder, uint256 fromTier, uint256 toTier);
    event MilestoneRecorded(address indexed holder, string milestone, uint256 timestamp);

    //  State 
    mapping(address => uint256) public holderTier;         // current tier of each holder
    mapping(address => bool) public hasSBT;                // whether wallet has any SBT
    mapping(address => uint256) public joinedAt;           // timestamp of first mint
    mapping(address => uint256) public forumPostCount;     // on-chain post count (relayed)
    mapping(address => bool) public isGenesisMember;       // genesis ticket holder
    mapping(address => bytes32[]) public milestoneHashes;  // immutable milestone record
    /// @dev Prevents the same milestone hash from being recorded twice for the same holder.
    mapping(address => mapping(bytes32 => bool)) public milestoneRecorded;

    uint256 public constant MAX_TIER = 3;
    string private _baseMetadataUri;

    //  Tier thresholds (enforced by relayer using platform data) 
    uint256 public constant TIER_1_DAYS = 30;
    uint256 public constant TIER_1_POSTS = 10;
    uint256 public constant TIER_2_DAYS = 90;
    uint256 public constant TIER_2_POSTS = 50;
    uint256 public constant TIER_3_DAYS = 365;
    uint256 public constant TIER_3_POSTS = 200;

    constructor(string memory baseUri) ERC1155(baseUri) Ownable(msg.sender) {
        _baseMetadataUri = baseUri;
    }

    //  Minting: only the system relayer (owner) can mint 
    /**
     * @notice Mints the genesis Observer SBT to a new platform member.
     * @param holder The wallet address receiving the SBT.
     */
    function mint(address holder) external onlyOwner {
        require(!hasSBT[holder], "SBT: Already holds a token");
        hasSBT[holder] = true;
        holderTier[holder] = 0;
        joinedAt[holder] = block.timestamp;

        _mint(holder, 0, 1, "");
        emit SBTMinted(holder, 0);
    }

    /**
     * @notice Upgrades a holder's SBT to a higher tier. Burns the old token, mints the new one.
     * @param holder The wallet to upgrade.
     * @param newTier The new tier to assign. Must be holderTier[holder] + 1.
     */
    function upgrade(address holder, uint256 newTier) external onlyOwner {
        require(hasSBT[holder], "SBT: Does not hold a token");
        uint256 currentTier = holderTier[holder];
        require(newTier == currentTier + 1, "SBT: Must upgrade one tier at a time");
        require(newTier <= MAX_TIER, "SBT: Max tier reached");

        // Verify milestone eligibility on-chain
        uint256 daysActive = (block.timestamp - joinedAt[holder]) / 86400;
        if (newTier == 1) {
            require(daysActive >= TIER_1_DAYS && forumPostCount[holder] >= TIER_1_POSTS, "SBT: Tier 1 milestones not met");
        } else if (newTier == 2) {
            require(daysActive >= TIER_2_DAYS && forumPostCount[holder] >= TIER_2_POSTS, "SBT: Tier 2 milestones not met");
        } else if (newTier == 3) {
            require(
                daysActive >= TIER_3_DAYS &&
                forumPostCount[holder] >= TIER_3_POSTS &&
                isGenesisMember[holder],
                "SBT: Tier 3 milestones not met"
            );
        }

        // Burn old, mint new
        _burn(holder, currentTier, 1);
        _mint(holder, newTier, 1, "");
        holderTier[holder] = newTier;

        emit SBTUpgraded(holder, currentTier, newTier);
    }

    /**
     * @notice Records a milestone hash on-chain (e.g. IPFS CID of a forum post).
     * @param holder The wallet address.
     * @param milestoneHash Keccak256 hash of milestone data.
     * @param milestone Human-readable milestone label.
     */
    function recordMilestone(
        address holder,
        bytes32 milestoneHash,
        string calldata milestone
    ) external onlyOwner {
        require(hasSBT[holder], "SBT: Wallet has no SBT");
        // Deduplication guard: each milestone hash can only be recorded once per holder.
        // Without this, a malicious or compromised relayer could call recordMilestone
        // repeatedly with the same hash to artificially inflate forumPostCount and
        // allow a holder to satisfy tier-upgrade thresholds fraudulently.
        require(!milestoneRecorded[holder][milestoneHash], "SBT: Milestone already recorded");
        milestoneRecorded[holder][milestoneHash] = true;
        milestoneHashes[holder].push(milestoneHash);
        forumPostCount[holder]++;
        emit MilestoneRecorded(holder, milestone, block.timestamp);
    }

    /**
     * @notice Marks a wallet as a Genesis Ticket holder.
     */
    function setGenesisMember(address holder, bool status) external onlyOwner {
        isGenesisMember[holder] = status;
    }

    //  SOULBOUND: Override all transfer functions to block movement 
    function safeTransferFrom(
        address, address, uint256, uint256, bytes memory
    ) public pure override {
        revert("SBT: Soulbound - transfers are permanently disabled");
    }

    function safeBatchTransferFrom(
        address, address, uint256[] memory, uint256[] memory, bytes memory
    ) public pure override {
        revert("SBT: Soulbound - transfers are permanently disabled");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("SBT: Soulbound - approvals are permanently disabled");
    }

    //  Metadata 
    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(_baseMetadataUri, tokenId.toString(), ".json"));
    }

    function setBaseUri(string calldata newUri) external onlyOwner {
        _baseMetadataUri = newUri;
    }

    //  View helpers 
    function getMilestoneCount(address holder) external view returns (uint256) {
        return milestoneHashes[holder].length;
    }

    function getDaysActive(address holder) external view returns (uint256) {
        if (!hasSBT[holder]) return 0;
        return (block.timestamp - joinedAt[holder]) / 86400;
    }
}
