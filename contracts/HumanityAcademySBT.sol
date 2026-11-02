// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./HumanityIdentityRegistry.sol";

/**
 * @title HumanityAcademySBT
 * @dev Soulbound Tokens (SBTs) for tracking user progress and certifications in the Academy.
 * Completely replaces the UserProgress and AcademySubmission PostgreSQL tables.
 */
contract HumanityAcademySBT is Ownable {
    HumanityIdentityRegistry public identityRegistry;

    // Course ID => User => Completed
    mapping(bytes32 => mapping(address => bool)) public courseCompletions;
    
    // User => Total XP
    mapping(address => uint256) public userXp;

    event CourseCompleted(address indexed student, bytes32 indexed courseId, uint256 xpAwarded);
    event XpAwarded(address indexed student, uint256 amount, string reason);

    error NotRegistered();
    error CourseAlreadyCompleted();

    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = HumanityIdentityRegistry(_identityRegistry);
    }

    modifier onlyRegistered() {
        if (!identityRegistry.isRegistered(msg.sender)) revert NotRegistered();
        _;
    }

    /**
     * @dev Complete a course and mint an SBT record for a registered student
     */
    function completeCourse(address student, bytes32 _courseId, uint256 _xpAmount) external onlyOwner {
        require(student != address(0), "Invalid student address");
        if (!identityRegistry.isRegistered(student)) revert NotRegistered();
        if (courseCompletions[_courseId][student]) revert CourseAlreadyCompleted();

        courseCompletions[_courseId][student] = true;
        userXp[student] += _xpAmount;

        emit CourseCompleted(student, _courseId, _xpAmount);
        emit XpAwarded(student, _xpAmount, "Course Completion");
    }

    /**
     * @dev Check if a user has a specific certification (SBT)
     */
    function hasCertification(address _student, bytes32 _courseId) external view returns (bool) {
        return courseCompletions[_courseId][_student];
    }
}
