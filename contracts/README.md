# Humanity Ledger — Smart Contracts Architecture

This directory contains the authoritative L1 Solidity contracts for the Humanity Ledger protocol. Confidential L2 computation, anonymous transfers, and private transactions are executed via Aztec Network Noir circuits in `circuits/`.

## Active Core Contracts (In-Scope)

### Identity & Access
- `HumanityIdentityRegistry.sol`: On-chain identity mapping and World ID nullifier uniqueness verification.
- `ZKIdentityRegistry.sol`: Zero-knowledge proof verification anchor for identity claims.
- `ZKVerificationKeyRegistry.sol`: Verification key registry for Noir circuit proofs.

### Asset Security & Governance
- `HumanityTimeLockVault.sol`: Per-user multi-token timelock and dead man's switch vault with atomic multi-token sweeping.
- `security/LedgerDeadmanSwitch.sol`: Non-custodial inheritance protocol with 72-hour backup cooldown and strict caller authorization.
- `civilization/HumanTimeLock.sol`: Time-locked vault with non-reentrant ETH locking.
- `security/SafeContracts.sol`: Safe multisig circuit breaker and emergency control standard.
- `StudioProvenance.sol`: Immutable content hashing and timestamping anchor.

## Testing Mocks
- `mocks/MockERC20.sol`: Test mock for ERC-20 token transfers and allowances.
- `mocks/MockERC721.sol`: Test mock for NFT non-custodial forwarding.

## Deprecated & Retired Contracts
All obsolete contracts (including the retired QDS token, monolithic testnet routers, legacy paymasters, cross-chain bridge stubs, and legacy on-chain chat) have been permanently removed. Messaging in Ledger Chat is 100% end-to-end encrypted via XMTP MLS without centralized or on-chain plaintext storage.
