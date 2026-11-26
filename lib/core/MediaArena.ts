/**
 * MediaBlobArena — content-addressed binary media.
 * A data: URL (base64, ~1.33× the bytes, and 2 bytes per char as a JS string)
 * was copied into localStorage, profile caches and React state. Here it is
 * decoded once into a Blob, stored once in IndexedDB under its SHA-256, and
 * referenced as `media-ref://<hash>`. Live object URLs sit in a BoundedLRU
 * (120 entries / 24 MB) and are revoked on eviction.
 */
import { BoundedLRU } from '@/lib/core/BoundedLRU';
import { trackBlobUrl } from '@/lib/perf/memory-observatory';

export const MEDIA_REF = 'media-ref://';
const DB = 'HumanityLedgerMediaDB';
const STORE = 'blobs';

export const isMediaRef = (s: unknown): s is string => typeof s === 'string' && s.startsWith(MEDIA_REF);
export const isDataUrl = (s: unknown): s is string => typeof s === 'string' && s.startsWith('data:');

interface Entry { url: string; bytes: number }
const evicted = new Set<(hash: string) => void>();
export const objectUrls = new BoundedLRU<string, Entry>({
  max: 120, maxBytes: 24 * 1024 * 1024, sizeOf: e => e.bytes, name: 'media.objectUrls',
  onEvict: (hash, e) => { try { URL.revokeObjectURL(e.url); } catch {} trackBlobUrl(-1); evicted.forEach(f => f(hash)); },
});
/** Owners (e.g. profile caches) drop references to revoked URLs here. */
export function onMediaEvicted(fn: (hash: string) => void): () => void { evicted.add(fn); return () => evicted.delete(fn); }

/** Decodes a data: URL to a Blob without spreading bytes through call arguments. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, comma);
  const type = meta.split(';')[0] || 'application/octet-stream';
  const body = dataUrl.slice(comma + 1);
  if (!/;base64/i.test(meta)) return new Blob([decodeURIComponent(body)], { type });
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function sha256Hex(b: Blob): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', await b.arrayBuffer());
  return [...new Uint8Array(d)].slice(0, 16).map(x => x.toString(16).padStart(2, '0')).join('');
}

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  return dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  });
}
function idb<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(d => new Promise<T>((res, rej) => {
    const req = op(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  }));
}

function remember(hash: string, blob: Blob): string {
  const hit = objectUrls.get(hash);
  if (hit) return hit.url;
  const url = URL.createObjectURL(blob);
  trackBlobUrl(1);
  objectUrls.set(hash, { url, bytes: blob.size });
  return url;
}

/** Stores a data: URL once; returns its media-ref and a live object URL. */
export async function putDataUrl(dataUrl: string): Promise<{ ref: string; url: string }> {
  const blob = dataUrlToBlob(dataUrl);
  const hash = await sha256Hex(blob);
  const exists = await idb('readonly', s => s.count(hash)).catch(() => 0);
  if (!exists) await idb('readwrite', s => s.put(blob, hash)).catch(() => undefined);
  return { ref: MEDIA_REF + hash, url: remember(hash, blob) };
}

/** The live object URL for a media-ref if it is already in memory (synchronous, for first paint). */
export function resolveRefSync(ref: string): string | undefined {
  return isMediaRef(ref) ? objectUrls.get(ref.slice(MEDIA_REF.length))?.url : undefined;
}

/** The object URL for a media-ref, loading the Blob from IndexedDB when needed. */
export async function resolveRef(ref: string): Promise<string | undefined> {
  if (!isMediaRef(ref)) return undefined;
  const hash = ref.slice(MEDIA_REF.length);
  const hit = objectUrls.get(hash);
  if (hit) return hit.url;
  const blob = await idb<Blob | undefined>('readonly', s => s.get(hash)).catch(() => undefined);
  return blob ? remember(hash, blob) : undefined;
}

/** Revokes every live object URL (Settings → Trim memory). Stored blobs stay. */
export function trimMediaUrls(): number { const n = objectUrls.size; objectUrls.clear(); return n; }
