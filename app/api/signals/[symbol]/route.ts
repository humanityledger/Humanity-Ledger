import { NextRequest, NextResponse } from 'next/server';
import { signalEngine } from '@/lib/signals/SignalEngine';

/**
 * GET /api/signals/[symbol]
 * 
 * Returns AI-generated attesting signal for the specified symbol
 * 
 * Example: /api/signals/AUTHUSDT
 * 
 * Response includes:
 * - Direction (LONG/SHORT/NEUTRAL)
 * - Confidence score (0-100)
 * - Entry, target, stop loss prices
 * - Recommended leverage
 * - Technical indicator breakdown
 * - Reasoning and warnings
 */

// In-memory cache (1 minute TTL)
const signalCache = new Map<string, { signal: any; expiry: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ symbol: string }> }
) {
  try {
    const params = await props.params;
    const symbol = params.symbol.toUpperCase();


    // Validate symbol format
    if (!symbol.endsWith('USDT') && !symbol.endsWith('USDC')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid symbol format. Must end with USDT or USDC.'
        },
        { status: 400 }
      );
    }

    // Check cache
    const cached = signalCache.get(symbol);
    if (cached && Date.now() < cached.expiry) {
      return NextResponse.json({
        success: true,
        signal: cached.signal,
        cached: true,
        timestamp: Date.now()
      });
    }

    // Fetch historical candles from Binance
    const interval = '1h'; // 1-hour candles
    const limit = 100; // Need 100 candles for accurate indicators
    
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    const response = await fetch(binanceUrl);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.statusText}`);
    }

    const klines = await response.json();

    // Transform Binance format to our Candle format
    const candles = klines.map((k: any) => ({
      time: k[0] / 1000, // Milliseconds to seconds
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    // Generate signal
    const signal = await signalEngine.generateSignal(symbol, candles);

    // Cache the result
    signalCache.set(symbol, {
      signal,
      expiry: Date.now() + CACHE_TTL_MS
    });

    // Clean old cache entries (simple cleanup)
    if (signalCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of signalCache.entries()) {
        if (now >= value.expiry) {
          signalCache.delete(key);
        }
      }
    }

    return NextResponse.json({
      success: true,
      signal,
      cached: false,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('[SignalAPI] Error generating signal:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}

// Manually clear cache (for testing)
export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ symbol: string }> }
) {
  const params = await props.params;
  const symbol = params.symbol.toUpperCase();

  signalCache.delete(symbol);

  return NextResponse.json({
    success: true,
    message: `Cache cleared for ${symbol}`
  });
}
