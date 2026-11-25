import { EventEmitter } from 'node:events';
import * as prismaModule from '@/lib/prisma';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';

function getStreamReadDb() {
  return Object.prototype.hasOwnProperty.call(prismaModule, 'prismaRead')
    ? (prismaModule as { prismaRead?: typeof prismaModule.prisma }).prismaRead ?? prismaModule.prisma
    : prismaModule.prisma;
}
import { safeJsonParse } from '@/lib/utils/json';

export interface LedgerAlertPayload {
  hash?: string | null;
  from?: string | null;
  to?: string | null;
  asset?: string | null;
  amount?: unknown;
  usdValue?: unknown;
  chain?: string | null;
  type?: string | null;
  timestamp?: string;
  isHistorical?: boolean;
}

export type StreamPacket =
  | { event: 'ledger'; data: LedgerAlertPayload }
  | { event: 'auth-complete'; data: unknown }
  | { event: 'heartbeat'; data: { ts: number } }
  | { event: 'error'; data: { message: string } };

const CATCHUP_REDIS_KEY = 'ledger:stream:catchup:v1';
const CATCHUP_TTL_MS = 10_000;
const CATCHUP_TTL_SEC = 10;

let memoryCatchup: { expiresAt: number; rows: LedgerAlertPayload[] } | null = null;
let catchupInFlight: Promise<LedgerAlertPayload[]> | null = null;

/**
 * Fetches recent ledger activity once every 10s across the cluster (Redis L2 + L1 single-flight),
 * preventing reconnect storms from hammering PostgreSQL.
 */
export async function getCachedLedgerCatchup(): Promise<LedgerAlertPayload[]> {
  const now = Date.now();
  if (memoryCatchup && now < memoryCatchup.expiresAt) {
    return memoryCatchup.rows;
  }
  if (catchupInFlight) return catchupInFlight;

  catchupInFlight = (async () => {
    try {
      const cached = await safeRedisGet(CATCHUP_REDIS_KEY);
      if (cached && cached !== 'TIMEOUT') {
        const parsed = safeJsonParse<LedgerAlertPayload[] | null>(cached, null, 'LEDGER_CATCHUP_CACHE');
        if (Array.isArray(parsed)) {
          memoryCatchup = { expiresAt: Date.now() + CATCHUP_TTL_MS, rows: parsed };
          return parsed;
        }
      }

      const history = await getStreamReadDb().ledgerActivity.findMany({
        orderBy: { timestamp: 'desc' },
        take: 15,
      });

      const formatted: LedgerAlertPayload[] = history
        .slice()
        .reverse()
        .map((row: any) => ({
          hash: row.transactionHash,
          from: row.fromAddress,
          to: row.toAddress,
          asset: row.token,
          amount: row.amount,
          usdValue: row.usdValue,
          chain: row.chain,
          type: row.type,
          timestamp: row.timestamp?.toISOString?.() ?? undefined,
          isHistorical: true,
        }));

      memoryCatchup = { expiresAt: Date.now() + CATCHUP_TTL_MS, rows: formatted };
      await safeRedisSet(CATCHUP_REDIS_KEY, JSON.stringify(formatted), 'EX', CATCHUP_TTL_SEC).catch(() => {});
      return formatted;
    } catch {
      return memoryCatchup?.rows ?? [];
    } finally {
      catchupInFlight = null;
    }
  })();

  return catchupInFlight;
}

class LedgerStreamHub {
  private readonly emitter = new EventEmitter();
  private refCount = 0;
  private running = false;
  private subClient: any = null;
  private xreadClient: any = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private loopPromise: Promise<void> | null = null;
  private authSubscribeCalls = 0;

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  getStats() {
    return {
      subscribers: this.refCount,
      running: this.running,
      hasAuthSubscriber: Boolean(this.subClient),
      authSubscribeCalls: this.authSubscribeCalls,
    };
  }

  subscribe(listener: (pkt: StreamPacket) => void): () => void {
    this.emitter.on('packet', listener);
    this.refCount += 1;
    if (this.refCount === 1) {
      void this.start();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.emitter.off('packet', listener);
      this.refCount = Math.max(0, this.refCount - 1);
      if (this.refCount === 0) {
        void this.stop();
      }
    };
  }

  private emit(pkt: StreamPacket) {
    this.emitter.emit('packet', pkt);
  }

  private async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const { redisClient, createRedisClient, createSubClient } = await import('@/lib/redis/client');
    if (!this.running) return;

