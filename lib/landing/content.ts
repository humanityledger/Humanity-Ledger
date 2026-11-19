/**
 * Everything the landing says, in one typed file (docs: the landing brief of 18/11/2026).
 *
 * Copy, figures with a source, and links live here; the scenes in components/landing/immersive
 * only lay them out. Rules this file keeps:
 *  - every figure comes from deployments/*.json, the build, or GET /api/stats/live, never by hand;
 *  - no word that suggests an external audit, E2E community posts, or a deployed Ethereum portal;
 *  - the state of the protocol (Alpha, portal "next") is derived from the record and the build.
 */
import mainnet from '../../deployments/aztec-mainnet.json';
import testnet from '../../deployments/aztec-testnet.json';
import { EXTERNAL_LINKS } from '@/lib/constants/links';

const REPO = EXTERNAL_LINKS.github.repo;
const blob = (path: string) => `${REPO}/blob/main/${path}`;
const tree = (path: string) => `${REPO}/tree/main/${path}`;

/** The first private payment sent from Ledger Chat on Aztec Alpha (moved from LaunchSections.tsx). */
export const FIRST_PAYMENT = {
  date: '14 November 2026',
  block: 29012,
  tx: '0x1eb2bb76ae52d876e0ef8e107bf9de5b83ce9cb42850a1a1a938cae3c24040a5',
  amount: '0.10 HLC',
  token: '0x1f49571a48699da4e70e1b7dbc5afcea5bb712f7b2cfaf432353e694851e24e5',
  tokenBlock: 28992,
  tokenDecimals: 6,
  preflightRun: '43583640304',
  preflightUrl: 'https://github.com/humanityledger/Humanity-Ledger/actions/runs/43583640304',
} as const;

/** A point on the record line. Only entries with a real hash are added. */
export interface Milestone {
  date: string;
  block: number;
  hash: string;
  label: string;
}
export const MILESTONES: Milestone[] = [
  { date: FIRST_PAYMENT.date, block: FIRST_PAYMENT.tokenBlock, hash: FIRST_PAYMENT.token, label: 'HLC deployed on Aztec Alpha' },
  { date: FIRST_PAYMENT.date, block: FIRST_PAYMENT.block, hash: FIRST_PAYMENT.tx, label: 'First private payment from Ledger Chat' },
];

/* ── Protocol state, from the record and the build ───────────────────── */

/** HLPortal is "next" until its address is configured for the build. */
export const PORTAL_DEPLOYED = Boolean(process.env.NEXT_PUBLIC_HL_PORTAL);
/** The record never claims an audit; the landing reads it rather than assume. */
export const HAS_EXTERNAL_AUDIT = !!(mainnet as { audit?: unknown }).audit;

type Rec = { name?: string; contract?: string; classId?: string };
const classes: string[] = ((mainnet as { closedAlpha?: { classes?: string[] } }).closedAlpha?.classes ?? []).slice();
/** The wave-1 classes (deployments/aztec-mainnet.json → closedAlpha.classes), named from the test-network record. */
export const WAVE1_CLASSES = classes.map((id) => {
  const rec = ((testnet as { contracts?: Rec[] }).contracts ?? []).find((c) => c.classId === id);
  return { id, name: (rec?.name ?? rec?.contract ?? 'Contract').replace(/\s*\(.*\)$/, '') };
});

/* ── Copy ─────────────────────────────────────────────────────────────── */

export const ONE_LINE = 'A messenger where your wallet is your account, with private payments on Aztec Network.';
export const EYEBROW = 'Private messaging and payments on Aztec Network';

export const NAV = [
  { id: 'messages', label: 'Messages' },
  { id: 'payments', label: 'Payments' },
  { id: 'network', label: 'Network' },
  { id: 'live', label: 'Live' },
  { id: 'how', label: 'How it works' },
  { id: 'devices', label: 'Devices' },
] as const;

/**
 * The anatomy every scene and chapter shares: an index, an eyebrow, a title with one emphasis,
 * a lead of one or two lines, the visual, and one line of proof that links to the code, the
 * record or the documentation.
 */
export const EYEBROWS = {
  hero: 'Ledger Chat',
  hi: 'Messages',
  enc: 'Encryption',
  name: 'Usernames',
  pay: 'Payments',
  record: 'On chain',
  eth: 'Settlement',
  calls: 'Calls',
  live: 'Live',
  features: 'Today',
  how: 'How it works',
  protects: 'Security',
  open: 'In the open',
  faq: 'Questions',
  devices: 'Every screen',
} as const;

