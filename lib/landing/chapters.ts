/**
 * Everything the landing page says (redesign of 21 November 2026, second pass).
 *
 * Product first, protocol second: the page opens like a messenger people want to use, then
 * explains, in plain words and then in detail, how it protects them. Every sentence falls under a
 * row of the claims register (lib/landing/claims.ts); test/unit/landing/claims-register.test.ts
 * fails on any banned word or item. Not on this page, by rule: token names, hashes, block numbers,
 * user counts, throughput figures and dates.
 */
import { EXTERNAL_LINKS } from '@/lib/constants/links';
import { FAQ as ALL_FAQ, DEVICES as ALL_DEVICES, FEE_PRIVACY } from '@/lib/landing/content';
import type { ClaimId, ClaimLabel } from '@/lib/landing/claims';
import { labelOf } from '@/lib/landing/claims';

const REPO = EXTERNAL_LINKS.github.repo;

export const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '/security', label: 'Security' },
  { href: '/trust', label: 'Trust' },
  { href: '/docs/overview', label: 'Docs' },
  { href: '/dashboard', label: 'Dashboard' },
] as const;

/* ── Hero ────────────────────────────────────────────────────────────── */

export const HERO = {
  title: 'Speak freely. Pay privately.',
  line: 'Message, call and send money in the same conversation. Ledger Chat encrypts on your device, so only the people you talk to can read what you write or see what you pay.',
  primary: { label: 'Open Ledger Chat', href: '/chat' },
  secondary: { label: 'How it works', href: '#how' },
  points: ['No phone number', 'End-to-end encrypted messages', 'Works on every device'],
} as const;

/**
 * The hero conversation. For the two people the payment reads "25 cUSDC" (the closed beta asset)
 * (claims row "usdc"). For anyone else it reads as a proof.
 */
export const HERO_THREAD = {
  people: { a: 'Amara', b: 'Jonas' },
  messages: [
    { from: 'a', text: 'Contract signed on my side. Sending the deposit now.' },
    { from: 'b', text: 'Perfect. I will confirm when it arrives.' },
  ],
  payment: { amount: '25 cUSDC', note: 'Private payment', label: labelOf('usdc') as ClaimLabel },
  after: { from: 'b', text: 'Received. Thank you.' },
  observer: {
    message: 'MLS ciphertext',
    proof: 'Proof verified',
    fields: [
      { k: 'Amount', v: 'Hidden' },
      { k: 'Recipient', v: 'Hidden' },
      { k: 'Fee payer', v: 'Public' },
    ],
  },
  views: { inside: 'The two of them', outside: 'Everyone else' },
} as const;

/* ── Features, one row each, with a screen ───────────────────────────── */

export type Screen = 'profile' | 'chats' | 'call' | 'pay' | 'file' | 'timer';

export const FEATURES_ROWS: { id: string; screen: Screen; title: string; body: string; note?: string; claim: ClaimId }[] = [
  {
    id: 'identity',
    screen: 'profile',
    title: 'No phone number. Just you.',
    body: 'Your Ethereum wallet is your account. Choose an @username so people can find you, or share a QR code. Your number, your email and your address book stay out of it.',
    claim: 'identity',
  },
  {
    id: 'messages',
    screen: 'chats',
    title: 'Say anything.',
    body: 'Direct and group messages are end-to-end encrypted with MLS, the IETF standard for secure group messaging. Voice notes, photos, polls and reactions travel the same way, and the keys change as the conversation goes on.',
    claim: 'messages',
  },
  {
    id: 'calls',
    screen: 'call',
    title: 'Call face to face.',
    body: 'Voice and video calls connect device to device and are encrypted in transit. When your network changes, Ledger Chat moves the call to a new connection before it lets go of the old one.',
    claim: 'calls',
  },
  {
    id: 'payments',
    screen: 'pay',
    title: 'Pay without being watched.',
    body: 'Send money inside the conversation. Your device proves the payment is valid, and Aztec Network checks that proof without learning the amount or who receives it.',
    note: 'Private payments are in a closed alpha on Aztec Network. USDC is shown as the design and is not enabled yet. The account that pays the network fee is public.',
    claim: 'payments',
  },
  {
    id: 'files',
    screen: 'file',
    title: 'Send the whole project.',
    body: 'Share files of up to 32 GB: a film, a dataset, a full archive. Each file is encrypted on your device in pieces before anything uploads, and only the person you send it to can put it back together.',
    claim: 'files',
  },
  {
    id: 'privacy',
    screen: 'timer',
    title: 'Make privacy stick.',
    body: 'Set messages to disappear after they are read. Lock the app with a PIN. Your keys stay on your device, where no one can reset them for you, including us.',
    claim: 'messages',
  },
];

