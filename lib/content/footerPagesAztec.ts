import type { AztecDocSection } from '@/components/landing/AztecDocPage';

// ─── WHITEPAPER ───────────────────────────────────────────────────────────────

export const WHITEPAPER_SECTIONS: AztecDocSection[] = [
  {
    id: 'executive-summary',
    title: '1. Executive Summary',
    paragraphs: [
      'Humanity Ledger is a privacy-preserving protocol built natively on the Aztec Network. It provides a zero knowledge execution environment where financial activity, identity verification, and governance actions are proven locally on the user device and verified by the network, without the network ever accessing the underlying private data.',
      'Public blockchains, by design, expose all transaction metadata to every observer. This creates fundamental problems for individuals, businesses, and institutions that require confidentiality as a standard operating condition. Humanity Ledger resolves this by making privacy the default state of the network, not an opt-in feature.',
      'The protocol is deeply integrated with the Humanity Ledger, which provides real-time monitoring of large capital flows across major blockchains. Users can act on these analytics, setting alerts, analyzing flows, executing attestations, entirely within the shielded environment. Their positions and intentions remain cryptographically hidden from all external observers.',
      'This document describes the technical architecture, cryptographic primitives, economic model, and development roadmap of the Humanity Ledger protocol.',
    ],
  },
  {
    id: 'problem-statement',
    title: '2. The Problem with Transparent Ledgers',
    paragraphs: [
      'Every transaction recorded on a public blockchain is permanently visible to any observer. Wallet addresses, transaction amounts, timing, counterparties, and accumulated balances are all stored in plain view. This level of transparency is fundamentally incompatible with standard expectations of financial privacy.',
      'For individuals, this creates risks of targeted attacks, social engineering, and surveillance by both commercial actors and adversarial entities. For businesses, it exposes operational data, counterparty relationships, and treasury movements that would normally be protected by commercial confidentiality. For institutions, the absence of privacy prevents participation in decentralised finance entirely.',
      'Current privacy tools, such as mixing services and coin join implementations, are additive patches to transparent systems. They introduce additional trust assumptions, attestation risks, and forensic vulnerabilities. A fundamentally private architecture requires that privacy be embedded at the execution layer, not grafted on afterward.',
    ],
    bullets: [
      'Front running: Transaction intent is publicly visible in the mempool before confirmation, allowing adversarial actors to exploit pending activity.',
      'Address clustering: Blockchain analytics firms link wallet addresses into identity clusters using graph analysis, effectively deanonymizing users.',
      'Surveillance: Governments and commercial entities continuously analyze on-chain data to build behavioral profiles of network participants.',
      'Competitive exposure: Businesses operating on public chains expose their treasury, counterparty relationships, and operational strategy to competitors.',
    ],
  },
  {
    id: 'cryptographic-foundations',
    title: '3. Cryptographic Foundations',
    paragraphs: [
      'Humanity Ledger is built on zk-SNARKs, Zero Knowledge Succinct Non-Interactive Arguments of Knowledge. A zk-SNARK allows one party (the prover) to demonstrate to another party (the verifier) that a statement is true, without revealing any information beyond the truth of the statement itself.',
      'In the context of Humanity Ledger, the prover is the user device running the local Private Execution Environment (PXE). The verifier is the Aztec Network. The user proves that a state transition, for example, a transfer of funds, was executed correctly according to the protocol rules, without revealing who sent what to whom, or for how much.',
      'State is managed using a private UTXO model structured as an encrypted Merkle tree. Each asset is represented as a private note committing to its owner, value, and a random blinding factor. To spend a note, the user generates a deterministic nullifier derived from the note secret and submits it alongside the proof. The nullifier is recorded publicly to prevent double-spending, while the note itself remains opaque.',
      'The cryptographic backbone relies on the Grumpkin curve for note encryption and nullifier generation, and the BN254 curve for the Barretenberg proving backend. This dual-curve architecture is critical because Barretenberg operates natively on BN254, but requires a cycle of curves or efficient non-native field arithmetic to express cryptographic primitives efficiently.',
    ],
    bullets: [
      'Client-side proving: All witness generation and proof construction occur on the user device using WebAssembly-compiled Barretenberg. The network receives only the proof and the public inputs.',
      'Nullifier trees: Prevent double-spending without revealing which note was spent or establishing any linkability between transactions.',
      'Authorization witnesses (AuthWit): Allow smart contracts to execute actions on a user\'s behalf through in-circuit proofs, eliminating the need for linkable on-chain signatures.',
      'Pedersen Hashes: Used extensively for state tree commitments due to their efficiency inside algebraic circuits compared to traditional hashes like SHA-256.',
    ],
  },
  {
    id: 'system-architecture',
    title: '4. System Architecture',
    paragraphs: [
      'The Humanity Ledger architecture is divided into three distinct operational layers, each with well-defined responsibilities and trust boundaries.',
      'The Client Layer runs entirely on the user device. It holds cryptographic keys, manages the local PXE, constructs private state transitions, and generates zk-SNARKs using the Barretenberg proving backend. No private inputs are transmitted outside this layer under any circumstances. IndexedDB is used to cache encrypted state to accelerate sync times.',
      'The Aztec L2 Layer operates as a zkRollup on Ethereum. It receives proofs from users, verifies their validity in batches, and updates the global state roots. The sequencer processes encrypted data and publishes verified state commitments without accessing the underlying private content. The L2 layer is responsible for transaction ordering, proof verification, and state root publication.',
      'The Ethereum L1 Layer provides ultimate settlement and data availability. State roots published by the Aztec sequencer are anchored to Ethereum, providing economic finality, censorship resistance, and a permanent audit trail of verified state transitions. L1 and L2 communicate via messaging portals that utilize Inbox and Outbox smart contracts to enable trustless asset bridging.',
    ],
    diagram: {
      caption: "Figure 2: Full-Stack Protocol Topology",
      chart: `graph TD
    subgraph "L0: Client Device"
      K[Wallet Keys] --> PXE(PXE - Barretenberg WASM)
      PXE -->|Locally encrypted| DB[(IndexedDB)]
      PXE -->|Proof Artifact| XMTP[XMTP E2EE Layer]
    end

    subgraph "L1.5: Aztec L2 Rollup"
      XMTP -->|Submit Proof| SEQ[Sequencer Node]
      SEQ --> PRV[Prover Network]
      PRV -->|Update Roots| ST[(Note + Nullifier Trees)]
    end

    subgraph "L1: Ethereum Mainnet"
      PRV -.->|Publish State Root| RC[Rollup Contract]
      RC -->|Inbox / Outbox| BR[Bridge Portals]
    end

    style PXE fill:#ffffff,stroke:#2a1b4d,stroke-width:2px
    style ST fill:#f5f5f5,stroke:#444444,stroke-width:1.5px
    style RC fill:#f0f0f0,stroke:#666666,stroke-dasharray: 5 5
    style XMTP fill:#ffffff,stroke:#000000,stroke-width:1.5px,stroke-dasharray: 3 3`,
    },
  },
  {
    id: 'ledger-network-integration',
    title: '5. Integration with Humanity Ledger',
    paragraphs: [
      'The Humanity Ledger monitors capital flows across more than 20 major blockchain networks in real time. It identifies large asset transfers, exchange inflows and outflows, wallet activations, and macroeconomic flow patterns, and surfaces these events as structured, queryable data.',
      'This dataset is accessible within the Humanity Ledger shielded environment through private indexing logic. Users interact with the data, querying events, setting alert conditions, analyzing accumulation patterns, entirely inside the Aztec shielded pool. Their queries, alert configurations, and subsequent actions are cryptographically hidden from the public network.',
      'The architecture creates a dual-state design: market analytics are derived from publicly available on-chain data (via rigorous graph DB parsing and RPC ingestion), while user engagement with those analytics remains entirely private. A user who acts on a large transfer alert cannot be observed by competitors or adversarial actors.',
    ],
    bullets: [
      'Alert Engine: Configurable alert conditions triggered by specific flow events across monitored networks.',
      'Private queries: Alert configurations and filter criteria are stored in the local PXE database, never transmitted to the network.',
      'Real-time delivery: Matching events are delivered to the user within sub-second latency via authenticated WebSocket streams.',
      'Cross-chain coverage: Bitcoin, Ethereum, BNB Chain, Solana, Polygon, Arbitrum, Optimism, Avalanche, and 12+ additional networks.',
    ],
  },
  {
    id: 'identity-layer',
    title: '6. Identity and Sybil Resistance',
    paragraphs: [
      'The Humanity Ledger identity layer uses zero knowledge biometric proofs to establish unique human status without exposing personally identifiable information. Users prove uniqueness through integration with established liveness protocols by generating a ZK proof of credential possession rather than submitting the credential itself.',
      'To interact with the protocol, a user provisions a Private on-chain identity. This is achieved by generating an Aztec Account Contract (a specialized smart contract wallet natively deployed on L2) which abstracts the key pairs. A user possesses a standard ECDSA or EdDSA signing key, but the account contract handles the verification, enabling sophisticated multisig and threshold designs natively.',
      'For institutional participants requiring formal compliance, the protocol supports selective disclosure through viewing keys and W3C Verifiable Credentials. Institutions can prove specific attributes to regulators, balance thresholds, transaction limits, jurisdictional compliance, without revealing their full transactional history or counterparty graph.',
    ],
  },
  {
    id: 'security-model',
    title: '7. Security Model and Threat Assumptions',
    paragraphs: [
      'Humanity Ledger operates under a zero-trust threat model. We assume that all network intermediaries, including the Aztec sequencer, API gateways, and the client browser environment, may be compromised. Security is guaranteed exclusively through cryptographic proofs, not through trust in infrastructure operators.',
      'Private keys are generated and stored exclusively on the user device. No server, API endpoint, or network component holds or has access to user private keys. State transitions require a valid zk-SNARK generated locally, making unauthorized state changes mathematically impossible regardless of the state of any server-side component.',
      'All Noir circuits and Ethereum bridge contracts are subjected to formal verification and independent third-party audits before deployment. Circuit soundness is verified against reference constraint models through differential testing. Audit reports are published in full.',
    ],
    bullets: [
      'Cryptographic soundness: Security derives from the mathematical properties of the proving system, not from operational trust.',
      'Non-extractable keys: Private keys never leave the device and are processed only within hardware-isolated environments where available.',
      'Formal verification: Critical circuits are formally verified to confirm the impossibility of generating false proofs.',
      'Continuous testing: Automated fuzzing and symbolic execution run continuously against the constraint system to identify edge cases before exploitation.',
    ],
  },
  {
    id: 'economic-model',
    title: '8. Economic Model and Token Distribution',
    paragraphs: [
      'The Humanity Ledger protocol uses a native utility asset, QDs (Quantum Digital Signatures), to align participant incentives, facilitate private coordination, and fund ongoing development. The total supply of QDs is permanently fixed at 210,000,000 units. This hard cap is technically enforced by the Noir smart contract deployed natively on Aztec Mainnet, it cannot be modified by any entity, including the founding team. There is no minting authority beyond the schedule encoded in the contract at deployment.',
      'QDs are issued exclusively within the Aztec shielded pool. All token operations, transfers, staking, governance voting, and reward claims, occur as private state transitions using the dual-state architecture of the Aztec Network. External observers cannot determine the distribution or flow of QDs among participants.',
      'Proof of Contribution rewards participants who provide verifiable value to the network: forensic analysis submissions, infrastructure uptime, open source circuit contributions, and governance participation. Contributions are verified by zk-SNARKs submitted to the network. The network authorizes minting only after proof verification, without knowing the identity of the contributor.',
    ],
    bullets: [
      'Community mining (50%, 105,000,000 QDs): Distributed over ten years to verified contributors via the Proof of Contribution mechanism.',
      'Ecosystem treasury (25%, 52,500,000 QDs): Governed by cryptographic community vote. Funds protocol development, audits, and ecosystem integrations.',
      'Core contributors (15%, 31,500,000 QDs): Four-year linear vesting with a one-year cliff. Ensures long-term alignment between the founding team and the protocol.',
      'Initial liquidity (10%, 21,000,000 QDs): Designated for initial attesting liquidity at Token Generation. Managed under a multisignature arrangement with predefined operational parameters.',
    ],
  },
  {
    id: 'development-status',
    title: '9. Development Status',
    paragraphs: [
      'The protocol development focuses on verified foundations built directly on the Aztec Network.',
      'Current status (26 July 2026): The frontend platform (humanidfi.com) is live and connected to the Aztec Mainnet (node.aztec.network). The Noir smart contracts, specifically QDsToken.nr as a native Aztec token and the mint_private_license KYC circuit, are fully specified and in active development. The legal and regulatory framework (25-document MiCA suite) is fully drafted and in the formal process of being executed.',
    ],
  },
  {
    id: 'conclusion',
    title: '10. Conclusion',
    paragraphs: [
      'Humanity Ledger provides the missing privacy layer for decentralised finance. By integrating natively with the Aztec Network and combining institutional market analytics from Humanity Ledger with cryptographically private execution, the protocol enables a new category of financial activity: verifiable, compliant, and completely private.',
      'The architecture is designed to scale without compromising its privacy guarantees. Each component, proving, sequencing, settlement, identity, operates with well-defined trust boundaries. Users retain exclusive control over their keys and data at all times.',
      'We invite developers, institutions, and privacy advocates to build on Humanity Ledger, contribute to its open source circuits, and participate in governance. The protocol belongs to its participants.',
    ],
  },
];

