import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function LedgerChatPage() {
  return (
    <AztecDocPage
      eyebrow="Protocol · Ledger Chat"
      title="Sovereign Decentralized Messaging"
      subtitle="Ledger Chat is the application layer of the Humanity Ledger protocol, built as a terminal interface for sovereign, uninterceptable communications and zero-knowledge asset transfers."
      sections={[
        {
          id: 'architecture',
          title: 'The Dual-Network Architecture',
          paragraphs: [
            'Ledger Chat operates fundamentally differently from traditional messaging applications like Signal or Telegram. It leverages a dual-network architecture: XMTP (Extensible Message Transport Protocol) for ephemeral, high-throughput message routing, and the Aztec L2 rollup for zero-knowledge state settlement and financial operations.',
            'This segregation of concerns allows Ledger Chat to provide instant, decentralized peer-to-peer communication without congesting the blockchain, while ensuring that all identity assertions and Quantum Dot transfers benefit from the absolute security and finality of Ethereum L1 via the Aztec prover network.',
          ],
        },
        {
          id: 'encryption',
          title: 'Cryptographic Forward Secrecy',
          paragraphs: [
            'Every conversation established in Ledger Chat utilizes the Double Ratchet Algorithm implemented over X25519 elliptic curves, providing perfect forward secrecy and post-compromise security. The key derivation function (KDF) rotates the symmetric keys for every single message sent.',
            'Because the application is entirely client-side, the private keys necessary to decrypt the conversation exist only in the volatile memory of the local device. The decentralised relay network (XMTP) acts purely as a blind packet router, incapable of inspecting metadata, payloads, or the social graph of interacting peers.',
          ],
          bullets: [
            'X25519 Ephemeral Handshakes: Secure peer discovery without trusting a central authority.',
            'Double Ratchet Ratcheting: Continuous key rotation guarantees forward secrecy.',
            'Metadata Obfuscation: Sender/receiver pairings are shielded at the network layer.',
          ],
          diagram: {
            caption: "Figure 1: E2EE Messaging Architecture",
            chart: `graph TD
    A[Alice's Device] -->|1. Generate ECDH Key| B(Local IndexedDB)
    A -->|2. Encrypt Payload| C[XMTP Decentralized Network]
    C -->|3. Route Ciphertext| D[Bob's Device]
    D -->|4. Decrypt via Double Ratchet| E(Local IndexedDB)
    
    style A fill:#ffffff,stroke:#000000,stroke-width:2px
    style D fill:#ffffff,stroke:#000000,stroke-width:2px
    style C fill:#f0f0f0,stroke:#666666,stroke-dasharray: 5 5`
          },
        },
        {
          id: 'zk-transfers',
          title: 'In-Band Quantum Dot Transfers',
          paragraphs: [
            'Ledger Chat integrates seamlessly with the Humanity Ledger Registry smart contracts on Aztec. Users can transfer Quantum Dots (QDs) directly within the chat interface. These transactions are compiled into zero-knowledge proofs locally using the Noir domain-specific language.',
            'When a transfer occurs, the recipient receives a cryptographic commitment representing the new UTXO (Unspent Transaction Output) balance. The sender generates a nullifier to destroy their spent UTXO. Because these operations occur inside the chat terminal, the user experience is identical to sending a text message, yet the underlying settlement provides cryptographic privacy guarantees that not even the protocol operators can breach.',
          ],
        },
        {
          id: 'webrtc',
          title: 'Decentralized Voice & Video (WebRTC)',
          paragraphs: [
            'Ledger Chat supports sovereign peer-to-peer voice and video calls. The connection establishment completely circumvents centralized signaling servers by utilizing the XMTP relay to exchange WebRTC Session Description Protocol (SDP) offers, answers, and ICE candidates.',
            'Once the ICE negotiation concludes, the media stream is routed directly between the communicating devices over an encrypted DTLS/SRTP channel. This guarantees that real-time communications are physically uninterceptable by any intermediary infrastructure.',
          ],
          diagram: {
            caption: "Figure 2: Decentralized WebRTC Signaling",
            chart: `sequenceDiagram
    participant A as Peer A (Caller)
    participant X as XMTP Network (E2EE)
    participant B as Peer B (Receiver)

    A->>X: Send __CALL_OFFER__ (SDP)
    X->>B: Deliver Encrypted Offer
    B->>X: Send __CALL_ANSWER__ (SDP)
    X->>A: Deliver Encrypted Answer
    A<-->>B: Direct P2P Media Stream (DTLS/SRTP)
    Note over A,B: XMTP is bypassed once media connects`
          }
        },
      ]}
    />
  );
}
