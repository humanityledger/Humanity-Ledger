/**
 * Quota for sponsored transactions (POST /api/aztec/sponsor; LedgerSponsor, docs/SPONSOR.md). Server only.
 *
 * Two sliding windows: per wallet, for life (AZTEC_SPONSOR_PER_WALLET), and for everyone, per day
 * (AZTEC_SPONSOR_PER_DAY). A request takes a slot in both windows or in neither:
 *   - add, then count: the count includes this request, so concurrent requests at the boundary can
 *     never all pass (at worst one is refused that a strictly serial order would have let in);
 *   - a refused request removes what it added, so a refusal uses up nothing.
 * Before, each window was a separate checkRateLimit call, which records every request even when it
 * is refused: a wallet that asked on a day the daily limit was reached lost one of its lifetime
 * sponsored transactions per attempt, and got nothing for it.
 *
 * Store unavailable: refused ('unavailable'). The sponsor pays real Fee Juice, and per-process
 * windows would multiply the limits by the number of server replicas.
 *
 * The keys are those checkRateLimit used, so existing counts carry over and the /protocol
 * dashboard keeps reading the daily window (lib/protocol/read.ts).
 */
import { randomUUID } from 'node:crypto';

export interface QuotaStore {
  /** Drops entries scored before `since`, adds `member` at `now`, returns the count including it. */
  add(key: string, now: number, since: number, member: string, ttlSec: number): Promise<number>;
  remove(key: string, member: string): Promise<void>;
}

export interface SponsorLimits {
  perWallet: number;
  perDay: number;
}

export type QuotaResult = 'ok' | 'used-up' | 'daily-limit' | 'unavailable';

export const WALLET_WINDOW_S = 10 * 365 * 86400;
export const DAY_WINDOW_S = 86400;
export const DAY_KEY = 'aztec-sponsor-day:all';
export const walletKey = (wallet: string) => `aztec-sponsor:w:${wallet.toLowerCase()}`;

export async function takeSponsorSlot(store: QuotaStore, wallet: string, limits: SponsorLimits, now = Date.now()): Promise<QuotaResult> {
  const member = `${now}-${randomUUID()}`;
  const wk = walletKey(wallet);
  const added: string[] = [];
  try {
    const mine = await store.add(wk, now, now - WALLET_WINDOW_S * 1000, member, WALLET_WINDOW_S * 2);
    added.push(wk);
    if (mine > limits.perWallet) {
      await store.remove(wk, member);
      return 'used-up';
    }
    const all = await store.add(DAY_KEY, now, now - DAY_WINDOW_S * 1000, member, DAY_WINDOW_S * 2);
    added.push(DAY_KEY);
    if (all > limits.perDay) {
      await Promise.all([store.remove(DAY_KEY, member), store.remove(wk, member)]);
      return 'daily-limit';
    }
    return 'ok';
  } catch {
    // Best effort: give back what was taken. If that fails too, the slot stays used (the safe side).
    await Promise.all(added.map((k) => store.remove(k, member).catch(() => undefined)));
    return 'unavailable';
  }
}

/** The quota store on Redis (ioredis): MULTI, so prune, add and count run as one step. */
export function redisQuotaStore(redis: any): QuotaStore {
  return {
    async add(key, now, since, member, ttlSec) {
      if (typeof redis?.multi !== 'function') throw new Error('no Redis transaction support');
      const res = await redis.multi().zremrangebyscore(key, '-inf', since).zadd(key, now, member).zcard(key).expire(key, ttlSec).exec();
      if (!Array.isArray(res) || !Array.isArray(res[2])) throw new Error('Redis transaction aborted');
      const [err, count] = res[2];
      if (err) throw err;
      return Number(count);
    },
    async remove(key, member) {
      await redis.zrem(key, member);
    },
  };
}
