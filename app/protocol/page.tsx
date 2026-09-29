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
            'Humanity Ledger is a next-generation decentralised communication and identity protocol built for a world where privacy, sovereignty, and mathematical truth supersede institutional trust. Unlike Worldcoin, which relies on centralised biometric orbs and a corporation retaining iris scan hashes, Humanity Ledger anchors identity proofs entirely in the user\'s hardware Secure Enclave — a cryptographic module physically fused into the device silicon.',
            'The protocol is composed of three interconnected execution environments: the Aztec ZK-Rollup for private financial state settlement, the XMTP decentralised relay for ephemeral encrypted message routing, and the client-side Private Execution Environment (PXE) for local zero-knowledge proof generation. No private data ever leaves the device unencrypted.',
            'The protocol serves as the foundational infrastructure for Ledger Chat, the sovereign peer-to-peer messaging terminal, and for the Quantum Dots (QD) economic system — a deflationary, privacy-preserving utility token used for protocol participation.',
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
          id: 'vs-worldcoin',
          title: 'Why Humanity Ledger Supersedes Worldcoin',
          paragraphs: [
            'Worldcoin\'s architecture has three fundamental flaws that Humanity Ledger resolves at the protocol level. First, Worldcoin requires a physical orb scan — a centralised biometric collection event that creates an indelible record of a user\'s iris pattern, managed by a US corporation. Humanity Ledger requires only a WebAuthn authentication event using the device\'s existing Secure Enclave. No new hardware is needed. No biometric data leaves the device.',
            'Second, Worldcoin\'s proof of personhood system uses a semi-transparent merkle structure where the protocol operator has visibility into which commitments belong to active identities. Humanity Ledger uses nullifier-based anonymous credentials: the protocol can verify that a credential belongs to a registered human without knowing which human or which device generated it.',
            'Third, Worldcoin\'s WLD token is traded on centralised exchanges and subject to regulatory seizure. Humanity Ledger\'s Quantum Dots exist exclusively within the Aztec shielded pool. They cannot be frozen, seized, or attributed to a real-world identity by any authority.',
          ],
          callout: {
            title: 'Privacy Comparison',
            body: 'Worldcoin: Iris scan → Corporate DB → ZK proof of scan hash\nHumanity Ledger: Device Secure Enclave → Local ZK proof → Anonymous commitment\n\nWorldcoin knows your iris was scanned.\nHumanity Ledger knows only that a valid device generated a valid proof.',
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
            'Q1 2027 — Beta Mainnet: QDSToken smart contract deployed on Aztec Mainnet. Hardware-rooted ZK Identity onboarding live. First 10,000 verified sovereign identities registered.',
            'Q2 2027 — Protocol Governance: Decentralised governance contract deployed. First community vote on protocol parameters via zk-Quadratic Voting.',
            'Q3 2027 — Ecosystem Expansion: Third-party developer SDK published. First external applications integrating Humanity Ledger ZK Identity as a Sybil resistance primitive.',
            'Q4 2027 — Global Scale: Target 1 million verified sovereign identities. Relay network expanded to 50+ independent nodes across 20+ jurisdictions.',
          ],
        },
      ]}
    />
  );
}
