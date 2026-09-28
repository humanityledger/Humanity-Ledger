import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function StatusPage() {
  return (
    <AztecDocPage
      eyebrow="Network · System Status"
      title="Protocol Operational Metrics"
      subtitle="Real-time cryptographic telemetry and infrastructure health metrics for the Humanity Ledger protocol, the Aztec L2 rollup, and the decentralized relay networks."
      sections={[
        {
          id: 'infrastructure-health',
          title: 'Decentralized Infrastructure Health',
          paragraphs: [
            'The Humanity Ledger protocol relies on a complex synthesis of decentralized networks and client-side cryptographic proving systems. This page aggregates the operational status of all critical infrastructure components.',
          ],
          bullets: [
            'Aztec Sequencer Network: The nodes responsible for batching L2 transactions and submitting them to Ethereum L1. Monitored for uptime, block production latency, and L1 finality lag.',
            'Barretenberg Prover Network: The distributed computation layer that generates the recursive zk-SNARKs required to settle the Aztec rollup state on Ethereum. Monitored for proving latency and queue depth.',
            'XMTP Decentralized Relay: The Waku v2-based gossip network used for Ledger Chat message propagation and WebRTC signaling. Monitored for message propagation latency and store node availability.',
            'Client-Side PXE (Private Execution Environment): The local WASM module running in user browsers that generates transaction proofs. Monitored via aggregated, anonymized telemetry for compilation success rates and memory usage.',
          ],
        },
        {
          id: 'incident-response',
          title: 'Cryptographic Incident Response',
          paragraphs: [
            'In the event of an infrastructure degradation or a cryptographic anomaly (such as a detected flaw in a Noir circuit or a vulnerability in the Barretenberg prover), updates will be broadcast through this portal in real-time.',
            'The protocol incorporates a decentralized "circuit breaker" mechanism. If a critical vulnerability is detected, the governance protocol can trigger a temporary suspension of state transitions to prevent malicious exploitation, while preserving the integrity of all existing private state.',
          ],
        },
      ]}
    />
  );
}
