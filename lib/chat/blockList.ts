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

export async function loadBlockList(): Promise<string[]> {
  const current = parse(await vault.getItem(BLOCK_LIST_KEY).catch(() => null));
  let legacy: string[] = [];
  try { legacy = parse(localStorage.getItem(LEGACY_BLOCK_LIST_KEY)); } catch {}
  if (legacy.length === 0) return current;
  const merged = normalizeBlockList([...current, ...legacy]);
  await vault.setItem(BLOCK_LIST_KEY, JSON.stringify(merged)).catch(() => {});
  try { localStorage.removeItem(LEGACY_BLOCK_LIST_KEY); } catch {}
  return merged;
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
