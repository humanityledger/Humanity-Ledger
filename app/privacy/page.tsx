import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function PrivacyPage() {
  return (
    <AztecDocPage
      eyebrow="Compliance · Privacy Posture"
      title="Zero-Knowledge Data Posture"
      subtitle="Humanity Ledger does not protect your data. It architecturally denies its existence within our infrastructure. This document constitutes our complete and binding privacy posture under applicable data protection law, including the General Data Protection Regulation (EU) 2016/679 (GDPR) and the Markets in Crypto-Assets Regulation (EU) 2023/1114 (MiCA)."
      sections={[
        {
          id: 'architectural-position',
          title: '1. Architectural Denial of Data',
          paragraphs: [
            'Humanity Ledger is engineered from first principles to collect no personally identifiable information. This is not a policy commitment. It is a cryptographic constraint enforced at the system architecture level. Private keys are generated exclusively on user devices and never transmitted to any server, relay node, or API endpoint operated by Humanity Ledger or any third party.',
            'All cryptographic proofs are generated locally using the Barretenberg proving backend running as a compiled WebAssembly module on the user device. The proving process takes private inputs (keys, balances, communication metadata) and produces a proof artifact that contains no recoverable private information. This proof artifact is the only object transmitted to the Aztec L2 network.',
            'Our infrastructure components — API gateways, relay nodes, indexing services, and monitoring systems — receive only zk-SNARK proofs and their associated public inputs. These components have no technical capability to access, decrypt, or derive the underlying private data that generated those proofs. This is not an access control limitation. It is a mathematical property of the proving system.',
          ],
          bullets: [
            'No plaintext keys: Private keys are generated using WebCrypto or hardware-backed APIs and are never transmitted in any form.',
            'No data at rest: We operate no databases containing user identity, balance, or transaction history. The Aztec network state consists exclusively of encrypted commitments and nullifier hashes.',
            'No logs with PII: Our infrastructure logging is scoped to system metrics, proof throughput, and error traces. No user identifiers, addresses, or behavioral data appear in any log.',
            'No third-party analytics: We do not integrate Google Analytics, Meta Pixel, Mixpanel, Segment, or any behavioral tracking infrastructure.',
            'No cookies with PII: Session continuity for authenticated operations is managed via ephemeral browser-side state derived from locally held keys, not via persistent server-issued cookies.',
          ],
        },
        {
          id: 'what-we-process',
          title: '2. Data Processing: The Complete Inventory',
          paragraphs: [
            'To fulfill our legal obligations under GDPR Article 13 and 14, we provide an exhaustive enumeration of every data element that passes through our infrastructure. The list is intentionally short.',
            'Network-Level Metadata: Standard TCP/IP transport metadata (originating IP address, connection timestamp, request size) is processed in transit by our infrastructure. This data is neither stored persistently nor associated with any user identifier. IP addresses are not logged beyond standard CDN egress buffer windows (typically 24 hours), after which they are irreversibly discarded.',
            'Proof Artifacts: zk-SNARK proof objects submitted to our relay API are routed to the Aztec sequencer. These objects contain public inputs (nullifiers, commitment hashes) which are by definition publicly available on the Aztec L2 state tree. We do not retain proof objects in our infrastructure after successful relay to the sequencer.',
            'System Telemetry: Aggregated, non-attributable system metrics (proof generation latency percentiles, relay throughput, error rates) are retained for operational purposes for a maximum of 90 days in anonymized aggregate form. These metrics cannot be attributed to any individual.',
          ],
          bullets: [
            'Legal basis for network-level metadata processing: Legitimate interests (GDPR Article 6(1)(f)) — necessary for denial-of-service protection and infrastructure stability.',
            'Legal basis for proof relay: Contract performance (GDPR Article 6(1)(b)) — necessary to fulfill the relay service that constitutes the protocol.',
            'Legal basis for system telemetry: Legitimate interests (GDPR Article 6(1)(f)) — necessary for maintaining protocol reliability and security.',
            'Data subject categories: Pseudonymous wallet addresses. We hold no information permitting identification of the natural person behind any address.',
          ],
        },
        {
          id: 'ephemeral-communications',
          title: '3. Ephemeral Communications Architecture',
          paragraphs: [
            'Ledger Chat, the sovereign communications layer of the Humanity Ledger protocol, transmits all messages through the XMTP decentralized relay network. Messages are encrypted end-to-end using ECDH-derived symmetric keys that are generated and held exclusively by the communicating parties. The XMTP network nodes, and by extension our relay integration, receive only ciphertext.',
            'We do not operate XMTP nodes. XMTP is an independent, decentralized protocol. Messages routed through XMTP are stored encrypted on the XMTP distributed storage layer and are accessible only by parties holding the requisite decryption keys. We have no access to these keys.',
            'For WebRTC voice and video communications facilitated through Ledger Chat, media streams are established directly between peer devices via peer-to-peer ICE/STUN negotiation. Call media never transits our infrastructure. Our signaling relay (used only during ICE negotiation to exchange connection parameters) processes ephemeral session descriptors that are discarded immediately upon connection establishment.',
          ],
        },
        {
          id: 'data-subject-rights',
          title: '4. Data Subject Rights Under GDPR',
          paragraphs: [
            'GDPR Articles 15 through 22 confer specific rights on data subjects resident in the European Economic Area. We address each right as it applies to our architecture.',
            'Right of access (Article 15): You may request a complete account of all data we hold relating to your wallet address. Given our architecture, this request will be fulfilled with the confirmation that we hold no personally identifiable data. We hold no name, email address, phone number, or any other identifier associated with your address.',
            'Right to erasure (Article 17): The public nullifier hashes and commitment hashes published to the Aztec L2 state tree are not erasable, as they form part of an append-only distributed ledger secured by Ethereum. This is technically equivalent to the blockchain immutability recognized in EDPB guidance. However, as these objects contain no recoverable personal data, their continued existence presents no data protection concern.',
            'Right to data portability (Article 20): All private state held by you is held on your own device, in your own wallet. It is inherently portable. We hold no data on your behalf that would require export.',
            'Rights regarding automated decision-making (Article 22): We engage in no automated decision-making or profiling that produces legal or similarly significant effects for data subjects.',
          ],
          bullets: [
            'To exercise any data subject right, contact: humanityledger@icloud.com',
            'Response time: We commit to acknowledging your request within 72 hours and providing a substantive response within 30 days.',
            'Right to lodge a complaint: You retain the right to lodge a complaint with your national supervisory authority. For EEA residents, the relevant authority is determined by your country of residence.',
          ],
        },
        {
          id: 'international-transfers',
          title: '5. International Data Transfers',
          paragraphs: [
            'Our infrastructure is deployed across cloud regions in the European Union and the United States. To the extent that network-level metadata processing constitutes a cross-border data transfer under GDPR Chapter V, we rely on Standard Contractual Clauses (SCCs) as the legal mechanism for transfers to non-EEA jurisdictions.',
            'The Aztec L2 network operates as a permissionless decentralized protocol. Proof artifacts submitted to the network are broadcast to a globally distributed set of sequencer nodes. As these proof artifacts contain no personal data recoverable by any technical means, this broadcast does not constitute a transfer of personal data for the purposes of GDPR Chapter V.',
          ],
        },
        {
          id: 'security-measures',
          title: '6. Technical and Organisational Security Measures',
          paragraphs: [
            'In accordance with GDPR Article 32, we implement and maintain the following technical and organisational measures appropriate to the risk profile of our processing activities.',
            'Transport security: All API endpoints enforce TLS 1.3 with strong cipher suites (ECDHE key exchange, AES-256-GCM encryption). HSTS headers with a minimum max-age of one year are enforced. Certificate transparency is monitored via automated tooling.',
            'Cryptographic standards: All protocol cryptography uses standardized, peer-reviewed primitives. Elliptic curve operations use the BN254 and Grumpkin curves as defined by the Barretenberg proving system. Hash functions use Poseidon over BN254 for circuit-internal operations and SHA-256 for transport-layer operations.',
            'Audit logging: Infrastructure access is logged with immutable timestamps to a write-once logging backend. Access to infrastructure systems is restricted via hardware-backed MFA and is subject to quarterly access reviews.',
            'Incident response: We maintain a documented incident response procedure. In the event of a personal data breach within the meaning of GDPR Article 4(12), we will notify the competent supervisory authority within 72 hours of becoming aware of the breach, and will notify affected data subjects without undue delay where the breach is likely to result in a high risk to their rights and freedoms.',
          ],
        },
        {
          id: 'updates',
          title: '7. Updates to This Posture',
          paragraphs: [
            'This privacy posture is maintained as a living document and will be updated to reflect changes in our protocol architecture, applicable law, or supervisory guidance. Material changes will be communicated via the protocol changelog at humanidfi.com/company/changelog.',
            'The current version of this document was last reviewed on 28 September 2026. The governing language is English. Translations, if provided, are for convenience only.',
          ],
        },
        {
          id: 'contact',
          title: '8. Contact',
          paragraphs: [
            'For all data protection enquiries, requests, and complaints, contact Humanity Ledger at: humanityledger@icloud.com',
            'Humanity Ledger is the data controller for the limited processing activities described in this document. Our registered correspondence address is available upon request for formal legal purposes.',
          ],
          callout: {
            title: 'Data Protection Enquiries',
            body: 'For data subject rights requests, breach notifications, or regulatory enquiries, contact our data protection team. We commit to acknowledging all formal requests within 72 hours.',
            href: 'mailto:humanityledger@icloud.com',
            hrefLabel: 'Contact Data Protection Team',
          },
        },
      ]}
    />
  );
}
