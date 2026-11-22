/**
 * lib/beta/gate.ts: the logic of /beta (components/beta/BetaGateView.tsx), kept pure so it is
 * tested without a browser: which screen to show, the four-block code input, and what each answer
 * of /api/beta/cusdc/redeem means for the person.
 */
import { BETA_REASONS, MAX_BETA_TESTERS } from './cusdc-beta';

export type GateStatus = {
  wallet?: string;
  open: boolean;
  reasons: string[];
  member: boolean;
  active: boolean;
  access: boolean;
  accessReasons: string[];
  visibility: 'send' | 'exits' | 'hidden';
  capacity: number;
  remaining?: number | null;
  notice: { version: string; text: string[] };
};

export type GateStage = 'loading' | 'signedOut' | 'unavailable' | 'member' | 'notice' | 'revoked' | 'waiting' | 'closed' | 'full' | 'join';

/** Which screen /beta shows. A member always sees their own state, even when the beta is full or paused. */
export function gateStage(s: GateStatus | null, flags: { signedOut?: boolean; failed?: boolean } = {}): GateStage {
  if (flags.signedOut) return 'signedOut';
  if (flags.failed) return 'unavailable';
  if (!s) return 'loading';
  if (s.member) {
    if (!s.active) return 'revoked';
    if (s.access) return 'member';
    return s.accessReasons.includes(BETA_REASONS.notice) ? 'notice' : 'waiting';
  }
  if (!s.open) return 'closed';
  if (s.remaining === 0) return 'full';
  return 'join';
}

const ALLOWED = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Typed or pasted text as code characters: upper case, look-alikes mapped (O→0, I and L→1), the rest dropped. */
export function codeChars(raw: string): string {
  let out = '';
  for (const ch of String(raw).toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')) if (ALLOWED.includes(ch)) out += ch;
  return out;
}

export type Blocks = [string, string, string, string];
export const EMPTY_BLOCKS: Blocks = ['', '', '', ''];

export function codeBlocks(chars: string): Blocks {
  const c = codeChars(chars).slice(0, 16);
  return [c.slice(0, 4), c.slice(4, 8), c.slice(8, 12), c.slice(12, 16)];
}

/**
 * New blocks after typing or pasting `value` into block `index`, and which block to focus. A full
 * code pasted anywhere fills all four; a longer value flows into the next blocks.
 */
export function applyBlockInput(blocks: Blocks, index: number, value: string): { blocks: Blocks; focus: number } {
  const typed = codeChars(value);
  if (typed.length >= 16) return { blocks: codeBlocks(typed), focus: 3 };
  if (typed.length <= 4) {
    const next = [...blocks] as Blocks;
    next[index] = typed;
    return { blocks: next, focus: typed.length === 4 && index < 3 ? index + 1 : index };
  }
  const head = blocks.slice(0, index).join('') + typed;
  return { blocks: codeBlocks(head + blocks.slice(index + 1).join('')), focus: Math.min(3, Math.floor(Math.min(head.length, 16) / 4)) };
}

export function isCompleteCode(blocks: Blocks): boolean {
  return blocks.every((b) => b.length === 4);
}

export function blocksToCode(blocks: Blocks): string {
  return blocks.join('-');
}

export function capacityPill(capacity: number = MAX_BETA_TESTERS, remaining?: number | null): string {
  const base = `Closed Beta • ${capacity} spots total`;
  return typeof remaining === 'number' ? `${base} • ${remaining} remaining` : base;
}

export function shortAddress(a: string | undefined): string {
  return a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? '';
}

export type RedeemView = { text: string; step: 'wallet' | 'code' | 'notice' | 'stay' };

/** What to tell the person after a failed redeem, and which step to send them back to. status null: no answer (network). */
export function redeemErrorView(status: number | null, body: unknown): RedeemView {
  const error = typeof (body as { error?: unknown } | null)?.error === 'string' ? (body as { error: string }).error : null;
  if (status === null) {
    return { text: 'Could not reach Ledger Chat. Check your connection and try again. Trying again with the same code is safe: if it already worked, you are shown as a member.', step: 'stay' };
  }
  if (status === 401) return { text: 'Your session ended. Sign in with your wallet again; your code was not used.', step: 'wallet' };
  if (status === 400 && error && /notice/i.test(error)) return { text: error, step: 'notice' };
  if (status === 400 || status === 403) return { text: error ?? 'This invitation code does not work.', step: 'code' };
  if (status === 409) return { text: error ?? 'The cUSDC beta is full.', step: 'stay' };
  if (status === 429) return { text: 'Too many attempts. Try again in an hour.', step: 'stay' };
  if (status === 503) return { text: error ?? 'The cUSDC beta is not open.', step: 'stay' };
  return { text: 'That did not work. Try again in a minute.', step: 'stay' };
}

/** The cUSDC line of Settings > Payments: a short value and one sentence, from the same status as /beta. */
export function betaSummary(s: GateStatus | null, flags: { applies: boolean; signedOut?: boolean; failed?: boolean }): { value: string; sub: string } {
  const invited = 'A closed beta for invited people. Payments and requests in cUSDC work only between members.';
  if (!flags.applies) return { value: 'Not open', sub: 'A closed beta for invited people. It is not open in this version of Ledger Chat.' };
  switch (gateStage(s, flags)) {
    case 'loading':
      return { value: '…', sub: invited };
    case 'member':
      return { value: 'Member', sub: 'You can send, receive and request cUSDC with other members, within the per-payment cap.' };
    case 'notice':
      return { value: 'Action needed', sub: 'The beta notice changed. Confirm it to keep using cUSDC.' };
    case 'waiting':
      return { value: 'Member', sub: s!.accessReasons[0] ?? 'cUSDC payments are paused for now.' };
    case 'revoked':
      return { value: 'Revoked', sub: 'Your cUSDC balance stays visible and you can still move your own funds out.' };
    case 'closed':
      return { value: 'Not open', sub: s!.reasons[0] ?? invited };
    case 'full':
      return { value: 'Full', sub: 'All places are taken.' };
    case 'join':
      return { value: 'Invitation only', sub: typeof s!.remaining === 'number' ? `${s!.remaining} of ${s!.capacity} places left. Join with your invitation code.` : 'Join with your invitation code.' };
    default:
      return { value: 'Invitation only', sub: invited };
  }
}