/* ── Why ─────────────────────────────────────────────────────────────── */

export type Glyph = 'lock' | 'id' | 'coin' | 'code' | 'devices' | 'eye';

export const WHY = {
  title: 'Why use Ledger Chat?',
  body: 'A simple messenger with the protections of a security tool and the payments of a bank app, without handing your life to either.',
  items: [
    { glyph: 'lock' as Glyph, title: 'Private by design', text: 'Messages are encrypted on your device before they leave it. The network carries ciphertext.' },
    { glyph: 'id' as Glyph, title: 'No phone number', text: 'Your wallet is your account. Nobody needs your number to reach you.' },
    { glyph: 'coin' as Glyph, title: 'Money where you talk', text: 'Ask, send and agree on payments in the conversation, with amounts kept private.' },
    { glyph: 'code' as Glyph, title: 'Open source', text: 'The app, the contracts and every test run are public. Anyone can check them.' },
    { glyph: 'devices' as Glyph, title: 'On every screen', text: 'iPhone, Android, Mac, Windows and Linux, from the browser, installable as an app.' },
    { glyph: 'eye' as Glyph, title: 'Honest about what we see', text: 'We publish what our own server can read today, and the plan that removes it.' },
  ],
};

/* ── How it protects you ─────────────────────────────────────────────── */

export const HOW = {
  title: 'How Ledger Chat protects you',
  body: 'Three ideas do the work. You do not need to understand them to be protected by them, but you can check every one.',
  pillars: [
    { title: 'Encrypted on your device', text: 'Keys are made on your phone or computer and never leave it. What you write is locked before it is sent.' },
    { title: 'Carried by open networks', text: 'Messages travel over the XMTP network. Payments are verified by Aztec Network, which settles on Ethereum.' },
    { title: 'Opened only by the people in it', text: 'Only the devices of the people in a conversation hold the keys to read it, or to see what was paid.' },
  ],
};

export const PAYMENT = {
  title: 'A private payment, step by step',
  body: 'The network checks the proof, not the payment.',
  steps: [
    { title: 'You type an amount', text: 'In the conversation. Before value moves, Ledger Chat checks that the payment address belongs to the person you are talking to.' },
    { title: 'Your device builds a proof', text: 'The Aztec PXE in your browser proves the payment is valid: the funds are yours and nothing is spent twice.' },
    { title: 'The network checks the proof', text: 'Aztec verifies it and records note hashes and nullifiers. Not the amount, not the recipient.' },
    { title: 'The other person receives it', text: 'Their device finds the new note and decrypts the amount. Only the two of you know it.' },
  ],
  honest: FEE_PRIVACY.long,
  label: labelOf('payments'),
} as const;

/* ── Zero-knowledge, in plain words ──────────────────────────────────── */

