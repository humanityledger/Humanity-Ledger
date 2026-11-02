import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  NewsArticleAnalytics, 
  MarketSentiment,
  RawNewsItem
} from '@/lib/news-analytics';
import { safeJsonParse } from '@/lib/utils/json';

export const dynamic = 'force-dynamic';

interface CryptoPanicArticle {
  id: number; domain: string; title: string; published_at: string;
  slug: string; url: string;
  source: { title: string; region: string; domain: string };
  metadata?: { description?: string };
}

/**
 * Interface for the flattened article structure used in the UI
 * NOTE: Images removed per sovereign mandate.
 */
export interface UINewsArticle {
  id: string; 
  title: string; 
  description: string;
  date: string; 
  url: string; 
  source: string; 
  sentiment?: MarketSentiment;
  veracityScore?: number | null;
  isFake?: boolean;
  btcBullish?: number;
  btcBearish?: number;
}

//  Utilidad: Decodificador de Entidades HTML 
function decodeHTMLEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8217;/g, '')
    .replace(/&#8216;/g, '')
    .replace(/&#8220;/g, '')
    .replace(/&#8221;/g, '')
    .replace(/&#8211;/g, '')
    .replace(/&#8212;/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_idx, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_idx, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Real keyword-based BTC sentiment analysis — NO hash randomness, NO fabrication.
 * Purely derived from title keywords. Returns honest neutral when no signal found.
 */
function analyzeSentiment(title: string): { btcBullish: number; btcBearish: number; sentiment: MarketSentiment } {
  const lower = title.toLowerCase();
  const bearishSignals = (lower.match(/(crash|hack|exploit|lawsuit|sec|ban|bearish|dump|drop|plunge|sell.off|liquidat|sanction|fear|warning|alert|theft|rug|scam|fraud|slump|collapse|decline|losing|loss)/g) || []).length;
  const bullishSignals = (lower.match(/(rally|surge|soar|adopt|approve|etf|ath|breakout|bull|buy|accumulate|launch|partner|integration|upgrade|milestone|record|growth|rise|gain|recover)/g) || []).length;

  if (bearishSignals > bullishSignals) {
    const confidence = Math.min(90, 50 + bearishSignals * 12);
    return { btcBullish: 100 - confidence, btcBearish: confidence, sentiment: 'bearish' };
  }
  if (bullishSignals > bearishSignals) {
    const confidence = Math.min(90, 50 + bullishSignals * 12);
    return { btcBullish: confidence, btcBearish: 100 - confidence, sentiment: 'bullish' };
  }
  return { btcBullish: 50, btcBearish: 50, sentiment: 'neutral' };
}

// [REMOVED] generateDeepAnalysis was a simulation engine generating fake AI analysis text.
// All descriptions now come directly from real RSS feed <description> fields or are left empty.
// No fabrication allowed per system mandate.

/**
 * Real RSS feed parser — extracts title, link, pubDate, and real description from feed items.
 * No fake analysis, no simulated text. Description comes directly from RSS <description> tag.
 */
async function fetchRSSFeed(url: string, sourceName: string): Promise<UINewsArticle[]> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'HumanityLedgerBot/2.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const articles: UINewsArticle[] = [];

    for (const match of itemMatches) {
      const item = match[1];

      const title = (
        item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ??
        item.match(/<title>(.*?)<\/title>/)
      )?.[1]?.trim() ?? '';

      const link = (
        item.match(/<link>(.*?)<\/link>/) ??
        item.match(/<guid[^>]*>(.*?)<\/guid>/)
      )?.[1]?.trim() ?? '';

      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? '';

      // Extract REAL description from RSS — strip HTML tags but keep the actual text
      const rawDesc = (
        item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ??
        item.match(/<description>([\s\S]*?)<\/description>/)
      )?.[1]?.trim() ?? '';
      const cleanDesc = decodeHTMLEntities(rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 500);

      if (!title || !link) continue;

      const cleanTitle = decodeHTMLEntities(title);
      const sentimentData = analyzeSentiment(cleanTitle);

      articles.push({
        id:          `rss-${Buffer.from(link).toString('base64').slice(0, 16)}`,
        title:       cleanTitle,
        description: cleanDesc, // REAL description from RSS, not fabricated
        date:        pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        url:         link,
        source:      sourceName,
        sentiment:   sentimentData.sentiment,
        btcBullish:  sentimentData.btcBullish,
        btcBearish:  sentimentData.btcBearish
      });

      if (articles.length >= 30) break;
    }

    return articles;
  } catch (err: any) {
    console.warn(`[LedgerNews] RSS ${sourceName} failed: ${err.message || 'Unknown Network Error'}`);
    return [];
  }
}

async function persistToDB(articles: UINewsArticle[]) {
  // DB code omitted from update for brevity and as we removed imageUrl
  for (const art of articles) {
    try {
      await prisma.newsArticle.upsert({
        where: { url: art.url },
        update: {
          title: art.title,
          summary: art.description,
          source: art.source,
          publishedAt: new Date(art.date),
        },
        create: {
          url: art.url,
          title: art.title,
          summary: art.description,
          source: art.source,
          publishedAt: new Date(art.date),
          category: 'crypto',
        },
      });
    } catch (e: any) {
      // Ignore errors for unmigrated DB
    }
  }
}

/**
 * GET /api/news
 * Returns REAL articles only — no fabrication, no padding.
 * Sources: CryptoPanic API (primary) → RSS feeds (fallback)
 */
export async function GET() {
  return GET_internal();
}

async function GET_internal() {
  const apiKeysEnv = process.env.CRYPTOPANIC_API_KEYS || process.env.CRYPTOPANIC_API_KEY || '';
  const apiKeys = apiKeysEnv.split(',').map(k => k.trim()).filter(Boolean);

  //  Capa 1: CryptoPanic 
  for (const key of apiKeys) {
    try {
      const res = await fetch(
        `https://cryptopanic.com/api/v1/posts/?auth_token=${key}&public=true&kind=news`,
        { headers: { 'Accept': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const text = await res.text();
        const json = safeJsonParse<any>(text, null, 'NEWS_CRYPTOPANIC_API');
        if (!json) continue;
        const results: CryptoPanicArticle[] = json.results ?? [];
        if (results.length > 0) {
          const articles: UINewsArticle[] = results.slice(0, 50).map(item => {
            const clean   = decodeHTMLEntities(item.title.replace(/<[^>]*>?/gm, ''));
            const srcName = item.source?.title || item.domain || 'CryptoPanic';
            const artId   = `cp-${item.id}`;
            const sentimentData = analyzeSentiment(clean);
            // CryptoPanic provides real description via metadata — use it, never fabricate
            const realDesc = item.metadata?.description
              ? decodeHTMLEntities(item.metadata.description.slice(0, 500))
              : '';
            return {
              id: artId, title: clean,
              description: realDesc,
              date: new Date(item.published_at).toISOString(),
              url: item.url, source: srcName,
              sentiment: sentimentData.sentiment,
              btcBullish: sentimentData.btcBullish,
              btcBearish: sentimentData.btcBearish
            };
          });
          persistToDB(articles).catch(() => {});
          return NextResponse.json({ success: true, source: 'live', count: articles.length, articles, timestamp: Date.now() });
        }
      } else if (res.status !== 429) break;
    } catch { continue; }
  }

  //  Capa 2: RSS Feeds institucionales (Cointelegraph Prioritized) 
  const RSS_SOURCES = [
    { url: 'https://cointelegraph.com/rss', name: 'Cointelegraph' }, // Moved to top priority
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk' },
    { url: 'https://decrypt.co/feed', name: 'Decrypt' },
    { url: 'https://cryptoslate.com/feed/', name: 'CryptoSlate' },
    { url: 'https://bitcoinmagazine.com/.rss/full/', name: 'Bitcoin Magazine' },
  ];

  const rssResults = await Promise.allSettled(RSS_SOURCES.map(s => fetchRSSFeed(s.url, s.name)));
  const allRss: UINewsArticle[] = [];
  for (const r of rssResults) {
    if (r.status === 'fulfilled') allRss.push(...r.value);
  }
  allRss.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const top50 = allRss.slice(0, 50);

  if (top50.length > 0) {
    persistToDB(top50).catch(() => {});
    return NextResponse.json({ success: true, source: 'rss', count: top50.length, articles: top50, timestamp: Date.now() });
  }

  return NextResponse.json({ success: false, source: 'none', articles: [], error: 'All sources offline.' }, { status: 503 });
}
