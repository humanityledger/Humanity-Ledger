import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { BoundedLRU } from '@/lib/core/BoundedLRU';
import { bytesToBase64 } from '@/lib/core/SecureVault';
import { proverThreads } from '@/lib/aztec/prover/threads';
import { normalizeSentAt } from '@/lib/chat/indexeddb';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

describe('Zero-residency prover', () => {
  const src = read('lib/aztec/prover/ephemeral-prover.ts');
  it('uses a fresh Barretenberg per proof and always destroys it', () => {
    expect(src).toMatch(/Barretenberg\.new\(\{ threads: profile\.threads/);
    expect(src).not.toMatch(/Barretenberg\.initSingleton\(/);
    expect(src).toMatch(/finally \{[\s\S]*barretenberg\?\.destroy\(\)/);
    expect(src).toMatch(/extends BBLazyPrivateKernelProver/);
  });
  it('is the prover the wallet hands to the PXE', () => {
    const client = read('lib/aztec/wallet/client.ts');
    expect(client).toMatch(/proverOrOptions: createEphemeralProver\(simulator\)/);
    expect(client).toMatch(/simulator,\n/);
  });
  it('sizes threads to the device', () => {
    const base = { crossOriginIsolated: true, hasSharedArrayBuffer: true, hardwareConcurrency: 8, mobile: false };
    expect(proverThreads({ ...base, crossOriginIsolated: false })).toBe(1);   // no SharedArrayBuffer threads
    expect(proverThreads({ ...base, deviceMemoryGb: 2, mobile: true })).toBe(1);
    expect(proverThreads({ ...base, deviceMemoryGb: 4, mobile: true })).toBe(2);
    expect(proverThreads({ ...base, deviceMemoryGb: 8, mobile: true })).toBe(4);
    expect(proverThreads({ ...base, deviceMemoryGb: 16 })).toBe(7);          // one core left for the UI
    expect(proverThreads({ ...base, hardwareConcurrency: 64, deviceMemoryGb: 32 })).toBe(16);
  });
  it('transferring a buffer leaves the sender with zero bytes', () => {
    const buf = new ArrayBuffer(8 * 1024 * 1024);
    const moved = structuredClone(buf, { transfer: [buf] });
    expect(buf.byteLength).toBe(0);
    expect(moved.byteLength).toBe(8 * 1024 * 1024);
  });
});

describe('BoundedLRU', () => {
  it('holds at most `max` entries across 10,000 peers', () => {
    const lru = new BoundedLRU<string, number>({ max: 500 });
    for (let i = 0; i < 10_000; i++) lru.set(`0x${i}`, i);
    expect(lru.size).toBe(500);
    expect(lru.has('0x9999')).toBe(true);
    expect(lru.has('0x0')).toBe(false);
  });
  it('enforces the byte budget, skips oversize values and reports evictions', () => {
    const evicted: string[] = [];
    const lru = new BoundedLRU<string, string>({ max: 10_000, maxBytes: 1024, maxItemBytes: 256, sizeOf: v => v.length, onEvict: k => evicted.push(k) });
    for (let i = 0; i < 100; i++) lru.set(`k${i}`, 'x'.repeat(100));
    expect(lru.byteSize <= 1024).toBe(true);
    expect(lru.size).toBe(10);
    expect(evicted.length).toBe(90);
    lru.set('big', 'x'.repeat(300));
    expect(lru.has('big')).toBe(false);
  });
  it('reads refresh recency', () => {
    const lru = new BoundedLRU<string, number>({ max: 2 });
    lru.set('a', 1); lru.set('b', 2); lru.get('a'); lru.set('c', 3);
    expect(lru.has('a')).toBe(true);
    expect(lru.has('b')).toBe(false);
  });
});

describe('SecureVault', () => {
  it('base64-encodes multi-MB payloads without blowing the call stack', () => {
    const bytes = new Uint8Array(5 * 1024 * 1024);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31) & 255;
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
  it('bounds the decrypted cache and coalesces activity listeners', () => {
    const src = read('lib/core/SecureVault.ts');
    expect(src).toMatch(/new BoundedLRU<string, string>\(\{ max: 256, maxBytes: 256 \* 1024, maxItemBytes: 16 \* 1024/);
    expect(src).not.toMatch(/btoa\(String\.fromCharCode\(\.\.\.(masterBytes|combined)/);
    expect(src).toMatch(/const onActivity = \(\) => \{ this\.lastActivity = Date\.now\(\); \}/);
  });
});

describe('Chat database windowing', () => {
  it('reads a page with a reverse cursor on the compound index', () => {
    const src = read('lib/chat/indexeddb.ts');
    expect(src).toMatch(/private dbVersion = 2;/);
    expect(src).toMatch(/createIndex\(CONV_TIME_INDEX, \['conversationId', 'sentAtNs'\]/);
    expect(src).toMatch(/openCursor\(range, 'prev'\)/);
    expect(src).toMatch(/if \(out\.length >= limit\) return resolve\(out\);/);
  });
  it('normalizes times so every row stays in the index', () => {
    expect(normalizeSentAt(1_800_000_000_000)).toBe(1_800_000_000_000);
    expect(normalizeSentAt(1_800_000_000_000_000_000)).toBe(1_800_000_000_000);
    expect(normalizeSentAt('1800000000000')).toBe(1_800_000_000_000);
    expect(normalizeSentAt(undefined)).toBe(0);
    expect(normalizeSentAt('garbage')).toBe(0);
  });
});

describe('Bounded app caches and no DOM-watching loops', () => {
  it('caches are bounded', () => {
    expect(read('lib/xmtp/client.ts')).toMatch(/const activeDmCache = new BoundedLRU/);
    expect(read('components/chat/ContactInfoPanel.tsx')).toMatch(/new BoundedLRU<string, PeerProfile \| null>\(\{ max: 64/);
    expect(read('components/chat/ChatDetailsPanel.tsx')).toMatch(/new BoundedLRU<string, string\[\]>\(\{ max: 48/);
    expect(read('components/terminal/LedgerChatV2.tsx')).toMatch(/new BoundedLRU<string, CallSignal\[\]>\(\{ max: 8/);
  });
  it('the anti-tamper rAF loop and global providers are gone from the layout', () => {
    const layout = read('app/layout.tsx');
    expect(layout).not.toMatch(/AntiTamperCore|AztecProvider/);
    expect(read('components/security/AntiTamperCore.tsx')).not.toMatch(/requestAnimationFrame|MutationObserver/);
  });
});
