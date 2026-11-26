/**
 * Reproducible heap measurements for the Phase C changes (real byte counters,
 * not estimates). Run: node --expose-gc (after transpiling) or
 *   npx tsx --expose-gc scripts/benchmark-ram.ts
 *
 * 1. Unbounded Map vs BoundedLRU for 10,000 peers with avatar-sized strings.
 * 2. Full-history thread load (old getAll) vs a 50-row window (cursor).
 * 3. SecureVault base64 of a 5 MB payload: spread vs chunked.
 */
import { BoundedLRU } from '../lib/core/BoundedLRU';
import { bytesToBase64 } from '../lib/core/SecureVault';

const gc = (globalThis as { gc?: () => void }).gc;
const heap = () => { gc?.(); gc?.(); return process.memoryUsage().heapUsed; };
const MB = (b: number) => (b / 1048576).toFixed(2) + ' MB';
// Unique, flat strings (no shared rope): ~8 KB of base64 each, like a downscaled avatar.
const avatar = (i: number) => 'data:image/webp;base64,' + Buffer.alloc(6_000, i % 251).toString('base64') + i;

function measure<T>(label: string, build: () => T): { label: string; bytes: number; keep: T } {
  const before = heap();
  const keep = build();
  const bytes = heap() - before;
  return { label, bytes, keep };
}

const rows: Array<[string, string]> = [];

const a = measure('Map, 10,000 profiles', () => { const m = new Map<string, string>(); for (let i = 0; i < 10_000; i++) m.set(`0x${i}`, avatar(i)); return m; });
const b = measure('BoundedLRU(64), 10,000 profiles', () => { const m = new BoundedLRU<string, string>({ max: 64 }); for (let i = 0; i < 10_000; i++) m.set(`0x${i}`, avatar(i)); return m; });
rows.push([a.label, MB(a.bytes)], [b.label, MB(b.bytes)]);

const msg = (i: number) => ({ id: `m${i}`, conversationId: 'dm-0xabc', content: 'x'.repeat(200), sentAtNs: 1_800_000_000_000 + i, senderAddress: '0x' + 'a'.repeat(40) });
const c = measure('Thread: full history (10,000 rows)', () => Array.from({ length: 10_000 }, (_, i) => msg(i)));
const d = measure('Thread: 50-row window', () => Array.from({ length: 50 }, (_, i) => msg(i)));
rows.push([c.label, MB(c.bytes)], [d.label, MB(d.bytes)]);

const payload = new Uint8Array(5 * 1024 * 1024);
let spread = 'ok';
try { btoa(String.fromCharCode(...payload)); } catch (e) { spread = 'throws: ' + (e as Error).message; }
const t0 = performance.now(); bytesToBase64(payload); const chunkMs = performance.now() - t0;
rows.push(['5 MB base64, spread', spread], ['5 MB base64, chunked', `ok in ${chunkMs.toFixed(0)} ms`]);

console.table(Object.fromEntries(rows));
void [a.keep, b.keep, c.keep, d.keep];
