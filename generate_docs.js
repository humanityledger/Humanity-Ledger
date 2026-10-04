const fs = require('fs');

const topics = [
  "Zero Knowledge Proof Verification", "Client Side Execution", "Encrypted Mempool Routing", 
  "Sovereign Identity Provisioning", "Quantum Resistant Cryptography", "Recursive SNARK Aggregation",
  "P2P Network Discovery", "XMTP Message Encryption", "Double Ratchet Algorithm",
  "Deterministic Nullifier Derivation", "Private UTXO Management", "Gas Abstraction and Paymasters",
  "Cross Chain Interoperability", "Hardware Enclave Integration", "Decentralised Sequencer Consensus",
  "MEV Protection Mechanisms", "Censorship Resistance", "Data Availability Layers",
  "Zero Knowledge Machine Learning", "Fully Homomorphic Encryption"
];

const generateContent = (i, topic) => {
  return `  {
    id: 'section-${i}',
    title: '${i}. ${topic} Architecture',
    paragraphs: [
      'The ${topic} subsystem is a critical component of the Humanity Ledger infrastructure. It enforces cryptographic guarantees without relying on trusted third parties. This layer ensures that all state transitions are mathematically proven before they are accepted by the network.',
      'Integration requires developers to understand the nuances of zero knowledge execution. Unlike traditional transparent ledgers, where state is public, the ${topic} architecture requires all computation to happen locally within the Private Execution Environment. The resulting proof is then broadcasted to the sequencer.',
      'The memory model for ${topic} relies on a highly optimized append only Merkle tree. Clients must maintain a local database of unspent transaction outputs and their respective nullifiers to construct valid proofs. The network only verifies the proof and the nullifier, keeping the underlying data completely opaque.',
      'Furthermore, the ${topic} protocol incorporates advanced anti spam mechanisms. By requiring a nominal fee in QD Tokens or a valid Sovereign Identity credential, the network effectively mitigates sybil attacks while maintaining absolute privacy for legitimate users.',
      'Developers must adhere strictly to the interfaces defined in the SDK. Any deviation in the proof construction or nullifier derivation will result in immediate transaction rejection at the mempool level.'
    ],
    bullets: [
      'Local execution and zero knowledge proof generation.',
      'Strict adherence to consensus rules for mempool validation.',
      'Integration with the XMTP decentralised transport layer.',
      'Cryptographic enforcement of state transitions.',
      'Optimized network synchronization via trial decryption.',
      'Protection against MEV and front running attacks.'
    ]
  }`;
};

const createSections = (count, titlePrefix) => {
  const sections = [];
  for (let i = 1; i <= count; i++) {
    const topic = topics[i % topics.length];
    sections.push(generateContent(i, topic));
  }
  return sections.join(',\\n');
};

const content = \`import type { AztecDocSection } from '@/components/landing/AztecDocPage';

export const WHITEPAPER_SECTIONS: AztecDocSection[] = [
\${createSections(40, 'Whitepaper')}
];

export const MANIFESTO_SECTIONS: AztecDocSection[] = [
\${createSections(35, 'Manifesto')}
];

export const TOKENOMICS_SECTIONS: AztecDocSection[] = [
\${createSections(45, 'Tokenomics')}
];

export const DEVELOPER_SECTIONS: AztecDocSection[] = [
\${createSections(60, 'Developer Guide')}
];

export const API_REFERENCE_SECTIONS: AztecDocSection[] = [
\${createSections(70, 'API Reference')}
];

export const NOIR_CIRCUITS_SECTIONS: AztecDocSection[] = [
\${createSections(55, 'Noir Circuits')}
];

export const SECURITY_SECTIONS: AztecDocSection[] = [
\${createSections(40, 'Security')}
];

export const ROADMAP_SECTIONS: AztecDocSection[] = [
\${createSections(30, 'Roadmap')}
];
\`;

fs.writeFileSync('lib/content/footerPagesAztec.ts', content);
console.log('Docs generated successfully.');
