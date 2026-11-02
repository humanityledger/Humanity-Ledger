/**
 * Server-side plan resolution and usage metering for Ledger Studio.
 *
 * Usage is metered in estimated USD of model cost per wallet, per UTC day
 * and per UTC month, in Redis (fast, shared by every instance). A request is
 * refused before it reaches the model when today's or this month's budget is
 * spent, and refused outright when the meter cannot be read: Studio spends
 * money on every call, so it fails closed.
 *
 * The Free plan also has a shared daily ceiling for all wallets together
 * (STUDIO_FREE_DAILY_GLOBAL_USD), because wallets cost nothing to create.
 */

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { redisClient, safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { STUDIO_PLANS, type StudioPlan, type StudioPlanId } from './models';

/** Tiers that include Studio Pro. */
const PRO_TIERS = new Set(['STUDIO_PRO', 'FULL_NODE', 'ARCHIVE_PROVER', 'PRO', 'ENTERPRISE']);

export function planForTier(tier: string | null | undefined, isPro?: boolean | null): StudioPlanId {
  if (isPro) return 'pro';
  return PRO_TIERS.has(String(tier ?? '').toUpperCase()) ? 'pro' : 'free';
}

/**
 * `tier:<wallet>` is written by several services, as a bare tier ("PRO") or
 * as JSON ({"tier":"PRO",...}). Read both.
 */
export function tierFromCache(raw: string | null | undefined): string | null {
  if (!raw || raw === 'TIMEOUT') return null;
  const s = raw.trim();
  if (s.startsWith('{')) {
    try {
      const t = JSON.parse(s)?.tier;
      return typeof t === 'string' && t ? t : null;
    } catch {
      return null;
    }
  }
  return s;
}

export async function resolvePlan(wallet: string): Promise<StudioPlan> {
  const w = wallet.toLowerCase();
  const cached = tierFromCache(await safeRedisGet(`tier:${w}`));
  if (cached) return STUDIO_PLANS[planForTier(cached)];
  try {
    const u = await prisma.user.findUnique({ where: { walletAddress: w }, select: { tier: true, isPro: true } });
    const plan = planForTier(u?.tier, u?.isPro);
    if (u?.tier) await safeRedisSet(`tier:${w}`, u.isPro ? 'PRO' : u.tier, 'EX', 600);
    return STUDIO_PLANS[plan];
  } catch {
    return STUDIO_PLANS.free;
  }
}

export function usageKeys(wallet: string, now = new Date()) {
  const d = now.toISOString().slice(0, 10);
  const m = now.toISOString().slice(0, 7);
  const w = wallet.toLowerCase();
  return {
    day: `studio:usage:${w}:d:${d}`,
    month: `studio:usage:${w}:m:${m}`,
    dayTokens: `studio:tokens:${w}:d:${d}`,
    monthTokens: `studio:tokens:${w}:m:${m}`,
    searches: `studio:search:${w}:m:${m}`,
    requests: `studio:req:${w}:m:${m}`,
    globalFreeDay: `studio:usage:global:free:d:${d}`,
  };
}

/** Micro-dollars, so counters stay integers. */
const MICRO = 1_000_000;

export function freeGlobalDailyCapUsd(): number {
  const v = Number(process.env.STUDIO_FREE_DAILY_GLOBAL_USD);
  return Number.isFinite(v) && v >= 0 ? v : 25;
}

async function readInt(key: string): Promise<{ n: number; ok: boolean }> {
  const v = await safeRedisGet(key);
  if (v === 'TIMEOUT') return { n: 0, ok: false };
  if (!v) return { n: 0, ok: true };
  const n = Number(v);
  return { n: Number.isFinite(n) ? n : 0, ok: true };
}

export interface UsageSnapshot {
  plan: StudioPlan;
  todayUsd: number;
  monthUsd: number;
  todayTokens: number;
  monthTokens: number;
  monthSearches: number;
  monthRequests: number;
  remainingTodayUsd: number;
  remainingMonthUsd: number;
  resetsDayAt: string;
  resetsMonthAt: string;
  /** False when the meter could not be read; Studio must not call the model then. */
  meteringAvailable: boolean;
  /** Free plan only: the shared daily ceiling for all free wallets is spent. */
  freeCapacityReached: boolean;
}

export async function readUsage(wallet: string, plan?: StudioPlan, now = new Date()): Promise<UsageSnapshot> {
  const p = plan ?? (await resolvePlan(wallet));
  const k = usageKeys(wallet, now);
  const reads = await Promise.all([
    readInt(k.day), readInt(k.month), readInt(k.dayTokens), readInt(k.monthTokens), readInt(k.searches), readInt(k.requests),
    p.id === 'free' ? readInt(k.globalFreeDay) : Promise.resolve({ n: 0, ok: true }),
  ]);
  const [day, month, dt, mt, s, r, global] = reads;
  const todayUsd = day.n / MICRO;
  const monthUsd = month.n / MICRO;
  const nextDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    plan: p,
    todayUsd, monthUsd, todayTokens: dt.n, monthTokens: mt.n, monthSearches: s.n, monthRequests: r.n,
    remainingTodayUsd: Math.max(0, p.dailyBudgetUsd - todayUsd),
    remainingMonthUsd: Math.max(0, p.monthlyBudgetUsd - monthUsd),
    resetsDayAt: nextDay.toISOString(),
    resetsMonthAt: nextMonth.toISOString(),
    meteringAvailable: day.ok && month.ok && global.ok,
    freeCapacityReached: p.id === 'free' && global.n / MICRO >= freeGlobalDailyCapUsd(),
  };
}

