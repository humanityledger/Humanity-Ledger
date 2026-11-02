import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
/**
 * GET /api/chat/stream/[channelId]
 * Server-Sent Events endpoint. Streams new messages to connected clients in real-time.
 * Uses Upstash Redis polling (Upstash doesn't support SUBSCRIBE, so we poll zrangebyscore).
 *
 * Resilience: If Upstash is not configured, falls back to in-memory message store
 * so the SSE channel still works in development and on environments without Redis.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

//  Lazy Upstash client  avoids module-level crash when env vars are missing 
let _upstashRedis: any = null;
function getUpstashRedis(): any | null {
  if (_upstashRedis) return _upstashRedis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = require('@upstash/redis');
    _upstashRedis = new Redis({ url, token });
    return _upstashRedis;
  } catch {
    return null;
  }
}

//  In-memory fallback store (same instance shared with chat/send/route.ts
//    only when both run in the same Node.js process  fine for dev/single instance) 
declare global {
  var __LedgerChatMemStore: Map<string, Array<{ id: string; sender: string; content: string; sentAt: string; _score: number }>>;
}
if (!global.__LedgerChatMemStore) {
  global.__LedgerChatMemStore = new Map();
}
const memoryStore = global.__LedgerChatMemStore;


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession();
  if (!session?.userId) {
    return new Response('Unauthorized', { status: 401 });
  }
  const { channelId } = await params;

  // ── [SECURITY — HIGH-05] SSE Channel Authorization ────────────────────────
  // Without this, any authenticated user can subscribe to another user's
  // private message stream. An attacker with a valid session could receive
  // all real-time messages sent to any address they know, in clear text.
  // A valid channelId must be:
  //   (a) the user's own address (self-channel), OR
  //   (b) a conversation channel where the user's address is an exact segment
  //       (composite channels like "0xAlice_0xBob" — checked by splitting on _ or -)
  const userAddr = session.userId.toLowerCase();
  const chanLower = channelId.toLowerCase();
  const chanSegments = chanLower.split(/[_\-]/);
  const isAuthorized = chanLower === userAddr || chanSegments.includes(userAddr);
  if (!isAuthorized) {
    return new Response('Forbidden: You are not a participant in this channel.', { status: 403 });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const encoder = new TextEncoder();
  let lastScore = Date.now() - 500; // start slightly in the past to pick up very recent msgs
  let closed = false;

  const redis = getUpstashRedis();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(': heartbeat\n\n'));

      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Poll for new messages (Redis or in-memory)
      const poll = async () => {
        if (closed) return;
        try {
          let newMessages: any[] = [];

          if (redis) {
            //  Redis path 
            const key = `ledger_chat:messages:${channelId}`;
            const raw = await redis.zrangebyscore(key, lastScore + 1, '+inf', { withScores: false });
            if (raw && raw.length > 0) {
              newMessages = (raw as unknown[]).map((r) => {
                try { return typeof r === 'string' ? JSON.parse(r) : r; } catch { return null; }
              }).filter(Boolean);
            }
          } else {
            //  In-memory fallback 
            const msgs = memoryStore.get(channelId) ?? [];
            newMessages = msgs.filter(m => (m._score ?? new Date(m.sentAt).getTime()) > lastScore);
          }

          if (newMessages.length > 0) {
            lastScore = Date.now();
            for (const msg of newMessages) {
              send({ type: 'message', payload: msg });
            }
          }
        } catch (err) {
          // Any error  send heartbeat to keep connection alive rather than dying
          send({ type: 'heartbeat' });
        }
      };

      // Heartbeat every 15s to prevent proxy/load-balancer timeouts
      const heartbeatInterval = setInterval(() => {
        if (closed) { clearInterval(heartbeatInterval); return; }
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch { closed = true; }
      }, 15_000);

      // Poll every 800ms
      const pollInterval = setInterval(async () => {
        if (closed) {
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          return;
        }
        await poll();
      }, 800);

      // Initial poll
      await poll();

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering for Railway
    },
  });
}
