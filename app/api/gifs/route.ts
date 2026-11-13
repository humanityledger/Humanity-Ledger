import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gifs?q=<search>&offset=<n> — GIFs from GIPHY for the chat's GIF tab (trending when
 * there is no search). The key stays on the server (GIPHY_API_KEY). Only GIPHY's own media
 * URLs are returned; GIPHY's terms require the "Powered by GIPHY" attribution, shown in the
 * picker. Rating pg-13.
 */
const MEDIA_HOST = /^https:\/\/media\d*\.giphy\.com\//;

export async function GET(req: NextRequest) {
  const key = (process.env.GIPHY_API_KEY || '').trim();
  if (!key) return NextResponse.json({ error: 'NOT_CONFIGURED', results: [] }, { status: 503 });
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 50);
  const offset = Math.max(0, Math.min(4_000, Number(req.nextUrl.searchParams.get('offset')) || 0));
  const url = new URL(q ? 'https://api.giphy.com/v1/gifs/search' : 'https://api.giphy.com/v1/gifs/trending');
  url.searchParams.set('api_key', key);
  if (q) url.searchParams.set('q', q);
  url.searchParams.set('limit', '24');
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('rating', 'pg-13');
  url.searchParams.set('bundle', 'messaging_non_clips');
  try {
    const r = await fetch(url, { next: { revalidate: q ? 600 : 300 } });
    if (!r.ok) return NextResponse.json({ error: 'UPSTREAM', results: [] }, { status: 502 });
    const data = await r.json();
    const results = (data?.data ?? []).map((g: any) => {
      const full = g?.images?.fixed_width ?? g?.images?.downsized ?? g?.images?.original;
      const small = g?.images?.fixed_width_small ?? full;
      return { id: String(g?.id ?? ''), url: String(full?.url ?? ''), preview: String(small?.url ?? ''), width: Number(full?.width) || 200, height: Number(full?.height) || 200, title: String(g?.title ?? '').slice(0, 80) };
    }).filter((g: any) => MEDIA_HOST.test(g.url) && MEDIA_HOST.test(g.preview));
    return NextResponse.json({ results, next: offset + 24 }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch {
    return NextResponse.json({ error: 'UPSTREAM', results: [] }, { status: 502 });
  }
}
