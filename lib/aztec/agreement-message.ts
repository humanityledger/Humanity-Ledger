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