export const HERO = { title: ['Your wallet is ', 'your account', '.'], line: 'Messages, calls and private payments. One app.' };
export const SAY_HI = { typed: 'Hi how are you', title: ['Say hi. ', 'To anyone', ' with a wallet.'] };
export const ENCRYPTION = {
  layers: ['Ledger Chat', 'XMTP with MLS', 'Network'],
  title: ['Read by the ', 'two of you', '.'],
  line: 'Direct messages are end-to-end encrypted with MLS, through XMTP. Community posts are stored on our server, and we say so.',
};
export const NAME = {
  handle: 'yourname',
  title: ['One name. ', 'Yours', '.'],
  line: 'Each @username exists once. Your code opens a chat without showing your wallet address.',
};
export const PAYMENTS = {
  title: ['Private payments on ', 'Aztec Network', '.'],
  line: 'Amounts and parties stay private. Escrow and payment streams run on Aztec Alpha with HLC, a test token with no monetary value.',
  small: HAS_EXTERNAL_AUDIT
    ? 'Aztec Alpha is an early network.'
    : 'Aztec Alpha is an early network. Our contracts have had an internal security review, not an external audit.',
};
export const RECORD = {
  title: ['Not a promise. ', 'A record', ' on chain.'],
  note: 'Sent between two accounts of the operator, with fees paid in Fee Juice. The contracts have had an internal security review, not an external audit, and payments on Alpha have a cap per payment.',
};
export const ETHEREUM = {
  title: ['Aztec settles on ', 'Ethereum', '.'],
  small: PORTAL_DEPLOYED
    ? 'Deposits from Ethereum go through our portal, with L1 → L2 messages.'
    : 'Deposits from Ethereum through our portal are next: written and tested, not yet deployed.',
};
export const CALLS = {
  title: ['Voice and video, ', 'device to device', '.'],
  line: 'Calls connect peer to peer over WebRTC, with media encrypted in transit (DTLS-SRTP). When a network blocks a direct path, a relay passes the encrypted stream.',
};
export const LIVE = {
  title: ['People on Ledger Chat. ', 'Right now', '.'],
  method: 'Visitors are counted once per browser per day by time zone, with no IP address stored, since 18 November 2026.',
};

/**
 * What the app does today, grouped. Each line rests on the code: lib/xmtp (MLS through XMTP),
 * components/chat (groups, communities, burn timer, voice notes, payment requests, @usernames,
 * QR), components/zk/wallet (send, shield, unshield, Fee Juice), lib/calls (WebRTC).
 */
export const FEATURES: { group: string; items: { title: string; body: string }[] }[] = [
  {
    group: 'Messages',
    items: [
      { title: 'Direct messages', body: 'End-to-end encrypted with MLS, through XMTP. Only the people in the chat can read them.' },
      { title: 'Groups', body: 'Group chats on the same MLS protocol, with the same encryption.' },
      { title: 'Disappearing messages', body: 'Set a timer and messages delete themselves.' },
      { title: 'Voice messages', body: 'Record and send audio in any conversation.' },
    ],
  },
  {
    group: 'Payments',
    items: [
      { title: 'Private payments', body: 'Send HLC on Aztec Alpha. The amount and the parties stay private.' },
      { title: 'Requests in the chat', body: 'Ask for a payment inside the conversation and get paid in one tap.' },
      { title: 'Shield and unshield', body: 'Move tokens between your public and private balances.' },
      { title: 'Your own fees', body: 'Network fees are paid in Fee Juice from your wallet. Ledger Chat pays no one’s fees.' },
    ],
  },
  {
    group: 'Identity',
    items: [
      { title: 'Your wallet is your account', body: 'No phone number to give. Sign in with an Ethereum wallet.' },
      { title: '@usernames', body: 'Each name exists once, so people find you without your address.' },
      { title: 'QR codes', body: 'Scan a code to open a chat or save a contact.' },
    ],
  },
  {
    group: 'Calls and communities',
    items: [
      { title: 'Voice and video calls', body: 'Peer to peer over WebRTC, with media encrypted in transit.' },
      { title: 'Communities', body: 'Spaces you join with an invite. Their posts are stored on our server and are not end-to-end encrypted.' },
    ],
  },
];

export const NEXT_WAVE = 'Escrow and payment streams come next, to a closed alpha of at most 20 testers, with a cap of 100 HLC per agreement.';

export const DEVICES = [
  { name: 'iPhone', how: 'Safari or Chrome. Add it to your Home Screen.' },
  { name: 'Android', how: 'Chrome. Install it from the menu.' },
  { name: 'Mac, Windows and Linux', how: 'Any modern browser, installable as an app.' },
];

