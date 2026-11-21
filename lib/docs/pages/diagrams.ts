import type { Block, DocPage } from "../types";

/**
 * The system in diagrams (21 November 2026). Every drawing is Mermaid source, drawn on the server
 * by lib/docs/diagram.ts, and describes what the code does today. Where something is in design
 * or switched off, the drawing says so. Facts come from the whitepaper (/docs/whitepaper), the
 * threat model (docs/security/THREAT_MODEL.md) and the modules named in each caption.
 */

const d = (code: string, caption: string, title?: string): Block => ({ t: "diagram", code, caption, title });

// ── The system ───────────────────────────────────────────────────────────────

export const diagramsSystem: DocPage = {
  slug: "diagrams-system",
  href: "/docs/diagrams-system",
  label: "The system in diagrams",
  title: "The system in diagrams",
  summary: "How Ledger Chat is put together, how you sign in and how a computer is linked to your phone, drawn one step at a time.",
  keywords: ["diagram", "architecture", "mermaid", "sign in", "siwe", "linked devices", "middleware", "scaling", "relay"],
  updated: "2026-11-21",
  blocks: [
    {
      t: "p",
      text: "Each drawing below is written in Mermaid and drawn on our server. Open **Mermaid source** under a drawing to copy it. The drawings show what runs today; anything in design is drawn with a dashed border and named as such.",
    },
    { t: "h2", text: "The whole system", id: "whole" },
    d(`flowchart LR
  You[Your device<br/>app, keys, prover]:::accent
  XMTP[XMTP network<br/>relays MLS ciphertext]
  Peer[The other person's device]
  Srv[Our servers<br/>accounts, contacts, communities]:::dashed
  Az[Aztec network<br/>proofs and notes]
  Eth[Ethereum<br/>settlement]
  You -->|messages, MLS| XMTP --> Peer
  You -->|calls, DTLS-SRTP| Peer
  You -.->|session| Srv
  You -->|proof| Az -->|settles on| Eth`,
      "Your device does the encryption and the proving. Messages travel as MLS ciphertext over XMTP, calls go device to device, and private payments reach Aztec as proofs. Our servers keep accounts, contacts and communities.",
      "Ledger Chat at a glance"),
    d(`flowchart LR
  subgraph dev [Your browser]
    App[Ledger Chat web app]
    X[XMTP client<br/>keys of this installation]
    P[Private eXecution Environment<br/>notes and proofs]
    H[(IndexedDB<br/>decrypted history)]
  end
  subgraph ours [Our servers]
    API[Next.js routes]
    PG[(PostgreSQL)]
    R[(Redis)]
    ST[(File storage<br/>ciphertext)]
  end
  subgraph net [Networks]
    XN[XMTP nodes]
    AZ[Aztec node]
    EV[EVM chains]
  end
  App --> X --> XN
  App --> P --> AZ
  App --> H
  App --> API --> PG
  API --> R
  API --> ST
  App -->|public payments| EV`,
      "What runs where. Keys, decrypted history and private notes stay in the browser. Our servers run the routes, the database, Redis and the file storage, which only receives ciphertext.",
      "What runs where"),
    d(`flowchart LR
  Msg[A message you write] --> H[(Your device<br/>decrypted history)]
  Msg -->|MLS ciphertext| XC[(XMTP nodes<br/>ciphertext)]
  Msg -.->|fallback path only, readable| F[(Our server<br/>PostgreSQL, Redis 7 days)]:::dashed
  File[A file you send] -->|encrypted first| S[(File storage<br/>ciphertext)]
  Pay[A private payment] --> N[(Your device<br/>notes, encrypted store)]
  Pay -->|proof| AZ[(Aztec<br/>notes and nullifiers)]
  Acct[Your account] --> A[(Our server<br/>profile, contacts, communities)]`,
      "Where each kind of data ends up. Only the fallback path, used when the other person has no XMTP installation yet, leaves a message readable by our server, and the app labels it on both sides.",
      "Where your data is kept"),
    { t: "h2", text: "In front of every route", id: "perimeter" },
    d(`flowchart LR
  Req[Request] --> Strip[Remove identity headers<br/>sent by the client]
  Strip --> V{Valid session<br/>token?}
  V -->|yes| Att[Attach the address<br/>from the token]:::ok
  V -->|no| Pub{Public route?}
  Att --> Route[The route reads identity<br/>only from that value]
  Pub -->|yes| Page[Public page]
  Pub -->|no| Stop[401 or sign in]:::danger`,
      "The identity perimeter (middleware.ts). A client cannot claim to be someone else by sending a header: it is removed, and the only identity a route sees is the one taken from the verified session token.",
      "The identity perimeter"),
    d(`flowchart LR
  MW[Middleware] -->|new nonce per request| CSP[Content-Security-Policy<br/>script-src self and the nonce]
  MW --> HTML[Server-rendered page<br/>its scripts carry the nonce]
  CSP --> B[Browser]
  HTML --> B
  B --> Run[Runs scripts with the nonce]:::ok
  B --> Block[Refuses injected scripts]:::danger`,
      "A fresh nonce for every response (buildCsp in middleware.ts). A script injected into a page has no nonce, so the browser refuses to run it.",
      "Content security policy"),
    d(`flowchart LR
  U[Browsers] --> W1[Web server<br/>stateless]
  U --> W2[Web server<br/>stateless]
  W1 --> Pool[Connection pooler]
  W2 --> Pool
  Pool --> PG[(PostgreSQL)]
  Mig[Migrations] -.->|direct connection| PG
  W1 --> R[(Redis<br/>online status, with expiry)]
  W2 --> R`,
      "Scaling. Web servers keep no state, PostgreSQL is reached through a pooler and online status lives in Redis with an expiry. Device linking codes held in memory are the remaining single-instance state.",
      "How it scales"),
    d(`flowchart TB
  PR[Pull request] --> CI[CI<br/>types, lint, forbidden patterns, tests]
  CI --> Rev[Review and merge<br/>by a maintainer]
  Rev --> Dep[Deployment]
  Agent[Changes made by an agent] -.->|claude/ branches only| PR`,
      "How a change reaches the site. Every pull request runs the type check, the linter, the forbidden-pattern scan and the tests. Agents push only to claude/ branches and never merge.",
      "From a change to the site"),
    d(`flowchart LR
  Reg[Claims register<br/>lib/landing/claims.ts]:::accent --> Land[Landing page]
  Reg --> Brief[Printable brief]
  Test[Unit test] -->|fails the build on| Rogue[A status written by hand<br/>or a banned word]:::danger`,
      "Every status on the landing (Live, Closed alpha, Not enabled yet, In design) comes from one register. A test fails the build if a page writes a status of its own.",
      "One register for every public claim"),
    { t: "h2", text: "Signing in", id: "sign-in" },
    d(`sequenceDiagram
  autonumber
  participant D as Your device
  participant W as Your wallet
  participant S as Our server
  D->>S: Ask for a nonce
  S-->>D: Nonce, and a sealed cookie valid ten minutes
  D->>W: Sign this message: website, address, nonce, time, chain
  W-->>D: Signature
  D->>S: Message and signature
  Note over S: Checks website, nonce and age, marks the nonce used, recovers the signer
  S-->>D: Session cookie, HttpOnly, seven days`,
      "Sign in with Ethereum (EIP-4361). Signing is free and is not a transaction. A nonce can be used once, and only a nonce our server issued.",
      "Sign in with a wallet"),
    d(`flowchart LR
  Sig[Signature on the message] --> T{Kind of wallet}
  T -->|externally owned| Rec[Recover the signer<br/>it must match the address]:::ok
  T -->|smart contract wallet| C[ERC-1271 or ERC-6492<br/>checked on its own chain]:::ok
  Any[Any EVM chain] -.-> T`,
      "Both kinds of wallet sign in. A contract wallet is asked on its own chain whether the signature is valid; a signature does not depend on the chain.",
      "Contract wallets"),
    d(`sequenceDiagram
  participant U as You
  participant S as Our server
  participant M as Your inbox
  U->>S: Email address
  S->>M: One-time code
  U->>S: The code
  S-->>U: Session for an account with a random identifier
  Note over S: Routes that need a wallet refuse this account explicitly`,
      "Signing in with email. The account has no wallet, so anything that needs one says so instead of failing later.",
      "Sign in with email"),
    d(`flowchart TB
  Msg[Exact text the wallet will sign] --> Parse[Read its fields]
  Parse --> F[Website, address, chain,<br/>nonce, issued, expires]
  F --> C{Website matches<br/>this page?}
  C -->|yes| Sign[Sign in the wallet]:::ok
  C -->|no| Warn[Warning: do not sign]:::danger
  Msg -.->|one tap| Full[Show the exact text]`,
      "What you see before signing (components/auth/SignaturePreview.tsx). The summary is read from the exact text the wallet receives, and a website that differs from the page is flagged.",
      "Seeing what you sign"),
    d(`flowchart LR
  PIN[Six digit PIN] -->|Argon2id, salt, server pepper| H[(Hash on our server)]
  H --> Lim[Eight attempts<br/>per five minutes]
  PIN -.->|not used to derive| Keys[Message keys]:::muted
  Flag[Off since 11 November 2026<br/>build flag]:::dashed -.-> PIN`,
      "The PIN, when it is switched on, gates the interface on a device. It does not protect message keys, and it is off today.",
      "The PIN"),
    { t: "h2", text: "Linking a computer", id: "linking" },
    d(`sequenceDiagram
  autonumber
  participant C as Computer
  participant S as Our server
  participant P as Your phone
  C->>C: New P-256 key pair
  C-->>P: QR code with the public key, valid four minutes
  P->>P: Names the computer that asks and waits for you
  P->>S: Claim code, device id and channel key, encrypted to the computer
  Note over S: Keeps only ciphertext and the SHA-256 of the claim
  C->>S: Proves it decrypted the claim
  S-->>C: Session in HttpOnly cookies`,
      "Linking works like WhatsApp Web or Signal Desktop. The computer never receives the wallet, and our server holds no key that opens what it relays.",
      "Linking a computer to your phone"),
    d(`sequenceDiagram
  participant C as Computer
  participant S as Our server
  participant P as Your phone
  C->>S: Request sealed with AES-256-GCM under the channel key
  Note over C,S: Request id and kind bound as associated data
  S->>P: Ciphertext
  P->>P: Says what the signature is for
  alt You approve
    P->>S: Signature, sealed
    S->>C: Ciphertext
  else You decline
    P->>S: Declined
  end`,
      "When a linked computer needs a wallet signature, the phone shows what it is for and signs only on approval. An answer cannot be replayed onto another request.",
      "Signatures for a linked computer"),
    d(`flowchart LR
  Ph[Your phone]:::accent -->|lists and unlinks| Comp[Linked computers<br/>at most five]
  Comp --> Exp[Each link lasts<br/>seven days]
  Ph -->|unlink| Rev[Session token revoked at once]:::danger
  Comp -.->|cannot| L[Link more devices]:::muted
  Comp -.->|cannot| A[Answer signature requests]:::muted`,
      "The limits of a linked computer. The phone holds the account; a computer can do neither of the two things that would let it act as the phone.",
      "What a linked computer can do"),
    { t: "h2", text: "Ledger Relay, in design", id: "relay" },
    d(`flowchart LR
  A[Your device]:::accent <-->|signalling<br/>TURN credentials<br/>encrypted files| Rl[Ledger Relay<br/>stateless, self-hostable]:::dashed
  Rl <-->|signalling| B[Other device]
  Rl -->|empty push| PS[Push service]
  PS -.->|wake up| B`,
      "Ledger Relay (relay/ in the repository) is built and tested but not deployed. It would replace the public signalling service and give anyone a relay they can run themselves.",
      "Ledger Relay"),
    d(`flowchart LR
  Up[Upload to the relay] --> Sz{Within size and quota?}
  Sz -->|no| R413[Refused: too large]:::danger
  Sz -->|yes| Sig{Starts like a known file<br/>PNG, JPEG, PDF, ZIP, MP4, text}
  Sig -->|yes| R415[Refused: not encrypted]:::danger
  Sig -->|no| Keep[(Kept until it expires)]:::ok`,
      "The relay's blob store accepts ciphertext only. A file that begins like a common plaintext format is refused, so a client that forgot to encrypt cannot leave a readable file there.",
      "Ciphertext only"),
    d(`sequenceDiagram
  participant B as Their device
  participant Rl as Ledger Relay
  participant P as Push service
  participant A as Your device
  A->>Rl: Register a push subscription
  Rl-->>A: Opaque token
  A->>B: The token, inside an MLS message
  B->>Rl: Wake this token
  Rl->>P: Empty push, no payload
  P->>A: Wake up
  A->>A: Fetches new messages over XMTP itself`,
      "Push without content. The relay sees an endpoint, an opaque token and the time of each wake, never who wrote or what.",
      "Waking a device"),
  ],
};

