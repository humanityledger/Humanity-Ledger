/**
 * The claims register, as data (landing brief of 21 November 2026, "Claims register").
 *
 * Every sentence on the landing, the brief and the record page falls under one row of this table.
 * A sentence that fits no row is not published. The labels are the only status words allowed:
 * Live, Closed alpha, Not enabled yet, In design.
 *
 * Rules enforced by test/unit/landing/claims-register.test.ts:
 *  - every evidence path exists in the repository;
 *  - a row marked Live has no controlling switch that is off;
 *  - the landing copy contains none of the banned words or items.
 *
 * A label changes only in a pull request that cites the merged code and, where the row has a
 * switch, the switch Stefan turned on. Nothing here is a figure typed by hand.
 */
import { cusdcReady } from '@/lib/payments/assets';
import { CUSDC_PUBLIC } from '@/lib/aztec/wallet/config';
import { r2ConfigFromEnv } from '@/lib/storage/r2';

export type ClaimLabel = 'Live' | 'Closed alpha' | 'Not enabled yet' | 'In design';

export const LABELS: readonly ClaimLabel[] = ['Live', 'Closed alpha', 'Not enabled yet', 'In design'];

export interface ClaimSwitch {
  /** The name Stefan uses for it (verdict prompt, "Switches only Stefan changes"). */
  name: string;
  /** Read from the code, never typed. */
  on: boolean;
}

export interface Claim {
  id: string;
  topic: string;
  label: ClaimLabel;
  /** What the page may say, in the register's words. */
  may: string;
  /** What it must never say. */
  mustNot: string;
  /** Repository paths that back the row. */
  evidence: readonly string[];
  switch?: ClaimSwitch;
}

/**
 * Community MLS is a per-community column (prisma `communityMls`, default false) that only Stefan
 * flips; no community is flagged in the code, so the register reads it as off.
 */
const COMMUNITY_MLS_ON = false;

/** Large files need encrypted file storage on the server (R2, set in Railway by Stefan). Read per process. */
const FILE_STORAGE_ON = Boolean(r2ConfigFromEnv());

