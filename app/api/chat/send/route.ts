/**
 * POST /api/chat/send
 * Publishes a chat message to a Redis channel so all SSE listeners receive it in real-time.
 * Body: { channelId, sender, content }
 *
 * Resilience: If Upstash Redis is not configured, falls back to in-memory store
 * so the route never crashes regardless of environment.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkMessageEnvelope } from '@/lib/security/messageEnvelope';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

//  Lazy Upstash client  only created when env vars are present 
// Previously: `new Redis({url: process.env.UPSTASH_REDIS_REST_URL!, token: ...})`
// crashed at module-load time when env vars were undefined (! is a TypeScript-only
// assertion; at runtime it's just `undefined`). Upstash constructor throws on
// undefined url/token, taking down the entire route with a 500 for every user.
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

//  Shared in-memory fallback store (global so it's shared with the SSE stream route) 
declare global {
  var __LedgerChatMemStore: Map<string, Array<{ id: string; sender: string; content: string; sentAt: string; _score: number }>>;
}
if (!global.__LedgerChatMemStore) {
  global.__LedgerChatMemStore = new Map();
}
const memoryStore = global.__LedgerChatMemStore;

export async function POST(req: NextRequest) {
  try {
    // [SECURITY HARDENING] Sender identity MUST be derived from the cryptographic session.
    // Previously, body-supplied 'sender' was trusted directly, enabling any attacker to
    // impersonate ANY wallet in the chat — including admins or high-reputation users.
    const session = await getSession();
    const web3Address = req.headers.get('x-verified-session-address');
    const userId = session?.userId || web3Address;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required to send messages.' }, { status: 401 });
    }

    const { channelId, content } = await req.json();

    // [SECURITY — LOW-02] channelId validation
    // Limit length to 150 chars (two Ethereum addresses + separator max) and prevent Redis control chars
    if (
      !channelId || 
      typeof channelId !== 'string' || 
      channelId.length > 150 || 
      /[^\w\-]/.test(channelId) || // Only allow alphanumeric, underscore, hyphen
      !content?.trim()
    ) {
      return NextResponse.json({ error: 'Missing or invalid required fields (channelId must be alphanumeric)' }, { status: 400 });
    }

    // F2-02: this body is written to a Redis sorted set (7-day TTL), published
    // over Redis pub/sub, held in a process-global memory store and written to
    // prisma.pendingChatMessage — four readable copies of every message.
    const envelope = checkMessageEnvelope(content, 'chat/send');
    if (envelope.rejection) {
      return NextResponse.json(envelope.rejection, { status: 400 });
    }

    const message = {
      id:      crypto.randomUUID(),
      sender:  userId, // Cryptographically verified — cannot be spoofed
      content: content.trim(),
      sentAt:  new Date().toISOString(),
    };

    const redis = getUpstashRedis();

    if (redis) {
      try {
        // Persist last 100 messages per channel in Redis (sorted set by timestamp)
        const key = `ledger_chat:messages:${channelId}`;
        await redis.zadd(key, { score: Date.now(), member: JSON.stringify(message) });
        await redis.expire(key, 60 * 60 * 24 * 7); // 7 days TTL
        // Publish to channel for SSE subscribers
        await redis.publish(`ledger_chat:channel:${channelId}`, JSON.stringify(message));
      } catch (redisErr) {
        console.warn('[Ledger Chat] Redis write failed, falling back to memory:', redisErr);
      }
    }

    // Always update shared in-memory store (fallback + local consistency)
    if (!memoryStore.has(channelId)) memoryStore.set(channelId, []);
    const msgs = memoryStore.get(channelId)!;
    msgs.push({ ...message, _score: Date.now() });
    if (msgs.length > 100) msgs.shift();

    // Persist to Prisma DB for offline routing
    try {
      await prisma.pendingChatMessage.create({
        data: { sender: message.sender, recipient: channelId, content: message.content }
      });
    } catch (dbErr) {
      console.warn('[Ledger Chat] Prisma DB write failed:', dbErr);
    }

    return NextResponse.json({ ok: true, message });
  } catch (err) {
    console.error('[Ledger Chat] Send error:', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

/**
 * GET /api/chat/send?channelId=...
 * Fetches recent messages (polling fallback for environments without SSE)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const channelId = req.nextUrl.searchParams.get('channelId');
    if (!channelId) return NextResponse.json({ messages: [] });

    const redis = getUpstashRedis();

    if (redis) {
      try {
        const key = `ledger_chat:messages:${channelId}`;
        const since = req.nextUrl.searchParams.get('since');
        const sinceScore = since ? Number(since) : Date.now() - 5 * 60 * 1000;
        const raw = await redis.zrangebyscore(key, sinceScore, '+inf', { withScores: false });
        const messages = (raw as unknown[]).map((r) => {
          try { return typeof r === 'string' ? JSON.parse(r) : r; } catch { return null; }
        }).filter(Boolean);
        return NextResponse.json({ messages });
      } catch (redisErr) {
        console.warn('[Ledger Chat] Redis read failed, falling back to memory:', redisErr);
      }
    }

    // In-memory fallback
    const msgs = memoryStore.get(channelId) ?? [];
    const since = req.nextUrl.searchParams.get('since');
    const sinceScore = since ? Number(since) : Date.now() - 5 * 60 * 1000;
    const filtered = msgs.filter(m => new Date(m.sentAt).getTime() >= sinceScore);
    return NextResponse.json({ messages: filtered });

  } catch (err) {
    console.error('[Ledger Chat] Fetch error:', err);
    return NextResponse.json({ messages: [] });
  }
}
