# Humanity Ledger — Smart Contracts Architecture

This directory contains the L1 Solidity contracts for the Humanity Ledger protocol. Confidential L2 computation and private transactions are executed via Aztec Network contracts in `aztec-contracts/`.

## Active Contracts

### Bridges & Settlement
- `HumanityOmnichainBridge.sol`: L1 token bridge for cross-chain liquidity and settlement.
- `HumanityPaymaster.sol`: ERC-4337 gasless onboarding and sponsorship paymaster.
- `HumanityTimeLockVault.sol`: Multisig timelock vault for protocol governance.

### Tokens & Identity
- `HumanityQdToken.sol` / `QDSToken.sol`: ERC-20 utility and settlement tokens on Ethereum / Base.
- `HumanityIdentityRegistry.sol`: On-chain identity mapping and verification.
- `ZKIdentityRegistry.sol`: Zero-knowledge proof verification anchor for identity claims.

### Security
- `security/LedgerDeadmanSwitch.sol`: Emergency recovery and dead man's switch mechanism.
- `security/SafeContracts.sol`: Safe multisig integration interfaces.

### Ancillary Modules
- `StudioProvenance.sol`: Immutable content hashing and timestamping.
- `HumanityAcademyCore.sol` & `HumanityAcademySBT.sol`: Non-transferable credential registry.
- `HumanityForum.sol`: Decentralized topic anchoring.
- `HumanityLedgerCore.sol`: Core protocol state coordinator.

## Deprecated Contracts
All obsolete and deprecated contracts (including on-chain chat, legacy oracles, and test verifiers) have been permanently removed from the repository. Messaging is handled 100% end-to-end encrypted via XMTP MLS without centralized or on-chain plaintext storage.