// ── Messages, files and calls ────────────────────────────────────────────────

export const diagramsMessaging: DocPage = {
  slug: "diagrams-messaging",
  href: "/docs/diagrams-messaging",
  label: "Messages, files and calls",
  title: "Messages, files and calls in diagrams",
  summary: "How a message, a file and a call travel from your device to the other person's, drawn step by step.",
  keywords: ["diagram", "mls", "xmtp", "fallback", "attachment", "large file", "call", "webrtc", "turn", "dtls"],
  updated: "2026-11-21",
  blocks: [
    { t: "h2", text: "Messages", id: "messages" },
    d(`sequenceDiagram
  participant A as Your device
  participant X as XMTP nodes
  participant B as Their device
  A->>A: Encrypt with the conversation's current MLS epoch
  A->>X: Ciphertext
  Note over X: Stored so offline devices can collect it
  B->>X: Fetch
  X-->>B: Ciphertext
  B->>B: Decrypt, keep the history in the browser`,
      "The normal path. XMTP nodes store ciphertext; only the two devices can read it.",
      "A direct message"),
    d(`flowchart TB
  W[Wallet signature] -->|authorises| I[Installation keys<br/>made in this browser]:::accent
  I --> G[MLS group<br/>one per conversation]
  G --> E1[Epoch n]
  E1 -->|member or key update| E2[Epoch n plus 1]
  E2 --> FS[Forward secrecy and<br/>post-compromise security]:::ok`,
      "Messaging Layer Security (RFC 9420). Each browser gets its own keys once the wallet authorises it, and the group key changes with every epoch.",
      "Keys and epochs"),
    d(`flowchart TB
  A[Your device] -->|first| X[XMTP]
  X -->|recipient has no installation yet| Nd[Not delivered]:::danger
  Nd -->|the app may hand it to| F[Our server<br/>PostgreSQL, Redis 7 days]:::dashed
  F -->|readable by the server| B[Their device]
  B --> L[Labelled on both sides]`,
      "The fallback path. It exists so a first message reaches someone who has not opened Ledger Chat yet. Messages on it are readable by our server, and both people see a label.",
      "The fallback path"),
    d(`flowchart LR
  Body[Fallback message body] --> G{Sealed envelope<br/>hlv1.algorithm.payload?}
  G -->|yes| Store[Stored]:::ok
  G -->|no, default mode| Rep[Recorded that a readable body<br/>arrived, without the body]
  G -->|no, with the flag on| Rej[Rejected]:::danger`,
      "A guard on the fallback path reports readable bodies today and rejects them once clients seal every fallback message.",
      "The fallback guard"),
    d(`flowchart LR
  Sig[Typing, read, reaction,<br/>edit, pin, vote] -->|ordinary MLS messages| X[XMTP]
  Typ[Typing] -->|at most one every 5 s| Sig
  X --> B[Their device<br/>shows typing for 7 s]`,
      "Receipts, reactions and typing are messages like any other, encrypted the same way. Typing is sent at most every five seconds.",
      "Signals inside the conversation"),
    d(`flowchart TB
  Clear[Clear chat] --> Cut[Cut-off time, on this device<br/>and on your other devices]
  Delete[Delete chat] --> Cut
  Delete --> Del[Deletion time]
  Cut --> Hide[No message from before it<br/>is shown again]:::ok
  Del --> Away[Out of the list until<br/>a newer message arrives]:::ok
  Cut -.->|does not touch| Theirs[The other person's copy]:::muted`,
      "Clear and delete are recorded, so nothing comes back on the next sync (lib/chat/cleared-chats.ts). Neither removes the other person's copy.",
      "Clear chat and delete chat"),
    d(`flowchart TB
  M[Member] --> S[Our server<br/>checks the role on every request]
  S --> PG[(PostgreSQL<br/>communities, channels, roles, posts)]
  Inv[Invite link] -->|HMAC-SHA256 tag| S
  Adm[Admin] -->|revokes| Inv
  PG -.->|readable by the server today| E[Not end-to-end encrypted yet]:::danger`,
      "Communities are server rows today. Invite links cannot be forged and can be revoked; posts are not end-to-end encrypted yet.",
      "Communities"),
    { t: "h2", text: "Files", id: "files" },
    d(`sequenceDiagram
  participant A as Your device
  participant S as Our server
  participant R as File storage
  participant B as Their device
  A->>A: Encrypt, AES-256-GCM with a key from HKDF-SHA256
  A->>S: Ciphertext
  S->>R: Ciphertext
  S-->>A: Link and the digest it computed
  A->>A: Checks the digest matches
  A->>B: hl.attachment message with link and key, inside MLS
  B->>S: Download ciphertext
  B->>B: Decrypt with the key from the message`,
      "Files up to 20 MB (lib/chat/send-attachment.ts). The key travels only inside the end-to-end encrypted message.",
      "Sending a file"),
    d(`flowchart LR
  F[File over 20 MB] --> Split[16 MiB pieces<br/>up to 2048]
  Key[One key per file<br/>HKDF-SHA256] --> Enc[AES-256-GCM<br/>each piece]:::accent
  Split --> Enc
  Enc --> Up[Upload each piece<br/>with retries]
  Up --> St[(File storage<br/>ciphertext)]
  Up --> Msg[hl.largefile message<br/>pieces and key, inside MLS]`,
      "Large files, up to 32 GiB (lib/chat/large-file.ts). Each piece is encrypted on the device before anything is uploaded.",
      "Large files"),
    d(`flowchart LR
  Pre[Prefix, 8 random bytes] --> N[Nonce: prefix and<br/>index as 4 bytes]
  I[Piece index] --> N
  I --> AAD[Associated data<br/>hl.largefile/v1, index, total]
  T[Total pieces] --> AAD
  N --> G[AES-256-GCM]
  AAD --> G
  G --> Out[A piece moved, dropped or<br/>swapped fails to open]:::ok`,
      "Why pieces cannot be rearranged: every piece is bound to its position and to the total number of pieces.",
      "One piece"),
    d(`sequenceDiagram
  participant B as Their device
  participant S as Our server
  B->>B: Reads the hl.largefile message
  loop Each piece
    B->>S: Download piece
    S-->>B: Ciphertext
    B->>B: Decrypt with its nonce and associated data
  end
  B->>B: Writes the file to disk when the browser allows, else to memory`,
      "Receiving a large file. A piece that fails to open stops the download with an error instead of a damaged file.",
      "Receiving a large file"),
    d(`flowchart LR
  Up[Upload] --> R{File storage<br/>switched on?}
  R -->|yes| Ok[Stored as ciphertext]:::ok
  R -->|no, small file| In[Sent inside the<br/>XMTP message itself]
  R -->|no, large file| Msg[You read: file storage<br/>is not switched on]:::danger`,
      "When storage is not configured the app says so plainly. Small files can still travel inside the encrypted message.",
      "When storage is off"),
    { t: "h2", text: "Calls", id: "calls" },
    d(`sequenceDiagram
  autonumber
  participant A as Caller
  participant P as PeerJS signalling
  participant B as Callee
  A->>P: Offer
  P->>B: Offer
  B->>P: Answer
  P->>A: Answer
  A->>P: ICE candidates
  P->>B: ICE candidates
  A->>B: DTLS handshake
  A->>B: Media, SRTP`,
      "Setting up a call. The signalling service carries descriptions and candidates; the media key is negotiated by the two browsers.",
      "How a call connects"),
    d(`flowchart LR
  A[Your device] --> Q{Direct path?}
  Q -->|yes| D[Device to device<br/>DTLS-SRTP]:::ok
  Q -->|no| T[TURN relay<br/>short-lived credentials]:::muted
  T --> E[Still DTLS-SRTP<br/>the relay cannot decode]:::ok
  Set[Relay-only setting] -.-> T
  Set -.-> IP[The other person does<br/>not learn your IP address]`,
      "Direct when possible, relayed when not. Either way the media is encrypted between the two browsers.",
      "Direct or relayed"),
    d(`flowchart LR
  Sec[Shared secret<br/>relay and coturn] --> H[HMAC-SHA1]
  U[Username: expiry and<br/>random characters] --> H
  H --> Pw[Password, base64]
  U --> C[coturn checks the expiry<br/>and recomputes the password]
  Pw --> C
  U -.->|no wallet, no user id| Priv[Nothing ties it to you]:::ok`,
      "TURN credentials from Ledger Relay (relay/src/turn.mjs), in the form coturn accepts with use-auth-secret. They expire and carry no identifier.",
      "TURN credentials"),
    d(`flowchart TB
  Idle[Idle] -->|you call| Out[Ringing them]
  Idle -->|they call| In[Ringing you]
  Out -->|answered| Con[Connecting]
  In -->|you answer| Con
  Con -->|media flows| Act[In call]:::ok
  Act -->|network changes| Re[Moving to a new connection<br/>the old one keeps playing]
  Re -->|new one ready| Act
  Out -.-> End[Ended]
  In -.-> End
  Act -->|hang up| End`,
      "The states of a call (lib/calls/machine.ts). A call that is declined, missed or not answered ends. When the network changes the call stays on: a new connection is made first and the old one closes after. Every screen and sound follows one state, so a call cannot ring and talk at once.",
      "Call states"),
  ],
};

