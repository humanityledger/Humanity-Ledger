/**
 * G-001 — Server-Sent Events endpoint
 * GET /api/events
 * Single SSE channel per authenticated user for real-time notifications,
 * contact requests, and presence updates.
 * Requires Redis pub/sub for multi-replica support (TODO[G-001]).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Keep connections alive with periodic pings
const PING_INTERVAL_MS = 25_000;
// Max connection duration (Railway has 60s timeout for idle connections)
const MAX_CONNECTION_MS = 55_000;

export async function GET(req: NextRequest) {
  const caller = await requireWallet(req);
  if (caller.errorResponse) return caller.errorResponse;

  const address = caller.walletAddress.toLowerCase();

  const encoder = new TextEncoder();
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      }

      function cleanup() {
        if (closed) return;
        closed = true;
        if (pingTimer) clearInterval(pingTimer);
        if (closeTimer) clearTimeout(closeTimer);
        try { controller.close(); } catch {}
      }

      // Send connected event immediately
      send('connected', { address, ts: Date.now() });

      // Periodic ping to keep connection alive
      pingTimer = setInterval(() => {
        send('ping', { ts: Date.now() });
      }, PING_INTERVAL_MS);

      // Auto-close after max duration (client will reconnect via EventSource)
      closeTimer = setTimeout(() => {
        send('reconnect', { reason: 'max_duration', ts: Date.now() });
        cleanup();
      }, MAX_CONNECTION_MS);

      // TODO[G-001]: Subscribe to Redis pub/sub channel `sse:${address}`
      // and forward messages to the client:
      //
      // const sub = redisClient.duplicate();
      // await sub.subscribe(`sse:${address}`, (message) => {
      //   const { event, data } = JSON.parse(message);
      //   send(event, data);
      // });
      //
      // On close: sub.unsubscribe(); sub.quit();

      // Listen for client disconnect
      req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (closeTimer) clearTimeout(closeTimer);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
