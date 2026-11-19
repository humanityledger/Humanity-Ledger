import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { coordsForTimeZone, regionsFrom } from '@/lib/stats/live';
import { isSyncWaitError, redactXmtpError } from '@/lib/xmtp/syncErrors';

const h = vi.hoisted(() => ({ keys: new Set<string>(), rows: new Map<string, number>() }));
vi.mock('@/lib/redis', () => ({
  getRedisClient: async () => ({ set: async (k: string) => (h.keys.has(k) ? null : (h.keys.add(k), 'OK')) }),
  safeRedisGet: async () => null,
  safeRedisSet: async () => {},
}));
vi.mock('@/lib/security/rateLimiter', () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    visitorTally: {
      upsert: async ({ where }: any) => {
        const k = `${where.day_tz.day}|${where.day_tz.tz}`;
        h.rows.set(k, (h.rows.get(k) ?? 0) + 1);
        return {};
      },
    },
  },
}));

import { POST as VISIT } from '@/app/api/stats/visit/route';

const visit = (body: unknown) =>
  VISIT(new NextRequest('https://ledgerchat.org/api/stats/visit', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' } }));

beforeEach(() => { h.keys.clear(); h.rows.clear(); });

describe('live map numbers', () => {
  it('places time zones from the tz database, aliases included, and nothing else', () => {
    expect(coordsForTimeZone('Europe/Madrid')).toEqual([40.4, -3.68]);
    expect(coordsForTimeZone('Asia/Calcutta')).not.toBeNull();
    expect(coordsForTimeZone('Mars/Olympus')).toBeNull();
    expect(coordsForTimeZone('__proto__')).toBeNull();
  });

  it('groups tallies by zone, biggest first, and drops unknown zones', () => {
    const r = regionsFrom([{ tz: 'Europe/Madrid', count: 2 }, { tz: 'Europe/Madrid', count: 3 }, { tz: 'Asia/Tokyo', count: 9 }, { tz: 'unknown', count: 4 }]);
    expect(r.map((x) => [x.tz, x.visitors])).toEqual([['Asia/Tokyo', 9], ['Europe/Madrid', 5]]);
  });

  it('counts every visit, from the time zone alone', async () => {
    expect(await (await visit({ tz: 'Europe/Madrid' })).json()).toEqual({ counted: true });
    expect(await (await visit({ tz: 'Europe/Madrid' })).json()).toEqual({ counted: true });
    expect(h.rows.get([...h.rows.keys()][0])).toBe(2);
  });

  it('ignores an id an older client still sends, files an unknown zone as unknown, refuses a non-object body', async () => {
    expect(await (await visit({ tz: 'Europe/Madrid', vid: 'A'.repeat(22) })).json()).toEqual({ counted: true });
    await visit({ tz: '<script>' });
    expect([...h.rows.keys()].some((k) => k.endsWith('|unknown'))).toBe(true);
    expect((await visit([1, 2])).status).toBe(400);
  });

  it('stores nothing in the browser and sends nothing but the time zone', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('lib/stats/useVisitBeacon.ts', 'utf8').replace(/\/\*[^]*?\*\//g, '');
    expect(src).not.toMatch(/setItem|document\.cookie|getRandomValues/);
    expect(src).toMatch(/JSON\.stringify\(\{ tz \}\)/);
    const route = fs.readFileSync('app/api/stats/visit/route.ts', 'utf8');
    expect(route).not.toMatch(/getRedisClient|createHash/);
  });
});

describe('XMTP "synced N messages" errors', () => {
  it('are recognised as a late receipt, not a failure', () => {
    expect(isSyncWaitError(new Error('synced 1 messages, 0 failed 1 succeeded from cursor Some(Cursor { sequence_id: 173542333, originator_id: 0 })'))).toBe(true);
    expect(isSyncWaitError(new Error('SyncFailedToWait(synced 0 messages, 0 failed 0 succeeded from cursor None)'))).toBe(true);
    expect(isSyncWaitError(new Error('group is inactive'))).toBe(false);
  });
  it('are logged without ids', () => {
    expect(redactXmtpError(new Error('failed for 0x' + 'ab'.repeat(20) + ' cursor Some(Cursor { sequence_id: 1, originator_id: 0 })'))).not.toMatch(/abab|sequence_id/);
  });
});
