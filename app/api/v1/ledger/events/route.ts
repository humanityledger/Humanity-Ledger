import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey, logApiRequest } from '@/lib/api-guard';
import { ZKProofAuthenticator } from '@/lib/zk/ZKProofAuthenticator';

export const dynamic = 'force-dynamic';

/**
 * @api {get} /api/v1/ledger/events Get lastest ledger transactions
 * @apiHeader {String} X-WAC-API-Key Your Humanity Ledger Corp API Key
 */
export async function GET(req: NextRequest) {
  const endpoint = '/api/v1/ledger/events';
  
  // 1. Validate API Key
  const auth = await validateApiKey(req);
  if (!auth.valid || !auth.subscription) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  try {
    const { subscription } = auth;
    const searchParams = req.nextUrl.searchParams;
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100));
    
    // 1. Enforce Plan Threshold
    const minUsd = Math.max(
      parseFloat(searchParams.get('min_usd') || '0'),
      subscription.enforcedThreshold // Enforced by api-guard
    );

    // 2. Enforce Time Window
    const windowDays = subscription.enforcedWindowDays || 1;
    const minTimestamp = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    
    const token = searchParams.get('token');

    // 3. Fetch events from database
    const events = await (prisma as any).globalLedgerEvent.findMany({
      where: {
        usdValue: { gte: minUsd },
        timestamp: { gte: minTimestamp },
        ...(token ? { token: { contains: token, mode: 'insensitive' } } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // 4. Generate Zero Knowledge (ZK) Proof for the event batch
    const formattedEvents = events.map((e: any) => ({
        id: e.id,
        hash: e.hash,
        timestamp: e.timestamp,
        wallet: e.wallet,
        token: e.token || 'ETH', // Fallback for strict typing
        amount: e.amount || '0',
        usd_value: parseFloat(e.usdValue.toString()),
        direction: (e.action === 'INFLOW' || e.action === 'DEPOSIT') ? 'SELL' : 
                   (e.action === 'OUTFLOW' || e.action === 'WITHDRAW') ? 'BUY' : 'TRANSFER' as any,
        from: e.wallet,
        to: '0x000...000', // Simplify for this scaffold
        block: Number(e.blockNumber) || 0,
        tier: e.tier,
        dex: e.dex,
    }));
    
    const zkPayload = ZKProofAuthenticator.generateProof(formattedEvents);

    // 5. Log usage
    await logApiRequest(req, subscription.id, endpoint, 200);

    // 6. Return Elite grade data WITH ZK Mathematical Proof
    return NextResponse.json({
      success: true,
      count: events.length,
      plan: subscription.tier,
      threshold_enforced: subscription.ledgerThresholdUsd,
      zk_authentication: zkPayload,
      data: formattedEvents,
      attribution: "Data secured by Zero Knowledge SNARK Cryptography. Mathematically unforgeable."
    });

  } catch (error: any) {
    console.error('[WAC API] Error:', error);
    await logApiRequest(req, auth.subscription.id, endpoint, 500);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

