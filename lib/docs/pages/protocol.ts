import type { DocPage } from "../types";

export const architecture: DocPage = {
  slug: "architecture",
  href: "/docs/architecture",
  label: "Architecture",
  title: "Architecture overview",
  summary: "The parts that make up Humanity Ledger, where each one runs, and what each one can see.",
  keywords: ["architecture", "system", "design", "diagram", "stack", "infrastructure", "servers", "components", "trust", "boundary"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Humanity Ledger is a web application that connects your device to a small set of our own services and to two open networks. The most useful way to understand it is to ask, for each part, what it holds and what it can read.",
    },
    { t: "figure", kind: "architecture", caption: "Your device talks to our servers for accounts and communities, to XMTP for messages, and to blockchains for payments you sign." },
    { t: "h2", text: "The parts" },
    {
      t: "table",
      head: ["Part", "What it holds", "Can it read your direct messages?"],
      strongFirst: true,
      rows: [
        ["Your browser", "The Ledger Chat app, your message keys and your conversation history.", "Yes. This is where messages are encrypted and decrypted."],
        ["Your wallet", "The private key for your address. It signs sign in messages and payments.", "No. It is never given message content."],
        ["Humanity Ledger servers", "Accounts, sessions, profiles, contacts, communities, the hash of your PIN and the fallback relay.", "Only messages that took the fallback path, which are labelled."],
        ["XMTP network", "Encrypted messages waiting to be collected.", "No."],
        ["Ethereum and layer 2 networks", "Public payments you send from your wallet.", "No. Payments themselves are public."],
        ["Aztec network", "Private payment notes, in our experimental integration.", "No."],
      ],
    },
    { t: "h2", text: "Our servers" },
    {
      t: "p",
      text: "The web application runs on Next.js. A PostgreSQL database holds accounts and community data, and a Redis cache holds short lived state such as rate limits, online status and fallback messages waiting for delivery.",
    },
    { t: "h3", text: "The identity perimeter" },
    {
      t: "p",
      text: "Every request passes through one piece of code before it reaches any route. It deletes any identity headers the browser sent, verifies the session cookie, and only then attaches the verified address for the route to use. A route cannot be tricked into acting for someone else by a forged header or a parameter in the address bar.",
    },
    {
      t: "ul",
      items: [
        "Requests that change data must come from our own origin, which blocks cross site request forgery.",
        "A content security policy with a fresh nonce on every request limits which scripts the page can run.",
        "Sign in, email codes and PIN checks are rate limited.",
      ],
    },
    { t: "h2", text: "Services we rely on" },
    {
      t: "table",
      head: ["Service", "Used for", "What it receives"],
      strongFirst: true,
      rows: [
        ["XMTP", "Delivering direct messages", "Encrypted messages and the time they were sent."],
        ["Reown WalletConnect", "Connecting wallets on other devices", "Your wallet address and connection requests."],
        ["Resend", "Sending sign in codes by email", "Your email address and the code."],
        ["Cloudflare Turnstile", "Stopping automated email sign ups", "Browser signals used to tell people from bots."],
        ["Cloudflare R2", "Storing attachments", "The files you attach."],
        ["PeerJS, Google STUN, OpenRelay TURN", "Setting up and relaying calls", "Connection details and, for relayed calls, encrypted media."],
        ["Public blockchain RPC providers", "Reading balances and sending transactions", "Your address and the transactions you send."],
      ],
    },
    { t: "h2", text: "Known limits at scale" },
    {
      t: "p",
      text: "The web servers are stateless and can be run as many copies as needed. A few parts are not ready for that yet, and we list them so nobody is surprised:",
    },
    {
      t: "ul",
      items: [
        "Device linking codes and some rate limit counters live in the memory of a single server, so they do not follow a request to another copy.",
        "Some views refresh by polling rather than by push, which adds load as the number of people online grows.",
        "Community posts are served from the database on every request without a cache in front.",
      ],
    },
  ],
};

