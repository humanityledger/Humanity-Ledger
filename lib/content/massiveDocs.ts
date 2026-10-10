import { AztecDocSection } from '@/components/landing/AztecDocPage';

export const MASSIVE_WHITEPAPER: AztecDocSection[] = [
  {
    id: 'abstract',
    title: '1. Abstract and Protocol Motivation',
    paragraphs: [
      'The modern digital communication landscape is dominated by extractive surveillance architectures. Legacy platforms monetize metadata, social graphs, and plaintext communications while enforcing platform lock-in. Humanity Ledger is designed as a sovereign counter-architecture: a communications protocol where identity is cryptographic, encryption is mandatory, and payments are peer-to-peer.',
      'This yellow paper defines the technical specifications of the Humanity Ledger platform. The architecture separates communication from financial settlement, utilizing the Extensible Message Transport Protocol (XMTP) for end-to-end encrypted messaging, and Ethereum Virtual Machine (EVM) compatible networks for non-custodial asset transfers. Our design philosophy prioritizes user sovereignty without sacrificing the UX expectations of a modern application.'
    ]
  },
  {
    id: 'identity-layer',
    title: '2. The Cryptographic Identity Layer',
    paragraphs: [
      'Identity within Humanity Ledger is intrinsically tied to public-key cryptography. There are no usernames, passwords, or centralized identity providers. The foundational identity primitive is the Ethereum wallet address.',
      'Authentication is performed using the Sign-In with Ethereum (SIWE) standard, defined in EIP-4361. The authentication flow guarantees that the server can verify the ownership of an address without ever possessing the private key.'
    ],
    bullets: [
      'Step 1: The client requests a cryptographically secure random nonce from the authentication server.',
      'Step 2: The server issues the nonce and binds it to the current IP and session state to prevent replay attacks.',
      'Step 3: The client constructs a SIWE message containing the URI, domain, address, statement, and the server-issued nonce.',
      'Step 4: The user signs the SIWE message using their ECDSA private key (secp256k1 curve).',
      'Step 5: The server recovers the public key from the signature and verifies it matches the claimed address.'
    ],
    diagram: {
      caption: 'Figure 2.1: SIWE Authentication Flow',
      chart: `sequenceDiagram
    participant User as Wallet
    participant Client as Frontend
    participant Server as Auth API
    Client->>Server: GET /api/auth/nonce
    Server-->>Client: Return secure nonce
    Client->>User: Request Signature (EIP-4361 Message)
    User-->>Client: Return ECDSA Signature
    Client->>Server: POST /api/auth/verify (Message + Signature)
    Server->>Server: ecrecover(hash, signature)
    Server-->>Client: Issue HttpOnly Session Cookie`
    }
  },
  {
    id: 'xmtp-transport',
    title: '3. XMTP Transport and Message Routing',
    paragraphs: [
      'The transport layer relies on the Extensible Message Transport Protocol (XMTP). XMTP is a decentralized, off-chain communication network designed specifically for Web3 identities.',
      'Humanity Ledger operates XMTP relay nodes to facilitate low-latency delivery. The relay nodes do not process plaintext. They operate strictly as a blind routing layer for ciphertext envelopes, utilizing the Waku v2 gossip protocol for network propagation.'
    ],
    bullets: [
      'Waku Relay: The gossipsub-based routing protocol that floods messages to the network.',
      'Waku Store: Nodes that persist encrypted messages temporarily (up to 30 days) for offline recipients.',
      'Waku Lightpush: Enables mobile and web clients with limited bandwidth to push messages to full nodes.'
    ]
  },
  {
    id: 'e2ee-encryption',
    title: '4. End-to-End Encryption Architecture',
    paragraphs: [
      'Humanity Ledger implements the Double Ratchet Algorithm over an Extended Triple Diffie-Hellman (X3DH) key agreement. This is the cryptographic standard utilized by Signal, providing both forward secrecy and post-compromise security.',
      'When two wallets interact for the first time, they exchange identity keys and signed prekeys via the XMTP network. This allows them to compute a shared secret deterministically without requiring both parties to be online simultaneously.'
    ],
    diagram: {
      caption: 'Figure 4.1: X3DH Key Agreement',
      chart: `sequenceDiagram
    participant Alice
    participant Network as XMTP Store
    participant Bob
    Bob->>Network: Publish Identity Key (IK_B), Signed Prekey (SPK_B), One-Time Prekeys (OPK_B)
    Alice->>Network: Fetch Bob's Keys
    Alice->>Alice: Generate Ephemeral Key (EK_A)
    Alice->>Alice: DH1 = DH(IK_A, SPK_B)
    Alice->>Alice: DH2 = DH(EK_A, IK_B)
    Alice->>Alice: DH3 = DH(EK_A, SPK_B)
    Alice->>Alice: DH4 = DH(EK_A, OPK_B)
    Alice->>Alice: SK = KDF(DH1 || DH2 || DH3 || DH4)
    Alice->>Bob: Send Initial Ciphertext (includes IK_A, EK_A)`
    }
  },
  {
    id: 'double-ratchet',
    title: '5. The Double Ratchet Algorithm',
    paragraphs: [
      'Once the initial shared secret (SK) is established, the conversation utilizes the Double Ratchet algorithm. This combines a Diffie-Hellman (DH) ratchet with a symmetric-key KDF (Key Derivation Function) ratchet.',
      'The DH ratchet ensures that even if a session key is compromised, future messages remain secure because new DH ephemeral keys are continually exchanged. The symmetric ratchet ensures that past messages cannot be decrypted if a current key is compromised (forward secrecy).'
    ],
    callout: {
      title: 'Post-Compromise Security',
      body: 'If an attacker extracts a message key from a compromised device, they can only read the specific message encrypted by that key. The attacker cannot decrypt previous messages, nor can they decrypt future messages once the legitimate user sends a new message (triggering a DH ratchet step).'
    }
  },
  {
    id: 'payment-architecture',
    title: '6. Non-Custodial Financial Settlement',
    paragraphs: [
      'The payment layer of Humanity Ledger is strictly non-custodial. The platform functions as an interface builder, constructing Ethereum transactions that the user signs directly with their local wallet. At no point does Humanity Ledger infrastructure touch, hold, or route user funds.',
      'For native assets (ETH), the system utilizes standard EVM value transfers. For tokens (USDC), the system constructs ABI-encoded calls to the ERC-20 `transfer(address,uint256)` function.'
    ],
    bullets: [
      'Transaction Construction: Utilizes Wagmi v2 and Viem to fetch current gas parameters and construct the payload.',
      'Wallet Interaction: The payload is passed to the injected wallet provider (e.g., MetaMask via EIP-1193) or WalletConnect.',
      'Broadcast: The wallet signs and broadcasts the transaction to the RPC node. Humanity Ledger is entirely bypassed in the transmission.',
      'Receipt Injection: Once confirmed, the UI generates a receipt payload (__PAYMENT__::{...}) and transmits it through the encrypted XMTP channel.'
    ]
  },
  {
    id: 'community-metadata',
    title: '7. Centralized Metadata for Communities',
    paragraphs: [
      'While 1-to-1 messaging is fully decentralized via XMTP, Community structures (DAOs, groups) require a hybrid approach to ensure high performance, moderation capabilities, and instant state resolution. Community metadata is stored in a centralized PostgreSQL database.',
      'This database stores relational mapping of wallets to community roles, channel configurations, and access control lists (ACLs). The actual message content within these channels remains end-to-end encrypted using XMTP MLS (Messaging Layer Security) groups.'
    ],
    diagram: {
      caption: 'Figure 7.1: Hybrid Architecture Data Flow',
      chart: `graph TD
    A[User Client] -->|EIP-4361 Auth| B(API Server)
    B -->|Metadata Query| C[(PostgreSQL DB)]
    C -->|Return Channel List| B
    B -->|Return to Client| A
    A -->|Encrypt Group Message| D(XMTP MLS Protocol)
    D -->|Gossip Ciphertext| E(XMTP Relay Network)
    E -->|Deliver Ciphertext| F[Group Member Clients]`
    }
  },
  {
    id: 'database-schema',
    title: '8. Database Schema and RBAC',
    paragraphs: [
      'The relational database enforces Role-Based Access Control (RBAC). The schema is minimal, designed solely to facilitate coordination without holding sensitive communication data.'
    ],
    bullets: [
      'Community Table: id, name, description, isPublic, ownerAddress, createdAt.',
      'Member Table: id, communityId, walletAddress, role (ADMIN, MODERATOR, MEMBER), joinedAt.',
      'Channel Table: id, communityId, name, isPrivate, createdAt.'
    ],
    callout: {
      title: 'Data Minimization',
      body: 'The database does not contain a Message table. Message routing is handled by XMTP, and message storage is handled by IndexedDB on the local device. A database breach would reveal who is in which community, but not what they are saying.'
    }
  },
  {
    id: 'webrtc-signaling',
    title: '9. WebRTC Media Plane Architecture',
    paragraphs: [
      'Voice and video communications utilize the WebRTC protocol for direct peer-to-peer transmission. The media streams (RTP) are encrypted using DTLS-SRTP, meaning the audio and video data is indecipherable to anyone intercepting the packet stream.',
      'Humanity Ledger operates a signaling server solely for the initial exchange of Session Description Protocol (SDP) offers and ICE candidates. Once the peers establish a direct connection, the signaling server steps out of the loop entirely.'
    ]
  },
  {
    id: 'stun-turn',
    title: '10. STUN and TURN Infrastructure',
    paragraphs: [
      'To traverse NATs (Network Address Translators) and firewalls, the protocol utilizes STUN (Session Traversal Utilities for NAT). When a direct P2P connection is impossible due to symmetric NATs, a TURN (Traversal Using Relays around NAT) server is employed as a fallback.',
      'Even when media is relayed through a TURN server, the DTLS-SRTP encryption remains intact end-to-end. The TURN server merely relays the encrypted UDP packets and has no cryptographic capability to decode the media.'
    ]
  },
  {
    id: 'threat-model-1',
    title: '11. Threat Modeling: Server Compromise',
    paragraphs: [
      'A core tenet of the Humanity Ledger security model is analyzing the impact of a total infrastructure compromise. If an advanced persistent threat (APT) were to gain root access to the API servers and database:',
      '1. They could view the public wallet addresses of users and their community memberships.',
      '2. They could NOT decrypt any past or future messages, as the XMTP encryption keys reside strictly on user devices.',
      '3. They could NOT steal user funds, as financial transactions are executed client-side via the wallet provider.',
      '4. They could NOT spoof messages, as XMTP messages require a valid cryptographic signature from the sender\'s wallet.'
    ]
  },
  {
    id: 'threat-model-2',
    title: '12. Threat Modeling: Network Interception',
    paragraphs: [
      'If an attacker performs a Man-in-the-Middle (MitM) attack on a user\'s network connection:',
      '1. The TLS 1.3 encryption prevents the interception of API traffic (metadata, authentication).',
      '2. The XMTP payload encryption prevents the attacker from reading message contents even if they intercept the raw TCP/IP packets.',
      '3. The DTLS-SRTP encryption protects WebRTC voice and video streams from eavesdropping.'
    ]
  },
  {
    id: 'threat-model-3',
    title: '13. Threat Modeling: Device Seizure',
    paragraphs: [
      'The primary vulnerability in the Humanity Ledger architecture is endpoint compromise. If a user\'s physical device is seized and unlocked, or infected with malware (e.g., Pegasus):',
      'The attacker gains access to the IndexedDB storage, which contains the decrypted message history and the XMTP session keys. This is an inherent limitation of all software-based encryption systems: the data must be decrypted on the screen for the user to read it. Users requiring extreme operational security are advised to utilize ephemeral messaging features (burn timers) and hardware-backed execution environments.'
    ]
  },
  {
    id: 'offline-qr',
    title: '14. EIP-681 Offline Payment Protocol',
    paragraphs: [
      'To facilitate air-gapped security and physical world utility, the payment module generates EIP-681 compliant URIs. This allows a user to generate a payment request on an offline device, display it as a QR code, and have another user scan and broadcast it using an online device.',
      'The URI format `ethereum:pay-<address>?value=<amount>` is universally recognized by Web3 wallets, enabling seamless interoperability between Ledger Chat and external hardware wallets.'
    ]
  },
  {
    id: 'gdpr-compliance',
    title: '15. Data Privacy and GDPR Compliance',
    paragraphs: [
      'Humanity Ledger is architected to minimize the scope of regulated data processing. Under the General Data Protection Regulation (GDPR), personal data is defined as any information relating to an identified or identifiable natural person.',
      'By design, the platform processes cryptographic public keys (wallet addresses) rather than names, emails, or phone numbers. While a wallet address can be considered pseudonymous personal data if linked to an individual via external block explorers, Humanity Ledger itself does not possess the identifying linkage.'
    ],
    bullets: [
      'Data Minimization (Art 5c): We collect only the wallet address and session metadata required for protocol operation.',
      'Storage Limitation (Art 5e): IP addresses are purged from edge logs within 30 days. Message data is never stored on our servers.',
      'Integrity and Confidentiality (Art 5f): All stored metadata is protected by enterprise-grade encryption at rest and in transit.'
    ]
  },
  {
    id: 'future-scalability',
    title: '16. Future Scalability Vectors',
    paragraphs: [
      'As the network scales to millions of concurrent users, the centralized metadata layer for Communities will face bottleneck constraints. The roadmap includes migrating community state to highly scalable Layer 2 rollups or dedicated AppChains using the OP Stack or Arbitrum Orbit.',
      'This future transition will decentralize community moderation and access control without reintroducing per-message gas fees, maintaining the hybrid architecture\'s UX advantages while maximizing censorship resistance.'
    ]
  },
  {
    id: 'conclusion',
    title: '17. Conclusion',
    paragraphs: [
      'Humanity Ledger demonstrates that uncompromising cryptographic privacy and seamless user experience are not mutually exclusive. By strictly separating the encrypted transport layer (XMTP), the non-custodial financial layer (EVM), and the high-performance metadata layer (PostgreSQL), the protocol achieves a scalable architecture that respects user sovereignty.'
    ]
  }
];

