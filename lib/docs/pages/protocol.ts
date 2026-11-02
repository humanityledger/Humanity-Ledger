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
        ["Private payments wallet key", "HKDF-SHA256 over an EIP-712 wallet signature", "Computed in your browser. The derived secret is never sent to our servers."],
        ["Private payments", "Zero knowledge proofs on Aztec, written in Noir", "Aztec test network only. See [Private payments on Aztec](/docs/zero-knowledge)."],
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
  summary: "How the private payments wallet works, what it hides, what it does not, and why it runs on a test network.",
  keywords: ["zk", "zero knowledge", "aztec", "shielded", "private payment", "proof", "noir", "notes", "nullifier", "shield", "unshield", "send", "receive", "qr", "testnet", "privacy", "wallet"],
  updated: "2026-10-23",
  blocks: [
    {
      t: "hint",
      tone: "warning",
      title: "Test network only",
      text: "The private payments wallet runs on the Aztec test network (version 6.0.0, settled on Ethereum Sepolia). Its tokens have no value. It will not be connected to a network with real value until our contracts have been reviewed by an independent auditor.",
    },
    {
      t: "p",
      text: "A normal blockchain payment is public: anyone can see who paid whom and how much. [Aztec](https://aztec.network) is an Ethereum layer 2 network with private state, where a payment can be valid without revealing those details. The private payments wallet in Ledger Chat uses it to hold private balances and to send them.",
    },
    { t: "h2", text: "Your private wallet" },
    {
      t: "steps",
      items: [
        { title: "Your wallet signs a statement", text: "The first time you open the private wallet, your Ethereum wallet asks you to sign a typed message that names Humanity Ledger and the Aztec test network. Signing is free and sends no transaction." },
        { title: "Your browser derives the keys", text: "The signature is turned into the secret of an Aztec account with HKDF-SHA256, inside your browser. The same wallet always produces the same account, so you can open it on any device, and nothing that can spend it is ever sent to us." },
        { title: "Your browser runs a private node", text: "A Private eXecution Environment (PXE) runs in your browser, stores your notes in its local database, decrypts them and produces the proofs for your transactions." },
        { title: "The account is deployed", text: "Your Aztec account contract is deployed on the test network the first time it is needed. Fees on the test network are covered by Aztec's sponsored fee contract, so you do not need any tokens to start." },
      ],
    },
    { t: "h2", text: "The four actions" },
    {
      t: "table",
      head: ["Action", "What it does", "What is public"],
      strongFirst: true,
      rows: [
        ["Shield", "Moves tokens from your public Aztec balance into private notes.", "Your Aztec address and the amount, because the tokens leave a public balance."],
        ["Send", "Spends some of your notes and creates new ones that only the recipient can read.", "That a transaction happened. Not the amount, the sender or the recipient."],
        ["Receive", "Shows your Aztec address as a QR code, optionally with a token and an amount, so someone can send to you.", "Nothing. Your address is shared only with the people you show it to. Our server never stores it."],
        ["Unshield", "Moves tokens from your private notes back to a public Aztec balance.", "The receiving address and the amount."],
      ],
    },
    {
      t: "p",
      text: "Timing can still leak information. If you shield an amount and an identical amount is unshielded shortly afterwards, an observer may connect the two. Shield and unshield round amounts, and leave time in between.",
    },
    { t: "h2", text: "How privacy is achieved" },
    {
      t: "defs",
      items: [
        { term: "Private notes", text: "A private balance is a set of encrypted notes that only the owner can read. Sending spends some notes and creates new ones for the recipient and, if there is change, for you." },
        { term: "Proofs made on your device", text: "Your browser proves that the transaction follows the rules of the token contract, for example that you own the notes and are not creating tokens. The network checks the proof without learning the amounts. The first proof on a device downloads several megabytes of proving data and can take a minute or more." },
        { term: "Nullifiers", text: "When a note is spent, a nullifier is published. It stops the same note being spent twice, without revealing which note it was." },
      ],
    },
    { t: "h2", text: "History" },
    {
      t: "p",
      text: "**Recent transactions** and **shielded notes** are assembled in your browser. Payments you receive are found by the PXE, which decrypts the notes and events addressed to you, so they appear on any device you open the wallet on. Payments you send, and your own shield and unshield operations, are recorded by the device that sends them and appear there. Our server never sees any of it.",
    },
    {
      t: "p",
      text: "Each action is a real transaction: your browser makes the proof, then the network includes it in a block. On a recent laptop that takes about a minute from pressing the button to the balance changing. The list shows each step as it happens: proving on this device, waiting for the network, settled.",
    },
    { t: "h2", text: "Test tokens" },
    {
      t: "p",
      text: "The wallet shows three test tokens, zkUSDC, zkDAI and zkETH. They are instances of Aztec's standard token contract that we deployed on the test network, and they have no relation to the real USDC, DAI or ETH. A faucet in the wallet mints a small public amount so you can try shielding and sending. The faucet's key is published on purpose so that anyone can mint, which is one more reason the tokens have no value.",
    },
    { t: "h2", text: "What is not built yet" },
    {
      t: "status",
      items: [
        { label: "Private balances, send and receive", state: "partial", text: "Working on the Aztec test network. Contracts not independently audited." },
        { label: "Bridge from Ethereum", state: "development", text: "Moving real tokens from Ethereum into Aztec and back needs a bridge contract on each side. It is not built." },
        { label: "Aztec mainnet", state: "unavailable", text: "Mainnet runs version 5.2.0, which our wallet does not support, and is described by Aztec as alpha." },
      ],
    },
    { t: "h2", text: "Status of the Aztec network" },
    {
      t: "p",
      text: "Aztec describes its mainnet as alpha, where bugs, including critical ones, are expected. In August 2026 its contributors reported a critical vulnerability in the proving system of Alpha V5 and announced a fix in version 6. The test network runs version 6.0.0. See the [Aztec network page](https://docs.aztec.network/networks) for the current versions.",
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
      text: "A private payments wallet runs on the Aztec test network, version 6.0.0, which settles on Ethereum Sepolia. The client derives the secret of a Schnorr account contract from an EIP-712 signature by the user's wallet using HKDF-SHA256, so the same wallet always recovers the same account and the server never holds a spending key. A Private eXecution Environment runs in the browser with IndexedDB storage, decrypts the user's notes and generates proofs locally. Account deployment and transaction fees are paid by Aztec's sponsored fee payment contract.",
    },
    {
      t: "p",
      text: "Balances are held in instances of Aztec's standard token contract. Shielding calls `transfer_to_private`, unshielding calls `transfer_to_public`, and a private payment calls `transfer_private_to_private`. Shielding and unshielding reveal the address and the amount by construction; a private payment reveals only that a transaction occurred. Transaction history is assembled by the client from its own notes and receipts. A bridge to Ethereum is not built, the tokens are test tokens without value, and the contracts have not been independently audited.",
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
