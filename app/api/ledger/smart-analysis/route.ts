import { NextRequest, NextResponse } from 'next/server';
import { Alchemy, Network } from 'alchemy-sdk';
import { analyzeWalletSmartMoney } from '@/lib/smartMoneyAnalyzer';

/**
 * Smart Money Analysis API
 * Real on-chain wallet behavior analysis
 */

// Configure Alchemy
const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
  url: process.env.BASE_RPC_URL || undefined,
};

// HACK: Fix for Alchemy SDK in Next.js Server
const originalFetch = global.fetch;
global.fetch = (url, init) => {
  if (init && init.referrer === 'client') {
    delete init.referrer;
  }
  return originalFetch(url, init);
};

const alchemy = new Alchemy(config);

// Simple in-memory cache (1 hour TTL)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    // Check cache
    const cached = cache.get(address.toLowerCase());
    const now = Date.now();
    
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Math.floor((now - cached.timestamp) / 1000),
      });
    }

    // Perform analysis with REAL on-chain data
    const analysis = await analyzeWalletSmartMoney(
      address.toLowerCase()
    );

    // Cache the result
    cache.set(address.toLowerCase(), {
      data: analysis,
      timestamp: now,
    });

    // Clean old cache entries (simple cleanup)
    if (cache.size > 100) {
      const entries = Array.from(cache.entries());
      entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 50)
        .forEach(([key]) => cache.delete(key));
    }

    return NextResponse.json({
      ...analysis,
      cached: false,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Smart Money Analysis API Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to analyze wallet',
        details: 'Error details redacted',
      },
      { status: 500 }
    );
  }
}

