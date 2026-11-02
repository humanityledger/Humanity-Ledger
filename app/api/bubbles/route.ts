
import { NextResponse, NextRequest } from 'next/server';
import { PriceService } from '@/lib/blockchain/PriceService';

export async function GET(req: NextRequest) {
  try {
    console.log('[Bubbles] Fetching top markets from Legendary PriceService...');
    
    // Use the new Legendary PriceService
    const bubblesData = await PriceService.getTopMarkets();

    if (!bubblesData || bubblesData.length === 0) {
      return NextResponse.json({ error: 'No se encontraron datos de mercado' }, { status: 404 });
    }

    // [BACKEND SYNC] Fetch classified tokens from our DB
    const riskMap: Record<string, string> = {};
    try {
      const { db: prisma } = await import('@/lib/db');
      const classifiedMarkets = await (prisma as any).market.findMany({
        select: { slug: true, riskLevel: true }
      });

      classifiedMarkets.forEach((m: any) => {
        riskMap[m.slug.toLowerCase()] = m.riskLevel;
      });
    } catch (dbError) {
      console.warn('[Bubbles API] Database unreachable, skipping classification enrichment');
    }

    // Conversion rate USD to EUR (Static for now, can be dynamic later)
    const eurRate = 0.93;

    // Enriched data
    const enriched = bubblesData.map((coin: any) => {
      const symbol = (coin.symbol || '').toUpperCase();
      const id = (coin.id || '').toLowerCase();
      const riskLevel = riskMap[id] || riskMap[symbol.toLowerCase()] || null;

      return {
        ...coin,
        current_price_eur: coin.current_price * eurRate,
        riskLevel: riskLevel
      };
    });

    return NextResponse.json({ bubbles: enriched });
  } catch (error: any) {
    console.error('Bubbles API Internal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Internal error' }, { status: 500 });
  }
}