export const MASSIVE_DEVELOPERS: AztecDocSection[] = [
  {
    id: 'intro',
    title: '1. Introduction to the Humanity Ledger SDK',
    paragraphs: [
      'The Humanity Ledger platform provides a robust set of APIs and SDKs for developers building privacy-first applications. Our infrastructure handles the complexities of wallet authentication, XMTP message routing, and non-custodial payments, allowing developers to focus on application logic.',
      'This documentation covers the REST APIs for community management, the React hooks for wallet integration, and the exact protocols required to interact with the Ledger Chat client.'
    ]
  },
  {
    id: 'auth-api',
    title: '2. Authentication API (SIWE)',
    paragraphs: [
      'All protected endpoints require an active session. Sessions are established using the Sign-In With Ethereum (SIWE) protocol.'
    ],
    bullets: [
      'GET /api/auth/nonce — Returns a secure, single-use alphanumeric nonce string.',
      'POST /api/auth/verify — Accepts a JSON payload { message: string, signature: string }. Validates the EIP-4361 signature. Upon success, sets an HttpOnly cookie containing the encrypted session JWT.',
      'GET /api/auth/session — Returns the currently authenticated wallet address and session expiration.',
      'POST /api/auth/logout — Invalidates the session cookie.'
    ]
  },
  {
    id: 'community-api',
    title: '3. Community Management REST API',
    paragraphs: [
      'The Communities API allows for programmatic creation and management of group spaces. All requests require the session cookie established via the Auth API.'
    ],
    bullets: [
      'GET /api/communities — Fetch a paginated list of public communities. Query parameters: ?page=1&limit=20&search=keyword.',
      'POST /api/chat/communities — Create a new community. Payload: { name: string, description: string, isPublic: boolean }. Returns the community ID and owner assignment.',
      'GET /api/chat/communities/:id — Fetch full details of a specific community, including channels and members (requires appropriate role).',
      'PATCH /api/chat/communities/:id — Update community metadata. Requires ADMIN role.',
      'POST /api/chat/communities/:id/channels — Create a new chat channel within the community.'
    ]
  },
  {
    id: 'xmtp-integration',
    title: '4. Interacting with the XMTP Layer',
    paragraphs: [
      'To build bots, automated agents, or custom clients that communicate with Ledger Chat users, developers must utilize the XMTP SDK. Humanity Ledger users are addressable via their standard Ethereum wallet address on the XMTP network.'
    ],
    callout: {
      title: 'Installation',
      body: 'npm install @xmtp/xmtp-js ethers',
    },
    bullets: [
      'Initialize Client: const xmtp = await Client.create(walletSigner, { env: "production" });',
      'Start Conversation: const conversation = await xmtp.conversations.newConversation(recipientAddress);',
      'Send Message: await conversation.send("Hello from the API!");',
      'Listen for Messages: for await (const message of await xmtp.conversations.streamAllMessages()) { console.log(message.content); }'
    ]
  },
  {
    id: 'custom-payloads',
    title: '5. Custom XMTP Content Types',
    paragraphs: [
      'Ledger Chat extends the standard XMTP text messages with custom payload strings to trigger native UI elements in the client. Developers can send these payloads to render rich features.'
    ],
    bullets: [
      'Payments: Send __PAYMENT__::{"amount":"1.5","token":"ETH","txHash":"0x...","to":"0x..."} to render the crypto payment receipt bubble.',
      'Media: Send __MEDIA__::{"url":"https://...","mime":"image/jpeg"} to render inline images or videos.',
      'Voice Notes: Send __AUDIO__https://... to render the native audio player.',
      'System Pins: Send __PIN__messageId to trigger the UI to pin a message.'
    ]
  },
  {
    id: 'payment-integration',
    title: '6. Wagmi/Viem Payment Construction',
    paragraphs: [
      'For third-party web clients integrating Humanity Ledger payment flows, we mandate the use of Wagmi v2 for react applications. The non-custodial requirement means the application must never ask for private keys.'
    ],
    diagram: {
      caption: 'Figure 6.1: Wagmi Hook Architecture',
      chart: `graph LR
    A[React Component] -->|useSendTransaction| B(Wagmi Core)
    B -->|Construct Tx| C(Viem Client)
    C -->|EIP-1193 Request| D[Browser Wallet Extension]
    D -->|User Signs| E((Ethereum RPC))`
    }
  },
  {
    id: 'electron-build',
    title: '7. Building the Electron Desktop Client',
    paragraphs: [
      'The desktop client is a native Electron wrapper around the Next.js production build. To compile the desktop binaries from the repository:'
    ],
    bullets: [
      '1. Execute the Next.js static export: npx next build (Ensure output: "export" is set in next.config.mjs).',
      '2. Navigate to the electron directory: cd electron.',
      '3. Install desktop dependencies: npm install.',
      '4. Compile for current OS: npm run build.',
      '5. Output binaries will be generated in the electron/dist folder (.exe for Windows, .dmg for macOS).'
    ]
  },
  {
    id: 'webhooks',
    title: '8. Webhooks and Event Streaming',
    paragraphs: [
      'Enterprise integrations can configure webhooks to receive real-time updates for community events. (Note: Message contents are NOT available via webhook due to XMTP end-to-end encryption).'
    ],
    bullets: [
      'COMMUNITY_CREATED: Fired when a new community is registered.',
      'MEMBER_JOINED: Fired when a wallet address joins a community.',
      'ROLE_UPDATED: Fired when an admin alters a member\'s RBAC role.',
      'CHANNEL_CREATED: Fired when a new channel is added to the architecture.'
    ]
  },
  {
    id: 'environment-config',
    title: '9. Environment Configuration Reference',
    paragraphs: [
      'The following environment variables must be populated in the .env file for the development server to initialize correctly.'
    ],
    bullets: [
      'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: Required for the AppKit wallet modal.',
      'DATABASE_URL: Connection string for the PostgreSQL metadata database.',
      'NEXTAUTH_SECRET: A 32-byte cryptographically secure random string used to encrypt session JWTs.',
      'NEXT_PUBLIC_ALCHEMY_API_KEY: Fallback RPC provider for resolving ENS names and fetching token balances.'
    ]
  },
  {
    id: 'best-practices',
    title: '10. Security Best Practices',
    paragraphs: [
      'When building applications that interact with Humanity Ledger users, developers must adhere to the following security constraints:'
    ],
    bullets: [
      'Never request or attempt to intercept a user\'s private key or seed phrase.',
      'Ensure all API interactions are conducted over HTTPS (TLS 1.2 or higher).',
      'Validate all user input server-side to prevent SQL injection or Cross-Site Scripting (XSS) within community descriptions.',
      'Do not store payment receipt metadata in persistent databases if it can be dynamically reconstructed from the blockchain.'
    ]
  }
];