// ─── MANIFESTO ────────────────────────────────────────────────────────────────

export const MANIFESTO_SECTIONS: AztecDocSection[] = [
  {
    title: 'Privacy Is Not Optional',
    paragraphs: [
      'Financial privacy is a prerequisite for human autonomy. The ability to transact, save, and coordinate without exposing every detail of your financial life to permanent public surveillance is not a luxury, it is a fundamental operating requirement for individuals, businesses, and institutions alike.',
      'The current paradigm of public blockchains, where every balance, every counterparty, every amount is globally visible and permanently recorded, represents a radical departure from the confidentiality that has underpinned financial systems for centuries. A payment network where every participant can observe every other participant\'s complete financial history is not a neutral innovation. It is a surveillance system.',
    ],
  },
  {
    title: 'The Limitations of Transparency as Default',
    paragraphs: [
      'Proponents of transparent blockchains argue that visibility creates accountability. This argument conflates auditability, the ability to verify specific claims, with surveillance, the continuous observation of all activity by all parties. These are not the same thing, and conflating them leads to architectures that sacrifice privacy without gaining proportionate accountability.',
      'A business does not post its complete transaction history publicly to demonstrate it pays its taxes. It submits verified reports to regulators through controlled, legally defined processes. An individual does not broadcast their salary, rent, and grocery spending to prove they operate within the law. The disclosure of specific information to specific parties for specific purposes is fundamentally different from unrestricted public access to all information at all times.',
      'Zero-knowledge cryptography makes it possible to provide the former without the latter. A user can prove solvency without revealing their balance. A business can prove regulatory attestation without revealing its counterparties. An institution can prove policy adherence without revealing its attesting strategy. Verifiable claims do not require full transparency.',
    ],
  },
  {
    title: 'Default Privacy, Selective Disclosure',
    paragraphs: [
      'Humanity Ledger is built on a simple principle: privacy is the default, and disclosure is a controlled choice made by the user. This is not a technical limitation, it is an architectural decision made deliberately, because we believe users should control their data, not the other way around.',
      'When a user needs to demonstrate attestation, they generate a viewing key or a cryptographic range proof. The auditor receives verifiable evidence of the specific claim being made. Nothing else is disclosed. The process is controlled, auditable, and mathematically precise.',
      'This model resolves the apparent conflict between privacy and regulation. Regulators get the evidence they need. Users retain control over what is disclosed, to whom, and under what conditions. The network enforces these properties cryptographically, not through policy statements or terms of service, but through mathematics.',
    ],
  },
  {
    title: 'Open Infrastructure, Private Data',
    paragraphs: [
      'We believe that the code governing a financial protocol must be publicly auditable. Every circuit, every smart contract, every cryptographic primitive used by Humanity Ledger is open source and available for public review. Researchers, developers, and adversaries are all invited to analyze the system and identify weaknesses.',
      'This commitment to open infrastructure is not in conflict with our commitment to data privacy. The code is public. The data it processes is not. This is the correct architecture for a trustworthy financial system: transparent rules applied to private inputs.',
      'Protocol upgrades are subject to community governance. The rules of the protocol cannot be changed unilaterally by any individual or organization, including the founding team. Governance requires participation from verified community members, and changes take effect only after cryptographic ratification.',
    ],
  },
  {
    title: 'The Role of Market Analytics',
    paragraphs: [
      'Understanding capital flows is a legitimate and important activity. Large movements of assets across blockchain networks often signal significant market events: sovereign accumulation, exchange insolvency risk, protocol migrations, and macro repositioning. Participants who understand these flows are better positioned to make informed decisions.',
      'The Humanity Ledger makes these analytics available. The challenge is that acting on public analytics in a public environment creates a surveillance problem: if your alerts, queries, and attestations are all visible, the analytical advantage is neutralized and your own position becomes vulnerable.',
      'Humanity Ledger solves this by integrating market analytics into a private execution environment. You can access the same on-chain data, configure the same alerts, and execute the same strategies, without any of your activity being observable. The analytics are derived from public data. Your response to it is not.',
    ],
  },
  {
    title: 'What We Are Building',
    paragraphs: [
      'We are building the private coordination layer for decentralised finance. A system where individuals and institutions can participate in open financial networks without sacrificing the confidentiality that is a basic requirement of professional financial activity.',
      'We are not building privacy as an afterthought or as a feature. We are building it as the foundational operating condition of the network. Every component, the proving environment, the state model, the identity layer, the analytics integrations, is designed with privacy as the primary constraint.',
      'We believe this is the architecture that allows decentralised finance to reach its potential. Not because privacy is necessary to hide illicit activity, the protocol provides attestation tools precisely because legitimate activity sometimes requires disclosure, but because privacy is necessary for every participant who does not want to operate in permanent public view.',
    ],
  },
];