export const cryptography: DocPage = {
  slug: "cryptography",
  href: "/docs/cryptography",
  label: "Encryption",
  title: "Encryption in use",
  summary: "Every cryptographic mechanism in the product, where it applies, and where none applies yet.",
  keywords: ["crypto", "cryptography", "encryption", "keys", "cipher", "mls", "tls", "argon2", "argon2id", "signature", "jwt", "dtls", "srtp", "hmac"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "We use established standards and well reviewed libraries. We do not design our own ciphers. This page lists each mechanism and what it protects.",
    },
    { t: "h2", text: "Mechanisms" },
    {
      t: "table",
      head: ["Protects", "Mechanism", "Notes"],
      strongFirst: true,
      rows: [
        ["Direct messages", "MLS ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420)) through XMTP", "Keys are created and kept in your browser, one set per device."],
        ["Calls", "DTLS-SRTP ([RFC 5764](https://www.rfc-editor.org/rfc/rfc5764))", "Negotiated between the two browsers by WebRTC."],
        ["Every connection", "TLS", "Between your browser and our servers, XMTP and RPC providers."],
        ["Signing in", "ECDSA signatures on secp256k1", "Over a Sign in with Ethereum message ([EIP-4361](https://eips.ethereum.org/EIPS/eip-4361))."],
        ["Sessions", "JWT signed with HMAC-SHA256", "The algorithm is fixed on the server, so a token cannot downgrade it."],
        ["Your PIN", "Argon2id ([RFC 9106](https://www.rfc-editor.org/rfc/rfc9106))", "With a salt per account and a secret held only by the server."],
        ["Community invite links", "HMAC-SHA256", "So a link cannot be forged or altered."],
        ["Private payments", "Zero knowledge proofs on Aztec, written in Noir", "Experimental. See [Private payments on Aztec](/docs/zero-knowledge)."],
      ],
    },
    { t: "h2", text: "Where encryption does not apply yet" },
    {
      t: "p",
      text: "Some data is protected only by TLS on the way to our servers and by access controls once it is there. That means we can read it.",
    },
    {
      t: "ul",
      items: [
        "Messages that took the [fallback path](/docs/p2p-routing). They are labelled in the conversation.",
        "Posts and messages in [communities](/docs/communities).",
        "Attachments, which are stored as uploaded.",
        "Your profile, your contacts and your community memberships.",
      ],
    },
    {
      t: "hint",
      tone: "info",
      text: "When any of these changes, this table changes with it, and the change is recorded in the [changelog](/changelog).",
    },
  ],
};

export const zeroKnowledge: DocPage = {
  slug: "zero-knowledge",
  href: "/docs/zero-knowledge",
  label: "Private payments on Aztec",
  summary: "How private payments on Aztec work, what they hide, and why they are still experimental.",
  keywords: ["zk", "zero knowledge", "aztec", "shielded", "private payment", "proof", "noir", "notes", "nullifier", "zk.money", "shield", "unshield", "privacy"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "hint",
      tone: "warning",
      title: "Experimental",
      text: "Our Aztec integration is built on a release candidate of Aztec V6, and our contracts have not been reviewed by an independent auditor. Do not use private payments with funds you cannot afford to lose.",
    },
    {
      t: "p",
      text: "A normal blockchain payment is public: anyone can see who paid whom and how much. [Aztec](https://aztec.network) is an Ethereum layer 2 network with private state, where a payment can be valid without revealing those details.",
    },
    { t: "h2", text: "How it works" },
    {
      t: "defs",
      items: [
        { term: "Private notes", text: "A private balance is a set of encrypted notes that only the owner can read. Sending a payment spends some notes and creates new ones for the recipient." },
        { term: "Proofs made on your device", text: "Your browser produces a zero knowledge proof that the payment follows the rules, for example that you own the notes and are not creating money. The network checks the proof without learning the amounts." },
        { term: "Nullifiers", text: "When a note is spent, a nullifier is published. It stops the same note being spent twice, without revealing which note it was." },
      ],
    },
    { t: "h2", text: "What stays private and what does not" },
    {
      t: "table",
      head: ["Action", "What is public"],
      strongFirst: true,
      rows: [
        ["Moving funds into a private balance", "Your Ethereum address and the amount, because the funds leave a public account."],
        ["Paying someone privately", "That a private transaction happened. Not the amount, the sender or the recipient."],
        ["Moving funds back to a public address", "The receiving address and the amount."],
      ],
    },
    {
      t: "p",
      text: "Timing can still leak information. If you move a sum in and an identical sum comes out shortly afterwards, an observer may connect the two.",
    },
    { t: "h2", text: "Status of the Aztec network" },
    {
      t: "p",
      text: "Aztec describes its network as being in alpha. In August 2026 its contributors reported a critical vulnerability in the proving system of Alpha V5, asked teams to pause V5 deployments, and announced a fix for V6. See the [Aztec announcement](https://aztec.network/blog/introducing-alpha-v5).",
    },
    {
      t: "p",
      text: "Our integration is built on the V6 release candidate rather than on V5. Our own contracts have not been reviewed by an independent auditor yet. Until both the network and our contracts have matured, treat private payments as an experiment.",
    },
  ],
};