export const PROTECTS = {
  yes: [
    'Direct messages, end to end with MLS',
    'Keys and proofs made on your device',
    'Amounts and parties private on Aztec',
  ],
  notYet: [
    'Community posts are readable by our server',
    'The account that pays the network fee is public',
    'No external audit of our contracts yet',
  ],
};

export const STACK = [
  { name: 'Ledger Chat', detail: 'On your device: the app, your keys, your proofs.', href: tree('components/chat') },
  { name: 'XMTP with MLS', detail: 'Direct messages, end-to-end encrypted.', href: tree('lib/xmtp') },
  { name: 'Aztec Network', detail: 'PXE in the browser, client-side proofs, contracts in Noir with aztec-nr.', href: tree('contracts/aztec') },
  { name: 'Ethereum', detail: 'Where Aztec settles.', href: 'https://ethereum.org' },
];

/** Roadmap from docs/alpha/OPERATOR_DECISIONS.md and docs/MAINNET_READINESS.md. No invented quarters. */
export const ROADMAP = [
  { when: 'Wave 1', what: 'Escrow and payment streams on Aztec Alpha, with HLC, for a closed group of testers.' },
  { when: 'Wave 2', what: 'The Ethereum portal, after an external review.' },
  { when: 'Later', what: 'Communities with MLS, and private fee payment through an Aztec or community FPC.' },
];

export const FAQ = [
  { q: 'Do I need a wallet?', a: 'Yes. Your Ethereum wallet is your account. There is no phone number to give.' },
  { q: 'Who can read my messages?', a: 'Direct messages: only the people in them, encrypted with MLS through XMTP. Community posts are stored on our server.' },
  { q: 'What is Aztec Alpha?', a: 'An early Aztec network that settles on Ethereum. Aztec says to expect critical bugs, so keep amounts small.' },
  { q: 'Does HLC have value?', a: 'No. HLC is a test token with no monetary value. It is not sold or offered.' },
  { q: 'What if I lose my phone?', a: 'Your account is your wallet. Private Aztec balances depend on keys in your browser: read the wallet’s Security view before holding funds.' },
  { q: 'Does it work on iPhone and Android?', a: 'Yes, as a web app installed from Safari or Chrome. It also runs on Mac, Windows and Linux.' },
  { q: 'Is it open source?', a: 'Yes, under MIT or Apache-2.0. The code, the contracts and the CI runs are public on GitHub.' },
  { q: 'How do I report a security issue?', a: 'Privately first, as the Report a vulnerability page explains.' },
];

export const OPEN = [
  { label: 'Source code', href: REPO },
  { label: 'Public CI', href: `${REPO}/actions` },
  { label: 'Changelog', href: '/docs/changelog' },
  { label: 'Network status', href: '/docs/status' },
  { label: 'Report a vulnerability', href: '/docs/bug-bounty' },
];

export const FACT_SOURCES = {
  messages: blob('lib/xmtp/client.ts'),
  payments: blob('deployments/aztec-mainnet.json'),
  tests: `${REPO}/actions`,
  license: blob('LICENSE'),
  scale: blob('docs/MAINNET_READINESS.md'),
  classes: blob('deployments/aztec-testnet.json'),
  calls: blob('lib/calls/media.ts'),
};

/** Trademark attribution only: no sentence about independence or endorsement (master plan, decision 6). */
export const TRADEMARKS = 'Aztec and Ethereum are trademarks of their respective owners.';
export const SETTLES = 'Private payments on Aztec Network. Aztec settles on Ethereum.';

/** Media. Source and licence must be confirmed in public/media/landing/README.md before launch. */
export const MEDIA = {
  hand: { play: '/media/landing/hand-phone-1920.mp4', scrub: '/media/landing/hand-phone-scrub-1280.mp4', poster: '/media/landing/hand-phone-poster.jpg' },
  typing: { play: '/media/landing/typing-1920.mp4', scrub: '/media/landing/typing-scrub-1280.mp4', poster: '/media/landing/typing-poster.jpg' },
  /** Video-call image supplied by Stefan (18/11/2026), shown at its native 800 × 1290 with its own shadow. */
  call: { webp: '/media/landing/call-phone.webp', png: '/media/landing/call-phone.png' },
};

/**
 * Official marks. Each stays null until the file from the official kit is committed under
 * public/brand/ with its source and download date in public/brand/README.md. Until then the
 * landing writes the name in plain text: no redrawn or approximated logo.
 */
export const BRAND_FILES: { aztec: string | null; ethereum: string | null } = { aztec: null, ethereum: null };
