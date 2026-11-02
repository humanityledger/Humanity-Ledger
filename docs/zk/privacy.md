# Aztec ZK Privacy Guarantees & Metadata Boundaries

## Completely Private (Encrypted on L2)
- Sender and receiver addresses in private note transfers
- Transaction amounts (hidden via Pedersen commitments)
- Escrow secret hashes and balance updates

## Public Metadata (Visible to Sequencer)
- Total transaction fee paid (in gas / fee token)
- Block inclusion timestamp
- Contract address invoked (unless wrapped in generic router)
