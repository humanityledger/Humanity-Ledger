import { NextResponse } from 'next/server';

/**
 * GET /api/vip/oi-history
 * Returns 90-day BTC Open Interest history with:
 *  - Real per-day BTC closing price (from Binance Klines, not fixed current price)
 *  - Binance OI per day
 *  - Bybit OI per day (when available)
 * No Math.random()  only real API data.
 */

export const dynamic = 'force-dynamic';

interface OIPoint {
  timestamp: number;
  dateLabel: string;
  openInterestBinance: number; // USD
  openInterestBybit: number;   // USD
  openInterestTotal: number;   // USD
  btcClose: number;            // real per-day closing price
  btcCloseEur: number;
}

export async function GET() {
  try {
    // 1. EUR/USD rate
    let eurRate = 0.92;
    try {
      const fxRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR', {
        signal: AbortSignal.timeout(3000),
      });
      const fxData = await fxRes.json();
      if (fxData.rates?.EUR) eurRate = fxData.rates.EUR;
    } catch {}

    // 2. Binance OI history (90 days, 1d period)
    const [oiHistRes, klinesRes, bybitOiRes] = await Promise.allSettled([
      fetch(
        'https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1d&limit=90',
        { signal: AbortSignal.timeout(8000), next: { revalidate: 0 } }
      ),
      // Real BTC daily closing prices  aligned to OI timestamps
      fetch(
        'https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1d&limit=90',
        { signal: AbortSignal.timeout(8000), next: { revalidate: 0 } }
      ),
      // Bybit OI history  linear perpetuals, 1d interval
      fetch(
        'https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1d&limit=200',
        { signal: AbortSignal.timeout(8000), next: { revalidate: 0 } }
      ),
    ]);

    const binanceOI: any[] =
      oiHistRes.status === 'fulfilled' && oiHistRes.value.ok
        ? await oiHistRes.value.json()
        : [];

    // Klines format: [openTime, open, high, low, close, volume, closeTime, ...]
    const klines: any[][] =
      klinesRes.status === 'fulfilled' && klinesRes.value.ok
        ? await klinesRes.value.json()
        : [];

    const bybitOIRaw: any[] =
      bybitOiRes.status === 'fulfilled' && bybitOiRes.value.ok
        ? ((await bybitOiRes.value.json())?.result?.list ?? [])
        : [];

    // Build Bybit OI map: timestamp (ms)  OI in USD
    // Bybit returns: { timestamp: "1700000000000", openInterest: "12345.67" }
    const bybitMap: Record<number, number> = {};
    for (const item of bybitOIRaw) {
      const ts = parseInt(item.timestamp || '0');
      // Bybit OI is in BTC contracts  need to multiply by price to get USD
      // We'll join on date later
      bybitMap[ts] = parseFloat(item.openInterest || '0');
    }

    // Build a klines map: openTime (ms)  close price
    const klinesMap: Record<number, number> = {};
    for (const k of klines) {
      const openTime = k[0] as number;
      const closePrice = parseFloat(k[4] as string);
      klinesMap[openTime] = closePrice;
    }

    if (binanceOI.length === 0) {
      return NextResponse.json({ error: 'OI data unavailable', data: [] }, { status: 503 });
    }

    // Align: for each Binance OI point, find closest kline price
    const points: OIPoint[] = binanceOI.map((item: any) => {
      const ts = item.timestamp as number; // ms
      const oiContracts = parseFloat(item.sumOpenInterest || '0'); // BTC

      // Find closest kline (same day, within ±12h)
      let btcClose = 0;
      const candidates = Object.keys(klinesMap)
        .map(Number)
        .filter((t) => Math.abs(t - ts) < 12 * 3600 * 1000);
      if (candidates.length > 0) {
        const closest = candidates.reduce((a, b) =>
          Math.abs(a - ts) < Math.abs(b - ts) ? a : b
        );
        btcClose = klinesMap[closest];
      }

      const oiBinanceUsd = oiContracts * btcClose;

      // Bybit: match by same day (±12h)
      let bybitOIUsd = 0;
      const bybitCandidates = Object.keys(bybitMap)
        .map(Number)
        .filter((t) => Math.abs(t - ts) < 12 * 3600 * 1000);
      if (bybitCandidates.length > 0) {
        const closestBybit = bybitCandidates.reduce((a, b) =>
          Math.abs(a - ts) < Math.abs(b - ts) ? a : b
        );
        bybitOIUsd = bybitMap[closestBybit] * btcClose;
      }

      const date = new Date(ts);
      return {
        timestamp: ts,
        dateLabel: date.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        openInterestBinance: oiBinanceUsd,
        openInterestBybit: bybitOIUsd,
        openInterestTotal: oiBinanceUsd + bybitOIUsd,
        btcClose,
        btcCloseEur: btcClose * eurRate,
      };
    });

    // Current BTC stats
    let currentBtcPrice = 0;
    let change24h = 0;
    try {
      const tickerRes = await fetch(
        'https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT',
        { signal: AbortSignal.timeout(4000) }
      );
      if (tickerRes.ok) {
        const t = await tickerRes.json();
        currentBtcPrice = parseFloat(t.lastPrice || '0');
        change24h = parseFloat(t.priceChangePercent || '0');
      }
    } catch {}

    return NextResponse.json({
      data: points,
      eurRate,
      currentBtcPrice,
      change24h,
      totalOI: points[points.length - 1]?.openInterestTotal ?? 0,
      updatedAt: Date.now(),
      source: 'binance_openInterestHist + binance_klines + bybit_oi',
    });
  } catch (err) {
    console.error('[api/vip/oi-history]', err);
    return NextResponse.json({ error: 'Failed to fetch OI history', data: [] }, { status: 503 });
  }
}
