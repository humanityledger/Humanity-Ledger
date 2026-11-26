import { NextRequest, NextResponse } from 'next/server';
import rateLimit from '@/lib/rate-limit';
import { getClientIP } from '@/lib/security/rateLimiter';

const limiter = rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 500,
});

/**
 * Sovereign Historical Price Data (Klines)
 * Zero-Latency Binance Backend
 */

interface PriceDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface HistoricalResponse {
  symbol: string;
  currency: string;
  data: PriceDataPoint[];
  currentPrice: number;
}

// Map requested symbols to Binance pairings
const BINANCE_MAP: Record<string, string> = {
  'ETH': 'ETHUSDT', 'BTC': 'BTCUSDT', 'MATIC': 'MATICUSDT', 'POL': 'POLUSDT', 'ARB': 'ARBUSDT',
  'OP': 'OPUSDT', 'BASE': 'ETHUSDT', 'USDC': 'USDCUSDT', 'USDT': 'EURUSDT', 'DAI': 'DAIUSDT',
  'SOL': 'SOLUSDT', 'XRP': 'XRPUSDT', 'ADA': 'ADAUSDT', 'AVAX': 'AVAXUSDT', 'DOT': 'DOTUSDT',
  'LINK': 'LINKUSDT', 'UNI': 'UNIUSDT', 'BNB': 'BNBUSDT', 'LTC': 'LTCUSDT', 'BCH': 'BCHUSDT',
  'XLM': 'XLMUSDT', 'ALGO': 'ALGOUSDT', 'FIL': 'FILUSDT', 'FET': 'FETUSDT', 'RNDR': 'RNDRUSDT',
  'NEAR': 'NEARUSDT', 'INJ': 'INJUSDT', 'PEPE': 'PEPEUSDT', 'AUTH': 'AUTHUSDT', 'TAO': 'TAOUSDT'
};

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    try {
        await limiter.check(50, ip);
    } catch {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'ETH';
    let days = parseInt(searchParams.get('days') || '7');
    const currency = searchParams.get('currency') || 'usd';

    // Protect against non-USD endpoints that we aren't supporting via Binance trivially
    if (currency.toLowerCase() !== 'usd') {
        return NextResponse.json({ error: 'Only USD denomination supported' }, { status: 400 });
    }

    const binanceSymbol = BINANCE_MAP[symbol];
    if (!binanceSymbol) {
      return NextResponse.json(
        { error: `Unsupported symbol for historical klines: ${symbol}` },
        { status: 400 }
      );
    }

    // Determine interval based on requested days to maintain high resolution without hitting payload limits
    let interval = '1h';
    let limit = days * 24;
    
    if (days <= 1) {
        interval = '15m';
        limit = 96;
    } else if (days > 7 && days <= 30) {
        interval = '4h';
        limit = days * 6;
    } else if (days > 30) {
        interval = '1d';
        limit = days;
    }

    // Fetch Klines
    const klinesUrl = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
    const klinesRes = await fetch(klinesUrl, { cache: 'no-store' });

    if (!klinesRes.ok) {
      throw new Error(`Binance API Error: ${klinesRes.status}`);
    }

    const klinesData = await klinesRes.json();
    
    // Transform Binance structure
    // [0] Open time, [1] Open, [2] High, [3] Low, [4] Close, [5] Volume
    const priceData: PriceDataPoint[] = klinesData.map((kline: any[]) => ({
      timestamp: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
    }));

    // Get strictly the very latest frame for current price
    const currentPrice = priceData.length > 0 ? priceData[priceData.length - 1].close : 0;

    const response: HistoricalResponse = {
      symbol,
      currency: 'USD',
      data: priceData,
      currentPrice,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Price fetch error:', error);
    
    return NextResponse.json(
      { 
        symbol: 'UNKNOWN',
        currency: 'USD',
        data: [],
        currentPrice: 0,
        error: "Historical market data currently unavailable"
      }, 
      { status: 503 }
    );
  }
}


