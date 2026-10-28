/**
 * lib/sync/bus.ts
 *
 * A tiny in-page event bus so modules that change synced state (the settings
 * engine, for one) can announce it without importing the sync runtime, which
 * would create an import cycle.
 */

export type SettingsChange = { account: string; changes: Record<string, unknown> };

const settingsListeners = new Set<(c: SettingsChange) => void>();

/** Called by the settings engine after a change made on THIS device. */
export function announceLocalSettingsChange(account: string, changes: Record<string, unknown>): void {
  for (const fn of settingsListeners) {
    try { fn({ account: account.toLowerCase(), changes }); } catch { /* ignore */ }
  }
}

export function onLocalSettingsChange(fn: (c: SettingsChange) => void): () => void {
  settingsListeners.add(fn);
  return () => settingsListeners.delete(fn);
}
