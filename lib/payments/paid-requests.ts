/**
 * lib/payments/paid-requests.ts: which payment requests are paid, kept in localStorage on this
 * device (no server copy).
 *
 * Two kinds of record, because a chat message proves nothing by itself:
 *  - `me`: this device paid the request. It counts as paid unless that payment failed in this
 *    wallet's own activity; then the request opens again and can be paid again.
 *  - `peer`: the other person posted a payment that names the request. It counts as paid only when
 *    this wallet has found a settled receive with that transaction hash, in the requested token and
 *    for at least the requested amount. A message alone, a smaller payment or another token never
 *    marks a request paid.
 * Records written before the transaction was kept (v1, ids only) stay paid, so nobody pays twice.
 */
const KEY = 'hl.payments.paidRequests.v3';
const KEY_V2 = 'hl.payments.paidRequests.v2';
const LEGACY_KEY = 'hl.payments.paidRequests.v1';
const MAX = 500;
const EVENT = 'hl:paid-requests';

export type PaidBy = 'me' | 'peer';
type Entry = { id: string; txHash: string | null; by: PaidBy | 'legacy' };
type Activity = { kind: string; txHash?: string; status: string; token?: string; amount?: string };
type Read = Pick<Storage, 'getItem'> | null;

function parse(storage: Read, key: string): unknown[] {
  try {
    const v = JSON.parse(storage?.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function load(storage: Read): Entry[] {
  const out: Entry[] = [];
  for (const id of parse(storage, LEGACY_KEY)) if (typeof id === 'string') out.push({ id, txHash: null, by: 'legacy' });
  // v2 kept only this device's own payments.
  for (const e of parse(storage, KEY_V2) as { id?: unknown; txHash?: unknown }[]) {
    if (e && typeof e.id === 'string') out.push({ id: e.id, txHash: typeof e.txHash === 'string' ? e.txHash.toLowerCase() : null, by: 'me' });
  }
  for (const e of parse(storage, KEY) as { id?: unknown; txHash?: unknown; by?: unknown }[]) {
    if (e && typeof e.id === 'string' && (e.by === 'me' || e.by === 'peer')) {
      out.push({ id: e.id, txHash: typeof e.txHash === 'string' ? e.txHash.toLowerCase() : null, by: e.by });
    }
  }
  return out;
}

const browserStorage = (): Storage | null => (typeof localStorage === 'undefined' ? null : localStorage);

export type Settlement = 'paid' | 'failed' | 'announced' | null;

/**
 * The state of one request on this device. `req.tokenKey` is this wallet's key for the requested
 * token (null when the wallet does not list it); `req.amount` is in base units.
 */
export function requestSettlement(
  req: { id: string; amount: string; tokenKey: string | null },
  activity: readonly Activity[],
  storage: Read = browserStorage(),
): Settlement {
  const entries = load(storage).filter((e) => e.id === req.id);
  if (!entries.length) return null;
  if (entries.some((e) => e.by === 'legacy')) return 'paid';
  const tx = (a: Activity) => (a.txHash ?? '').toLowerCase();
  const mine = entries.filter((e) => e.by === 'me');
  const lastMine = mine[mine.length - 1];
  if (lastMine) {
    const failed = !!lastMine.txHash && activity.some((a) => a.kind === 'send' && a.status === 'failed' && tx(a) === lastMine.txHash);
    if (!failed) return 'paid';
  }
  let want: bigint | null = null;
  try {
    want = BigInt(req.amount);
  } catch {
    want = null;
  }
  const announced = new Set(entries.filter((e) => e.by === 'peer' && e.txHash).map((e) => e.txHash!));
  const received = activity.some((a) => {
    if (a.kind !== 'receive' || a.status !== 'settled' || !announced.has(tx(a))) return false;
    if (!req.tokenKey || a.token !== req.tokenKey || want === null) return false;
    try {
      return BigInt(a.amount ?? '0') >= want;
    } catch {
      return false;
    }
  });
  if (received) return 'paid';
  if (lastMine) return 'failed';
  return announced.size ? 'announced' : null;
}

/** Ids of requests this device paid (legacy and own records), minus those whose latest own payment failed. */
export function paidRequestIds(storage: Read = browserStorage(), activity: readonly Activity[] = []): ReadonlySet<string> {
  const ids = new Set(load(storage).filter((e) => e.by !== 'peer').map((e) => e.id));
  return new Set([...ids].filter((id) => requestSettlement({ id, amount: '0', tokenKey: null }, activity, storage) === 'paid'));
}

export function rememberPaidRequest(
  id: string,
  txHash: string | null = null,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = browserStorage(),
  by: PaidBy = 'me',
): void {
  if (!id) return;
  const tx = txHash ? txHash.toLowerCase() : null;
  let list = (parse(storage, KEY) as Entry[]).filter((e) => e && typeof e.id === 'string');
  if (list.some((e) => e.id === id && e.by === by && e.txHash === tx)) return;
  // One own record per request (the latest payment); every announced payment is kept.
  if (by === 'me') list = list.filter((e) => !(e.id === id && e.by === 'me'));
  list.push({ id, txHash: tx, by });
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
