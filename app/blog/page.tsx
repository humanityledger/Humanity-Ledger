import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function BlogPage() {
  return (
    <AztecDocPage
      eyebrow="Network · Dispatch"
      title="Cryptographic Dispatch & Research"
      subtitle="Official communications, cryptographic research, and protocol updates from the core engineering team and the Humanity Ledger collective."
      sections={[
        {
          id: 'latest-dispatch',
          title: 'Dispatch 001: The Synthesis of Aztec and XMTP',
          paragraphs: [
            'September 2026 — The fundamental challenge of building a sovereign communication network lies in the tension between state consensus and ephemeral routing. Rollups excel at the former; pub/sub gossip networks excel at the latter. In this dispatch, we detail how Humanity Ledger bridges the Aztec L2 state machine with the XMTP relay network to achieve zero-knowledge financial settlement within an encrypted chat terminal.',
            'Read the full research paper on our GitHub repository.',
          ],
        },
        {
          id: 'roadmap-update',
          title: 'Dispatch 002: Path to Alpha Mainnet',
          paragraphs: [
            'September 2026 — Following our unveiling at the European Blockchain Convention in Barcelona, the core engineering team is accelerating toward the Alpha Mainnet launch scheduled for January 2027. Key milestones include the finalization of the hardware-rooted ZK Identity circuits, the deployment of the UltraPlonk verifiers to the Sepolia testnet, and the completion of our primary cryptographic audit.',
            'We are currently onboarding external security researchers to stress-test the circuit constraints and the WebAuthn enclave integration.',
          ],
        },
      ]}
    />
  );
}
