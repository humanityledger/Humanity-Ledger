import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { scanKeys, scanDelete } from '@/lib/redis/scan';
import { railFor, checkL2Send, txLink, L2_RAILS, l2RailsEnabled } from '@/lib/payments/l2Rails';

const root = path.resolve(__dirname, '../../..');
function walk(d: string, out: string[] = []): string[] {
  for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.tsx?$/.test(n)) out.push(p); }
  return out;
}
function fakeRedis(keys: string[]) {
  const store = new Set(keys); const calls: any[] = [];
  return { store, calls,
    scan: async (cursor: string, _m: string, pat: string, _c: string, n: number) => {
      calls.push(cursor);
      const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      const all = [...store].filter(k => re.test(k)); const start = Number(cursor); const page = all.slice(start, start + 2);
      return [start + 2 >= all.length ? '0' : String(start + 2), page];
    },
    del: async (...k: string[]) => { k.forEach(x => store.delete(x)); return k.length; } };
}

describe('Titan V4', () => {
  it('SCAN walks every page with a cursor and respects the cap', async () => {
    const r = fakeRedis(['presence:0x1', 'presence:0x2', 'presence:0x3', 'presence:mutual:a', 'x']);
    expect((await scanKeys(r as any, 'presence:0x*')).sort()).toEqual(['presence:0x1', 'presence:0x2', 'presence:0x3']);
    expect(r.calls.length).toBeGreaterThanOrEqual(2);
    expect((await scanKeys(r as any, 'presence:*', 2)).length).toBe(2);
    expect(await scanDelete(r as any, 'presence:0x*')).toBe(3);
    expect([...r.store].sort()).toEqual(['presence:mutual:a', 'x']);
    expect(await scanKeys(null, '*')).toEqual([]);
  });
  it('no KEYS and no raw x-forwarded-for in app/ or lib/ (outside getClientIP)', () => {
    const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'lib'))];
    const keys = files.filter(f => /\.keys\(\s*[`'"]/.test(readFileSync(f, 'utf8')));
    expect(keys.map(f => path.relative(root, f))).toEqual([]);
    const xff = files.filter(f => !f.endsWith(path.join('security', 'rateLimiter.ts')) && f.includes(path.join('app', 'api')) && /x-forwarded-for/.test(readFileSync(f, 'utf8')));
    expect(xff.map(f => path.relative(root, f))).toEqual([]);
  });
  it('L2 rails are fail-closed', () => {
    expect(Object.keys(L2_RAILS).sort()).toEqual(['1', '10', '42161', '8453']);
    expect(railFor(137)).toBeNull();
    expect(railFor('0x2105')?.name).toBe('Base');
    expect(railFor('constructor')).toBeNull();
    expect(l2RailsEnabled(undefined)).toBe(false);
    expect(checkL2Send(1, 1, false)).toEqual({ ok: true });
    expect(checkL2Send(8453, 8453, false).ok).toBe(false);
    expect(checkL2Send(1, 8453, true).ok).toBe(false);
    expect(checkL2Send(8453, 8453, true)).toEqual({ ok: true });
    expect(checkL2Send(137, 137, true).ok).toBe(false);
    expect(txLink(42161, '0x' + 'a'.repeat(64))).toBe('https://arbiscan.io/tx/0x' + 'a'.repeat(64));
    expect(txLink(42161, 'javascript:alert(1)')).toBeNull();
  });
});
