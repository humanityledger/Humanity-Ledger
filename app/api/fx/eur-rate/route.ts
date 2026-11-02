import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// Revalidate server-side cache every 5 minutes
/**
 * GET /api/fx/eur-rate
 *
 * Returns the live EUR/USD exchange rate sourced from the European Central Bank (ECB).
 * The ECB publishes daily reference rates as XML at:
 *   https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml
 *
 * This server-side proxy:
 *   1. Avoids CORS issues from the browser hitting the ECB endpoint directly.
 *   2. Adds a 5-minute server-side Cache-Control header to prevent hammering.
 *   3. Falls back to 0.92 if the ECB is unreachable.
 *
 * Response: { rate: number, source: 'ecb' | 'fallback', timestamp: string }
 */
export async function GET() {
  try {
    const res = await fetch(
      'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
      {
        headers: { Accept: 'application/xml, text/xml' },
        signal: AbortSignal.timeout(6000),
        // Next.js fetch cache — revalidate every 5 minutes server-side
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) throw new Error(`ECB returned ${res.status}`);

    const xml = await res.text();

    // Parse USD rate from ECB XML.
    // The XML format is:
    //   <Cube currency='USD' rate='1.0782'/>
    // We want EUR/USD which is the reciprocal: 1 / (USD per EUR)
    const usdMatch = xml.match(/currency=['"]USD['"]\s+rate=['"]([0-9.]+)['"]/);
    if (!usdMatch || !usdMatch[1]) throw new Error('USD rate not found in ECB XML');

    const usdPerEur = parseFloat(usdMatch[1]);
    if (isNaN(usdPerEur) || usdPerEur <= 0) throw new Error('Invalid USD rate from ECB');

    // rate = EUR per USD (how many EUR for 1 USD)
    const rate = 1 / usdPerEur;

    return NextResponse.json(
      { rate, source: 'ecb', timestamp: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err: any) {
    console.warn('[FX/EUR] ECB fetch failed, attempting secondary fallback:', err.message);
    try {
      const fbRes = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000) });
      if (fbRes.ok) {
        const data = await fbRes.json();
        if (data && data.rates && data.rates.EUR) {
          return NextResponse.json(
            { rate: data.rates.EUR, source: 'open.er-api', timestamp: new Date().toISOString() },
            { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
          );
        }
      }
    } catch (fbErr: any) {
      console.warn('[FX/EUR] Secondary fallback failed:', fbErr.message);
    }

    return NextResponse.json(
      { rate: 0.92, source: 'fallback', timestamp: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
