/**
 * lib/aztec/agreement-message.ts
 *
 * Recognising Ledger Chat's agreement messages in a conversation, cheaply
 * and without trusting them: an escrow invitation, a stream invitation, or
 * an Aztec address announcement. Recognising is not verifying; a card built
 * from one of these still goes through verifyAgreementInvite or
 * recordPeerAnnouncement before anything is registered or pinned.
 *
 * Invitations carry the contract secret and, for an escrow, the claim
 * secret. They must never be shown as text, put in a conversation preview
 * or a notification, logged, or written to an outbox in plain storage:
 * agreementPreview gives the words to show instead.
 */

export type AgreementMessageKind = 'escrow' | 'stream' | 'address';

const TYPES: Record<string, AgreementMessageKind> = {
  'hl.escrow_invite': 'escrow',
  'hl.stream_invite': 'stream',
  'hl.aztec_address': 'address',
};

/** Largest message considered (an invitation is about 1 KB; MAX_INVITE_BYTES is 4096). */
const MAX_BYTES = 4096;

/** The kind of agreement message, or null for anything else. Never throws. */
export function agreementMessageKind(content: unknown): AgreementMessageKind | null {
  if (typeof content !== 'string' || content.length > MAX_BYTES) return null;
  const s = content.trimStart();
  if (!s.startsWith('{"type":"hl.')) return null;
  try {
    const t = (JSON.parse(s) as { type?: unknown })?.type;
    return typeof t === 'string' && t in TYPES ? TYPES[t] : null;
  } catch {
    return null;
  }
}

export function isAgreementMessage(content: unknown): boolean {
  return agreementMessageKind(content) !== null;
}

/** Words for previews and notifications; never the message itself. */
export function agreementPreview(kind: AgreementMessageKind): string {
  if (kind === 'escrow') return 'Private escrow';
  if (kind === 'stream') return 'Private payment stream';
  return 'Shared an Aztec address';
}

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const DEC = /^[0-9]{1,39}$/;

/** What a card may show about an invitation: no secrets. */
export interface AgreementSummary {
  kind: 'escrow' | 'stream';
  instanceAddress: string;
  sender: string;
  recipient: string;
  token: string;
  tokenSymbol: string;
  /** Escrow amount or stream total, base units. */
  amount: bigint;
  /** Escrow only: unix seconds. */
  deadline?: number;
  /** Stream only: base units per second and unix start. */
  rate?: bigint;
  start?: number;
}

/**
 * Reads the public fields of an invitation for display, without the
 * secrets and without verifying anything. Null when it is not a well-formed
 * invitation. Never throws.
 */
export function summarizeInvite(raw: string): AgreementSummary | null {
  const kind = agreementMessageKind(raw);
  if (kind !== 'escrow' && kind !== 'stream') return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const str = (k: string) => (typeof j[k] === 'string' ? (j[k] as string) : '');
    for (const k of ['instanceAddress', 'sender', 'recipient', 'token']) if (!HEX32.test(str(k))) return null;
    const amountRaw = kind === 'escrow' ? str('amount') : str('total');
    if (!DEC.test(amountRaw)) return null;
    const symbol = str('tokenSymbol').slice(0, 12);
    const base = { instanceAddress: str('instanceAddress'), sender: str('sender'), recipient: str('recipient'), token: str('token'), tokenSymbol: symbol, amount: BigInt(amountRaw) };
    if (kind === 'escrow') {
      const deadline = Number(j.deadline);
      return Number.isInteger(deadline) && deadline > 0 ? { kind, ...base, deadline } : null;
    }
    const start = Number(j.start);
    if (!DEC.test(str('rate')) || !Number.isInteger(start)) return null;
    return { kind, ...base, rate: BigInt(str('rate')), start };
  } catch {
    return null;
  }
}
