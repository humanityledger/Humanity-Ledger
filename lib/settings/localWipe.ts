// "Delete all data": removes what Ledger Chat keeps on this device.
//
// Kept on purpose:
//  - ledger_xmtp_db_key_* and the XMTP database. Wiping them would register a
//    new XMTP installation on next sign-in, and an inbox has a hard cap on
//    installations. Messages live in the encrypted inbox either way.
//  - The vault master secret and wallet / Aztec material. Those hold funds;
//    this screen deletes chat data, not money.

import { vault } from '@/lib/core/SecureVault';

const KEEP_LOCAL_PREFIXES = ['ledger_xmtp_db_key_', 'ledger_xmtp', 'ledger_hw_session_token'];

export function shouldWipeLocalKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (KEEP_LOCAL_PREFIXES.some(p => lower.startsWith(p))) return false;
  if (lower.startsWith('ledger_')) return true;
  if (lower.startsWith('hl_devsync')) return true;
  return false;
}

type StorageLike = Pick<Storage, 'length' | 'key' | 'removeItem'>;

export function wipeLocalKeys(storage: StorageLike): number {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && shouldWipeLocalKey(k)) doomed.push(k);
  }
  doomed.forEach(k => { try { storage.removeItem(k); } catch {} });
  return doomed.length;
}

/** Vault entries are stored under hashed names, so they are removed by key. */
async function wipeVaultEntries(address: string): Promise<void> {
  const a = address.toLowerCase();
  try {
    const files = JSON.parse((await vault.getItem('ledger_vault_files')) || '[]');
    if (Array.isArray(files)) {
      for (const f of files) if (f && typeof f.id === 'string') vault.removeItem(`ledger_vault_data_${f.id}`);
    }
  } catch {}
  for (const k of [
    'ledger_vault_files', 'ledger_blocked', 'ledger_media_perm', 'ledger_eula_accepted',
    `ledger_vault_notes_${address}`, `ledger_vault_notes_${a}`,
    `pxe_settings_${address}`, `pxe_settings_${a}`,
  ]) vault.removeItem(k);
  vault.clearMemoryCache();
}

export async function wipeLocalChatData(address: string): Promise<void> {
  try {
    const { chatDB } = await import('@/lib/chat/indexeddb');
    await chatDB.clearAll();
  } catch {}
  // Ledger Studio's chats, projects, artifacts and connector tokens.
  try {
    const { deleteStudioData } = await import('@/lib/studio/store');
    await deleteStudioData(address);
  } catch {}
  await wipeVaultEntries(address);
  try { wipeLocalKeys(localStorage); } catch {}
  try { sessionStorage.clear(); } catch {}
}
