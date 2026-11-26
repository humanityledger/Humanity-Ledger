import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sanitizeSyncedSettings } from '@/lib/settings/sanitize';

/**
 * The one server pipeline for a wallet's synced settings (UserSettings row).
 * Every route goes through sanitizeSyncedSettings (lib/settings/schema.ts
 * keys and types). `replace` is for the settings engine, which always sends
 * the full object; `merge` is for partial writers, which must never wipe keys
 * they do not know about (the old /api/settings replaced the whole row and
 * erased the chat's settings on every save).
 */
export type SyncedSettings = Record<string, string | number | boolean>;

function asRecord(v: Prisma.JsonValue | null | undefined): SyncedSettings {
  return v && typeof v === 'object' && !Array.isArray(v) ? sanitizeSyncedSettings(v) : {};
}

export async function readSettings(wallet: string): Promise<SyncedSettings> {
  const row = await prisma.userSettings.findUnique({ where: { walletAddress: wallet.toLowerCase() } });
  return asRecord(row?.settings);
}

export async function writeSettings(wallet: string, input: unknown, mode: 'replace' | 'merge'): Promise<SyncedSettings> {
  const w = wallet.toLowerCase();
  const clean = sanitizeSyncedSettings(input);
  const next = mode === 'merge' ? { ...(await readSettings(w)), ...clean } : clean;
  const row = await prisma.userSettings.upsert({
    where: { walletAddress: w },
    update: { settings: next, lastSyncedAt: new Date() },
    create: { walletAddress: w, settings: next, lastSyncedAt: new Date() },
  });
  return asRecord(row.settings);
}
