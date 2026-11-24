/**
 * lib/chat/verified-contacts.ts — "Verify" for a conversation, the Signal way.
 *
 * Two people compare their safety number (lib/chat/safety-glyphs.ts safetyDigits: both XMTP inboxes
 * and every device on them) in person or on a call. When it matches, either marks the contact as
 * verified on their own device. The number they verified is kept here; if it later changes (a
 * device was added or removed on either side), the contact shows "Safety number changed" until
 * they compare again. Kept in this browser only; nothing is sent.
 */

export const VERIFIED_KEY = 'hl.chat.verified.v1';
export const VERIFIED_EVENT = 'hl:verified-contacts';

export type VerifyState = 'unverified' | 'verified' | 'changed';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const browserStore = (): Store | undefined => (typeof window === 'undefined' ? undefined : window.localStorage);

function load(store: Store | undefined): Record<string, string> {
  try {
    const j = JSON.parse(store?.getItem(VERIFIED_KEY) ?? '{}');
    return j && typeof j === 'object' ? (j as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const key = (peer: string) => peer.trim().toLowerCase();

/** The state of a contact given the safety number shown now (null when it cannot be computed yet). */
export function verifyState(peer: string, current: string | null, store: Store | undefined = browserStore()): VerifyState {
  const saved = load(store)[key(peer)];
  if (!saved) return 'unverified';
  if (!current) return 'verified';
  return saved === current ? 'verified' : 'changed';
}

/** Whether the person ever marked this contact verified (before the current number is known). */
export function wasVerified(peer: string, store: Store | undefined = browserStore()): boolean {
  return !!load(store)[key(peer)];
}

export function markVerified(peer: string, digits: string, store: Store | undefined = browserStore()): void {
  if (!/^(\d{5} ){11}\d{5}$/.test(digits)) throw new Error('Not a safety number.');
  const all = load(store);
  all[key(peer)] = digits;
  store?.setItem(VERIFIED_KEY, JSON.stringify(all));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(VERIFIED_EVENT));
}

export function clearVerified(peer: string, store: Store | undefined = browserStore()): void {
  const all = load(store);
  delete all[key(peer)];
  store?.setItem(VERIFIED_KEY, JSON.stringify(all));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(VERIFIED_EVENT));
}