export const ZK = {
  title: 'Proving without revealing',
  body: 'In 1985 three researchers showed that one person can convince another that a statement is true while revealing nothing else. For decades it was theory. Today an ordinary phone or laptop can build such a proof, and a network can check it without learning what it proves.',
  analogy: [
    { title: 'Two balls', text: 'Your friend cannot tell red from green. You hand them two balls, one of each colour.' },
    { title: 'Swap, or not', text: 'Behind their back they swap the balls, or leave them, and ask you which. You answer right every time.' },
    { title: 'Convinced', text: 'After twenty rounds a lucky guess is about one chance in a million. They know the balls differ, and still not which one is red.' },
  ],
  timeline: [
    { year: '1985', text: 'Goldwasser, Micali and Rackoff define zero-knowledge proofs.' },
    { year: '1986', text: 'Fiat and Shamir show how to make such proofs non-interactive.' },
    { year: '1989', text: 'Quisquater and colleagues explain them with the story of a cave.' },
    { year: '2012', text: 'Goldwasser and Micali receive the ACM Turing Award.' },
    { year: '2013', text: 'Pinocchio makes general-purpose proofs close to practical.' },
    { year: '2016', text: 'Zcash launches private payments with zk-SNARKs; Groth16 is published.' },
    { year: '2019', text: 'PLONK is published; one of its authors co-founded Aztec.' },
    { year: 'Today', text: 'Aztec Network: private transactions proved on your own device.' },
  ],
  bridge: 'When you pay in Ledger Chat, your device proves the payment follows the rules, and the network checks that proof without learning the amount or the recipient.',
  more: { label: 'The history, with sources', href: '/docs/zero-knowledge-history' },
} as const;

/* ── Messages and calls, in detail ───────────────────────────────────── */

export const MESSAGES = {
  title: 'Messages and calls, in detail',
  spec: [
    { k: 'Message encryption', v: 'MLS (RFC 9420) through XMTP; keys updated as the conversation goes on' },
    { k: 'On your device', v: 'Messages kept in an encrypted local database' },
    { k: 'Call media', v: 'Peer to peer over WebRTC, DTLS-SRTP in transit' },
    { k: 'Strict networks', v: 'A TURN relay with short-lived credentials passes the encrypted stream' },
    { k: 'Network change', v: 'The call moves to a new connection before the old one is closed' },
    { k: 'Call measurements', v: 'Kept on your device, sent nowhere' },
  ],
  limit: 'XMTP protects content, not all metadata: the network sees that two inboxes exchange traffic.',
} as const;

/* ── What we can see ─────────────────────────────────────────────────── */

export const VISIBILITY = {
  title: 'What our server can see',
  body: 'Most apps ask you to trust them. We would rather show you. This table follows the code: where our server can read something today, it says so, next to the plan that changes it.',
  head: ['Part', 'Who can read it', 'What our server sees today', 'Next'],
  rows: [
    { part: 'Direct and group messages', who: 'Only the people in the conversation', server: 'No content. The XMTP network sees that inboxes exchange traffic', next: '', e2e: true },
    { part: 'Calls', who: 'Media: only the people on the call', server: 'For relayed calls, our TURN server sees addresses and timing; the signalling server sees which peers connect', next: 'Relays anyone can run, in design', e2e: true },
    { part: 'Payments', who: 'Amount and recipient: only the two parties', server: 'Nothing. On chain, the account that pays the fee is public', next: '', e2e: true },
    { part: 'Files', who: 'Only the people in the conversation', server: 'Encrypted pieces, their size and when they were sent', next: '', e2e: true },
    { part: 'Contacts', who: 'You', server: 'The list you save', next: 'Encrypted on your devices, in design', e2e: false },
    { part: 'Communities', who: 'Members', server: 'Posts, in plain text', next: 'MLS groups, in design', e2e: false },
    { part: 'Status', who: 'Your audience', server: 'Each Status and its media', next: 'MLS messages, in design', e2e: false },
    { part: 'Notifications', who: 'You', server: 'That a notification was sent to a device', next: 'Opaque wake-ups, in design', e2e: false },
    { part: 'Sign-in', who: 'You', server: 'Your wallet’s sessions', next: 'Shorter, device-bound sessions, in design', e2e: false },
  ],
} as const;

