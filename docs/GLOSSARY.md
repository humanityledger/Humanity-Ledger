# Glossary of Terms

Understanding the **Ledger Alert Network** means understanding the specific terminology used in our architecture and analytics reporting.

## Core Concepts

- **EVM Thermodynamics**: An analytical framework that measures the "heat" (density and frequency) of transactions in the Ethereum Virtual Machine. High thermodynamic activity usually precedes a market shift.
- **System Vault**: The local, secured instance of our platform running on your hardware. It ensures your data, queries, and connected wallets are never exposed to external servers.
- **Ledger Worker**: The background indexing service that constantly monitors RPC endpoints, the mempool, and EVM events to decode massive sovereign movements.
- **Z-Score Mapping**: A statistical measurement that describes a value's relationship to the mean of a group of values. We use 90-day moving averages and Z-Scores to determine anomalous ("ledger-level") behavior on-chain.
- **Zero-Knowledge (ZK) Shield**: The cryptographic layer (often integrating tools like WorldID or Aztec Network circuits) that validates you have authorization or "Golden Ticket" status without actually revealing your public address to the system.
- **Golden Ticket**: A specialized, permanent on-chain access credential. Holding this ticket proves you are an sovereign/elite user without compromising your privacy.
- **Elite Neighbors**: A graph-theoretic concept used in our Neo4j database to identify addresses that frequently transact with known smart money or top-tier ledgers.
- **Mempool Sonar**: Our high-frequency scanner that detects incoming but unconfirmed transactions (pending in the mempool) before they are mined into blocks, preventing front-running delays.