// ─── TOKENOMICS ───────────────────────────────────────────────────────────────

export const TOKENOMICS_SECTIONS: AztecDocSection[] = [
  {
    title: 'Overview',
    paragraphs: [
      'QDs (Quantum Digital Signatures) is the native utility token of the Humanity Ledger protocol, classified as a utility token under Article 3(1)(5) of Regulation (EU) 2023/1114 (MiCA). It is designed to be deployed natively on Aztec Network as a Noir smart contract, it is not an ERC-20 token on Ethereum L1, and no bridge contract exists.',
      'The total supply of QDs is permanently fixed at 210,000,000 units. This hard cap is enforced at the contract level inside the Noir program; no additional minting is possible once the supply ceiling is reached. All QDs activity, transfers, staking, governance participation, and reward claims, is conducted as private state transitions within the Aztec shielded pool.',
    ],
  },
  {
    title: 'Supply Distribution',
    paragraphs: [
      'The QDs supply is allocated across four categories, each governed by distinct vesting and unlock conditions. The structure is designed to prevent concentration, align long-term incentives, and fund sustainable protocol development.',
    ],
    bullets: [
      'Community mining, 50% (105,000,000 QDs): Distributed over ten years to participants who contribute verifiable value to the network through the Proof of Contribution mechanism. This is the largest allocation and is the primary source of circulating supply.',
      'Ecosystem treasury, 25% (52,500,000 QDs): Locked at genesis and governed by verified community vote. Funds are disbursed for protocol development, security audits, ecosystem grants, and strategic integrations. No unilateral disbursements are possible.',
      'Core contributors, 15% (31,500,000 QDs): Subject to a four-year linear vesting schedule with a one-year cliff. Ensures long-term alignment between the founding team and the protocol.',
      'Initial liquidity provision, 10% (21,000,000 QDs): Designated to establish liquidity upon token generation. Managed under a multisignature arrangement with predefined operational parameters.',
    ],
  },
  {
    title: 'Proof of Contribution',
    paragraphs: [
      'QDs are not mined through computational work. They are earned by contributing verifiable value to the network. This mechanism, Proof of Contribution, distributes new issuance to participants who perform specific, predefined actions that benefit the network.',
      'Eligible contributions include: forensic analysis submissions that identify significant on-chain events, infrastructure uptime for network nodes, open source circuit development and peer review, and governance participation. Each contribution type has a predefined reward structure and verification requirement.',
      'To claim a contribution reward, a participant submits a zk-SNARK proving that the eligible action was completed. The network verifies the proof and authorizes the minting of the corresponding QDs allocation, without ever learning the identity of the contributor. Rewards are deposited directly into the participant\'s shielded account.',
    ],
  },
  {
    title: 'Governance',
    paragraphs: [
      'Protocol governance is exercised through cryptographic voting. Verified participants cast votes within the shielded environment. The network tallies votes by verifying a set of valid, non-duplicate proofs of participation, without identifying individual voters or revealing the distribution of votes before the outcome is finalized.',
      'Proposals can cover protocol parameter changes, circuit upgrades, treasury disbursements, and new feature integrations. All proposals follow a defined submission, review, and voting process with predefined timelock periods between approval and implementation.',
      'The governance structure is designed to be resistant to plutocratic capture. Voting weight is not proportional to token holdings alone, it is modulated by verified contribution history, ensuring that active participants have proportionally greater influence over protocol direction than passive holders.',
    ],
  },
  {
    title: 'QDs Utility',
    paragraphs: [
      'Within the protocol, QDs serve several distinct functions beyond simple value transfer.',
    ],
    bullets: [
      'Access credentials: Certain protocol features, including premium alert tiers, dark pool participation, and advanced analytics, require holding a verified QDs balance.',
      'Governance participation: Verified QDs holders can submit and vote on protocol proposals.',
      'Fee settlement: Network fees for proof submission and sequencer interaction can be settled in QDs.',
      'Contribution staking: Participants staking QDs as collateral are eligible for higher-tier contribution opportunities with correspondingly larger rewards.',
    ],
  },
];

