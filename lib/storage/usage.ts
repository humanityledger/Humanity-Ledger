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
  /** By kind, as the browser reports it (Chromium's usageDetails; null elsewhere). */
  details: { indexedDB: number; caches: number; fileSystem: number; serviceWorker: number } | null;
  /** Message database files (XMTP keeps them in the origin private file system), exact sizes. */
  opfsFiles: { name: string; bytes: number }[];
  /** Entries in the offline app cache (Cache Storage), safe to clear. */
  cacheEntries: number;
}

const yieldToMain = () => new Promise<void>(r => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r()) : setTimeout(r, 0)));

export async function measureStorage(): Promise<StorageUsage> {
  const out: StorageUsage = { originBytes: null, quotaBytes: null, localBytes: 0, localCount: 0, mediaBytes: 0, mediaCount: 0, details: null, opfsFiles: [], cacheEntries: 0 };
  try {
    const est = await navigator.storage?.estimate?.();
    if (est) {
      out.originBytes = est.usage ?? null; out.quotaBytes = est.quota ?? null;
      const d = (est as { usageDetails?: Record<string, number> }).usageDetails;
      if (d) out.details = { indexedDB: d.indexedDB ?? 0, caches: d.caches ?? 0, fileSystem: d.fileSystem ?? 0, serviceWorker: d.serviceWorkerRegistrations ?? 0 };
    }
  } catch {}
  out.opfsFiles = await listOpfsFiles().catch(() => []);
  try {
    if (typeof caches !== 'undefined') for (const name of await caches.keys()) out.cacheEntries += (await (await caches.open(name)).keys()).length;
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

/**
 * Prover reference strings cached by bb.js (idb-keyval default store: 'keyval-store'/'keyval',
 * keys g1Data ~33 MB, g2Data, grumpkinG1DataV2). Removing them only costs a re-download on
 * the next private payment. Resolves the number of keys removed.
 */
export function purgeProverCrs(): Promise<number> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open('keyval-store');
      req.onerror = () => resolve(0);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('keyval')) { db.close(); return resolve(0); }
        const tx = db.transaction('keyval', 'readwrite');
        const store = tx.objectStore('keyval');
        const keys = ['g1Data', 'g2Data', 'grumpkinG1DataV2'];
        keys.forEach(k => store.delete(k));
        tx.oncomplete = () => { db.close(); resolve(keys.length); };
        tx.onerror = () => { db.close(); resolve(0); };
      };
    } catch { resolve(0); }
  });
}

/** Files in the origin private file system (top level and one folder deep), with exact sizes. */
export async function listOpfsFiles(): Promise<{ name: string; bytes: number }[]> {
  const root = await (navigator.storage as unknown as { getDirectory?: () => Promise<FileSystemDirectoryHandle> })?.getDirectory?.();
  if (!root) return [];
  const out: { name: string; bytes: number }[] = [];
  const walk = async (dir: FileSystemDirectoryHandle, prefix: string, depth: number) => {
    for await (const [name, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      if (h.kind === 'file') {
        try { out.push({ name: prefix + name, bytes: (await (h as FileSystemFileHandle).getFile()).size }); } catch { /* locked by a worker: skipped */ }
      } else if (depth < 1) await walk(h as FileSystemDirectoryHandle, `${prefix}${name}/`, depth + 1);
      if (out.length > 200) return;
    }
  };
  await walk(root, '', 0);
  return out.sort((a, b) => b.bytes - a.bytes);
}

/**
 * Removes the offline app cache (every Cache Storage cache of this site). The service worker
 * fills it again with the app shell on the next visit; nothing personal is kept there.
 * Resolves the number of caches removed.
 */
export async function purgeOfflineCaches(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  let n = 0;
  for (const name of await caches.keys()) { if (await caches.delete(name)) n++; }
  return n;
}