    const hasRealRedis = !(redisClient as any).__isMock && !(redisClient as any).__isBuildMock;

    // 1. Single pod-level Pub/Sub subscriber for auth handshakes
    if (hasRealRedis && !this.subClient) {
      try {
        const sub = createSubClient('ledger_auth_hub');
        this.subClient = sub;
        this.authSubscribeCalls += 1;
        if (typeof sub.on === 'function') {
          sub.on('message', (channel: string, message: string) => {
            if (channel !== 'system_mesh_auth_bus') return;
            const event = safeJsonParse<unknown>(message, null, 'AUTH_BUS_MESSAGE');
            if (event) this.emit({ event: 'auth-complete', data: event });
          });
        }
        if (typeof sub.subscribe === 'function') {
          await sub.subscribe('system_mesh_auth_bus').catch(() => {});
        }
      } catch {
        this.subClient = null;
      }
    }

    // 2. Shared 15s heartbeat broadcast across all connected clients on this pod
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        if (!this.running) return;
        this.emit({ event: 'heartbeat', data: { ts: Date.now() } });
      }, 15_000);
      this.heartbeatTimer.unref?.();
    }

    // 3. Dedicated single blocking XREAD connection OR single Prisma poller loop
    if (!this.loopPromise) {
      this.loopPromise = this.runFeedLoop(hasRealRedis, createRedisClient).finally(() => {
        this.loopPromise = null;
      });
    }
  }

  private async runFeedLoop(
    hasRealRedis: boolean,
    createRedisClient: (cfg: { name?: string }) => any,
  ): Promise<void> {
    let redisStreamId = '$';
    let lastPrismaId: string | undefined;

    if (hasRealRedis) {
      try {
        this.xreadClient = createRedisClient({ name: 'ledger_stream_hub_xread' });
      } catch {
        this.xreadClient = null;
      }
    }

    while (this.running) {
      try {
        if (this.xreadClient && !(this.xreadClient as any).__isMock) {
          const result = await (this.xreadClient as any).xread(
            'BLOCK',
            15000,
            'STREAMS',
            'ledger:alert:stream',
            redisStreamId,
          );
          if (!this.running) break;
          if (Array.isArray(result) && result[0]?.[1]) {
            const messages = result[0][1];
            for (const msg of messages) {
              redisStreamId = msg[0];
              const jsonPayload = msg[1]?.[1];
              if (jsonPayload) {
                const alert = safeJsonParse<LedgerAlertPayload | null>(jsonPayload, null, 'LEDGER_XREAD_STREAM');
                if (alert) this.emit({ event: 'ledger', data: alert });
              }
            }
          }
        } else {
          const where = lastPrismaId ? { id: { gt: lastPrismaId } } : {};
          const rows = await getStreamReadDb().ledgerActivity.findMany({
            where,
            orderBy: { timestamp: 'asc' },
            take: 10,
          });
          if (!this.running) break;
          for (const row of rows as any[]) {
            this.emit({
              event: 'ledger',
              data: {
                hash: row.transactionHash,
                from: row.fromAddress,
                to: row.toAddress,
                asset: row.token,
                amount: row.amount,
                usdValue: row.usdValue,
                chain: row.chain,
                type: row.type,
                timestamp: row.timestamp?.toISOString?.() ?? undefined,
              },
            });
            lastPrismaId = row.id;
          }
          await new Promise((r) => setTimeout(r, 5000));
        }
      } catch {
        if (!this.running) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.running && !this.subClient && !this.xreadClient) return;
    this.running = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    const sub = this.subClient;
    this.subClient = null;
    if (sub) {
      try {
        await sub.unsubscribe?.('system_mesh_auth_bus')?.catch?.(() => {});
        await sub.quit?.()?.catch?.(() => {});
      } catch {}
    }
    const xread = this.xreadClient;
    this.xreadClient = null;
    if (xread) {
      try {
        await xread.quit?.()?.catch?.(() => {});
        xread.disconnect?.();
      } catch {}
    }
  }
}

const g = globalThis as unknown as { __hlLedgerStreamHub?: LedgerStreamHub };
export const ledgerStreamHub = g.__hlLedgerStreamHub ?? (g.__hlLedgerStreamHub = new LedgerStreamHub());

export function _resetCatchupCacheForTests(): void {
  memoryCatchup = null;
  catchupInFlight = null;
}