// ─── DEVELOPER DOCS ───────────────────────────────────────────────────────────

export const DEVELOPER_SECTIONS: AztecDocSection[] = [
  {
    title: 'Getting Started',
    paragraphs: [
      'Humanity Ledger provides a set of developer tools for building applications that leverage private state transitions on the Aztec Network. These tools abstract the complexity of zk-SNARK generation and private state management, enabling developers to integrate privacy-preserving features without requiring deep expertise in zero knowledge cryptography.',
      'The primary integration surface is the Humanity Ledger API, which provides REST endpoints for querying public protocol state and WebSocket streams for real-time event delivery. For applications requiring direct interaction with the shielded pool, the local Aztec PXE must be initialized and configured.',
    ],
    bullets: [
      'Install the Aztec sandbox: npm install -g @aztec/cli (requires Node.js 20+)',
      'Start a local Aztec sandbox: aztec start --sandbox',
      'Create a test account: aztec create-account',
      'Compile a Noir circuit: nargo compile (requires nargo 1.0+)',
      'Submit your first private transaction using the Humanity Ledger SDK (documentation available on GitHub)',
    ],
  },
  {
    title: 'Authentication',
    paragraphs: [
      'All API requests require authentication via HMAC-SHA256 request signing. Each API key has an associated secret used to generate the signature. The signature is computed over the request method, path, timestamp, and body hash.',
      'API keys are issued through the developer portal after identity verification. Keys are scoped to specific capabilities, read-only access for analytics queries, write access for proof submission, and administrative access for key management.',
      'For endpoints interacting with the shielded pool, the API functions strictly as a relay. It receives client-generated proofs and routes them to the Aztec sequencer. The API does not hold any cryptographic keys and cannot initiate or modify private state transitions.',
    ],
  },
  {
    title: 'The Noir Programming Language',
    paragraphs: [
      'All private logic in Humanity Ledger is expressed in Noir, a domain-specific language designed for zero knowledge circuit development. Noir provides a Rust-like syntax that compiles efficiently to the constraint representations required by the Barretenberg proving backend.',
      'Developers building custom circuits for integration with Humanity Ledger should review the published reference circuits, which demonstrate standard patterns for membership verification, private asset transfers, and authorization witness generation. These circuits are available under open source licenses and serve as both reference implementations and building blocks for custom applications.',
      'The Aztec sandbox provides a local development environment for compiling, testing, and deploying Noir circuits. It includes deterministic block production, pre-funded test accounts, and full event logging for debugging proving pipelines.',
    ],
    bullets: [
      'Install the Noir compiler: curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash',
      'Create a new circuit project: nargo new my_circuit',
      'Compile to constraint system: nargo compile',
      'Generate a proof locally: nargo prove',
    ],
  },
  {
    title: 'WebSocket Streams',
    paragraphs: [
      'The Humanity Ledger WebSocket API provides real-time delivery of on-chain events identified by the Humanity Ledger. Connections are authenticated using the same HMAC mechanism as REST requests, with the initial handshake including a signed timestamp.',
      'Once connected, clients subscribe to specific event channels. Available channels include large transfer events (by chain and minimum value), exchange flow events (deposits and withdrawals above threshold), and wallet activation events (first outbound transaction from a previously inactive address).',
      'Events are delivered as structured JSON objects with a consistent schema across all channels. Each event includes the originating chain, transaction identifier, asset type, normalized USD value, and a confidence score indicating the reliability of the classification.',
    ],
  },
  {
    title: 'Rate Limits and SLAs',
    paragraphs: [
      'The API enforces rate limits on all endpoints to ensure equitable access and prevent abuse. Default limits apply per API key, with higher limits available under enterprise agreements.',
      'Standard tier limits: 100 REST requests per minute, 10 concurrent WebSocket connections, 1,000 events per connection per minute.',
      'Enterprise tier: Custom rate limits, dedicated infrastructure, 99.9% uptime SLA, and priority support with defined response times.',
      'Rate limit status is communicated through response headers on all REST requests. WebSocket connections include a real-time flow control mechanism that signals approaching limits before disconnection occurs.',
    ],
  },
];

