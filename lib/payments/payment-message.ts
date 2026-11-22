/**
 * lib/payments/payment-message.ts: the structured messages a private payment posts in a chat.
 *
 *   hl.payment          posted by the payer after the wallet accepted the transaction
 *     { type, version: 1, id, network, token: { symbol, address }, txHash, sender?, requestId? }
 *   hl.payment_request  posted by the person asking to be paid
 *     { type, version: 1, id, network, token: { symbol, address }, amount, memo?, expiresAt }
 *
 * A payment message never carries the amount: the payer's card reads it from the payer's own
 * wallet history, and the receiver's card shows "Received" only once the receiver's own wallet has
 * found a transfer with that transaction hash. A message can claim anything; the card trusts only
 * the wallet. A request carries the amount asked for, which is what the payer is shown and may pay.
 *
 * Recognised as opaque messages by lib/aztec/agreement-message.ts, so the chat sends them exactly as
 * built (no reply wrapper, no text transform, no disappearing timer) and previews them as words.
 */

export const PAYMENT_TYPE = 'hl.payment';
export const REQUEST_TYPE = 'hl.payment_request';

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const DEC = /^[0-9]{1,39}$/;
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const SYMBOL = /^[A-Za-z0-9.]{1,12}$/;
/** Largest structured message read (a request with a memo is well under 1 KB). */
const MAX_BYTES = 2048;
export const MAX_MEMO = 140;
/** A request is valid for at most 30 days. */
export const MAX_REQUEST_MS = 30 * 86400_000;

export type PaymentNetwork = 'mainnet' | 'testnet';

export interface PaymentToken {
  symbol: string;
  address: string;
}

export interface PaymentMessage {
  type: typeof PAYMENT_TYPE;
  version: 1;
  id: string;
  network: PaymentNetwork;
  token: PaymentToken;
  txHash: string;
  /** The payer's Aztec address, so a wallet opened before the chat pinned it can still find the payment. */
  sender?: string;
  /** The request this pays, if any. */
  requestId?: string;
}

export interface PaymentRequestMessage {
  type: typeof REQUEST_TYPE;
  version: 1;
  id: string;
  network: PaymentNetwork;
  token: PaymentToken;
  /** Base units, decimal string. */
  amount: string;
  memo?: string;
  /** ISO date-time. */
  expiresAt: string;
}