/* ── Architecture ────────────────────────────────────────────────────── */

export const ARCHITECTURE = {
  title: 'Under the hood',
  body: 'Your device holds the keys, builds the proofs and decrypts the messages. Every other box sees only what it is drawn with. Switch to the next step to see where our own server goes.',
  states: { today: 'Today', relay: 'With Ledger Relay, in design' },
  goal: 'The goal: no Ledger Chat server can read your messages, contacts, communities or Status.',
  nodes: {
    device: { name: 'Your device', text: 'The app, your keys and the prover. Messages are decrypted and proofs are built here.', sees: 'Everything that is yours' },
    xmtp: { name: 'XMTP network', text: 'Relays MLS ciphertext between inboxes.', sees: 'Ciphertext, inbox ids and timing' },
    peer: { name: 'Other device', text: 'Calls connect directly when the networks allow it.', sees: 'The call, as a participant' },
    turn: { name: 'TURN relay', text: 'Passes the encrypted call stream when a direct path is blocked.', sees: 'Addresses and timing, not media' },
    aztec: { name: 'Aztec Network', text: 'Verifies proofs and keeps private notes.', sees: 'Proofs, note hashes, nullifiers, the public fee' },
    ethereum: { name: 'Ethereum', text: 'Where Aztec settles.', sees: 'Rollup proofs and state roots' },
    server: { name: 'Our server today', text: 'Sign-in sessions, contacts, communities, Status and push.', sees: 'What it stores, in plain text where noted' },
    onDevice: { name: 'Moved to your devices', text: 'Contacts, community posts and Status as MLS messages.', sees: 'Only you and the people you share with' },
    relays: { name: 'Ledger Relays', text: 'Calls, encrypted files and notifications, on relays anyone can run.', sees: 'Ciphertext, opaque tokens and timing' },
  },
  stackHead: ['Layer', 'Technology', 'Standard', 'Status'],
} as const;

export function stackRows(v: { xmtp: string; aztecNr: string }): { layer: string; tech: string; standard: string; label: ClaimLabel }[] {
  return [
    { layer: 'Device', tech: 'Web app, installable on iPhone, Android, Mac, Windows and Linux', standard: 'Web platform', label: 'Live' },
    { layer: 'Identity', tech: 'Sign-In with Ethereum, @usernames', standard: 'EIP-4361', label: labelOf('identity') },
    { layer: 'Messages', tech: `XMTP browser SDK${v.xmtp ? ` ${v.xmtp}` : ''}`, standard: 'MLS, RFC 9420', label: labelOf('messages') },
    { layer: 'Calls', tech: 'WebRTC, TURN relay, ringing over XMTP', standard: 'DTLS-SRTP', label: labelOf('calls') },
    { layer: 'Files', tech: 'AES-256-GCM pieces, keys inside MLS messages', standard: 'HKDF-SHA256', label: labelOf('files') },
    { layer: 'Payments', tech: `Aztec PXE in the browser, Noir contracts with aztec-nr${v.aztecNr ? ` ${v.aztecNr}` : ''}, fees in Fee Juice`, standard: 'Client-side proofs', label: labelOf('payments') },
    { layer: 'Settlement', tech: 'Ethereum', standard: 'Aztec rollup', label: 'Live' },
  ];
}

/* ── Organisations: Ledger Relay ─────────────────────────────────────── */

export const RELAY = {
  title: 'Run it on your own servers',
  body: 'Ledger Relay is a small, stateless service that a company, a newsroom or a community can run on its own domain. It carries only what cannot be end-to-end encrypted away, and never plaintext. Ledger Chat’s own call set-up already runs on one.',
  carries: [
    { k: 'Calls', v: 'TURN with short-lived credentials, and signalling' },
    { k: 'Encrypted files', v: 'Ciphertext only, addressed by its hash, deleted on expiry' },
    { k: 'Notifications', v: 'Opaque wake-ups, without senders or content' },
  ],
  never: 'It never carries payments: those are proved on your device and settle on Aztec.',
  goal: 'No Ledger Chat server can read your messages, contacts, communities or Status, and you can run every server we run.',
  label: labelOf('relay'),
  source: { label: 'Read the specification', href: `${REPO}/tree/main/relay` },
} as const;

