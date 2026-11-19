import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

/**
 * GET /api/ping
 *
 * Empty on purpose. The client times the round trip itself (lib/chat/liveRtt.ts).
 * No database, no session, no JSON. A body of two bytes so every browser,
 * including iOS Safari, records a finished Resource Timing entry.
 * The query string is read so Next.js cannot prerender or cache this handler.
 */
export function GET(req: Request) {
  // Reading the request keeps Next.js from prerendering or caching this handler.
  void new URL(req.url).searchParams.get('n');
  return new NextResponse('ok', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      'cdn-cache-control': 'no-store',
      pragma: 'no-cache',
      expires: '0',
      'x-content-type-options': 'nosniff',
    },
  });
}