function readJson(content: unknown): Record<string, unknown> | null {
  if (typeof content !== 'string' || content.length > MAX_BYTES) return null;
  const s = content.trimStart();
  if (!s.startsWith('{"type":"hl.payment')) return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readToken(v: unknown): PaymentToken | null {
  const t = v as { symbol?: unknown; address?: unknown } | null;
  if (!t || typeof t.symbol !== 'string' || typeof t.address !== 'string') return null;
  if (!SYMBOL.test(t.symbol) || !HEX32.test(t.address)) return null;
  return { symbol: t.symbol, address: t.address.toLowerCase() };
}

const network = (v: unknown): PaymentNetwork | null => (v === 'mainnet' || v === 'testnet' ? v : null);

export function parsePaymentMessage(content: unknown): PaymentMessage | null {
  const o = readJson(content);
  if (!o || o.type !== PAYMENT_TYPE || o.version !== 1) return null;
  const net = network(o.network);
  const token = readToken(o.token);
  if (!net || !token || typeof o.id !== 'string' || !ID.test(o.id) || typeof o.txHash !== 'string' || !HEX32.test(o.txHash)) return null;
  const out: PaymentMessage = { type: PAYMENT_TYPE, version: 1, id: o.id, network: net, token, txHash: o.txHash.toLowerCase() };
  if (typeof o.sender === 'string' && HEX32.test(o.sender)) out.sender = o.sender.toLowerCase();
  if (typeof o.requestId === 'string' && ID.test(o.requestId)) out.requestId = o.requestId;
  return out;
}

export function parsePaymentRequest(content: unknown): PaymentRequestMessage | null {
  const o = readJson(content);
  if (!o || o.type !== REQUEST_TYPE || o.version !== 1) return null;
  const net = network(o.network);
  const token = readToken(o.token);
  if (!net || !token || typeof o.id !== 'string' || !ID.test(o.id)) return null;
  if (typeof o.amount !== 'string' || !DEC.test(o.amount) || BigInt(o.amount) <= 0n) return null;
  if (typeof o.expiresAt !== 'string' || !Number.isFinite(Date.parse(o.expiresAt))) return null;
  const out: PaymentRequestMessage = { type: REQUEST_TYPE, version: 1, id: o.id, network: net, token, amount: o.amount, expiresAt: new Date(Date.parse(o.expiresAt)).toISOString() };
  if (typeof o.memo === 'string' && o.memo.trim()) out.memo = o.memo.trim().slice(0, MAX_MEMO);
  return out;
}

/** A random id for a message (no meaning, no tracking). */
export function newMessageId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(random(12), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The exact text the payer posts. Key order is fixed so the chat recognises it ('{"type":"hl.payment"'). */
export function buildPaymentMessage(p: { network: PaymentNetwork; token: PaymentToken; txHash: string; sender?: string; requestId?: string; id?: string }): string {
  const msg: PaymentMessage = {
    type: PAYMENT_TYPE,
    version: 1,
    id: p.id ?? newMessageId(),
    network: p.network,
    token: { symbol: p.token.symbol, address: p.token.address.toLowerCase() },
    txHash: p.txHash.toLowerCase(),
  };
  if (p.sender) msg.sender = p.sender.toLowerCase();
  if (p.requestId) msg.requestId = p.requestId;
  const text = JSON.stringify(msg);
  if (!parsePaymentMessage(text)) throw new Error('The payment message could not be built.');
  return text;
}

export function buildPaymentRequest(p: { network: PaymentNetwork; token: PaymentToken; amount: bigint; memo?: string; validForMs: number; now?: number; id?: string }): string {
  if (p.amount <= 0n) throw new Error('Ask for an amount above zero.');
  const ms = Math.min(Math.max(p.validForMs, 60_000), MAX_REQUEST_MS);
  const msg: PaymentRequestMessage = {
    type: REQUEST_TYPE,
    version: 1,
    id: p.id ?? newMessageId(),
    network: p.network,
    token: { symbol: p.token.symbol, address: p.token.address.toLowerCase() },
    amount: p.amount.toString(),
    expiresAt: new Date((p.now ?? Date.now()) + ms).toISOString(),
  };
  const memo = p.memo?.trim().slice(0, MAX_MEMO);
  if (memo) msg.memo = memo;
  const text = JSON.stringify(msg);
  if (!parsePaymentRequest(text)) throw new Error('The payment request could not be built.');
  return text;
}

export type PaymentCardState =
  | { kind: 'sending' }
  | { kind: 'sent'; amount?: string }
  | { kind: 'confirmed'; amount?: string }
  | { kind: 'failed'; error?: string }
  | { kind: 'received'; amount?: string }
  | { kind: 'awaiting'; walletOpen: boolean }
  | { kind: 'wrongNetwork' };

/** What the card says, from the message and this device's own wallet history only. */
export function paymentCardState(
  msg: PaymentMessage,
  p: { isMe: boolean; network: PaymentNetwork; walletOpen: boolean; activity: { kind: string; txHash?: string; status: string; amount?: string; error?: string }[] },
): PaymentCardState {
  if (msg.network !== p.network) return { kind: 'wrongNetwork' };
  const tx = msg.txHash.toLowerCase();
  const mine = p.activity.filter((a) => (a.txHash ?? '').toLowerCase() === tx);
  if (p.isMe) {
    const sent = mine.find((a) => a.kind === 'send');
    if (!sent) return { kind: 'sent' };
    if (sent.status === 'failed') return { kind: 'failed', error: sent.error };
    if (sent.status === 'settled') return { kind: 'confirmed', amount: sent.amount };
    if (sent.status === 'proving') return { kind: 'sending' };
    return { kind: 'sent', amount: sent.amount };
  }
  const received = mine.find((a) => a.kind === 'receive' && a.status === 'settled');
  if (received) return { kind: 'received', amount: received.amount };
  return { kind: 'awaiting', walletOpen: p.walletOpen };
}

export type RequestCardState = { kind: 'open' } | { kind: 'expired' } | { kind: 'paid' } | { kind: 'wrongNetwork' };

/** A request is paid once a payment message in the same chat names it. Expired requests cannot be paid. */
export function requestCardState(req: PaymentRequestMessage, p: { network: PaymentNetwork; now: number; paidRequestIds: ReadonlySet<string> }): RequestCardState {
  if (req.network !== p.network) return { kind: 'wrongNetwork' };
  if (p.paidRequestIds.has(req.id)) return { kind: 'paid' };
  if (p.now >= Date.parse(req.expiresAt)) return { kind: 'expired' };
  return { kind: 'open' };
}
