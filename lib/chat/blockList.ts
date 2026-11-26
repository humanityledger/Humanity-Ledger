// The single block list. It lives in the encrypted vault under
// `ledger_blocked`; the chat reads it to drop messages, calls and
// notifications from blocked wallets, and the settings screen edits it.
// An older build kept a second, unenforced list in localStorage
// (`ledger_blocked_users`); it is merged in once and then removed.

import { vault } from '@/lib/core/SecureVault';

export const BLOCK_LIST_KEY = 'ledger_blocked';
export const LEGACY_BLOCK_LIST_KEY = 'ledger_blocked_users';
export const BLOCK_LIST_EVENT = 'ledger_blocklist_changed';

export function normalizeBlockList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const v of input) {
    if (typeof v !== 'string') continue;
    const s = v.trim().toLowerCase();
    if (s) out.add(s);
  }
  return Array.from(out);
}

function parse(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return normalizeBlockList(JSON.parse(raw)); } catch { return []; }
}

/** Older wallet builds kept per-account lists under `ledger_blocklist_<account>`. */
export const WALLET_LEGACY_PREFIX = 'ledger_blocklist_';

function legacyKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (k === LEGACY_BLOCK_LIST_KEY || k.startsWith(WALLET_LEGACY_PREFIX)) out.push(k);
    }
  } catch {}
  return out;
}

export async function loadBlockList(): Promise<string[]> {
  const current = parse(await vault.getItem(BLOCK_LIST_KEY).catch(() => null));
  const keys = legacyKeys();
  if (keys.length === 0) return current;
  let legacy: string[] = [];
  for (const k of keys) { try { legacy = legacy.concat(parse(localStorage.getItem(k))); } catch {} }
  const merged = normalizeBlockList([...current, ...legacy]);
  // Only drop the old keys once the merged list is safely in the vault.
  const saved = await vault.setItem(BLOCK_LIST_KEY, JSON.stringify(merged)).then(() => true, () => false);
  if (saved) for (const k of keys) { try { localStorage.removeItem(k); } catch {} }
  return merged;
}

export async function isPeerBlocked(peer: string): Promise<boolean> {
  return (await loadBlockList()).includes(peer.trim().toLowerCase());
}

export async function saveBlockList(list: string[]): Promise<string[]> {
  const clean = normalizeBlockList(list);
  await vault.setItem(BLOCK_LIST_KEY, JSON.stringify(clean));
  try { window.dispatchEvent(new CustomEvent(BLOCK_LIST_EVENT, { detail: { blocked: clean } })); } catch {}
  return clean;
}

export async function setBlocked(peer: string, blocked: boolean): Promise<string[]> {
  const list = new Set(await loadBlockList());
  const p = peer.trim().toLowerCase();
  if (blocked) list.add(p); else list.delete(p);
  return saveBlockList(Array.from(list));
}
