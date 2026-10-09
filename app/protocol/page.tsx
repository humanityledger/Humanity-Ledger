import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function ProtocolPage() {
  return (
    <AztecDocPage
      eyebrow="Protocol · Architecture Overview"
      title="The Humanity Ledger Protocol"
      subtitle="A mathematically sovereign, multi-layer cryptographic network designed to make privacy the default state of human digital interaction. Built on Aztec, XMTP, and hardware-rooted zero-knowledge identity."
      sections={[
        {
          id: 'overview',
          title: 'What is Humanity Ledger?',
          paragraphs: [
            'Humanity Ledger is a next-generation decentralised communication and identity protocol built for a world where privacy, sovereignty, and mathematical truth supersede institutional trust. Unlike legacy centralised protocols, which relies on centralised biometric orbs and a corporation retaining iris scan hashes, Humanity Ledger anchors identity proofs entirely in the user\'s hardware Secure Enclave — a cryptographic module physically fused into the device silicon.',
            'The protocol is composed of three interconnected execution environments: the Aztec ZK-Rollup for private financial state settlement, the XMTP decentralised relay for ephemeral encrypted message routing, and the client-side Private Execution Environment (PXE) for local zero-knowledge proof generation. No private data ever leaves the device unencrypted.',
            'The protocol serves as the foundational infrastructure for Ledger Chat, the sovereign peer-to-peer messaging terminal, and for the Cryptocurrency (QD) economic system — a deflationary, privacy-preserving utility token used for protocol participation.',
          ],
          callout: {
            title: 'Core Design Principle',
            body: 'Humanity Ledger is designed such that even if the entire operator infrastructure were compromised, seized, or shut down, no user communications, identity data, or asset balances could be decrypted, attributed, or confiscated. This is enforced mathematically, not by policy or legal agreement.',
          },
        },
        {
          id: 'layers',
          title: 'Protocol Layers',
          paragraphs: [
            'The protocol operates across three distinct technical layers, each with a clearly defined responsibility boundary. Understanding these boundaries is critical to understanding why the system cannot be compromised at any single point.',
          ],
          bullets: [
            'Layer 1 — Ethereum (Settlement): The base layer of finality. Aztec rollup state roots are posted here. Ethereum\'s consensus mechanism provides the ultimate arbitration for any dispute over protocol state.',
            'Layer 2 — Aztec ZK-Rollup (Private Execution): All financial transactions (QD transfers, identity registrations, governance votes) are executed here. The Aztec sequencer network batches private state transitions into recursive UltraPlonk proofs and settles them on L1.',
            'Layer 3 — XMTP Relay Network (Ephemeral Messaging): A decentralised gossip network (Waku v2) for routing end-to-end encrypted messages between peers. The relay is cryptographically blind to the payloads it routes.',
            'Layer 0 — Client-Side PXE (Local Proving): A WebAssembly module running in the user browser. All Noir circuit compilation, proof generation, and private key operations occur here. Nothing sensitive exits this environment.',
          ],
        },
        {
          id: 'sovereign-identity',
          title: 'The Sovereign Identity Primitive',
          paragraphs: [
            'The foundational primitive of the Humanity Ledger is its approach to proof-of-personhood. Rather than relying on centralised biometric databases or third-party hardware collection events, the protocol leverages the cryptographic capabilities already present in modern consumer devices.',
            'By utilising the WebAuthn standard and hardware Secure Enclaves, Humanity Ledger anchors identity directly into the device silicon. The enclave generates an ECDSA keypair where the private key is physically non-extractable. A zero-knowledge proof is then generated locally, proving that a valid hardware-rooted signature exists for a given challenge, without ever exposing the underlying biometric trigger or the private key itself.',
            'This architecture ensures that identity is entirely self-sovereign. The protocol operators, sequencers, and relayers have zero visibility into the identities of the participants. The nullifier-based credential system guarantees that a user can prove their uniqueness across different contexts without those contexts being linkable to one another.',
          ],
          callout: {
            title: 'Privacy by Default',
            body: 'Humanity Ledger knows only that a valid cryptographic enclave generated a valid proof. There is no corporate database, no biometric storage, and no centralized honeypot of user data.',
          },
        },
        {
          id: 'testnet-sequencer',
          title: 'Humanity Ledger as Aztec Testnet Sequencer',
          paragraphs: [
            'Humanity Ledger is actively participating in the Aztec Network testnet sequencer programme. As a testnet sequencer, the Humanity Ledger node participates in the sequencer selection protocol, batches private L2 transactions from Ledger Chat users, generates the recursive ZK proofs required for block production, and posts the resulting state roots to Ethereum Sepolia.',
            'Running a testnet sequencer is the first step toward full decentralisation of the Aztec network. The sequencer role in the Aztec alpha testnet is permissioned via an attestation mechanism: the operator signs a challenge message using the Ethereum private key of their registered attester validator and submits the signature to the Aztec Foundation\'s role registry.',
            'Humanity Ledger has completed this attestation. Our node operates continuously on the Aztec testnet, contributing to the liveness and decentralisation of the network. This participation grants the protocol the @Testnet Sequencer role in the Aztec ecosystem, signalling to the developer community that Humanity Ledger is a first-class infrastructure participant in the Aztec network — not merely a dApp built on top of it.',
          ],
          bullets: [
            'Sequencer Status: Active on Aztec Alpha Testnet.',
            'Attestation: Signed via Ethereum EOA attester keypair and verified by Aztec Foundation.',
            'Block Production: Participating in UltraPlonk recursive proof generation for the testnet.',
            'Liveness: 24/7 node uptime monitored at /network/status.',
          ],
        },
        {
          id: 'roadmap',
          title: 'Protocol Roadmap',
          paragraphs: [
            'The Humanity Ledger protocol is currently in Alpha phase. The following milestones define the path to Mainnet and global adoption.',
          ],
          bullets: [
            'Q4 2026 — Alpha Testnet: Ledger Chat live on XMTP production network. ZK Identity circuits deployed on Aztec Sepolia. Testnet Sequencer attestation complete.',
            'Q1 2027 — Beta Mainnet: CryptoToken smart contract deployed on Aztec Mainnet. Hardware-rooted ZK Identity onboarding live. First 10,000 verified sovereign identities registered.',
            'Q2 2027 — Protocol Governance: Decentralised governance contract deployed. First community vote on protocol parameters via zk-Quadratic Voting.',
            'Q3 2027 — Ecosystem Expansion: Third-party developer SDK published. First external applications integrating Humanity Ledger ZK Identity as a Sybil resistance primitive.',
            'Q4 2027 — Global Scale: Target 1 million verified sovereign identities. Relay network expanded to 50+ independent nodes across 20+ jurisdictions.',
          ],
        },
      ]}
    />
  );
}

