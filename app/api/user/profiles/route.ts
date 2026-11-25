import { NextRequest, NextResponse } from 'next/server';
import { prisma, prismaRead } from '@/lib/prisma';
import * as redisModule from '@/lib/redis';

export const dynamic = 'force-dynamic';

const ADDRESS = /^0x[0-9a-f]{40}$/;
const MAX = 100;
const PROFILE_CACHE_TTL_S = 120;

async function batchGetProfiles(keys: string[]) {
  if (Object.prototype.hasOwnProperty.call(redisModule, 'safeRedisMGet') && typeof redisModule.safeRedisMGet === 'function') {
    return redisModule.safeRedisMGet(keys);
  }
  return Promise.all(keys.map((k) => redisModule.safeRedisGet(k)));
}

async function batchSetProfiles(entries: Array<{ key: string; value: string; ttlSec: number }>) {
  if (Object.prototype.hasOwnProperty.call(redisModule, 'safeRedisSetMany') && typeof redisModule.safeRedisSetMany === 'function') {
    return redisModule.safeRedisSetMany(entries);
  }
  await Promise.all(entries.map((e) => redisModule.safeRedisSet(e.key, e.value, 'EX', e.ttlSec)));
}

/**
 * POST /api/user/profiles  { addresses: string[] }  ->  { profiles: { [address]: { displayName, avatarUrl } } }
 * Uses single-round-trip Redis MGET + pipeline SET and exact lowercase IN(...) against the unique B-tree index.
 */
export async function POST(req: NextRequest) {
  const sessionAddress = req.headers.get('x-verified-session-address');
  if (!sessionAddress) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const raw = (body as { addresses?: unknown })?.addresses;
  if (!Array.isArray(raw)) return NextResponse.json({ error: 'addresses must be an array' }, { status: 400 });
  const addresses = [...new Set(raw.filter((a): a is string => typeof a === 'string').map((a) => a.trim().toLowerCase()).filter((a) => ADDRESS.test(a)))].slice(0, MAX);
  if (!addresses.length) return NextResponse.json({ profiles: {} });

  try {
    const profiles: Record<string, { displayName: string | null; avatarUrl: string | null }> = {};
    const missing: string[] = [];
    const cacheKeys = addresses.map((addr) => `profile:pub:${addr}`);
    const cachedValues = await batchGetProfiles(cacheKeys);

    addresses.forEach((addr, idx) => {
      const cached = cachedValues[idx];
      if (cached && cached !== 'TIMEOUT') {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            profiles[addr] = {
              displayName: parsed.displayName || parsed.chatName || null,
              avatarUrl: parsed.avatarUrl || null,
            };
            return;
          }
        } catch {}
      }
      missing.push(addr);
    });

    if (missing.length > 0) {
      const dbRead = prismaRead ?? prisma;
      const users = await dbRead.user.findMany({
        where: { walletAddress: { in: missing } },
        select: { walletAddress: true, displayName: true, chatName: true, avatarUrl: true },
        take: MAX,
      });
      const toCache: Array<{ key: string; value: string; ttlSec: number }> = [];
      for (const u of users as any[]) {
        const a = (u.walletAddress || '').toLowerCase();
        if (!a) continue;
        profiles[a] = { displayName: u.displayName || u.chatName || null, avatarUrl: u.avatarUrl || null };
        toCache.push({
          key: `profile:pub:${a}`,
          value: JSON.stringify({ walletAddress: a, displayName: u.displayName, chatName: u.chatName, avatarUrl: u.avatarUrl }),
          ttlSec: PROFILE_CACHE_TTL_S,
        });
      }
      await batchSetProfiles(toCache);
    }

    return NextResponse.json({ profiles }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch {
    return NextResponse.json({ error: 'Profiles are not available right now' }, { status: 503 });
  }
}
