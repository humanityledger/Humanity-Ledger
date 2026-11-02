/**
 * Developer Documentation Specifications
 * Genuine architectural reference for developers and integrators.
 */
export const DOCS_CONTENT = [
  {
    slug: "introduction-to-decentralised-analysis",
    title: "Introduction to Decentralised Analysis",
    content: [
      "Decentralised analysis enables client-side verification of ledger events without relying on a centralized intermediary. Each client connects to public nodes or runs a local light client to query contract states and event logs directly.",
      "The architecture prioritizes zero-knowledge proofs where transactional integrity and privacy are verified locally before state updates are broadcasted to the network.",
      "Integrators interact with the system via standard JSON-RPC interfaces and client-side SDKs, ensuring full compatibility with existing Web3 tooling while preserving caller anonymity.",
    ],
  },
  {
    slug: "the-zero-trust-protocol",
    title: "The Zero-Trust Protocol",
    content: [
      "The zero-trust model enforces that the backend server is treated as an untrusted transport relay. Message confidentiality, authenticity, and integrity are guaranteed by end-to-end cryptographic layers.",
      "Authentication utilizes SIWE (EIP-4361) to bind requests to hardware-backed Ethereum private keys. Identity headers supplied by clients are stripped at the perimeter middleware.",
      "All persistent state modifications require cryptographically signed payloads, preventing unauthorized privilege escalation or IDOR vulnerabilities.",
    ],
  },
  {
    slug: "mobile-and-desktop-integration",
    title: "Mobile and Desktop Integration",
    content: [
      "Client applications run across Web, iOS, and Android platforms using native shells and progressive web standards.",
      "Cryptographic private keys remain exclusively within local secure enclaves (Apple Keychain and Android Keystore) and are never transmitted to server endpoints.",
      "Push notifications use data-free wake-up payloads, prompting the client application to fetch and decrypt messages locally via the XMTP network.",
    ],
  },
  {
    slug: "cryptographic-proving-systems",
    title: "Cryptographic Proving Systems",
    content: [
      "Private token transfers and identity proofs utilize Aztec's Noir programming language and Barretenberg proving system.",
      "Client-side proofs are computed in dedicated Web Workers to ensure responsive UI performance during constraint generation and witness calculation.",
      "Mainnet execution is strictly gated behind formal security audits and legal compliance attestations.",
    ],
  },
];