/* ── Open and verifiable ─────────────────────────────────────────────── */

export const OPEN = {
  title: 'Don’t take our word for it',
  body: 'Every claim on this page links to something you can check: the code, the tests, the network record, or the limits we publish.',
  cards: [
    { title: 'Source code', text: 'The app, the contracts and the relay, under MIT or Apache-2.0.', href: REPO, cta: 'Open GitHub' },
    { title: 'Security', text: 'The cryptography, key handling and threat model, part by part.', href: '/security', cta: 'Read the architecture' },
    { title: 'Trust centre', text: 'Review status, disclosure policy, networks we rely on and what we store.', href: '/trust', cta: 'Open the trust centre' },
    { title: 'Ledger Record', text: 'What we deployed and the first private payments, checkable on chain.', href: '/record', cta: 'See the record' },
  ],
  review: 'Our contracts have had an internal security review, not an external audit.',
} as const;

/* ── What's next ─────────────────────────────────────────────────────── */

export const NEXT = {
  title: 'What we are building next',
  body: 'Each item moves to Live only when the code is merged and switched on. Until then it says what it is.',
  items: [
    { title: 'Private USDC', text: 'Dollar payments in the conversation, with amounts kept private.', claim: 'usdc' as ClaimId },
    { title: 'Escrow and payment streams', text: 'Agreements that release money when both sides are done.', claim: 'agreements' as ClaimId },
    { title: 'Contacts on your devices', text: 'Your list, encrypted, no longer on our server.', claim: 'contactsOnDevice' as ClaimId },
    { title: 'Communities on MLS', text: 'Posts our server can no longer read.', claim: 'communityMls' as ClaimId },
    { title: 'Ledger Relay', text: 'Every server we run, runnable by you.', claim: 'relay' as ClaimId },
  ],
};

/* ── Questions, then every screen ────────────────────────────────────── */

const KEEP = [
  'Do I need a wallet?',
  'Who can read my messages?',
  'What is Aztec Alpha?',
  'Will there be real payments?',
  'How do I know a payment address belongs to the person in the chat?',
  'What if I lose my phone?',
  'Is it open source?',
  'What are the current limits?',
  'How do I report a security issue?',
];
export const FAQ = [
  ...ALL_FAQ.filter((f) => KEEP.includes(f.q)),
  { q: 'How large can a file be?', a: 'Up to 32 GB. The file is encrypted on your device in 16 MiB pieces, and our server stores only those encrypted pieces. Large files need file storage to be switched on for the server you use.' },
];
export const DEVICES = ALL_DEVICES;

export const CLOSING = {
  title: 'Take privacy with you.',
  body: 'Ledger Chat runs in any modern browser and installs as an app on iPhone, Android, Mac, Windows and Linux. Bring a wallet; nothing else.',
} as const;

/** Every capability with the claim that backs it, for the register test. */
export const FEATURES: { title: string; text: string; claim: ClaimId }[] = [
  ...FEATURES_ROWS.map((r) => ({ title: r.title, text: r.body, claim: r.claim })),
  ...NEXT.items.map((i) => ({ title: i.title, text: i.text, claim: i.claim })),
];

/**
 * Other apps on Aztec, as the directory at aztec.network/apps lists them (checked 28 Nov 2026):
 * name, category and availability as that page shows them, the line in our own words. A card opens
 * the app's own site, or its Aztec project page when that page names no site. `icon` is the host
 * whose favicon the card shows; a letter tile stays visible when none loads.
 */