// ─── SECURITY ────────────────────────────────────────────────────────────────

export const SECURITY_SECTIONS: AztecDocSection[] = [
  {
    id: 'security-architecture',
    title: 'Security Architecture',
    paragraphs: [
      'The security architecture of Humanity Ledger is built on a single principle: no trust assumption should stand between a user and the security of their assets. Every security property of the protocol is guaranteed by cryptographic proof, not by the integrity of any server, operator, or intermediary.',
      'This means that the security of the protocol does not degrade if any single component, including the API gateway, the Aztec sequencer, or the indexing infrastructure, is compromised. Private keys never leave user devices. State transitions require locally generated proofs. The network can only advance state based on valid proofs, regardless of what any other actor does.',
    ],
  },
  {
    id: 'threat-model',
    title: 'Threat Model',
    paragraphs: [
      'We model the following adversaries as within scope for the protocol\'s security guarantees:',
    ],
    bullets: [
      'Passive network observers: Entities that monitor all network traffic, including the Aztec sequencer\'s data availability layer, and attempt to extract private information from public data.',
      'Compromised infrastructure: API servers, sequencer nodes, or indexing services that behave maliciously, either by withholding service or by attempting to forge state transitions.',
      'Colluding validators: A subset of the sequencer network that attempts to manipulate transaction ordering or censorship resistance.',
      'Advanced forensic analysis: Commercial blockchain analytics firms applying graph analysis, timing correlation, and value heuristics to deanonymize users.',
      'Long-term decryption: Adversaries who record encrypted data today with the intention of decrypting it in the future using advances in computing.',
    ],
  },
  {
    id: 'audits-verification',
    title: 'Audits and Formal Verification',
    paragraphs: [
      'All critical protocol components, Noir circuits, Ethereum bridge contracts, and client-side proving pipelines, are designed to undergo independent third-party security audits before any public deployment. Audit scope will include cryptographic soundness, implementation correctness, and denial-of-service resistance. Engaging Tier-1 ZK auditors (Trail of Bits, Nethermind Security) is a core prerequisite before mainnet launch.',
      'In addition to external audits, we apply formal verification to the most critical circuit components. Formal verification uses mathematical proof techniques to demonstrate that a circuit correctly enforces its intended constraints under all possible inputs, providing a stronger guarantee than testing alone.',
      'Audit reports, formal verification certificates, and the specific scope of each engagement are published in full at the time of completion. We do not delay disclosure of audit findings.',
    ],
  },
  {
    id: 'vulnerability-disclosure',
    title: 'Vulnerability Disclosure and Bug Bounty',
    paragraphs: [
      'We maintain an active bug bounty program covering all components of the protocol. Scope includes Noir circuit soundness, Ethereum contract vulnerabilities, API authentication bypasses, and client-side proving pipeline integrity.',
      'Critical vulnerabilities, those that could result in loss of user funds or deanonymization of users, are eligible for significant rewards. Specific bounty amounts are defined at the time of the formal bug bounty program launch, which occurs alongside our first public mainnet deployment. Researchers are asked to submit findings to humanityledger@icloud.com with a clear proof-of-concept demonstrating the vulnerability. We commit to acknowledging receipt within 24 hours and providing an initial assessment within 72 hours.',
      'Researchers are asked to submit findings to humanityledger@icloud.com with a clear proof-of-concept demonstrating the vulnerability. We commit to acknowledging receipt within 24 hours and providing an initial assessment within 72 hours. We adhere to a responsible disclosure timeline of 90 days, after which findings are disclosed publicly regardless of remediation status.',
    ],
    callout: {
      title: 'Responsible Disclosure',
      body: 'Do not attempt to exploit vulnerabilities against the production network or against any user\'s funds. Submit findings to our security team with a proof-of-concept in a controlled environment. We will work with you on coordinated disclosure.',
      href: 'mailto:humanityledger@icloud.com',
      hrefLabel: 'Contact the security team',
    },
  },
  {
    id: 'key-management',
    title: 'Key Management',
    paragraphs: [
      'User private keys are generated, stored, and used exclusively on the user device. The protocol does not provide a key custody service. Users are responsible for maintaining secure backups of their key material.',
      'For devices supporting hardware security modules, including iOS Wallet and Android StrongBox, the Humanity Ledger client uses hardware-backed key storage. In this configuration, the private key is non-extractable: it cannot be read from the device even by the application itself. All signing operations are performed inside the secure hardware element.',
      'For sovereign users requiring multi-party key management, the protocol supports threshold signatures proven inside a Noir circuit. M-of-N signers are required to authorize a transaction, with the proof confirming that the threshold was met without revealing the total number of signers or their individual identities.',
    ],
  },
];

