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

export type ActivityKind = 'shield' | 'unshield' | 'send' | 'receive' | 'faucet' | 'deploy';
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
