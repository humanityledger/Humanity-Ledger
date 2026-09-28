import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function ExplorerPage() {
  return (
    <AztecDocPage
      eyebrow="Network · Block Explorer"
      title="The Omniscient Shield Explorer"
      subtitle="Unlike traditional block explorers that expose the entire financial history and social graph of a network, the Humanity Ledger Block Explorer is a cryptographic verification tool. It provides deterministic proof of inclusion and system integrity without violating the zero-knowledge guarantees of the protocol."
      sections={[
        {
          id: 'paradigm-shift',
          title: 'The Privacy Paradox in Block Exploration',
          paragraphs: [
            'Traditional networks (Ethereum, Solana, Bitcoin) utilize transparent ledgers where every transaction, balance, and interaction is publicly broadcast. This allows block explorers like Etherscan to provide rich, human-readable data. However, this architecture is fundamentally incompatible with the right to financial privacy.',
            'Humanity Ledger is built on the Aztec Network, a privacy-first zk-Rollup. Our ledger state is composed of encrypted UTXOs (Unspent Transaction Outputs) and nullifier hashes. Consequently, the Block Explorer cannot display sender addresses, receiver addresses, asset types, or transfer amounts.',
          ],
        },
        {
          id: 'what-is-visible',
          title: 'What the Explorer Reveals',
          paragraphs: [
            'The Explorer serves as a vital tool for network health monitoring, sequencer auditing, and cryptographic verification. The following data points are publicly verifiable by any observer:',
            '1. L2 Block Headers: Cryptographic commitments to the state of the rollup, including the global state tree root, the nullifier tree root, and the contract tree root.',
            '2. Encrypted Commitments: Raw ciphertext blobs representing new UTXOs added to the state tree. These are mathematically impossible to decrypt without the corresponding viewing key.',
            '3. Nullifiers: Deterministic hashes representing consumed UTXOs. They prove that an asset was spent without revealing which asset it was or who spent it.',
            '4. Zero-Knowledge Proofs: The succinct cryptographic proofs submitted by users to validate their state transitions. The explorer verifies the mathematical soundness of these proofs against the protocol\'s verification keys.',
            '5. Sequencer Metrics: Data regarding block finality times, throughput (TPS), and L1 settlement costs.',
          ],
        },
        {
          id: 'viewing-keys',
          title: 'Authenticated Decryption (Viewing Keys)',
          paragraphs: [
            'Users can interact with the Explorer using their cryptographic viewing keys. By providing a viewing key to the local client interface, the user\'s browser can scan the encrypted commitments and decrypt only the UTXOs that belong to them.',
            'This decryption happens entirely client-side. The viewing key is never transmitted to the Explorer\'s backend servers. This allows users to view their own transaction history, export compliance reports, and audit their state while maintaining absolute privacy from the network and the protocol operators.',
          ],
        },
      ]}
    />
  );
}