export const ECOSYSTEM = {
  eyebrow: 'Aztec ecosystem',
  title: 'More private apps on Aztec',
  body: 'Ledger Chat is built with Aztec. These are other apps on the same network. Each card opens the app in a new tab.',
  source: 'Names, categories and availability as listed on aztec.network/apps. Ledger Chat does not run these apps.',
  more: { label: 'See every app on aztec.network', href: 'https://aztec.network/apps' },
  apps: [
    { slug: 'aztecscan', brand: 'Aztecscan', category: 'Block explorers', availability: 'Available', url: 'https://aztecscan.xyz/', icon: 'aztecscan.xyz', note: 'Look up blocks, transactions and contracts on Aztec.' },
    { slug: 'dark-forest-aztec', brand: 'Dark Forest Aztec', category: 'Apps', availability: 'Available', url: 'https://aztec.network/projects/dark-forest-aztec', icon: '', note: 'Strategy game where hidden planets stay hidden through private state.' },
    { slug: 'galactica', brand: 'Galactica', category: 'Apps', availability: 'Available', url: 'https://privateinference.gg/', icon: 'privateinference.gg', note: 'AI chat and API paid for privately, with encrypted prompts.' },
    { slug: 'nemi', brand: 'Nemi', category: 'Apps', availability: 'Alpha', url: 'https://nemi.fi/', icon: 'nemi.fi', note: 'Trading that hides who trades and how, on a public market.' },
    { slug: 'nulo', brand: 'Nulo', category: 'Wallets', availability: 'Available', url: 'https://nulo.sh/', icon: 'nulo.sh', note: 'Open-source wallet that shows what stays private before you send.' },
    { slug: 'nyx', brand: 'Nyx', category: 'Apps', availability: 'Alpha', url: 'https://www.nyx.money/', icon: 'nyx.money', note: 'Private account controlled by an Ethereum wallet and a passkey.' },
    { slug: 'olla', brand: 'Olla', category: 'Apps', availability: 'Available', url: 'https://olla.finance/', icon: 'olla.finance', note: 'Pooled staking for AZTEC holders, without the solo staking minimum.' },
    { slug: 'ravenhouse', brand: 'RavenHouse', category: 'Apps', availability: 'Available', url: 'https://aztec.network/projects/ravenhouse', icon: 'app.ravenhouse.xyz', note: 'NFT launches, private ownership and auctions.' },
    { slug: 'rollingchat', brand: 'RollingChat', category: 'Apps', availability: 'Alpha', url: 'https://rolling.chat/', icon: 'rolling.chat', note: 'Onchain message board where you post under any name.' },
    { slug: 'shield', brand: 'Shield', category: 'Bridges', availability: 'Alpha', url: 'https://shield.human.tech/', icon: 'shield.human.tech', note: 'Moves assets between Ethereum and Aztec and converts the fee asset on the way.' },
    { slug: 'xochi', brand: 'Xochi', category: 'Bridges', availability: 'Check availability', url: 'https://xochi.fi/', icon: 'xochi.fi', note: 'Private intents settled by competing solvers, away from the public mempool.' },
    { slug: 'zk-money', brand: 'zk.money', category: 'Apps', availability: 'Available', url: 'https://zk.money/', icon: 'zk.money', note: 'Self-custodial wallet to send and receive crypto privately.' },
    { slug: 'zkpassport', brand: 'ZKPassport', category: 'Apps', availability: 'Available', url: 'https://aztec.network/projects/zkpassport', icon: 'zkpassport.id', note: 'Open SDK for eligibility, compliance and bot checks, proved on the device.' },
  ],
};

/** All prose of the page, for the banned-items test. */
export const ALL_COPY = [
  HERO, HERO_THREAD, FEATURES_ROWS, WHY, HOW, PAYMENT, ZK, MESSAGES, VISIBILITY, ARCHITECTURE, RELAY, OPEN, NEXT, FAQ, DEVICES, CLOSING, ECOSYSTEM,
];
