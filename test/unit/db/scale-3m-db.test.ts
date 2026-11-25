import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  redis: new Map<string, string>(),
  userFindManyCalls: 0,
  userFindUniqueCalls: 0,
  userUpsertData: null as any,
  r2PutCalls: 0,
}));

vi.mock('@/lib/redis', () => ({
  safeRedisGet: async (k: string) => h.redis.get(k) ?? null,
  safeRedisSet: async (k: string, v: string) => { h.redis.set(k, v); },
}));

vi.mock('@/lib/security/verifiedCaller', () => ({
  getVerifiedCaller: async () => '0x' + 'a'.repeat(40),
}));

vi.mock('@/lib/security/rateLimiter', () => ({
  checkRateLimit: async () => ({ allowed: true, remaining: 50, resetAt: 9999999999 }),
}));

vi.mock('@/lib/security/premium-security', () => ({
  validateSecureRequest: async () => ({ valid: true, userId: '0x' + 'a'.repeat(40) }),
}));

vi.mock('@/lib/storage/chat-attachment-store', async (orig) => {
  const actual = await orig<typeof import('@/lib/storage/chat-attachment-store')>();
  return {
    ...actual,
    putAvatarObject: async () => { h.r2PutCalls++; },
  };
});

vi.mock('@/lib/prisma', () => {
  const mockDb = {
    user: {
      findUnique: async (args: any) => {
        h.userFindUniqueCalls++;
        if (args.where.walletAddress === '0x' + 'b'.repeat(40)) {
          return { walletAddress: '0x' + 'b'.repeat(40), displayName: 'Alice', chatName: 'alice', avatarUrl: '/api/chat/avatars/' + 'f'.repeat(32), bio: 'hi', isZkVerified: true, tier: 'FREE' };
        }
        return null;
      },
      findFirst: async () => null,
      findMany: async () => {
        h.userFindManyCalls++;
        return [{ walletAddress: '0x' + 'b'.repeat(40), displayName: 'Alice', chatName: 'alice', isZkVerified: true, tier: 'FREE' }];
      },
      upsert: async (args: any) => {
        h.userUpsertData = args;
        return { walletAddress: args.where.walletAddress, ...args.update };
      },
    },
    chatUsername: {
      findUnique: async () => null,
      findMany: async () => [],
    },
  };
  return { prisma: mockDb, prismaRead: mockDb };
});

import { GET as SEARCH_GET } from '@/app/api/chat/users/search/route';
import { GET as PROFILE_GET, PUT as PROFILE_PUT } from '@/app/api/user/profile/route';
import { POST as PROFILES_POST } from '@/app/api/user/profiles/route';

const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const;

describe('Phase 2: 3M+ PostgreSQL scalability & index hardening', () => {
  beforeEach(() => {
    h.redis.clear();
    h.userFindManyCalls = 0;
    h.userFindUniqueCalls = 0;
    h.userUpsertData = null;
    h.r2PutCalls = 0;
    for (const k of R2_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of R2_KEYS) delete process.env[k];
  });

  it('eliminates runtime CREATE TABLE DDL from updates/route.ts and leading-wildcard contains/ILIKE scans from users/search/route.ts', () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const updatesSrc = strip(fs.readFileSync('app/api/chat/updates/route.ts', 'utf8'));
    expect(updatesSrc).not.toMatch(/CREATE TABLE/i);
    expect(updatesSrc).not.toMatch(/\$executeRaw/);

    const searchSrc = strip(fs.readFileSync('app/api/chat/users/search/route.ts', 'utf8'));
    expect(searchSrc).not.toMatch(/\bcontains\s*:/);
    expect(searchSrc).not.toMatch(/\bILIKE\b/i);

    const storiesSrc = strip(fs.readFileSync('app/api/chat/stories/route.ts', 'utf8'));
    expect(storiesSrc).not.toMatch(/peer:\s*\{\s*equals:[^}]*mode:\s*'insensitive'/);

    const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
    const chatContactBlock = schema.slice(schema.indexOf('model ChatContact {'), schema.indexOf('}', schema.indexOf('model ChatContact {')) + 1);
    expect(chatContactBlock).toContain('@@index([peer])');
  });

  it('caches /api/chat/users/search prefix lookups in Redis on repeated calls', async () => {
    const r1 = await SEARCH_GET(new NextRequest('https://ledgerchat.org/api/chat/users/search?q=ali'));
    expect(r1.status).toBe(200);
    expect(h.userFindManyCalls).toBe(1);

    const r2 = await SEARCH_GET(new NextRequest('https://ledgerchat.org/api/chat/users/search?q=ALI'));
    expect(r2.status).toBe(200);
    expect(h.userFindManyCalls).toBe(1);
  });

  it('caches public profiles in Redis, serves batch profiles via lowercase IN(), and offloads base64 avatars to R2', async () => {
    const peer = '0x' + 'b'.repeat(40);
    const g1 = await PROFILE_GET(new NextRequest(`https://ledgerchat.org/api/user/profile?walletAddress=${peer.toUpperCase()}`));
    expect(g1.status).toBe(200);
    expect(h.userFindUniqueCalls).toBe(1);

    // Repeat read hits Redis cache instead of Postgres
    const g2 = await PROFILE_GET(new NextRequest(`https://ledgerchat.org/api/user/profile?walletAddress=${peer}`));
    expect(g2.status).toBe(200);
    expect(h.userFindUniqueCalls).toBe(1);

    // Batch profiles returns cached entry with 0 DB queries
    const b1 = await PROFILES_POST(new NextRequest('https://ledgerchat.org/api/user/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-verified-session-address': '0x' + 'a'.repeat(40) },
      body: JSON.stringify({ addresses: [peer] }),
    }));
    expect(b1.status).toBe(200);
    expect(h.userFindManyCalls).toBe(0);
    const body = await b1.json();
    expect(body.profiles[peer].displayName).toBe('Alice');

    // Offloads inline PNG avatar to R2 object path on PUT when R2 is configured
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_BUCKET_NAME = 'bkt';
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'sec';
    const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
    const pRes = await PROFILE_PUT(new NextRequest('https://ledgerchat.org/api/user/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ walletAddress: '0x' + 'a'.repeat(40), avatarUrl: `data:image/png;base64,${pngBase64}` }),
    }));
    expect(pRes.status).toBe(200);
    expect(h.r2PutCalls).toBe(1);
    expect(h.userUpsertData.update.avatarUrl).toMatch(/^\/api\/chat\/avatars\/[0-9a-f]{32}$/);
  });

  it('db-maintenance.mjs runs bounded batched deletes cleanly', async () => {
    const { purgeExpiredBatches } = await import('@/scripts/db-maintenance.mjs');
    const queries: string[] = [];
    const fakePg = {
      query: async (sql: string) => {
        queries.push(sql);
        if (sql.includes('to_regclass')) return { rows: [{ ok: true }] };
        return { rowCount: 25 };
      },
    };
    const out = await purgeExpiredBatches(fakePg, { dry: false, batch: 100, limitBatches: 5 });
    expect(Object.keys(out)).toHaveLength(6);
    expect(queries.some((q) => q.includes('DELETE FROM "SiweNonce"') && q.includes('LIMIT $1'))).toBe(true);
    expect(queries.some((q) => q.includes('DELETE FROM "StatusUpdate"'))).toBe(true);
  });
});