// ─── ROADMAP ────────────────────────────────────────────────────────────────

export const ROADMAP_SECTIONS: AztecDocSection[] = [
  {
    title: 'Current State: Protocol Genesis & Mainnet Readiness',
    paragraphs: [
      'The Humanity Ledger architecture has reached full operational maturity on the active Aztec Mainnet (Node v5.0.0-rc.2, Rollup v4239416255) anchoring to Ethereum Mainnet. The system successfully validates 600+ end to end cryptographic integration tests natively against the decentralised network infrastructure. The foundation is now resilient, mathematically verified, and fully scaled to support the impending Beta Genesis rollout.',
    ],
  },
  {
    id: 'current-infrastructure',
    title: 'Architectural Milestones Achieved',
    paragraphs: [
      'The following foundational components are fully specified, cryptographically proven, and natively verified against the Aztec v5 infrastructure:',
    ],
    bullets: [
      'Native Aztec v5 Integration: Standardized all Noir state-transition circuits to utilize the `0.67.0` Aztec toolchain, executing flawlessly on `v5.0.0-rc.2` alongside permissionless sequencers.',
      'Sovereign Messaging Layer (LedgerChat): Deployed XMTP-powered End to End Encrypted messaging protocol, guaranteeing offshore persistence, cryptographic deniability, and cross-platform synchronization.',
      'Zero Knowledge Identity Portfolio: The Identity interface strictly polls verified state from the `AztecNativeContext`. A resilient, sybil-resistant 200 Beta Supply Indexed Wallet Signature is fully implemented and audited.',
      'Omni-Platform Terminal: Full iOS, Android, and Web responsiveness across the sovereign dashboard, featuring our proprietary "Zero-Mock" live data and cryptographic attestation architecture.'
    ],
  },
  {
    id: 'q3-2026',
    title: 'Q3 2026: Security & Formal Verification',
    paragraphs: [
      'The focus shifts to rigorous auditing and mathematical proofs.'
    ],
    bullets: [
      'Security Audits: Comprehensive third-party audits of Ledger Chat encryption bridges and the Sovereign Identity logic.',
      'Formal Verification: Mathematical proofs of the `mint_private_license` Noir circuit to guarantee sound constraint execution.',
      'Private Portfolio Integration: Connecting the frontend Identity interface with live on-chain private state transitions.'
    ]
  },
  {
    id: 'q4-2026',
    title: 'Q4 2026: Sovereign Pilots',
    paragraphs: [
      'Preparing the infrastructure for cryptographic and high-volume usage.'
    ],
    bullets: [
      'Pre-Mainnet Shadow Deployment: Running the entire architecture against an Aztec mainnet shadow fork.',
      'Dark Pool Testing: Sovereign pilot testing for the zero knowledge Dark Pool and Sentiment nodes.',
      'Performance Tuning: Optimizing WASM/PXE execution speeds on mobile devices.'
    ]
  },
  {
    id: 'january-2027',
    title: 'January 2027: Genesis & Open Network',
    paragraphs: [
      'The official launch of Humanity Ledger on Aztec Mainnet.'
    ],
    bullets: [
      'Aztec Mainnet Readiness: Full deployment of the verified smart contracts.',
      'Token Generation Event (TGE): The Genesis claims for the 200 Beta Supply of the Indexed Identity open to the whitelisted Gold Ticket holders.',
      'Sentinel Network Rollout: Public availability of the private market intelligence and Ledger alerts.'
    ]
  }
];


