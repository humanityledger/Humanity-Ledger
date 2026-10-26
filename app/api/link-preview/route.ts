import { NextRequest, NextResponse } from 'next/server';
import { validateUrlForFetch } from '@/lib/security/ssrfGuard';

export const dynamic = 'force-dynamic';

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

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const guard = validateUrlForFetch(urlParam);
  if (!guard.safe) {
    return NextResponse.json({ error: guard.reason || 'Blocked by SSRF guard' }, { status: 403 });
  }

  try {
    const targetUrl = new URL(urlParam);
    const domain = targetUrl.hostname.replace(/^www\./, '');

    // Abort controller with 3.5s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    let res: Response;
    try {
      res = await fetch(targetUrl.href, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HumanityLedgerBot/1.0; +https://humanityledger.com)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      return NextResponse.json({
        url: urlParam,
        title: domain,
        siteName: domain,
        favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
      });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return NextResponse.json({
        url: urlParam,
        title: domain,
        siteName: domain,
      });
    }

    // Limit text read to first 300KB to prevent memory exhaustion
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      const MAX_BYTES = 300 * 1024;
      while (bytesRead < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        bytesRead += value.length;
        html += decoder.decode(value, { stream: true });
        if (html.includes('</head>')) break; // Header tags are all we need
      }
      reader.cancel().catch(() => {});
    } else {
      html = await res.text();
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
    let image = getMeta('image');

    if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
      try {
        image = new URL(image, targetUrl.href).href;
      } catch {
        image = undefined;
      }
    }

    // Extract favicon
    let favicon: string | undefined;
    const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']*)["']/i);
    if (iconMatch && iconMatch[1]) {
      try {
        favicon = new URL(iconMatch[1], targetUrl.href).href;
      } catch {
        favicon = undefined;
      }
    }
    if (!favicon) {
      favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    }

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
  } catch {
    // If fetching fails or times out, return fallback with domain
    try {
      const targetUrl = new URL(urlParam);
      const domain = targetUrl.hostname.replace(/^www\./, '');
      return NextResponse.json({
        url: urlParam,
        title: domain,
        siteName: domain,
        favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
      });
    } catch {
      return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 });
    }
  }
}