// ── Payments ─────────────────────────────────────────────────────────────────

export const diagramsPayments: DocPage = {
  slug: "diagrams-payments",
  href: "/docs/diagrams-payments",
  label: "Payments in diagrams",
  title: "Payments in diagrams",
  summary: "Public payments from your wallet and private payments on Aztec, from the key to the fee, drawn step by step.",
  keywords: ["diagram", "payment", "aztec", "pxe", "private", "fee juice", "note", "nullifier", "eip-712", "eip-681"],
  updated: "2026-11-21",
  blocks: [
    {
      t: "hint",
      tone: "warning",
      text: "Private payments run on Aztec Alpha with a cap per payment. The contracts have had an internal security review, not an external audit.",
    },
    { t: "h2", text: "From your wallet", id: "public" },
    d(`sequenceDiagram
  participant D as Your device
  participant W as Your wallet
  participant C as EVM chain
  participant B as Their device
  D->>D: Builds the transaction with wagmi and viem
  D->>W: Sign, EIP-1193 or WalletConnect
  W->>C: Signed transaction
  C-->>D: Confirmation
  D->>B: Receipt, inside the conversation`,
      "A public payment. Our server never receives a signing key; the transaction is public on its chain.",
      "A public payment"),
    d(`flowchart LR
  Req[Payment request] --> URI[EIP-681 URI]
  URI --> QR[QR code]
  QR --> W[The payer's wallet<br/>fills in the transaction]`,
      "Payment requests as EIP-681 links, shown as QR codes.",
      "Asking to be paid"),
    { t: "h2", text: "Your private wallet", id: "private-wallet" },
    d(`flowchart LR
  W[Your wallet] -->|EIP-712 signature| Sig[Signature]
  Sig -->|HKDF-SHA256| Sec[Account secret]:::accent
  Sec --> Acc[Schnorr account<br/>contract on Aztec]
  Sec -.->|never sent| Srv[Our server]:::muted
  W -.->|same wallet, any device| Acc`,
      "Where the private account comes from. The same wallet always recovers the same account, and no server holds a spending key.",
      "Your private account"),
    d(`flowchart LR
  subgraph dev [Your browser]
    PXE[Private eXecution Environment]:::accent
    Store[(Encrypted store)]
    Prover[Prover]
  end
  PXE --> Store
  PXE --> Prover
  Prover -->|proof only| Node[Aztec node]
  Node -->|encrypted notes| PXE`,
      "The PXE runs in your browser: it decrypts your notes and generates proofs on the device. The node receives proofs, not your balances.",
      "Proving on your device"),
    d(`flowchart TB
  Start[Before any step<br/>that moves value] --> Read[Read the node's identity]
  Read --> F[L1 chain, rollup version<br/>and address, Fee Juice portal, token]
  F --> C{Same as the pins<br/>in this build?}
  C -->|yes| Go[Continue]:::ok
  C -->|no| Stop[Refuse this node]:::danger`,
      "A node that is not the expected network is refused before anything moves.",
      "Checking the network"),
    d(`flowchart LR
  Pay[A payment] --> Note[New note<br/>encrypted to its owner]:::accent
  Note --> T[(Note commitments)]
  Spend[Spending a note] --> Nul[Nullifier published]
  Nul --> NS[(Nullifier set)]
  NS --> No[A note cannot be<br/>spent twice]:::ok
  Nul -.->|does not say which note| Priv[Privacy kept]:::ok`,
      "Notes and nullifiers. A balance is a set of private notes; spending one publishes a nullifier that stops double spending without pointing at the note.",
      "Notes and nullifiers"),
    { t: "h2", text: "Paying someone in a chat", id: "private-payment" },
    d(`sequenceDiagram
  autonumber
  participant A as Sender
  participant X as The conversation
  participant N as Aztec Alpha
  participant B as Receiver
  B->>X: Its Aztec address, signed with its account key
  A->>A: Checks that signature again before moving value
  A->>A: Builds transfer_private_to_private and proves it
  A->>N: Proof and encrypted note
  Note over N: Checks the proof, amount and recipient stay private
  B->>N: Syncs
  N-->>B: The new note, found because the sender is registered`,
      "A private payment between two people in a direct message. It goes only to the address the other person announced in that conversation.",
      "A private payment"),
    d(`flowchart LR
  Amt[Amount] --> Cap{Under the cap<br/>for this token?}
  Cap -->|no| Ref[Refused]:::danger
  Cap -->|yes| Ack[Sender acknowledges: internal review only,<br/>the fee payer is public]
  Ack --> Send[Send privately]:::ok`,
      "Limits during the closed alpha: a cap per token, and an explicit acknowledgement before the first payment.",
      "Before a payment"),
    { t: "h2", text: "Fees", id: "fees" },
    d(`flowchart TB
  E[AZTEC on Ethereum] -->|one way| Portal[FeeJuicePortal]
  Sec[Claim secret from<br/>the wallet signature] --> Claim
  Portal --> Claim[Claim, in the transaction<br/>that deploys the account]
  Claim --> FJ[Fee Juice balance]
  FJ --> Fee[Pays every fee]
  Fee -.-> Pub[The account is the<br/>visible fee payer]:::muted`,
      "Fee Juice. Every transaction, including the one that creates the account, pays its own fee; Ledger Chat sponsors none.",
      "Paying fees"),
    d(`sequenceDiagram
  participant N as New person
  participant C as A contact
  participant E as Ethereum
  participant A as Aztec
  N->>C: Link with an Aztec address and the hash of a claim secret
  C->>E: Deposit AZTEC for that address
  Note over E: Public: the contact, the Aztec address and the amount
  N->>A: Claims it with the secret`,
      "A contact can pay the first fees for someone who holds no AZTEC. Only the recipient can claim the deposit, and the deposit is public on Ethereum.",
      "A contact pays the first fees"),
  ],
};