// ─── API REFERENCE ────────────────────────────────────────────────────────────

export const API_REFERENCE_SECTIONS: AztecDocSection[] = [
  {
    title: 'API Overview & Network Architecture',
    paragraphs: [
      'The Humanity Ledger Sovereign API provides deterministic, cryptographically secure programmatic access to network analytics, Aztec L2 state commitments, and real-time Humanity Ledger event streams. The API architecture separates read-only analytics endpoints from write-heavy state-transition relay layers.',
      'All interactions operate over TLS 1.3 with strict cypher suite enforcement. The base URL for the production environment is `https://api.humanidfi.com/v1`. Testnet environments operate on `https://api.humanidfi.com/v1`.',
      'The API Gateway implements a sophisticated bucket-algorithm rate limiter based on the caller\'s institutional tier, verifying HMAC-SHA256 signatures derived from assigned API keys in sub-millisecond latencies using edge-deployed WebAssembly verifiers.'
    ],
  },
  {
    title: 'Authentication & Cryptographic Signatures',
    paragraphs: [
      'Authentication relies on stateless HMAC-SHA256 signatures to eliminate the attack vectors inherent in session tokens. Every request must be independently signed using a secret key strictly guarded by the calling institution\'s HSM (Hardware Security Module) or secrets manager.',
      'Three mandatory headers must accompany every request:',
      '`X-API-Key`: Your sovereign public identifier.',
      '`X-Timestamp`: The Unix timestamp in seconds. The gateway rejects requests older than 300 seconds to prevent replay attacks.',
      '`X-Signature`: The computed Hex-encoded HMAC-SHA256 signature.'
    ],
    bullets: [
      'Signature Construction: The string to sign is formulated as: `METHOD + "\\n" + PATH + "\\n" + TIMESTAMP + "\\n" + SHA256(BODY)`.',
      'For GET requests, the `BODY` is empty, so `SHA256(BODY)` equals `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.',
      'If the signature fails verification, the API immediately terminates the connection with a 401 Unauthorized status, providing no internal state leakage.'
    ],
  },
  {
    title: 'REST Endpoint Specifications',
    paragraphs: [
      'The REST API is structured around immutable event streams, private state proofs, and network telemetry. Responses strictly adhere to `application/json` formatting with deterministic schemas.',
    ],
    bullets: [
      'GET /v1/events/mempool : Stream raw, pre-processed mempool anomalies matching standard sovereign Z-Score deviations (requires Cryptographic tier).',
      'POST /v1/pxe/proof_relay : Submits a Barretenberg-compiled zk-SNARK proof. The payload requires the base64-encoded proof, public inputs array, and target contract address. The gateway validates the structure but cannot read the private inputs.',
      'GET /v1/state/roots : Returns the latest finalized L2 state roots (Note Tree, Nullifier Tree, Public Data Tree, and Global Variables) necessary for constructing localized proofs.'
    ],
  },
  {
    title: 'WebSocket Multiplexing & High-Frequency Streams',
    paragraphs: [
      'For high-frequency algorithmic execution, the platform provides an authenticated WebSocket endpoint at `wss://stream.humanidfi.com/v1`. Unlike standard HTTP polling, the WebSocket layer supports multiplexing—allowing a single TCP connection to subscribe to multiple, concurrent telemetry channels (e.g., DEX swaps, cross-chain bridge movements, centralised exchange inflows).',
      'Authentication is handled during the `UPGRADE` request via the same HMAC headers. Once established, the client must send a `{"op": "subscribe", "channels": ["ledger_eth", "darkpool_arb"]}` frame to begin receiving binary-encoded JSON payloads.',
      'To maintain connection integrity across load balancers, the client must transmit a `{"op": "ping"}` frame every 15,000 milliseconds. Failure to ping within the TTL window results in an unceremonious TCP closure.'
    ],
  },
  {
    title: 'JSON Schemas and Type Definitions',
    paragraphs: [
      'All event objects conform to strict TypeScript interfaces. For example, a Humanity Ledger event will consistently contain `transaction_hash`, `source_chain`, `destination_chain`, `asset_contract`, `normalized_usd_volume`, and `z_score`.',
      'Amounts are serialized as stringified BigInts (e.g., `"1500000000000000000"`) to prevent IEEE-754 floating-point precision loss in JSON parsers. Timestamps are invariably ISO-8601 strings in UTC.'
    ],
  },
];

