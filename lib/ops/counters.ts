/**
 * Package 6: hourly counters in Redis for the delivery and payment reports. A counter is a count
 * per event code and hour, kept 48 hours. It holds no account, address, message or amount, so it
 * is not personal data. Every call is bounded in time and never throws: reporting must not break
 * the report route, and a missing Redis reads as zero.
 */
import { redisClient } from '@/lib/redis/client';

const TTL_S = 48 * 3600;
const hourOf = (d: Date) => d.toISOString().slice(0, 13).replace(/[-T]/g, '');
const key = (group: string, code: string, hour: string) => `ops:${group}:${code}:${hour}`;
const bounded = <T>(p: Promise<T>, fallback: T, ms = 1500) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]).catch(() => fallback);

export async function bumpCounter(group: 'payment' | 'delivery', code: string, now = new Date()): Promise<void> {
  const k = key(group, code, hourOf(now));
  const r = redisClient as any;
  await bounded((async () => { await r.incr(k); await r.expire(k, TTL_S); })(), undefined);
}

/** Sum of each code over the last `hours` hours (including the current one). */
export async function readCounters(group: 'payment' | 'delivery', codes: readonly string[], hours = 24, now = new Date()): Promise<Record<string, number>> {
  const hoursList = Array.from({ length: hours }, (_, i) => hourOf(new Date(now.getTime() - i * 3600_000)));
  const r = redisClient as any;
  const out: Record<string, number> = {};
  for (const c of codes) {
    const vals: (string | null)[] = await bounded((async () => r.mget(...hoursList.map((h) => key(group, c, h))))(), []);
    out[c] = (Array.isArray(vals) ? vals : []).reduce((s, v) => s + (Number(v) || 0), 0);
  }
  return out;
}
