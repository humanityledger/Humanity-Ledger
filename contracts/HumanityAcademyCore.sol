// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./HumanityIdentityRegistry.sol";

/**
 * @title HumanityAcademyCore
 * @dev Replaces Course, Lesson, and MentoringMessage Prisma models.
 * Stores course metadata as IPFS hashes and tracks student submissions on-chain.
 */
contract HumanityAcademyCore is Ownable {
    HumanityIdentityRegistry public identityRegistry;

    struct Course {
        bytes32 courseId;
        string ipfsMetadata; // Title, description, modules
        bool isActive;
        address instructor;
    }

    struct Submission {
        bytes32 lessonId;
        string ipfsProof;
        bool isApproved;
        uint256 submittedAt;
    }

    mapping(bytes32 => Course) public courses;
    // courseId => (studentAddress => Submission[])
    mapping(bytes32 => mapping(address => Submission[])) public studentSubmissions;

    event CourseCreated(bytes32 indexed courseId, string ipfsMetadata);
    event LessonSubmitted(bytes32 indexed courseId, address indexed student, bytes32 lessonId);
    event SubmissionApproved(bytes32 indexed courseId, address indexed student, bytes32 lessonId);

    constructor(address _identity) Ownable(msg.sender) {
        identityRegistry = HumanityIdentityRegistry(_identity);
    }

    function createCourse(bytes32 _courseId, string calldata _ipfsMetadata) external {
        courses[_courseId] = Course({
            courseId: _courseId,
            ipfsMetadata: _ipfsMetadata,
            isActive: true,
            instructor: msg.sender
        });
        emit CourseCreated(_courseId, _ipfsMetadata);
    }

    function submitLesson(bytes32 _courseId, bytes32 _lessonId, string calldata _ipfsProof) external {
        require(courses[_courseId].isActive, "Course inactive");
        studentSubmissions[_courseId][msg.sender].push(Submission({
            lessonId: _lessonId,
            ipfsProof: _ipfsProof,
            isApproved: false,
            submittedAt: block.timestamp
        }));
        emit LessonSubmitted(_courseId, msg.sender, _lessonId);
    }

    function approveSubmission(bytes32 _courseId, address _student, uint256 _submissionIndex) external {
        require(courses[_courseId].instructor == msg.sender, "Not instructor");
        studentSubmissions[_courseId][_student][_submissionIndex].isApproved = true;
        emit SubmissionApproved(_courseId, _student, studentSubmissions[_courseId][_student][_submissionIndex].lessonId);
    }
}