// ─── NOIR CIRCUITS ────────────────────────────────────────────────────────────

export const NOIR_CIRCUITS_SECTIONS: AztecDocSection[] = [
  {
    title: 'Noir and Barretenberg Proving Backend',
    paragraphs: [
      'The core cryptographic guarantees of Humanity Ledger are articulated in Noir—a Rust-inspired Domain Specific Language (DSL) for Zero Knowledge proofs. Noir abstracts the intense complexity of arithmetic circuits, compiling high-level logic into ACIR (Abstract Circuit Intermediate Representation).',
      'Once compiled to ACIR, the Humanity Ledger Private Execution Environment (PXE) invokes Barretenberg. Barretenberg is an ultra-fast, WebAssembly-optimized SNARK proving backend that utilizes the UltraPlonk constraint system. UltraPlonk supports custom gates and lookup tables (Plookup), drastically reducing the constraint count for complex operations like SHA-256 hashing or ECDSA signature verification.',
      'Because Barretenberg is executed entirely client-side (in-browser or via mobile HSMs), the private inputs—such as the user\'s true wallet balance, the recipient\'s address, and the precise transaction amount—never leave the device. The sequencer only receives the finalized proof.'
    ],
  },
  {
    title: 'State Architecture: Note Trees and Nullifiers',
    paragraphs: [
      'Aztec Network relies on a private UTXO (Unspent Transaction Output) model. Assets are stored as "Notes" within an append-only Merkle tree. A Note is essentially a cryptographic commitment (a Pedersen hash) of its underlying values: `owner`, `amount`, `asset_id`, and a `random_blinding_factor`.',
      'When a transaction occurs, the user\'s local PXE generates a proof that they possess a valid Note and know the private key corresponding to the `owner`. To prevent double-spending without revealing which Note is being spent, the circuit deterministically derives a "Nullifier" from the Note and the user\'s private key.',
      'The Nullifier is published to the public Nullifier Tree. The Aztec sequencer checks if the Nullifier already exists; if not, the transaction is valid, the Nullifier is added, and the new output Notes are appended to the Note Tree. The linkage between the spent Note and the new Notes is entirely obliterated.'
    ],
    callout: {
      title: 'Cryptographic Detail',
      body: 'The deterministic generation of Nullifiers uses the Grumpkin curve, a curve that forms a cycle with the BN254 curve used by Barretenberg, allowing highly efficient in-circuit elliptic curve operations without the massive overhead of non-native field arithmetic.',
      href: 'https://docs.aztec.network',
      hrefLabel: 'Aztec Official Docs'
    }
  },
  {
    title: 'Cross-Chain Message Boxes (L1 <-> L2)',
    paragraphs: [
      'To interact with Ethereum (L1) DeFi protocols—such as Uniswap or Aave—from the shielded L2, Humanity Ledger utilizes Aztec\'s L1 to L2 messaging portals. This architecture guarantees trustless capital movement without centralised multisig bridges.',
      'When withdrawing assets from the private L2 pool to L1, the Noir circuit constructs an `L2ToL1Message`. This message contains the target L1 contract address, the function selector, and the payload. The L2 sequencer collects these messages and, upon generating the Rollup Proof, anchors them into the `Outbox` smart contract on Ethereum.',
      'Once the L1 Outbox is updated, any relayer (or the user themselves) can execute the transaction on L1 by providing the Merkle proof of the message\'s inclusion. This guarantees that capital flows directly from the L2 shielded pool to L1 liquidity pools with cryptographic finality.'
    ],
  },
  {
    title: 'Authorization Witnesses (AuthWits)',
    paragraphs: [
      'Traditional Ethereum requires users to sign an `approve()` transaction before a contract can move their tokens, exposing the intent on-chain. Humanity Ledger uses Noir Authorization Witnesses (AuthWits) to abstract this.',
      'An AuthWit is a private, in-circuit proof that the owner of an Aztec Account Contract has authorized a specific action (e.g., "swap 100 USDC for WETH"). The AuthWit is passed to the execution function. The smart contract validates the proof and executes the logic in a single atomic transaction. The authorization is consumed immediately and securely without requiring a distinct, visible approval transaction.'
    ],
  }
];

// u2500u2500u2500 COMMUNITY FORUM INTRO u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500

export const COMMUNITY_FORUM_INTRO: AztecDocSection[] = [
  {
    title: 'Purpose',
    paragraphs: [
      'The System Forum is the primary coordination layer for Humanity Ledger protocol participants. It is the canonical location for technical proposals, circuit reviews, mainnet coordination, and governance deliberation.',
    ],
  },
  {
    title: 'Conduct',
    paragraphs: [
      'All participants are expected to maintain technical precision and professional conduct. Discussions must be grounded in verifiable claims. Protocol-level decisions require formal proposals with supporting evidence.',
    ],
  },
  {
    title: 'Categories',
    paragraphs: [
      'Topics are organized into structured categories: Humanity Ledger, General, Applications, Mainnet Nodes, Noir Circuits, Site Feedback, and QDs Connect. Select the appropriate category before posting to ensure visibility to the relevant participants.',
    ],
  },
];

