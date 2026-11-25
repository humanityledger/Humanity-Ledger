import { EventEmitter } from 'node:events';

export interface ChatChannelMessage {
  id: string;
  sender: string;
  content: string;
  sentAt: string;
  _score?: number;
}

interface ChannelEntry {
  emitter: EventEmitter;
  refCount: number;
  lastScore: number;
  pollTimer: ReturnType<typeof setInterval> | null;
  pollCalls: number;
  inFlight: boolean;
}

let _upstashRedis: any = undefined;
function getUpstashRedis(): any | null {
  if (_upstashRedis !== undefined) return _upstashRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _upstashRedis = null;
    return null;
  }
  try {
    const { Redis } = require('@upstash/redis');
    _upstashRedis = new Redis({ url, token });
    return _upstashRedis;
  } catch {
    _upstashRedis = null;
    return null;
  }
}

declare global {
  var __LedgerChatMemStore: Map<string, ChatChannelMessage[]>;
}
if (!globalThis.__LedgerChatMemStore) {
  globalThis.__LedgerChatMemStore = new Map();
}

const POLL_INTERVAL_MS = 1500;

/**
 * Shared pod-level per-channel SSE multiplexer.
 * Keeps at most ONE poll timer per active channelId on the pod regardless of how
 * many subscribers listen to the channel, plus instant local push via `publishLocal`.
 */
class ChatStreamHub {
  private readonly channels = new Map<string, ChannelEntry>();

  getStats(channelId?: string) {
    if (channelId) {
      const c = this.channels.get(channelId);
      return c
        ? { listeners: c.refCount, hasTimer: Boolean(c.pollTimer), pollCalls: c.pollCalls }
        : { listeners: 0, hasTimer: false, pollCalls: 0 };
    }
    return { activeChannels: this.channels.size };
  }

  publishLocal(channelId: string, msg: ChatChannelMessage): void {
    const entry = this.channels.get(channelId);
    if (!entry) return;
    entry.lastScore = Math.max(entry.lastScore, msg._score ?? Date.now());
    entry.emitter.emit('message', msg);
  }

  subscribe(channelId: string, onMessage: (msg: ChatChannelMessage) => void): () => void {
    let entry = this.channels.get(channelId);
    if (!entry) {
      const emitter = new EventEmitter();
      emitter.setMaxListeners(0);
      entry = {
        emitter,
        refCount: 0,
        lastScore: Date.now() - 500,
        pollTimer: null,
        pollCalls: 0,
        inFlight: false,
      };
      this.channels.set(channelId, entry);
    }

    entry.emitter.on('message', onMessage);
    entry.refCount += 1;

    if (!entry.pollTimer) {
      void this.pollChannel(channelId, entry);
      entry.pollTimer = setInterval(() => {
        void this.pollChannel(channelId, entry!);
      }, POLL_INTERVAL_MS);
      entry.pollTimer.unref?.();
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const cur = this.channels.get(channelId);
      if (!cur) return;
      cur.emitter.off('message', onMessage);
      cur.refCount = Math.max(0, cur.refCount - 1);
      if (cur.refCount === 0) {
        if (cur.pollTimer) {
          clearInterval(cur.pollTimer);
          cur.pollTimer = null;
        }
        this.channels.delete(channelId);
      }
    };
  }

  private async pollChannel(channelId: string, entry: ChannelEntry): Promise<void> {
    if (entry.inFlight || entry.refCount <= 0) return;
    entry.inFlight = true;
    try {
      entry.pollCalls += 1;
      const redis = getUpstashRedis();
      let newMessages: ChatChannelMessage[] = [];

      if (redis) {
        const key = `ledger_chat:messages:${channelId}`;
        const raw = await redis.zrangebyscore(key, entry.lastScore + 1, '+inf', { withScores: false });
        if (Array.isArray(raw) && raw.length > 0) {
          newMessages = raw
            .map((r: unknown) => {
              try {
                return typeof r === 'string' ? JSON.parse(r) : r;
              } catch {
                return null;
              }
            })
            .filter(Boolean) as ChatChannelMessage[];
        }
      } else {
        const msgs = globalThis.__LedgerChatMemStore.get(channelId) ?? [];
        newMessages = msgs.filter((m) => (m._score ?? new Date(m.sentAt).getTime()) > entry.lastScore);
      }

      if (newMessages.length > 0) {
        entry.lastScore = Date.now();
        for (const msg of newMessages) {
          entry.emitter.emit('message', msg);
        }
      }
    } catch {
      // Transient read errors never tear down shared subscribers.
    } finally {
      entry.inFlight = false;
    }
  }
}

const g = globalThis as unknown as { __hlChatStreamHub?: ChatStreamHub };
export const chatStreamHub = g.__hlChatStreamHub ?? (g.__hlChatStreamHub = new ChatStreamHub());

export function _resetChatStreamHubUpstashForTests(): void {
  _upstashRedis = undefined;
}
