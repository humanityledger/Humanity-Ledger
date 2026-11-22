/**
 * lib/payments/incoming.ts: which incoming private payments the person has not been told about yet.
 *
 * The private wallet rebuilds received transfers from the private events it decrypts
 * (lib/aztec/wallet/history.ts). A notice is raised only for a settled 'receive' this device has
 * not announced before. The first time a wallet is seen on this device, everything already in its
 * history is marked as announced without a notice, so opening the app never floods old payments.
 * Kept in this browser only: activity ids, never amounts or addresses.
 */

export interface ActivityLike {
  id: string;
  kind: string;
  status: string;
  token?: string;
  amount?: string;
}

const KEY = (aztecAddress: string) => `hl.payments.announced.v1.${aztecAddress.toLowerCase()}`;
const MAX = 500;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function load(store: Store | null, aztecAddress: string): string[] | null {
  try {
    const raw = store?.getItem(KEY(aztecAddress));
    if (raw === null || raw === undefined) return null;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function save(store: Store | null, aztecAddress: string, ids: string[]): void {
  try {
    store?.setItem(KEY(aztecAddress), JSON.stringify(ids.slice(-MAX)));
  } catch {
    /* storage blocked: notices may repeat after a reload, never lost */
  }
}

/**
 * The settled incoming payments to announce now, and records them as announced. On the first call
 * for a wallet it records the whole history and announces nothing.
 */
export function takeNewIncoming(aztecAddress: string, activity: readonly ActivityLike[], store: Store | null): ActivityLike[] {
  const received = activity.filter((a) => a.kind === 'receive' && a.status === 'settled' && typeof a.id === 'string' && a.id);
  const known = load(store, aztecAddress);
  if (known === null) {
    save(store, aztecAddress, received.map((a) => a.id));
    return [];
  }
  const seen = new Set(known);
  const fresh = received.filter((a) => !seen.has(a.id));
  if (fresh.length) save(store, aztecAddress, [...known, ...fresh.map((a) => a.id)]);
  return fresh;
}

/** The in-app words. The system notification never carries the amount (it may show on a lock screen). */
export function incomingWords(amountText: string | null): { toast: string; system: string } {
  return {
    toast: amountText ? `You received ${amountText} privately.` : 'You received a private payment.',
    system: 'You received a private payment.',
  };
}
