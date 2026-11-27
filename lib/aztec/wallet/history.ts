/**
 * lib/aztec/wallet/history.ts
 *
 * The device's record of what this wallet did, kept in the browser only.
 *
 * Private transfers (sent and received) are rebuilt from the private Transfer
 * events the PXE decrypts, so they survive a device change. Shield, unshield
 * and faucet operations do not emit a private event, so they are recorded here
 * when this device sends them. Nothing in this file is sent to our server.
 */

import type { TokenKey } from './config';

export type ActivityKind = 'shield' | 'unshield' | 'send' | 'receive' | 'faucet' | 'deploy' | 'issue' | 'operator';
export type ActivityStatus = 'proving' | 'pending' | 'settled' | 'failed';

export interface Activity {
  id: string;
  kind: ActivityKind;
  token?: TokenKey;
  /** Base units, as a decimal string so it survives JSON. */
  amount?: string;
  counterparty?: string;
  txHash?: string;
  blockNumber?: number;
  status: ActivityStatus;
  error?: string;
  createdAt: number;
}

const KEY = (aztecAddress: string) => `hl_aztec_activity_v1_${aztecAddress.toLowerCase()}`;
const MAX = 200;

export function loadLocalActivity(aztecAddress: string): Activity[] {
  try {
    const raw = window.localStorage.getItem(KEY(aztecAddress));
    return raw ? (JSON.parse(raw) as Activity[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalActivity(aztecAddress: string, items: Activity[]) {
  try {
    window.localStorage.setItem(KEY(aztecAddress), JSON.stringify(items.slice(0, MAX)));
  } catch {
    // Storage full or blocked: history is a convenience, never a source of truth.
  }
}

export function upsertActivity(aztecAddress: string, item: Activity): Activity[] {
  const items = loadLocalActivity(aztecAddress);
  const i = items.findIndex((x) => x.id === item.id);
  if (i >= 0) items[i] = { ...items[i], ...item };
  else items.unshift(item);
  saveLocalActivity(aztecAddress, items);
  return items;
}

/** Merge local records with event-derived ones, newest first, without duplicates. */
export function mergeActivity(local: Activity[], fromEvents: Activity[]): Activity[] {
  const byTx = new Map<string, Activity>();
  const out: Activity[] = [];
  for (const a of local) {
    out.push(a);
    if (a.txHash) byTx.set(`${a.txHash}:${a.kind}`, a);
  }
  for (const e of fromEvents) {
    const k = `${e.txHash}:${e.kind}`;
    const existing = e.txHash ? byTx.get(k) : undefined;
    if (existing) {
      existing.status = 'settled';
      existing.blockNumber = existing.blockNumber ?? e.blockNumber;
      continue;
    }
    out.push(e);
  }
  return out.sort((a, b) => (b.blockNumber ?? Number.MAX_SAFE_INTEGER) - (a.blockNumber ?? Number.MAX_SAFE_INTEGER) || b.createdAt - a.createdAt);
}

/**
 * A-06 (docs/AZTEC_ALIGNMENT_AUDIT.md): the aztec-standards Token (cUSDC) delivers the recipient's
 * note but emits no private event, so an incoming payment shows in the balance and not in the
 * activity list. Comparing two balance reads closes that gap honestly: a rise in the private
 * balance that this device did not cause becomes one "receive" entry, labelled as detected from
 * the balance (no sender, no transaction hash: the wallet does not know them).
 *
 * `expected` is what this device itself moved in the meantime (its own shields, for example), so
 * those are not counted as received. Pure: the caller stores the result with upsertActivity.
 */
export function detectNoteReceipts(
  prev: ReadonlyArray<{ key: TokenKey; privateUnits: bigint }>,
  next: ReadonlyArray<{ key: TokenKey; privateUnits: bigint }>,
  opts: { emitsEvents: (key: TokenKey) => boolean; expected?: Partial<Record<string, bigint>>; now?: number },
): Activity[] {
  const before = new Map(prev.map((b) => [b.key, b.privateUnits]));
  const out: Activity[] = [];
  const now = opts.now ?? Date.now();
  for (const b of next) {
    if (opts.emitsEvents(b.key)) continue;
    const was = before.get(b.key);
    if (was === undefined) continue;
    const rise = b.privateUnits - was - (opts.expected?.[b.key] ?? 0n);
    if (rise <= 0n) continue;
    out.push({ id: `note-sync:${b.key}:${now}`, kind: 'receive', token: b.key, amount: rise.toString(), status: 'settled', createdAt: now });
  }
  return out;
}

/** The label the activity list shows for an entry made by detectNoteReceipts. */
export const NOTE_SYNC_LABEL = 'Received (detected from your private balance)';
export function isNoteSyncActivity(a: Pick<Activity, 'id'>): boolean {
  return a.id.startsWith('note-sync:');
}
