import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { streamChonk, type ChonkApi, type StreamStep } from '@/lib/aztec/prover/ephemeral-prover-core';
import { proverProfile, isAppleTouch, SRS_SMALL, SRS_FULL } from '@/lib/aztec/prover/threads';
import { every, activeTimers } from '@/lib/perf/clock';
import { IdleStorageWriter } from '@/lib/perf/idle-storage';
import { contentText } from '@/lib/chat/normalizeContent';
import { createChatMessageRecord } from '@/lib/chat/messageRecord';
import { frameBudget } from '@/lib/perf/scheduler';
import { idDigest, saveDeleteSnapshot, isPreDeleteId, collectPreDeleteHistory, SNAPSHOT_IDS } from '@/lib/chat/incoming-revival';
import { callPreflight } from '@/lib/chat/blockActions';
import { dataUrlToBlob, objectUrls } from '@/lib/core/MediaArena';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
function mem(): Storage {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null,
    getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } } as Storage;
}

describe('StreamingChonkExecutor', () => {
  const HIDING = 9;
  const mk = (n: number, bytes: number) => Array.from({ length: n }, (_, i): StreamStep => ({
    name: `c${i}`, kind: i === n - 1 ? HIDING : 1, vk: new Uint8Array([1]),
    load: async () => ({ bytecode: new Uint8Array(bytes), witness: new Uint8Array(bytes) }),
  }));
  it('calls bb in exactly AztecClientBackend.prove order, one step at a time', async () => {
    const calls: string[] = [];
    let live = 0, peak = 0;
    const api: ChonkApi = {
      chonkStart: async () => { calls.push('start'); },
      chonkLoad: async c => { calls.push(`load:${c.circuit.name}`); live += c.circuit.bytecode.byteLength; peak = Math.max(peak, live); },
      chonkAccumulate: async c => { calls.push('acc'); live += c.witness.byteLength; peak = Math.max(peak, live); live = 0; },
      chonkProve: async () => { calls.push('prove'); return { proof: 'P' }; },
      chonkVerify: async () => { calls.push('verify'); return { valid: true }; },
      chonkCompressProof: async () => { calls.push('compress'); return { compressedProof: new Uint8Array([7]) }; },
    };
    const res = await streamChonk(api, mk(12, 1000), () => [new Uint8Array(32)], HIDING);
    expect(calls[0]).toBe('start');
    expect(calls.slice(1, 25).join(',')).toBe(Array.from({ length: 12 }, (_, i) => `load:c${i},acc`).join(','));
    expect(calls.slice(25)).toEqual(['prove', 'verify', 'compress']);
    expect(peak).toBe(2000); // one step's bytecode + witness, never 12
    expect(res.compressedProof[0]).toBe(7);
  });
  it('enforces the same invariants as bb.js', async () => {
    const api = { chonkStart: async () => {} } as unknown as ChonkApi;
    const bad = mk(2, 1); bad[1].kind = 1;
    await expect(streamChonk(api, bad, () => [], HIDING)).rejects.toThrow(/HidingKernel/);
    const novk = mk(2, 1); novk[0].vk = new Uint8Array();
    await expect(streamChonk(api, novk, () => [], HIDING)).rejects.toThrow(/Missing precomputed VK/);
  });
  it('the prover uses it, sized per device, and always destroys bb', () => {
    const src = read('lib/aztec/prover/ephemeral-prover.ts');
    expect(src).toMatch(/streamChonk\(/);
    expect(src).not.toMatch(/Promise\.all\(executionSteps\.map/);
    expect(src).toMatch(/Barretenberg\.new\(\{ threads: profile\.threads, srsSize/);
    expect(src).toMatch(/finally \{[\s\S]*barretenberg\?\.destroy\(\)/);
  });
});

describe('Adaptive prover profile', () => {
  const desk = { crossOriginIsolated: true, hasSharedArrayBuffer: true, hardwareConcurrency: 8, mobile: false };
  it('detects iPadOS by Mac UA + touch', () => {
    expect(isAppleTouch('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isAppleTouch('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
  });
  it('2^18 SRS + 1.5 GiB cap on iPadOS, Android ≤4 GB; 2^19 on a big isolated desktop', () => {
    const ipad = proverProfile({ ...desk, crossOriginIsolated: false, userAgent: 'Macintosh', maxTouchPoints: 5 });
    expect([ipad.srsSize, ipad.threads, ipad.memoryMaxPages]).toEqual([SRS_SMALL, 1, 24_576]);
    const android = proverProfile({ ...desk, mobile: true, deviceMemoryGb: 4, userAgent: 'Android' });
    expect([android.srsSize, android.threads]).toEqual([SRS_SMALL, 2]);
    const pc = proverProfile({ ...desk, deviceMemoryGb: 16, userAgent: 'Windows' });
    expect([pc.srsSize, pc.threads, pc.memoryMaxPages]).toEqual([SRS_FULL, 7, undefined]);
  });
});

describe('Engine discipline', () => {
  it('one shared clock: subscribe/unsubscribe leaves no timer behind', () => {
    const off1 = every(1000, () => {}); const off2 = every(1000, () => {});
    expect(activeTimers()).toBe(1); // two subscribers, one timer
    off1(); off2();
    expect(activeTimers()).toBe(0);
  });
  it('idle storage: 100 rapid writes → 1 flush, reads see queued values', () => {
    const s = mem(); const w = new IdleStorageWriter(() => s);
    for (let i = 0; i < 100; i++) w.set('k', () => JSON.stringify({ i }));
    expect(w.read('k')).toBe('{"i":99}');
    expect(s.getItem('k')).toBeNull();
    w.flush();
    expect([w.writes, w.flushes, s.getItem('k')]).toEqual([100, 1, '{"i":99}']);
  });
  it('content normalized once per message', () => {
    const m = { content: { a: 1 } };
    const a = contentText(m); m.content.a = 2;
    expect(contentText(m)).toBe(a); // memoized, not re-stringified
    expect(contentText({ content: 'x' })).toBe('x');
  });
  it('every message record has the same shape and key order', () => {
    const a = createChatMessageRecord({ id: 1, content: 'x' });
    const b = createChatMessageRecord({ sentAtNs: 5, status: 'sending', burnAtNs: 9, isMe: true });
    expect(Object.keys(a)).toEqual(Object.keys(b));
  });
  it('frame budget yields only after 8 ms of work', async () => {
    const due = frameBudget(8); const t0 = performance.now();
    await due(); expect(performance.now() - t0 < 5).toBe(true);
  });
});

describe('Delete≠Block hardening', () => {
  it('snapshot keeps 256 compact digests (≤2.9 KB) and still matches raw ids', () => {
    const s = mem(); const A = '0x' + 'a'.repeat(40), B = '0x' + 'b'.repeat(40);
    saveDeleteSnapshot(B, [A], Array.from({ length: 400 }, (_, i) => `msg-${i}-uuid-long-id`), s);
    const raw = s.getItem(`ledger_delsnap_${A}_${B}`)!;
    expect(JSON.parse(raw).length).toBe(SNAPSHOT_IDS);
    expect(raw.length < 2900).toBe(true); // vs ~10 KB of raw UUIDs
    expect(isPreDeleteId(B, 'msg-399-uuid-long-id', [A], s)).toBe(true);
    expect(isPreDeleteId(B, 'brand-new', [A], s)).toBe(false);
    expect(idDigest('x')).toMatch(/^[0-9a-f]{8}$/);
  });
  it('pre-delete history is collected within its time budget', async () => {
    const slow = () => new Promise<never[]>(r => setTimeout(() => r([]), 5_000));
    const t0 = Date.now();
    const h = await collectPreDeleteHistory({ db: async () => [{ id: 'a', sentAtNs: 1_800_000_000_000 }], xmtp: slow }, 100);
    expect(Date.now() - t0 < 1000).toBe(true);
    expect(h).toEqual({ ids: ['a'], maxPersistedMs: 1_800_000_000_000 });
  });
  it('call preflight: 403 means unavailable, network trouble never blocks a call', async () => {
    expect(await callPreflight('0xabc', (async () => new Response(null, { status: 403 })) as typeof fetch)).toBe(false);
    expect(await callPreflight('0xabc', (async () => new Response('{}', { status: 200 })) as typeof fetch)).toBe(true);
    expect(await callPreflight('0xabc', (async () => { throw new Error('offline'); }) as typeof fetch)).toBe(true);
  });
  it('server blocks hydrate at startup; preflight route and search respect blocks', () => {
    expect(read('components/terminal/LedgerChatV2.tsx')).toMatch(/hydrateServerBlocks\(\{ account: effectiveAddress/);
    expect(read('app/api/calls/preflight/route.ts')).toMatch(/isMutuallyBlocked\(auth\.walletAddress, peer\)/);
    expect(read('app/api/chat/users/search/route.ts')).toMatch(/blockedCounterparties\(caller\)/);
    expect(read('lib/xmtp/client.ts')).toMatch(/1\. Inbox-level consent: works with no DM/);
    expect(read('lib/chat/blockFirewall.ts')).toMatch(/if \(!hasDelegate\(\)\) return false;/);
  });
});

describe('Media arena', () => {
  it('decodes data URLs to binary and revokes evicted object URLs', () => {
    const blob = dataUrlToBlob('data:image/png;base64,' + Buffer.from(new Uint8Array(3000)).toString('base64'));
    expect(blob.size).toBe(3000);
    const revoked: string[] = [];
    const orig = URL.revokeObjectURL; URL.revokeObjectURL = (u: string) => { revoked.push(u); };
    try {
      for (let i = 0; i < 500; i++) objectUrls.set(`h${i}`, { url: `blob:${i}`, bytes: 10_000 });
      expect(objectUrls.size).toBe(120);
      expect(revoked.length).toBe(380);
    } finally { objectUrls.clear(); URL.revokeObjectURL = orig; }
  });
});

describe('Boot graph, compositor and SW', () => {
  it('fixes and diets are in place', () => {
    const cl = read('components/layout/ClientLayout.tsx');
    expect(cl.indexOf('const isChat =') < cl.indexOf('[isDashboard, isBounded, isChat]')).toBe(true);
    expect(cl).toMatch(/removeEventListener\('chargingchange', onChange\)/);
    expect(read('components/chat/surface/ChatKeepAlive.tsx')).toMatch(/dynamic\(\(\) => import\('\.\/ChatSurface'\)/);
    expect(read('components/layout/MobileEnforcer.tsx')).not.toMatch(/MobileLanding/);
    const layout = read('app/layout.tsx');
    expect((layout.match(/= Inter\(/g) || []).length).toBe(1);
    expect(layout).not.toMatch(/subtree:true,attributes:true/);
    expect(read('next.config.js')).toMatch(/config\.optimization\.minimize = !isServer && process\.env\.HL_DISABLE_MINIFY !== '1'/);
    expect(read('next.config.js')).toMatch(/collapse_vars: false, reduce_vars: false, sequences: false, inline: 1/);
    const sw = read('public/sw.js');
    expect(sw).toMatch(/navigationPreload\.enable\(\)/);
    expect(sw).toMatch(/event\.preloadResponse/);
    expect(sw).toMatch(/application\/wasm/);
    expect(read('app/globals.css')).toMatch(/not \(-webkit-touch-callout: none\)/);
  });
  it('the app never imports the second Barretenberg (@aztec/bb.js 5.3.0)', () => {
    const files = require('child_process').execSync('git ls-files app lib components', { cwd: root }).toString().split('\n').filter((f: string) => /\.(ts|tsx|js)$/.test(f));
    const hits = files.filter((f: string) => { try { return /from '@aztec\/bb\.js'|import\('@aztec\/bb\.js'\)/.test(read(f)); } catch { return false; } });
    expect(hits).toEqual([]);
  });
});
