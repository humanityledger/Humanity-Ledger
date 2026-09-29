import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function DecentralizedRelayPage() {
  return (
    <AztecDocPage
      eyebrow="Protocol · Decentralized Relay"
      title="The Ephemeral Coordination Layer"
      subtitle="A distributed, censorship-resistant message bus that facilitates off-chain coordination, peer discovery, and payload delivery for the Humanity Ledger protocol without requiring trust in centralized servers."
      sections={[
        {
          id: 'why-relay',
          title: 'The Necessity of Off-Chain Coordination',
          paragraphs: [
            'Zero-Knowledge rollups like Aztec excel at settling private financial state and enforcing consensus. However, they are fundamentally unsuited for high-throughput, low-latency, ephemeral communications. WebRTC signaling, chat messages, and peer discovery require a system capable of routing millions of messages per second with sub-50ms latency.',
            'To solve this, Humanity Ledger integrates a Decentralized Relay built on the XMTP (Extensible Message Transport Protocol) architecture. This relay operates as an independent decentralized network specifically designed for secure message transport.',
          ],
        },
        {
          id: 'architecture',
          title: 'Relay Architecture and Topology',
          paragraphs: [
            'The Decentralized Relay is composed of a globally distributed set of validator nodes. These nodes do not achieve consensus over state; rather, they achieve consensus over message propagation. They operate a publish/subscribe (pub/sub) topic routing protocol.',
            'When a user initializes Ledger Chat, their client connects to the nearest relay node and subscribes to a specific cryptographic topic derived from their wallet address. Any peer wishing to communicate derives the same topic and publishes encrypted payloads to the network. The relay nodes propagate the payload across the network until it reaches the subscriber.',
          ],
          bullets: [
            'Waku v2 Protocol: The underlying gossip protocol ensuring message delivery.',
            'Store Nodes: Ephemeral persistence layers that cache messages for offline clients (up to 30 days).',
            'Filter Nodes: Bandwidth-efficient light node protocols for mobile clients.',
          ],
          diagram: {
            caption: "Figure 1: Waku v2 Gossip Topology",
            chart: `graph TD
    A[Alice (Light Client)] -->|Publish Ciphertext| N1(Relay Node 1)
    N1 <-->|Gossip Protocol| N2(Relay Node 2)
    N1 <-->|Gossip Protocol| N3(Store Node)
    N2 <-->|Gossip Protocol| N4(Relay Node 3)
    N3 -->|Cache Sync| B[Bob (Offline Client)]
    N4 -->|Direct Push| C[Charlie (Light Client)]
    
    style A fill:#ffffff,stroke:#000000,stroke-width:2px
    style B fill:#ffffff,stroke:#000000,stroke-width:2px
    style C fill:#ffffff,stroke:#000000,stroke-width:2px
    style N3 fill:#f5f5f5,stroke:#2a1b4d,stroke-width:2px,stroke-dasharray: 5 5`
          },
        },
        {
          id: 'encryption',
          title: 'Blind Payload Routing',
          paragraphs: [
            'The relay network is entirely "blind". It routes ciphertext envelopes without any ability to decrypt the contents or identify the communicating parties. The transport layer relies on Double Ratchet encryption (X3DH) negotiated entirely out-of-band or via the relay itself using ephemeral prekeys.',
            'Because the relay nodes have no insight into the payloads, they cannot censor specific communications, monitor social graphs, or monetize user data. The network is agnostic to the protocol running on top of it, treating a WebRTC SDP offer and a text message as identical opaque binary blobs.',
          ],
        },
        {
          id: 'incentives',
          title: 'Network Incentivization',
          paragraphs: [
            'Operating a high-throughput relay node requires significant bandwidth and compute resources. The Humanity Ledger economic model incorporates relay incentivization through Quantum Dots (QDs).',
            'In the upcoming protocol iterations, users will attach micro-proofs of QD micropayments to their relay payloads. Relay nodes will batch these proofs and submit them to the Aztec sequencer to claim their routing fees, creating a self-sustaining, decentralized infrastructure resistant to corporate capture.',
          ],
        },
      ]}
    />
  );
}
