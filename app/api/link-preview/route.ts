import { NextRequest, NextResponse } from 'next/server';
import { fetchPublicUrl, PublicFetchError } from '@/lib/security/publicFetch';
import { validateUrlForFetch } from '@/lib/security/ssrfGuard';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';

/**
 * GET /api/link-preview?url=...
 *
 * Public (no session), because previews are rendered for links in any chat.
 * That makes it a server-side fetch anyone on the internet can aim, so:
 *  - every hop goes through fetchPublicUrl (resolved IPs checked at connect
 *    time, redirects re-validated, ports 80/443, byte and time caps);
 *  - callers are limited per IP in Redis, so the server is not an open proxy;
 *  - image and favicon URLs handed back to the browser must be http(s).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cleanText(str?: string | null, maxLen = 300): string | undefined {
  if (!str) return undefined;
  const decoded = str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
  return decoded.length > maxLen ? decoded.slice(0, maxLen) + '…' : decoded;
}

/** Absolute http(s) URL or undefined. Blocks javascript:, data:, file: etc. */
function httpUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value, base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function fallback(urlParam: string, domain: string) {
  return NextResponse.json({
    url: urlParam,
    title: domain,
    siteName: domain,
    favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
  });
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }
  if (urlParam.length > 2048) {
    return NextResponse.json({ error: 'URL too long' }, { status: 400 });
  }

  const guard = validateUrlForFetch(urlParam);
  if (!guard.safe) {
    return NextResponse.json({ error: guard.reason || 'Blocked by SSRF guard' }, { status: 403 });
  }

  const rl = await checkRateLimit(getClientIP(req), { max: 30, windowSec: 60, prefix: 'rl:link-preview' });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many previews. Try again in a minute.' }, { status: 429 });
  }

  const targetUrl = new URL(urlParam);
  const domain = targetUrl.hostname.replace(/^www\./, '');

  let html: string;
  let finalUrl: string;
  try {
    const res = await fetchPublicUrl(urlParam, {
      timeoutMs: 3500,
      maxBytes: 300 * 1024,
      maxRedirects: 3,
      stopAt: '</head>',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HumanityLedgerBot/1.0; +https://humanityledger.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (res.status < 200 || res.status >= 300) return fallback(urlParam, domain);
    if (!res.contentType.includes('text/html') && !res.contentType.includes('application/xhtml+xml')) {
      return NextResponse.json({ url: urlParam, title: domain, siteName: domain });
    }
    html = res.body;
    finalUrl = res.url;
  } catch (e) {
    if (e instanceof PublicFetchError && e.code === 'BLOCKED') {
      // A redirect or DNS answer pointed somewhere non-public.
      return NextResponse.json({ error: 'Blocked by SSRF guard' }, { status: 403 });
    }
    return fallback(urlParam, domain);
  }

  // Extract OpenGraph, Twitter, and standard tags
  const getMeta = (propertyOrName: string) => {
    const regex = new RegExp(`<meta\\s+[^>]*(?:property|name)=["'](?:og:|twitter:)?${propertyOrName}["'][^>]*content=["']([^"']*)["']`, 'i');
    const match = html.match(regex);
    if (match) return match[1];
    const reverseRegex = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["'](?:og:|twitter:)?${propertyOrName}["']`, 'i');
    const reverseMatch = html.match(reverseRegex);
    return reverseMatch ? reverseMatch[1] : undefined;
  };

  let title = getMeta('title');
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) title = titleMatch[1];
  }

  const description = getMeta('description');
  const siteName = getMeta('site_name') || domain;
  const image = httpUrl(getMeta('image'), finalUrl);

  const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']*)["']/i);
  const favicon = httpUrl(iconMatch?.[1], finalUrl)
    ?? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

  return NextResponse.json(
    {
      url: urlParam,
      title: cleanText(title) || domain,
      description: cleanText(description),
      image,
      siteName: cleanText(siteName, 60),
      favicon,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
    }
  );
}
