import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FALLBACKS = [
  'https://images.pexels.com/photos/730564/pexels-photo-730564.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', // Desk/Finance
  'https://images.pexels.com/photos/6770610/pexels-photo-6770610.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', // Crypto
  'https://images.pexels.com/photos/8370752/pexels-photo-8370752.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', // Attesting
  'https://images.pexels.com/photos/6801874/pexels-photo-6801874.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', // Tech
  'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', // Corporate
];

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  let targetUrl = url;
  if (!targetUrl) {
    const seed = request.nextUrl.searchParams.get('seed') || '1';
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
    targetUrl = FALLBACKS[Math.abs(h) % FALLBACKS.length];
  }

  // SSRF Protection: Restrict to an exact-hostname allowlist.
  // Using URL parsing (not regex) prevents subdomain-bypass attacks.
  const ALLOWED_EXACT_HOSTS = new Set([
    'images.pexels.com',
    'images.unsplash.com',
    'images.coindesk.com',
    'images.decrypt.co',
    'images.cointelegraph.com',
    'images.reuters.com',
    'images.bloomberg.com',
    'upload.wikimedia.org',
  ]);
  const ALLOWED_HOST_SUFFIXES = ['.coinmarketcap.com', '.coingecko.com'];
  let parsedTarget: URL;
  try { parsedTarget = new URL(targetUrl!); } catch {
    return NextResponse.json({ error: 'Blocked: Invalid URL' }, { status: 403 });
  }
  const targetHostname = parsedTarget.hostname.toLowerCase();
  const isAllowed =
    ALLOWED_EXACT_HOSTS.has(targetHostname) ||
    ALLOWED_HOST_SUFFIXES.some(suffix => targetHostname.endsWith(suffix));
  if (!isAllowed) {
    return NextResponse.json({ error: 'Blocked: Unauthorized image host' }, { status: 403 });
  }
  // Only allow HTTPS to prevent downgrade to cleartext
  if (parsedTarget.protocol !== 'https:') {
    return NextResponse.json({ error: 'Blocked: Only HTTPS image sources are allowed' }, { status: 403 });
  }

  try {
    const res = await fetch(parsedTarget.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'image/jpeg,image/png,image/webp,*/*;q=0.8',
      },
      next: { revalidate: 86400 }
    });

    if (!res.ok) {
      throw new Error(`Proxy target failed: ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', res.headers.get('content-type') || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new NextResponse(arrayBuffer, { status: 200, headers });
  } catch (err) {
    // If ultimate failure, redirect to a static local image that CANNOT fail.
    return NextResponse.redirect(new URL('/logo-mark.png', request.url));
  }
}