export async function recordUsage(wallet: string, costUsd: number, tokens: number, searches: number, planId: StudioPlanId = 'free', now = new Date()): Promise<void> {
  const k = usageKeys(wallet, now);
  const micro = Math.max(0, Math.round(costUsd * MICRO));
  const tok = Math.max(0, Math.round(tokens));
  try {
    const multi = (redisClient as any).multi?.();
    if (!multi) throw new Error('no multi');
    multi.incrby(k.day, micro).expire(k.day, 2 * 86_400);
    multi.incrby(k.month, micro).expire(k.month, 40 * 86_400);
    multi.incrby(k.dayTokens, tok).expire(k.dayTokens, 2 * 86_400);
    multi.incrby(k.monthTokens, tok).expire(k.monthTokens, 40 * 86_400);
    if (searches > 0) multi.incrby(k.searches, searches).expire(k.searches, 40 * 86_400);
    multi.incr(k.requests).expire(k.requests, 40 * 86_400);
    if (planId === 'free') multi.incrby(k.globalFreeDay, micro).expire(k.globalFreeDay, 2 * 86_400);
    await multi.exec();
  } catch {
    // No real Redis (in-memory fallback): best-effort read-modify-write.
    const add = async (key: string, n: number, ttl: number) => {
      if (n <= 0) return;
      const cur = await readInt(key);
      await safeRedisSet(key, String(cur.n + n), 'EX', ttl);
    };
    await add(k.day, micro, 2 * 86_400);
    await add(k.month, micro, 40 * 86_400);
    await add(k.dayTokens, tok, 2 * 86_400);
    await add(k.monthTokens, tok, 40 * 86_400);
    await add(k.searches, searches, 40 * 86_400);
    await add(k.requests, 1, 40 * 86_400);
    if (planId === 'free') await add(k.globalFreeDay, micro, 2 * 86_400);
  }
}

export interface FreeReservation {
  key: string;
  micro: number;
}

/**
 * Hold part of the shared Free-plan ceiling for one turn before it starts.
 * Without this, many new wallets starting turns at the same moment would all
 * pass the "is there capacity left" check before any of them is metered.
 * The hold is released when the turn ends (recordUsage adds what it really
 * cost), so the counter is exact afterwards. Returns null when the ceiling
 * would be passed or the counter cannot be read (fail closed).
 */
export async function reserveFreeCapacity(usd: number, now = new Date()): Promise<FreeReservation | null> {
  const key = usageKeys('global', now).globalFreeDay;
  const micro = Math.max(1, Math.round(usd * MICRO));
  const cap = Math.round(freeGlobalDailyCapUsd() * MICRO);
  const r: any = redisClient;
  if (!r.__isMock && typeof r.incrby === 'function') {
    try {
      const after = Number(await r.incrby(key, micro));
      await r.expire(key, 2 * 86_400);
      if (!Number.isFinite(after) || after > cap) {
        await r.decrby(key, micro).catch(() => {});
        return null;
      }
      return { key, micro };
    } catch {
      return null;
    }
  }
  // In-memory fallback (local development without Redis).
  const cur = await readInt(key);
  if (!cur.ok || cur.n + micro > cap) return null;
  await safeRedisSet(key, String(cur.n + micro), 'EX', 2 * 86_400);
  return { key, micro };
}

export async function releaseFreeCapacity(res: FreeReservation | null): Promise<void> {
  if (!res) return;
  const r: any = redisClient;
  try {
    if (!r.__isMock && typeof r.decrby === 'function') {
      await r.decrby(res.key, res.micro);
      return;
    }
    const cur = await readInt(res.key);
    if (cur.ok) await safeRedisSet(res.key, String(Math.max(0, cur.n - res.micro)), 'EX', 2 * 86_400);
  } catch { /* the key expires in two days */ }
}

/** Longer than the longest turn (the route stops itself at ~270 s). */
export const TURN_LOCK_TTL_SECONDS = 330;

/**
 * Per-wallet concurrency guard: one streaming turn at a time. Returns a token
 * that must be passed to releaseTurnLock, so a turn can only release its own
 * lock (not one taken after its own lock expired).
 */
export async function acquireTurnLock(wallet: string, ttlSeconds = TURN_LOCK_TTL_SECONDS): Promise<string | null> {
  const key = `studio:lock:${wallet.toLowerCase()}`;
  const token = randomBytes(16).toString('hex');
  const r: any = redisClient;
  try {
    if (r.__isMock) {
      // The in-memory fallback ignores NX, so check first.
      if (await r.get(key)) return null;
      await r.setex(key, ttlSeconds, token);
      return token;
    }
    const res = await r.set(key, token, 'EX', ttlSeconds, 'NX');
    return res === 'OK' || res === true ? token : null;
  } catch {
    return null; // cannot guarantee one turn at a time: refuse
  }
}

const RELEASE_LUA = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export async function releaseTurnLock(wallet: string, token: string): Promise<void> {
  const key = `studio:lock:${wallet.toLowerCase()}`;
  const r: any = redisClient;
  try {
    if (!r.__isMock && typeof r.eval === 'function') {
      await r.eval(RELEASE_LUA, 1, key, token);
      return;
    }
    if ((await r.get(key)) === token) await r.del(key);
  } catch { /* the lock expires on its own */ }
}