// ── Security ─────────────────────────────────────────────────────────────────

export const diagramsSecurity: DocPage = {
  slug: "diagrams-security",
  href: "/docs/diagrams-security",
  label: "Security in diagrams",
  title: "Security in diagrams",
  summary: "Who can see what, where the trust boundaries are, and what each kind of attacker can and cannot do, drawn one picture at a time.",
  keywords: ["diagram", "security", "threat model", "trust", "metadata", "attacker", "disclosure"],
  updated: "2026-11-21",
  blocks: [
    { t: "p", text: "These drawings follow the threat model in the whitepaper and in docs/security/THREAT_MODEL.md. Green is what holds, red is what an attacker gets." },
    { t: "h2", text: "Boundaries", id: "boundaries" },
    d(`flowchart LR
  Dev[Your device<br/>keys and plaintext]:::ok
  Net[Your network<br/>TLS]:::muted
  Srv[Our servers<br/>accounts, fallback messages]:::dashed
  X[XMTP nodes<br/>ciphertext, size, timing]:::muted
  Az[Aztec<br/>proofs]:::muted
  Dev --> Net
  Net --> Srv
  Net --> X
  Net --> Az`,
      "Trust boundaries. Plaintext and keys exist only on your device; everything past your network sees ciphertext, proofs, or the account data named here.",
      "Where plaintext lives"),
    d(`flowchart LR
  You[You] -->|knows| Who[Who you talk to]
  X[XMTP nodes] -->|see| Meta[Size, timing,<br/>conversation of a message]
  Srv[Our servers] -->|see| Acc[Accounts, contacts,<br/>who is online]
  Az[Aztec network] -->|sees| Fee[The fee payer<br/>of a transaction]
  Meta -.->|not| Content[Content]:::ok
  Acc -.->|not| Content
  Fee -.->|not| Amt[Amount and recipient<br/>of a private payment]:::ok`,
      "Metadata. Content stays private everywhere; each party still sees something, and this is what.",
      "What each party sees"),
    { t: "h2", text: "Attackers", id: "attackers" },
    d(`flowchart LR
  Adv[Full control of<br/>our servers]:::danger
  Adv -->|can| C1[Read fallback messages,<br/>community posts, contacts]
  Adv -->|can| C2[See who is online,<br/>deny service]
  Adv -.->|cannot| N1[Read direct messages<br/>sent over XMTP]:::ok
  Adv -.->|cannot| N2[Sign as you or<br/>move your funds]:::ok`,
      "Someone who takes over our servers.",
      "Our servers, compromised"),
    d(`flowchart LR
  Op[An XMTP node operator]:::danger -->|can| S1[See ciphertext, its size and timing,<br/>and its conversation]
  Op -.->|cannot| R1[Read it]:::ok
  Obs[An observer on your network]:::danger -->|can| S2[See which services you use,<br/>and when]
  Obs -.->|cannot| R2[Read anything sent<br/>over TLS]:::ok`,
      "Someone who runs a node, or watches your network.",
      "Nodes and networks"),
    d(`flowchart LR
  Dev[Someone with your<br/>unlocked device]:::danger -->|can| O[Open Ledger Chat,<br/>read browser storage]
  Dev -.->|cannot| S[Sign in elsewhere<br/>without the wallet]:::ok
  QR[Someone who tricks you<br/>into scanning their code]:::danger -->|can| Ask[Ask to be linked: the phone<br/>names the computer and asks you]
  QR -.->|cannot| W[Get the wallet or any<br/>signature you do not approve]:::ok`,
      "Someone with your device in hand, or a phishing QR code.",
      "Devices and QR codes"),
    d(`flowchart LR
  Mal[Malware on your device]:::danger -->|sees| All[Everything you can see]
  All -.-> Note[No design that is only software<br/>can prevent this]:::muted`,
      "Malware is outside what any messenger can stop. Keeping the system updated, locking the device and running few browser extensions reduce the risk.",
      "Malware"),
    { t: "h2", text: "Keys and secrets", id: "keys" },
    d(`flowchart LR
  W[Wallet] -->|signature| Inst[XMTP installation keys]
  W -->|EIP-712 signature| Az[Private account secret]
  W -->|EIP-4361 signature| Sess[Session cookie<br/>HttpOnly, seven days]
  Inst --> Dev[(Stay in this browser)]:::ok
  Az --> Dev
  Sess --> Srv[Our server verifies it,<br/>scripts cannot read it]:::ok`,
      "One wallet, three different signatures, three different things. None of the keys leaves the browser.",
      "What your wallet signs"),
    d(`flowchart LR
  Ch[Channel key, 256 bits] -->|AES-256-GCM| Req[Sealed requests between<br/>computer and phone]
  ECDH[ECDH P-256 and HKDF-SHA256] --> Ch
  File[File key per file<br/>HKDF-SHA256] -->|AES-256-GCM| Pieces[Encrypted pieces]
  MLS[MLS epoch keys] --> Msgs[Messages]
  DTLS[DTLS-SRTP keys] --> Media[Call media]`,
      "The encryption in use, by what it protects.",
      "Ciphers by purpose"),
    { t: "h2", text: "Process", id: "process" },
    d(`flowchart TB
  Commit[Commit] --> Sec[Secret scan of<br/>staged files, pre-commit]
  Sec --> Pat[Forbidden security<br/>patterns]
  Pat --> Tests[Security tests]
  Tests --> Rev[Human review]
  Rev --> Main[Main branch]`,
      "Checks every change passes on its way in.",
      "Guards on every change"),
    d(`flowchart LR
  R[Someone finds a problem] -->|GitHub security advisory| Ack[We acknowledge it]
  Ack --> Ass[We assess and fix]
  Ass --> Pub[We publish the fix]
  R -.->|please do not| Pubf[Publish before a fix]:::muted`,
      "Reporting a vulnerability. The commitments and timings are on the trust page.",
      "Reporting a vulnerability"),
    d(`flowchart LR
  Now[Today] --> P1[Seal fallback messages<br/>on the client]
  Now --> P2[Communities as MLS groups]
  Now --> P3[External audit and<br/>penetration test]
  Now --> P4[Self-hosted signalling<br/>Ledger Relay]:::dashed
  Now --> P5[Private fee payer on Aztec]
  Now --> P6[Post-quantum key exchange<br/>when MLS supports it]`,
      "Open problems, as listed in the whitepaper. None of these is done yet.",
      "What is still open"),
  ],
};

export const DIAGRAM_PAGES = [diagramsSystem, diagramsMessaging, diagramsPayments, diagramsSecurity];

/** How many diagrams the documentation carries, for the overview and the tests. */
export const DIAGRAM_COUNT = DIAGRAM_PAGES.reduce((n, p) => n + p.blocks.filter((b) => b.t === "diagram").length, 0);