export const CLAIMS = [
  {
    id: 'messages',
    topic: 'Messages',
    label: 'Live',
    may: 'End-to-end encrypted with MLS (RFC 9420) through XMTP.',
    mustNot: 'That nobody can ever read them: the network still sees metadata.',
    evidence: ['lib/xmtp/client.ts', 'package.json'],
  },
  {
    id: 'identity',
    topic: 'Account',
    label: 'Live',
    may: 'An Ethereum wallet is the account, through Sign-In with Ethereum (EIP-4361). No phone number or email.',
    mustNot: 'That the server keeps no session.',
    evidence: ['app/api/siwe'],
  },
  {
    id: 'calls',
    topic: 'Calls',
    label: 'Live',
    may: 'Peer to peer, encrypted in transit (DTLS-SRTP), with a relay when networks block a direct path. A call moves to a new connection when the network changes, before the old one is closed.',
    mustNot: 'End-to-end encrypted calls; that calls never fail.',
    evidence: ['lib/calls/media.ts', 'lib/calls/resume.ts', 'app/api/calls/ice', 'docs/CALLS.md'],
  },
  {
    id: 'payments',
    topic: 'Private payments',
    label: 'Closed alpha',
    may: 'Amount and recipient hidden, proved on your device with Aztec. The account that pays the network fee is public.',
    mustNot: 'Never call payments anonymous, or say they cannot be traced.',
    evidence: ['contracts/aztec', 'lib/aztec/peer-binding.ts', 'deployments/aztec-mainnet.json'],
  },
  {
    id: 'usdc',
    topic: 'USDC',
    // cUSDC for everyone (lib/payments/cusdc-public.ts) is the operator's switch; CUSDC_GATES stay a record.
    label: CUSDC_PUBLIC ? 'Live' : 'Not enabled yet',
    may: CUSDC_PUBLIC
      ? 'Private cUSDC payments in the chat on Aztec Alpha, with a cap per payment and no external audit.'
      : 'Private USDC payments in the chat are the design.',
    mustNot: CUSDC_PUBLIC ? 'That payments have an external audit, no limit or no risk.' : 'That USDC works today.',
    evidence: ['lib/payments/assets.ts', 'lib/payments/cusdc-public.ts'],
    switch: { name: 'cusdcPublic', on: CUSDC_PUBLIC || cusdcReady() },
  },
  {
    id: 'files',
    topic: 'Large files',
    label: FILE_STORAGE_ON ? 'Live' : 'Not enabled yet',
    may: 'Files of up to 32 GB, encrypted on the device in 16 MiB pieces; the server stores ciphertext only.',
    mustNot: 'Unlimited size, or that files are live while file storage is off.',
    evidence: ['lib/chat/large-file.ts', 'app/api/chat/attachments/route.ts'],
    switch: { name: 'R2 file storage', on: FILE_STORAGE_ON },
  },
  {
    id: 'agreements',
    topic: 'Escrow and payment streams',
    label: 'Not enabled yet',
    may: 'Written and tested on the Aztec test network; refused on Aztec Alpha until an external audit.',
    mustNot: 'That they run on Alpha.',
    evidence: ['contracts/aztec/escrow', 'contracts/aztec/streams', 'lib/protocol/agreement-gate.ts'],
  },
  {
    id: 'statusCommunities',
    topic: 'Status and communities',
    label: 'Live',
    may: 'Stored on our server, not end-to-end encrypted, today. Moving them to MLS is in design.',
    mustNot: 'Any implication that they are private.',
    evidence: ['app/api/chat/stories', 'app/api/chat/communities', 'docs/communities/MLS_MIGRATION.md'],
  },
  {
    id: 'communityMls',
    topic: 'Communities on MLS',
    label: 'In design',
    may: 'Communities as MLS groups, so our server no longer holds their posts.',
    mustNot: 'That communities are end-to-end encrypted today.',
    evidence: ['docs/communities/MLS_MIGRATION.md'],
    switch: { name: 'communityMls', on: COMMUNITY_MLS_ON },
  },
  {
    id: 'contactsOnDevice',
    topic: 'Contacts on the device',
    label: 'In design',
    may: 'Contacts held encrypted on your devices, so our server no longer holds the list.',
    mustNot: 'That our server cannot see contacts today.',
    evidence: ['prisma/schema.prisma'],
  },
  {
    id: 'relay',
    topic: 'Ledger Relay',
    label: 'In design',
    // Call set-up has run on Ledger Relay for users since 22 November 2026 (relay.ledgerchat.org,
    // lib/calls/media.ts pickPeerServer, with a fallback to the public PeerJS cloud). Files and
    // notifications through it are still in design, so the row keeps its label.
    may: 'Call set-up already runs on our own Ledger Relay. Running every server Ledger Chat needs, encrypted files and notifications included, on software anyone can run is in design.',
    mustNot: 'That files or notifications run on it today, that it carries payments, or any number of users, calls or transfers.',
    evidence: ['relay/README.md', 'lib/relay/relays.ts', 'lib/calls/media.ts'],
  },
  {
    id: 'record',
    topic: 'Ledger Record',
    label: 'Live',
    may: 'What we deployed is on a public record anyone can check, on /record.',
    mustNot: 'Block numbers, hashes or token names on the landing.',
    evidence: ['deployments/aztec-mainnet.json', 'deployments/aztec-testnet.json'],
  },
  {
    id: 'scale',
    topic: 'Scale',
    label: 'Live',
    may: 'Messages scale on the XMTP network; payments on Aztec.',
    mustNot: 'Any user count, throughput or "millions" we have not measured.',
    evidence: ['lib/xmtp/client.ts'],
  },
  {
    id: 'security',
    topic: 'Security',
    label: 'Live',
    may: 'An internal security review; the limits listed next to each claim.',
    mustNot: 'Never claim the code is audited, nor any grade superlative (military, bank, enterprise, unhackable).',
    evidence: ['docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-18.md', 'SECURITY.md'],
  },
  {
    id: 'relationships',
    topic: 'Relationships',
    label: 'Live',
    may: 'Built on XMTP, Aztec Network and Ethereum.',
    mustNot: 'Partner, official, backed by, or a logo used as an endorsement.',
    evidence: ['lib/landing/content.ts'],
  },
  {
    id: 'open',
    topic: 'Open and verifiable',
    label: 'Live',
    may: 'Public repository under MIT or Apache-2.0, with CI anyone can inspect.',
    mustNot: 'Reproducible builds or signed releases, until they exist.',
    evidence: ['LICENSE', '.github/workflows'],
  },
] as const satisfies readonly Claim[];

export type ClaimId = (typeof CLAIMS)[number]['id'];

export function claim(id: ClaimId): Claim {
  const c = (CLAIMS as readonly Claim[]).find((x) => x.id === id);
  if (!c) throw new Error(`No claims-register row "${id}"`);
  return c;
}

export const labelOf = (id: ClaimId): ClaimLabel => claim(id).label;

/**
 * Words and items that never appear on the landing, the brief or the record page's prose
 * (verdict and landing prompts, "Content rules" and "Standing constraints").
 */
export const BANNED = [
  /\bpartners?\b|\bpartnership\b/i,
  /\bofficial\b/i,
  /backed by/i,
  /\banonym/i,
  /un-?trace-?able|impossible to trace/i,
  /\baudited\b/i,
  /military[- ]grade|bank[- ]level|enterprise[- ]grade|unhackable/i,
  /revolution|unprecedented|in history/i,
  /millions of|trusted by/i,
  /production[- ]ready|fully decentrali[sz]ed/i,
  /\bairdrop|\bpresale\b/i,
] as const;
