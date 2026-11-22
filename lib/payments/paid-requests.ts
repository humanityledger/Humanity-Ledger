/**
 * lib/payments/paid-requests.ts: which payment requests this device has seen paid.
 *
 * A request card cannot read the rest of the conversation, so the payment card records the request
 * it pays (requestId) here when it is shown, and the payer records it when they pay. Kept in this
 * browser only (localStorage, ids only: no amounts, no addresses), at most MAX ids.
 */

const KEY = 'hl.payments.paidRequests.v1';
const MAX = 500;
const EVENT = 'hl:paid-requests';

function load(storage: Pick<Storage, 'getItem'> | null): string[] {
  try {
    const raw = storage?.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const browserStorage = (): Storage | null => (typeof localStorage === 'undefined' ? null : localStorage);

export function paidRequestIds(storage: Pick<Storage, 'getItem'> | null = browserStorage()): ReadonlySet<string> {
  return new Set(load(storage));
}

export function rememberPaidRequest(id: string, storage: Pick<Storage, 'getItem' | 'setItem'> | null = browserStorage()): void {
  if (!id) return;
  const list = load(storage);
  if (list.includes(id)) return;
  list.push(id);
  try {
    storage?.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* storage full or blocked: the card simply stays "open" */
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent(EVENT));
}

export function onPaidRequestsChange(fn: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
