import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { chatStreamHub } from '@/lib/sse/chatStreamHub';

/**
 * GET /api/chat/stream/[channelId]
 * Server-Sent Events endpoint backed by the pod-level multiplexed ChatStreamHub:
 * shares at most ONE Redis/memory poll loop per active channelId instead of one per client.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let activeChatSse = 0;

function resolveMaxChatSse(): number {
  const envVal = Number(process.env.MAX_CONCURRENT_SSE || '');
  return Number.isFinite(envVal) && envVal >= 50 ? Math.floor(envVal) : 1000;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return new Response('Unauthorized', { status: 401 });
  }
  const { channelId } = await params;

  // ── [SECURITY — HIGH-05] SSE Channel Authorization ────────────────────────
  const userAddr = session.userId.toLowerCase();
  const chanLower = channelId.toLowerCase();
  const chanSegments = chanLower.split(/[_\-]/);
  const isAuthorized = chanLower === userAddr || chanSegments.includes(userAddr);
  if (!isAuthorized) {
    return new Response('Forbidden: You are not a participant in this channel.', { status: 403 });
  }

  const maxSse = resolveMaxChatSse();
  if (activeChatSse >= maxSse) {
    return new Response(JSON.stringify({ error: 'Stream capacity reached' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '15' },
    });
  }

  activeChatSse += 1;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        activeChatSse = Math.max(0, activeChatSse - 1);
        req.signal.removeEventListener('abort', cleanup);
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        try {
          unsubscribe?.();
        } catch {}
        unsubscribe = null;
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener('abort', cleanup);
      if (req.signal.aborted) {
        cleanup();
        return;
      }

      try {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      } catch {
        cleanup();
        return;
      }

      unsubscribe = chatStreamHub.subscribe(channelId, (msg) => {
        send({ type: 'message', payload: msg });
      });

      heartbeatInterval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          cleanup();
        }
      }, 15_000);
      heartbeatInterval.unref?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
