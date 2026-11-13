/**
 * /connect and the chat gate agree on what "signed in" means, and automatic
 * redirects between them cannot loop (lib/auth/session-check.ts).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { allowAutoRedirect, hasServerSession } from '@/lib/auth/session-check';

const res = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response;

describe('hasServerSession', () => {
  it('asks the same endpoint as the chat gate and accepts only a live session', async () => {
    let asked = '';
    expect(await hasServerSession((async (u: string) => { asked = u; return res(200, { hasPin: false }); }) as unknown as typeof fetch)).toBe(true);
    expect(asked).toBe('/api/auth/enclave-pin');
    expect(await hasServerSession((async () => res(401, { noSession: true })) as unknown as typeof fetch)).toBe(false);
    expect(await hasServerSession((async () => res(200, { noSession: true })) as unknown as typeof fetch)).toBe(false);
    expect(await hasServerSession((async () => res(500, {})) as unknown as typeof fetch)).toBe(false);
    expect(await hasServerSession((async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBe(false);
  });
});

describe('allowAutoRedirect', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  it('allows three automatic redirects a minute, then stops the loop', () => {
    const s = mem();
    const t = 1_000_000;
    expect([0, 1, 2].map((i) => allowAutoRedirect(t + i * 1000, s))).toEqual([true, true, true]);
    expect(allowAutoRedirect(t + 3000, s)).toBe(false);
    expect(allowAutoRedirect(t + 61_000 + 2000, s)).toBe(true);
  });
});

describe('/connect never redirects on local hints alone', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../../components/landing/ConnectPage.tsx'), 'utf8');
  it('asks the server before using a stored session, and clears stale hints', () => {
    expect(src).toMatch(/if \(!hasCookie && !hasLocal\) return;[\s\S]{0,600}await hasServerSession\(\)[\s\S]{0,300}clearLocalSessionMarkers\(\)/);
    expect(src).not.toMatch(/if \(hasCookie \|\| hasLocal\) \{\s*setLinked\(true\);/);
  });
  it('starts no WalletConnect pairing of its own on a phone browser (AppKit does)', () => {
    expect(src).not.toMatch(/display_uri/);
    expect(src).not.toMatch(/connect\(\{ connector: wcConnector \}\)/);
  });
});

describe('AppKit configuration', () => {
  const cfg = fs.readFileSync(path.resolve(__dirname, '../../../config/appkit.tsx'), 'utf8');
  it('adds no second WalletConnect connector next to AppKit', () => {
    expect(cfg).not.toMatch(/walletConnect\(\{/);
  });
  it('features wallets by their full registry id', () => {
    const ids = [...cfg.matchAll(/'([0-9a-f]{32,})', \/\/ /g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{64}$/);
  });
});
