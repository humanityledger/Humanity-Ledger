/**
 * GET /api/ledger-stream
 *
 * Server-Sent Events (SSE) endpoint that delivers real-time ledger
 * alert events and QR auth-complete events through a pod-level
 * Single-Subscriber Multiplexed Hub (`lib/sse/ledgerStreamHub.ts`).
 *
 * Scalability guarantee:
 * - Zero per-client Redis TCP connections (.duplicate() eliminated)
 * - At most 1 Redis subscriber + 1 blocking XREAD loop per pod regardless of concurrent SSE count
 * - Initial catch-up query cached 10s in Redis + L1 single-flight
 */

import { NextRequest } from 'next/server';
import { getCachedLedgerCatchup, ledgerStreamHub } from '@/lib/sse/ledgerStreamHub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let activePodConnections = 0;

function resolveMaxConcurrentSse(): number {
  const envVal = Number(process.env.MAX_CONCURRENT_SSE || '');
  return Number.isFinite(envVal) && envVal >= 50 ? Math.floor(envVal) : 1000;
}

export async function GET(req: NextRequest) {
  const maxSse = resolveMaxConcurrentSse();
  if (activePodConnections >= maxSse) {
    console.warn(`[SSE:Throttle] Max concurrent streams (${activePodConnections}/${maxSse}) reached. Rejecting with 503 Backoff.`);
    return new Response(JSON.stringify({ error: 'System at capacity. Please reconnect later.' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '30',
      },
    });
  }

  activePodConnections += 1;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let cleanedUp = false;
      let unsubscribeHub: (() => void) | null = null;

      const send = (event: string, data: unknown) => {
        if (cleanedUp) return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        activePodConnections = Math.max(0, activePodConnections - 1);
        req.signal.removeEventListener('abort', cleanup);
        try {
          unsubscribeHub?.();
        } catch {}
        unsubscribeHub = null;
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener('abort', cleanup);
      if (req.signal.aborted) {
        cleanup();
        return;
      }

      send('connected', { status: 'system', timestamp: new Date().toISOString() });

      // Subscribe to multiplexed pod hub before async catch-up finishes so live events aren't missed
      unsubscribeHub = ledgerStreamHub.subscribe((packet) => {
        send(packet.event, packet.data);
      });

      // Redis + L1 coalesced 10s catch-up cache (eliminates DB storms on reconnect bursts)
      try {
        const history = await getCachedLedgerCatchup();
        if (!cleanedUp) {
          for (const row of history) {
            send('ledger', row);
          }
        }
      } catch (err) {
        console.error('[SSE:CATCHUP_ERROR]', err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
