// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title ZKVerificationKeyRegistry
 * @notice Records the SHA-256 of each pinned Noir/UltraHonk verification key
 *         (the binary `target/vk` written by Barretenberg), so that off-chain
 *         verifiers can check the key they hold against a public record before
 *         accepting a proof (master prompt task R-19).
 * @dev    The registry stores hashes, not keys, and verifies no proofs.
 *         - A new or changed hash only takes effect after a timelock, so users
 *           can see a key change coming before it is accepted.
 *         - Revocation is immediate: it can only make verification fail closed.
 *         - The initial set is written in the constructor and is therefore
 *           visible in the deployment transaction.
 *         Circuit ids are keccak256 of a label such as "hl.escrow.v1"
 *         (see lib/aztec/verifier.ts, `circuitRegistryId`).
 *         Not deployed to any network yet.
 */
contract ZKVerificationKeyRegistry is Ownable2Step {
    /// @notice Lifecycle of a registered key.
    enum Status {
        None,
        Active,
        Revoked
    }

    /// @notice Current record of a circuit.
    struct Entry {
        bytes32 vkHash;
        Status status;
        uint64 activatedAt;
    }

    /// @notice A change waiting for its timelock to pass.
    struct Pending {
        bytes32 vkHash;
        uint64 eta;
    }

    /// @notice Smallest delay the constructor accepts.
    uint64 public constant MIN_DELAY = 1 days;

    /// @notice Delay between proposing and activating a key hash.
    uint64 public immutable delay;

    mapping(bytes32 circuitId => Entry) private _entries;
    mapping(bytes32 circuitId => Pending) private _pending;

    /// @notice Emitted when a key hash becomes active.
    event VKActivated(bytes32 indexed circuitId, bytes32 vkHash);
    /// @notice Emitted when a key hash change is proposed.
    event VKProposed(bytes32 indexed circuitId, bytes32 vkHash, uint64 eta);
    /// @notice Emitted when a proposed change is cancelled.
    event VKProposalCancelled(bytes32 indexed circuitId, bytes32 vkHash);
    /// @notice Emitted when an active key is revoked.
    event VKRevoked(bytes32 indexed circuitId, bytes32 vkHash);

    /// @notice The delay is below MIN_DELAY.
    error DelayTooShort(uint64 delay);
    /// @notice A zero circuit id or zero hash was supplied.
    error ZeroValue();
    /// @notice The constructor arrays have different lengths.
    error LengthMismatch();
    /// @notice The circuit id appears twice in the initial set.
    error DuplicateCircuit(bytes32 circuitId);
    /// @notice There is no pending change for the circuit.
    error NoPendingChange(bytes32 circuitId);
    /// @notice The timelock of the pending change has not passed.
    error TimelockNotElapsed(bytes32 circuitId, uint64 eta);
    /// @notice The proposed hash is already the active one.
    error AlreadyActive(bytes32 circuitId);
    /// @notice The circuit has no active key to revoke.
    error NotActive(bytes32 circuitId);

    /**
     * @param initialOwner Governance account (a multisig in production).
     * @param delay_       Timelock in seconds, at least MIN_DELAY.
     * @param circuitIds   Initial circuits.
     * @param vkHashes     SHA-256 of each initial binary VK.
     */
    constructor(
        address initialOwner,
        uint64 delay_,
        bytes32[] memory circuitIds,
        bytes32[] memory vkHashes
    ) Ownable(initialOwner) {
        if (delay_ < MIN_DELAY) revert DelayTooShort(delay_);
        if (circuitIds.length != vkHashes.length) revert LengthMismatch();
        delay = delay_;
        for (uint256 i = 0; i < circuitIds.length; ++i) {
            bytes32 id = circuitIds[i];
            if (id == bytes32(0) || vkHashes[i] == bytes32(0)) revert ZeroValue();
            if (_entries[id].status != Status.None) revert DuplicateCircuit(id);
            _activate(id, vkHashes[i]);
        }
    }

    /**
     * @notice Proposes a new key hash for a circuit; it can be executed after `delay`.
     * @dev    A second proposal for the same circuit replaces the first and restarts the timelock.
     * @param circuitId Circuit id.
     * @param vkHash    SHA-256 of the new binary VK.
     */
    function proposeVK(bytes32 circuitId, bytes32 vkHash) external onlyOwner {
        if (circuitId == bytes32(0) || vkHash == bytes32(0)) revert ZeroValue();
        Entry storage e = _entries[circuitId];
        if (e.status == Status.Active && e.vkHash == vkHash) revert AlreadyActive(circuitId);
        uint64 eta = uint64(block.timestamp) + delay;
        _pending[circuitId] = Pending(vkHash, eta);
        emit VKProposed(circuitId, vkHash, eta);
    }

    /**
     * @notice Activates a proposed key hash once its timelock has passed. Anyone can call it.
     * @param circuitId Circuit id.
     */
    function executeVK(bytes32 circuitId) external {
        Pending memory p = _pending[circuitId];
        if (p.eta == 0) revert NoPendingChange(circuitId);
        if (block.timestamp < p.eta) revert TimelockNotElapsed(circuitId, p.eta);
        delete _pending[circuitId];
        _activate(circuitId, p.vkHash);
    }

    /**
     * @notice Cancels a pending change.
     * @param circuitId Circuit id.
     */
    function cancelVK(bytes32 circuitId) external onlyOwner {
        Pending memory p = _pending[circuitId];
        if (p.eta == 0) revert NoPendingChange(circuitId);
        delete _pending[circuitId];
        emit VKProposalCancelled(circuitId, p.vkHash);
    }

    /**
     * @notice Revokes the active key of a circuit immediately (fail closed).
     * @param circuitId Circuit id.
     */
    function revokeVK(bytes32 circuitId) external onlyOwner {
        Entry storage e = _entries[circuitId];
        if (e.status != Status.Active) revert NotActive(circuitId);
        e.status = Status.Revoked;
        emit VKRevoked(circuitId, e.vkHash);
    }

    /**
     * @notice Current record of a circuit.
     * @param circuitId Circuit id.
     * @return vkHash      Registered hash (zero if never registered).
     * @return status      0 None, 1 Active, 2 Revoked.
     * @return activatedAt Timestamp of the last activation.
     */
    function getVK(bytes32 circuitId) external view returns (bytes32 vkHash, Status status, uint64 activatedAt) {
        Entry storage e = _entries[circuitId];
        return (e.vkHash, e.status, e.activatedAt);
    }

    /**
     * @notice Pending change of a circuit.
     * @param circuitId Circuit id.
     * @return vkHash Proposed hash (zero if none).
     * @return eta    Earliest execution time (zero if none).
     */
    function pendingVK(bytes32 circuitId) external view returns (bytes32 vkHash, uint64 eta) {
        Pending storage p = _pending[circuitId];
        return (p.vkHash, p.eta);
    }

    /**
     * @notice True if `vkHash` is the active key of the circuit.
     * @param circuitId Circuit id.
     * @param vkHash    SHA-256 of a binary VK.
     * @return accepted Whether the hash is active.
     */
    function isAccepted(bytes32 circuitId, bytes32 vkHash) external view returns (bool accepted) {
        Entry storage e = _entries[circuitId];
        return e.status == Status.Active && e.vkHash == vkHash;
    }

    function _activate(bytes32 circuitId, bytes32 vkHash) private {
        _entries[circuitId] = Entry(vkHash, Status.Active, uint64(block.timestamp));
        emit VKActivated(circuitId, vkHash);
    }
}
