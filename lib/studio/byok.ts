/**
 * Bring your own key, browser side. The key is kept in this browser only (localStorage) and sent
 * as request headers with Studio chat requests; lib/studio/client.ts byokFromHeaders accepts only
 * known providers and never stores or logs it.
 */
export interface ByokSetting { provider: string; key: string }

const STORAGE_KEY = 'ledger_studio_byok';

export function readByok(): ByokSetting | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return v && typeof v.provider === 'string' && typeof v.key === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function writeByok(v: ByokSetting | null): void {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: nothing saved */
  }
}

/** Headers for a Studio chat request: empty when no key is set. */
export function byokHeaders(): Record<string, string> {
  const v = readByok();
  return v ? { 'x-studio-provider': v.provider, 'x-studio-provider-key': v.key } : {};
}
