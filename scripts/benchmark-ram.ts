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

// ── Hyperion V3 ──────────────────────────────────────────────────────────────
import { streamChonk, type ChonkApi, type StreamStep } from '../lib/aztec/prover/ephemeral-prover-core';
import { IdleStorageWriter } from '../lib/perf/idle-storage';

async function hyperion() {
  const STEPS = 12, BYTECODE = 1_500_000, WITNESS = 2_000_000; // inflated sizes per kernel/app step
  const ab = () => { gc?.(); return process.memoryUsage().arrayBuffers; };

  // Old: inflate every step at once (Promise.all), then hand all arrays to bb.
  let base = ab();
  const all = Array.from({ length: STEPS }, () => ({ b: new Uint8Array(BYTECODE).fill(1), w: new Uint8Array(WITNESS).fill(2) }));
  const oldPeak = process.memoryUsage().arrayBuffers - base;
  void all.length;

  // New: one step inflated at a time.
  base = ab();
  let newPeak = 0;
  const api: ChonkApi = {
    // Live (reachable) bytes while step i is in bb: collect garbage first, as the engine does under pressure.
    chonkStart: async () => {}, chonkAccumulate: async () => { gc?.(); newPeak = Math.max(newPeak, process.memoryUsage().arrayBuffers - base); },
    chonkLoad: async () => {}, chonkProve: async () => ({ proof: 0 }), chonkVerify: async () => ({ valid: true }),
    chonkCompressProof: async () => ({ compressedProof: new Uint8Array(1) }),
  };
  const steps: StreamStep[] = Array.from({ length: STEPS }, (_, i) => ({
    name: `c${i}`, kind: i === STEPS - 1 ? 9 : 1, vk: new Uint8Array(1),
    load: async () => ({ bytecode: new Uint8Array(BYTECODE).fill(1), witness: new Uint8Array(WITNESS).fill(2) }),
  }));
  await streamChonk(api, steps, () => [], 9);

  // Working set: 20 chats × 200 messages in React state vs active chat + 1 recent, capped at 80.
  const msg = (c: number, i: number) => ({ id: `m${c}-${i}`, conversationId: `dm-${c}`, content: 'x'.repeat(200) + i, sentAtNs: i, senderAddress: '0x' + 'a'.repeat(40) });
  const ws1 = measure('Working set: 20 chats × 200', () => Array.from({ length: 4000 }, (_, k) => msg(k % 20, k)));
  const ws2 = measure('Working set: active 200 + 1 × 80', () => [...Array.from({ length: 200 }, (_, i) => msg(0, i)), ...Array.from({ length: 80 }, (_, i) => msg(1, i))]);

  // Avatars: 500 base64 data URLs held as JS strings vs 45-char media-refs (bytes live in IndexedDB).
  const av1 = measure('500 avatars as base64 strings', () => Array.from({ length: 500 }, (_, i) => avatar(i)));
  const av2 = measure('500 avatars as media-refs', () => Array.from({ length: 500 }, (_, i) => `media-ref://${i.toString(16).padStart(32, '0')}`));

  const store = new Map<string, string>();
  const w = new IdleStorageWriter(() => ({ getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); }, removeItem: k => { store.delete(k); }, key: () => null, length: 0, clear: () => {} }) as Storage);
  for (let i = 0; i < 100; i++) w.set('ledger_chat_history', () => JSON.stringify({ i }));
  w.flush();

  console.table({
    'Prover inputs, 12 steps, Promise.all': MB(oldPeak),
    'Prover inputs, 12 steps, streamed': MB(newPeak),
    [ws1.label]: MB(ws1.bytes), [ws2.label]: MB(ws2.bytes),
    [av1.label]: MB(av1.bytes), [av2.label]: MB(av2.bytes),
    'Storage: 100 rapid writes →': `${w.flushes} flush`,
  });
}
void hyperion();
