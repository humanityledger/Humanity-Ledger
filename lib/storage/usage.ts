/**
 * Storage numbers for Settings → Storage, measured off the render path.
 * - origin: what the browser counts for this site (IndexedDB, OPFS, caches,
 *   local storage), from navigator.storage.estimate();
 * - local: Ledger Chat keys in localStorage (UTF-16, 2 bytes per char);
 * - media: data: URLs cached in localStorage (avatars, previews).
 * Scans yield to the main thread every 200 keys so a big profile never janks.
 */
export interface StorageUsage {
  originBytes: number | null;
  quotaBytes: number | null;
  localBytes: number;
  localCount: number;
  mediaBytes: number;
  mediaCount: number;
}

const yieldToMain = () => new Promise<void>(r => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r()) : setTimeout(r, 0)));

export async function measureStorage(): Promise<StorageUsage> {
  const out: StorageUsage = { originBytes: null, quotaBytes: null, localBytes: 0, localCount: 0, mediaBytes: 0, mediaCount: 0 };
  try {
    const est = await navigator.storage?.estimate?.();
    if (est) { out.originBytes = est.usage ?? null; out.quotaBytes = est.quota ?? null; }
  } catch {}
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) keys.push(k); }
    for (let i = 0; i < keys.length; i++) {
      if (i % 200 === 199) await yieldToMain();
      const k = keys[i];
      if (!k.startsWith('ledger_') && !k.startsWith('peer_profile_')) continue;
      const v = localStorage.getItem(k) || '';
      out.localBytes += (k.length + v.length) * 2;
      out.localCount++;
      if (v.startsWith('data:')) { out.mediaBytes += Math.round(v.length * 0.75); out.mediaCount++; }
    }
  } catch {}
  return out;
}

/** Removes cached media (data: URLs) from localStorage. Returns how many were removed. */
export function purgeCachedMedia(): number {
  let n = 0;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !(k.startsWith('ledger_') || k.startsWith('peer_profile_'))) continue;
      if ((localStorage.getItem(k) || '').startsWith('data:')) { localStorage.removeItem(k); n++; }
    }
  } catch {}
  return n;
}

export function formatBytes(b: number | null): { value: string; unit: 'KB' | 'MB' | 'GB' } {
  const n = Math.max(0, b ?? 0);
  if (n >= 1024 ** 3) return { value: (n / 1024 ** 3).toFixed(2), unit: 'GB' };
  if (n >= 100 * 1024) return { value: (n / 1024 ** 2).toFixed(2), unit: 'MB' };
  return { value: (n / 1024).toFixed(1), unit: 'KB' };
}
