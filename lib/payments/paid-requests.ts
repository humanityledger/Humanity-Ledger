/**
 * lib/payments/paid-requests.ts: which payment requests this device has paid, and with which
 * transaction, kept in localStorage (no server copy).
 *
 * A request counts as paid while its payment has not failed in this device's own wallet activity:
 * a payment that is dropped or reverted reopens the request, so it can be paid again. Entries
 * written before the transaction was kept (v1, ids only) stay paid.
 */
const KEY = 'hl.payments.paidRequests.v2';
const LEGACY_KEY = 'hl.payments.paidRequests.v1';
const MAX = 500;
const EVENT = 'hl:paid-requests';

type Entry = { id: string; txHash: string | null };
type Activity = { kind: string; txHash?: string; status: string };

function load(storage: Pick<Storage, 'getItem'> | null): Entry[] {
  const out: Entry[] = [];
  try {
    const legacy = JSON.parse(storage?.getItem(LEGACY_KEY) || '[]');
    if (Array.isArray(legacy)) for (const id of legacy) if (typeof id === 'string') out.push({ id, txHash: null });
  } catch {
    /* unreadable: ignored */
  }
  try {
    const list = JSON.parse(storage?.getItem(KEY) || '[]');
    if (Array.isArray(list)) {
      for (const e of list) {
        if (e && typeof e.id === 'string') out.push({ id: e.id, txHash: typeof e.txHash === 'string' ? e.txHash.toLowerCase() : null });
      }
    }
  } catch {
    /* unreadable: ignored */
  }
  return out;
}

const browserStorage = (): Storage | null => (typeof localStorage === 'undefined' ? null : localStorage);

/** Requests whose own payment failed in this wallet's activity (the latest payment for each id). */
export function failedRequestIds(activity: readonly Activity[], storage: Pick<Storage, 'getItem'> | null = browserStorage()): ReadonlySet<string> {
  const failed = new Set(activity.filter((a) => a.kind === 'send' && a.status === 'failed' && a.txHash).map((a) => a.txHash!.toLowerCase()));
  const latest = new Map<string, string | null>();
  for (const e of load(storage)) latest.set(e.id, e.txHash);
  const out = new Set<string>();
  for (const [id, tx] of latest) if (tx && failed.has(tx)) out.add(id);
  return out;
}

/** Requests paid from this device, minus those whose latest payment failed. */
export function paidRequestIds(storage: Pick<Storage, 'getItem'> | null = browserStorage(), activity: readonly Activity[] = []): ReadonlySet<string> {
  const failed = failedRequestIds(activity, storage);
  return new Set(load(storage).map((e) => e.id).filter((id) => !failed.has(id)));
}

export function rememberPaidRequest(id: string, txHash: string | null = null, storage: Pick<Storage, 'getItem' | 'setItem'> | null = browserStorage()): void {
  if (!id) return;
  let list: Entry[] = [];
  try {
    const raw = JSON.parse(storage?.getItem(KEY) || '[]');
    list = Array.isArray(raw) ? raw.filter((e) => e && typeof e.id === 'string') : [];
  } catch {
    list = [];
  }
  list = list.filter((e) => e.id !== id);
  list.push({ id, txHash: txHash ? txHash.toLowerCase() : null });
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
