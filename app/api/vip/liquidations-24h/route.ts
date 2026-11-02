import { NextResponse } from 'next/server';

// All 20 VIP tokens with their Binance Futures symbol
const SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT',
  'ADAUSDT','DOGEUSDT','AVAXUSDT','DOTUSDT','LINKUSDT',
  'MATICUSDT','NEARUSDT','UNIUSDT','LTCUSDT','ATOMUSDT',
  'ARBUSDT','OPUSDT','INJUSDT','SUIUSDT','APTUSDT',
];

// Map Binance symbol  display name
const SYMBOL_TO_NAME: Record<string, string> = {
  BTCUSDT:'BTC', ETHUSDT:'ETH', SOLUSDT:'SOL', BNBUSDT:'BNB', XRPUSDT:'XRP',
  ADAUSDT:'ADA', DOGEUSDT:'DOGE', AVAXUSDT:'AVAX', DOTUSDT:'DOT', LINKUSDT:'LINK',
  MATICUSDT:'MATIC', NEARUSDT:'NEAR', UNIUSDT:'UNI', LTCUSDT:'LTC', ATOMUSDT:'ATOM',
  ARBUSDT:'ARB', OPUSDT:'OP', INJUSDT:'INJ', SUIUSDT:'SUI', APTUSDT:'APT',
};

/**
 * GET /api/vip/liquidations-24h
 * Returns real 24h forced liquidation volume per symbol from Binance Futures.
 * Endpoint: /fapi/v1/allForceOrders  public, no auth required.
 * We fan-out one request per symbol with a 24h startTime window, then aggregate.
 */

export const dynamic = 'force-dynamic';

async function fetchSymbolLiquidations(symbol: string, startTime: number): Promise<number> {
  try {
    const url = `https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${symbol}&startTime=${startTime}&limit=1000`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HumanDeFi/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 0 },
    });
    if (!res.ok) return 0;
    const orders: any[] = await res.json();
    // Each order: { origQty, price, ... }  cumulate notional (qty * price)
    return orders.reduce((sum, o) => {
      const qty = parseFloat(o.origQty || '0');
      const price = parseFloat(o.averagePrice || o.price || '0');
      return sum + qty * price;
    }, 0);
  } catch {
    return 0;
  }
}

export async function GET() {
  const startTime = Date.now() - 24 * 60 * 60 * 1000; // last 24h

  // Fan-out  all symbols in parallel (server-side, no CORS)
  const results = await Promise.all(
    SYMBOLS.map(async (symbol) => {
      const liquidationUsd = await fetchSymbolLiquidations(symbol, startTime);
      return {
        symbol,
        name: SYMBOL_TO_NAME[symbol] ?? symbol.replace('USDT', ''),
        liquidationUsd,
      };
    })
  );

  return NextResponse.json({
    data: results,
    updatedAt: Date.now(),
    source: 'binance_fapi_allForceOrders',
  });
}