export const quantumDots: DocPage = {
  slug: "quantum-dots",
  href: "/docs/quantum-dots",
  label: "Quantum Dots",
  title: "Quantum Dots (QD)",
  summary: "The status of the QD token: it is not live, and Ledger Chat does not use it.",
  keywords: ["token", "qd", "quantum dots", "airdrop", "economics", "supply", "coin", "buy", "price"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Quantum Dots, or QD, is the name of a token that was designed for the Humanity Ledger network. **It is not live.** There is no QD token you can buy, sell, receive in an airdrop or withdraw, and Ledger Chat does not charge or pay anything in QD.",
    },
    {
      t: "p",
      text: "Earlier versions of this page described monthly airdrops, message fees and staking in QD. Those plans are not active, and the page has been rewritten so that nobody acts on them.",
    },
    {
      t: "hint",
      tone: "danger",
      title: "Anyone selling QD is not us",
      text: "If someone offers you QD, a QD presale or a QD airdrop that requires a payment or a signature, it is not from Humanity Ledger. Any real announcement will appear on this page and in the [changelog](/changelog) first.",
    },
  ],
};

export const whitepaper: DocPage = {
  slug: "whitepaper",
  href: "/docs/whitepaper",
  label: "Whitepaper",
  title: "The Humanity Ledger platform paper",
  summary: "A technical description of the platform: its design goals, each subsystem, the threat model and the open problems.",
  keywords: ["whitepaper", "paper", "yellow paper", "technical", "specification", "design", "threat model", "research"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "hint",
      tone: "info",
      text: "Revised 21 October 2026. This revision replaces earlier versions that described components the product does not use, such as Waku routing and a Double Ratchet over X3DH. The current design is described below.",
    },
    { t: "h2", text: "Abstract", id: "abstract" },
    {
      t: "p",
      text: "Humanity Ledger is a communication platform in which an Ethereum address is the account. Ledger Chat, its first application, offers direct messages encrypted with MLS through the XMTP network, communities, WebRTC calls and payments signed by the user's own wallet. This paper describes each subsystem, states what each party can observe, and lists the properties the system does not yet provide.",
    },
    { t: "h2", text: "1. Design goals", id: "goals" },
    {
      t: "ol",
      items: [
        "**No phone number, no password.** Possession of a wallet is sufficient to create and use an account.",
        "**Content belongs to the endpoints.** Our servers should not be able to read direct messages.",
        "**No custody.** The platform never holds user funds or keys that can move them.",
        "**Stated limits.** Where a goal is not met, the product says so in the interface and in this paper.",
      ],
    },
    { t: "h2", text: "2. Identity and sessions", id: "identity" },
    {
      t: "p",
      text: "Authentication follows EIP-4361. The client requests a single use nonce from the server, which also stores it in a short lived cookie. The client constructs a Sign in with Ethereum message containing the domain, the address, the nonce, the issue time and the chain, and the wallet signs it. The server recovers the signer, checks that it matches the address in the message, and checks the domain and the nonce before issuing a session.",
    },
    {
      t: "p",
      text: "Sessions are JSON Web Tokens signed with HMAC-SHA256 and held in a cookie unavailable to scripts, valid for seven days. A perimeter function in front of every route removes identity headers supplied by the client and attaches the address taken from the verified token. Routes read identity only from that value.",
    },
    {
      t: "p",
      text: "Accounts can also be created with an email address and a one time code. Such accounts are identified internally by a random identifier rather than an address, and are marked so that routes requiring a wallet can refuse them explicitly.",
    },
    { t: "h2", text: "3. Direct messages", id: "messages" },
    {
      t: "p",
      text: "Direct messages use the XMTP network, which implements the Messaging Layer Security protocol (RFC 9420). Each browser installation generates its own key material after the user authorises it with a wallet signature. Conversations are MLS groups; the epoch key schedule gives forward secrecy and post compromise security at the granularity of group updates.",
    },
    {
      t: "p",
      text: "XMTP nodes store ciphertext so that offline recipients can collect it. At the time of writing they are operated by a single company and retain payloads without a time limit. Decrypted history is stored in the browser.",
    },
    { t: "figure", kind: "message-path", caption: "Figure 1. The two delivery paths for a direct message." },
    { t: "h3", text: "3.1 The fallback relay", id: "fallback" },
    {
      t: "p",
      text: "When delivery through XMTP fails, typically because the recipient has no XMTP installation yet, the client may submit the message to our server. The server stores it in PostgreSQL and in a Redis sorted set with a seven day expiry until the recipient collects it. **Messages on this path are readable by the server.** The client labels them on both sides of the conversation.",
    },
    {
      t: "p",
      text: "A guard on the server rejects or reports any message body that is not a sealed envelope of the form `hlv1.<algorithm>.<payload>`. In its default mode it records that a readable body arrived without recording the body. Rejection is enabled with a configuration flag once clients seal fallback messages.",
    },
    { t: "h2", text: "4. Communities", id: "communities" },
    {
      t: "p",
      text: "Communities, channels, members and roles are rows in PostgreSQL, and permissions are enforced by the server on every request. Invite links carry an HMAC-SHA256 tag so they cannot be forged, and can be revoked. Community posts and channel messages are currently stored in readable form on the server.",
    },
    { t: "h2", text: "5. Calls", id: "calls" },
    {
      t: "p",
      text: "Calls use WebRTC. Session descriptions and candidates are exchanged through the public PeerJS signalling service. Connectivity uses Google STUN servers and, when a direct path is unavailable, the public OpenRelay TURN service. Media is encrypted with DTLS-SRTP negotiated between the browsers, so neither signalling nor relays can decode it. A setting forces relay only connections, which prevents the remote party from learning the user's IP address.",
    },
    { t: "h2", text: "6. Payments", id: "payments" },
    {
      t: "p",
      text: "Payments are ordinary EVM transactions constructed by the client with wagmi and viem and signed by the user's wallet through EIP-1193 or WalletConnect. Native transfers use value transfers; ERC-20 transfers call `transfer(address,uint256)`. The server never receives a signing key. After confirmation the client sends a receipt into the conversation. Payment requests can be encoded as EIP-681 URIs for display as QR codes.",
    },
    { t: "h2", text: "7. Private payments", id: "private-payments" },
    {
      t: "p",
      text: "An experimental integration with Aztec allows tokens to be moved into a private balance, transferred privately and moved out again. Proofs are generated on the client. Deposits and withdrawals are public by construction; private transfers reveal only that a transaction occurred. The integration is built on a release candidate of Aztec V6, the release announced to fix the critical vulnerability reported in Alpha V5 in August 2026. Its contracts have not been independently audited.",
    },
    { t: "h2", text: "8. Device protection", id: "pin" },
    {
      t: "p",
      text: "Access to Ledger Chat on a device is gated by a six digit PIN. The server stores Argon2id of the PIN with a per account salt and a server held pepper, limits concurrent hashing work, and allows eight attempts per five minute window. The PIN gates the interface; it is not used to derive message keys.",
    },
    { t: "h2", text: "9. Threat model", id: "threat-model" },
    {
      t: "table",
      head: ["Adversary", "Can", "Cannot"],
      strongFirst: true,
      rows: [
        ["Someone with full control of our servers", "Read fallback messages, community posts, attachments, contacts and account data. See who is online. Deny service.", "Read direct messages delivered through XMTP. Sign as a user. Move user funds."],
        ["An XMTP node operator", "See encrypted messages, their size and timing, and the conversations they belong to.", "Read them."],
        ["An observer on the user's network", "See which services the user connects to and when.", "Read any content protected by TLS."],
        ["Someone with the user's unlocked device", "Open Ledger Chat if they know the PIN. Read data stored by the browser with developer tools, even without it.", "Sign in on another device without the wallet."],
        ["Malware on the user's device", "Everything the user can see.", "Nothing prevents this. No software only design can."],
      ],
    },
    { t: "h2", text: "10. Scaling", id: "scaling" },
    {
      t: "p",
      text: "Web servers are stateless. PostgreSQL is reached through a connection pooler, with a direct connection reserved for migrations. Online status is written to Redis with an expiry rather than to the database. Remaining single instance state, such as device linking codes held in memory, and polling in parts of the interface are the current limits on horizontal scaling.",
    },
    { t: "h2", text: "11. Open problems", id: "open-problems" },
    {
      t: "ul",
      items: [
        "Removing the readable fallback path, by sealing fallback messages on the client or by ensuring both parties have XMTP installations.",
        "Encrypting community content end to end, for example as MLS groups.",
        "Encrypting attachments before upload.",
        "An independent audit of the contracts and a penetration test of the application.",
        "Self hosted call signalling, so that call setup does not depend on a public service.",
      ],
    },
    { t: "h2", text: "References", id: "references" },
    {
      t: "ul",
      items: [
        "[EIP-4361: Sign in with Ethereum](https://eips.ethereum.org/EIPS/eip-4361)",
        "[RFC 9420: The Messaging Layer Security protocol](https://www.rfc-editor.org/rfc/rfc9420)",
        "[RFC 9106: Argon2](https://www.rfc-editor.org/rfc/rfc9106)",
        "[RFC 5764: DTLS extension for SRTP](https://www.rfc-editor.org/rfc/rfc5764)",
        "[EIP-681: URL format for transaction requests](https://eips.ethereum.org/EIPS/eip-681)",
        "[XMTP documentation](https://docs.xmtp.org)",
        "[Aztec documentation](https://docs.aztec.network)",
      ],
    },
  ],
};
