import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function EcosystemPage() {
  return (
    <AztecDocPage
      eyebrow="Ecosystem · Network Operators"
      title="The Humanity Ledger Ecosystem"
      subtitle="A growing network of sequencers, relayers, and application developers building the sovereign web on top of Aztec and XMTP. Humanity Ledger is not just a protocol, it is a foundational infrastructure provider."
      sections={[
        {
          id: 'testnet-sequencer',
          title: 'Official Aztec Testnet Sequencer',
          paragraphs: [
            'Humanity Ledger is an officially verified operator within the Aztec Network testnet ecosystem. As a testnet sequencer, our infrastructure is directly responsible for aggregating private L2 transactions, generating recursive UltraPlonk proofs, and committing state roots to the Ethereum Sepolia testnet.',
            'This is not merely a partnership; it is a structural integration. By operating core network infrastructure, Humanity Ledger ensures that our users\' shielded transactions are processed with maximum censorship resistance and minimal latency. We do not rely on third-party RPC endpoints for our core functionality.',
          ],
          callout: {
            title: 'Sequencer Attestation Protocol',
            body: [
              '// Example: Becoming an Aztec Testnet Sequencer',
              '// 1. Sign a challenge message with the ETH private key of an active attester',
              '$ cast wallet sign "<challenge_message>" --private-key 0x...',
              '',
              '// 2. Submit the signature hash to the Aztec Foundation Honk registry',
              '// Upon verification, the @Testnet Sequencer role is granted.'
            ].join('\n'),
          },
        },
        {
          id: 'v6-upgrade',
          title: 'Aztec v6 Network Upgrade Readiness',
          paragraphs: [
            'As core infrastructure providers, Humanity Ledger operations are strictly aligned with the Aztec Network upgrade cycles. The protocol has successfully migrated to the new v6 node architecture hosted under the aztec-labs-eng/aztec-node repository.',
            'Our testnet sequencers are currently running azteclabs/aztec:6.0.0-rc.1 in the v6 Testnet (deployed Sept 28, 2026), successfully batching transactions on the new rollup instance. This serves as a live dry-run for our infrastructure.',
          ],
          bullets: [
            'Governance Signalling (Oct 7): Our sequencers are configured with the GOVERNANCE_PROPOSER_PAYLOAD_ADDRESS to participate in the v6 upgrade consensus.',
            'Mainnet Deployment (Oct 20): We are prepared for the zero-day deployment of the stable v6.0.0 Mainnet binaries shipping just prior to the hard fork.',
            'Docker Registry: Our orchestrators now pull exclusively from the new azteclabs organization instead of the legacy aztecprotocol registry.',
          ],
        },
        {
          id: 'infrastructure-stack',
          title: 'Infrastructure Stack',
          paragraphs: [
            'The ecosystem is supported by a robust, multi-cloud infrastructure designed for 99.99% uptime and extreme cryptoeconomic security. The stack is separated into three distinct operational domains:',
          ],
          bullets: [
            'Aztec Sequencer Node: A high-compute cluster (minimum 32 vCPU, 128GB RAM) dedicated to running the Barretenberg prover for recursive proof aggregation. This node participates in the Aztec sequencer selection protocol.',
            'XMTP Relay Node: A Waku v2 gossip sub-node that routes ephemeral encrypted payloads. This node handles the high-throughput, low-latency requirements of the Ledger Chat signalling server and WebRTC handshakes.',
            'PXE Delivery Network: A global CDN that serves the Client-Side Private Execution Environment (WASM binary) to users\' browsers, ensuring that the critical cryptographic logic is delivered intact and without modification.',
          ],
        },
        {
          id: 'sovereign-alternative',
          title: 'The Sovereign Alternative',
          paragraphs: [
            'The digital identity ecosystem requires a paradigm shift away from centralized data collection and toward deterministic, mathematically proven sovereignty. Humanity Ledger represents this structural shift.',
            'Our ecosystem relies on the cryptographic hardware already present in billions of consumer devices. By leveraging the WebAuthn standard and hardware Secure Enclaves, we create a sybil-resistant identity network that is mathematically impossible to centrally exploit.',
            'Because private keys physically cannot leave the users\' devices, and all attestations are verified via zero-knowledge proofs on the Aztec rollup, the Humanity Ledger ecosystem provides absolute privacy guarantees without requiring users to trust the operator infrastructure.',
          ],
        },
        {
          id: 'partners-integrations',
          title: 'Integrations & Grants',
          paragraphs: [
            'We are actively collaborating with the bleeding edge of the privacy-preserving Web3 space. Our protocol is designed to be highly composable, allowing other dApps to leverage our ZK Identity primitive.',
          ],
          bullets: [
            'Aztec Foundation: Running core infrastructure and contributing to the Noir standard library.',
            'XMTP Labs: Pushing the boundaries of the XMTP protocol by integrating it with WebRTC for sovereign voice and video communication.',
            'Ethereum Foundation: Aligned with the endgame vision of a fully rollup-centric, privacy-preserving Ethereum ecosystem.',
          ],
          callout: {
            title: 'Build With Us',
            body: 'If you are building a protocol that requires sybil resistance without compromising user privacy, the Humanity Ledger ZK Identity circuit is available for integration. See the Developers section for the Noir circuit implementation.',
            href: '/developers',
            hrefLabel: 'View Developer Docs',
          },
        },
      ]}
    />
  );
}
