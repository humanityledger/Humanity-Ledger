import { NextRequest, NextResponse } from 'next/server';
import { walletAnalyticsService } from '@/lib/wallet/WalletAnalyticsService';
import { validateSecureRequest } from '@/lib/security/premium-security';

/**
 * GET /api/wallet/analytics/[address]
 * Returns full legendary wallet analytics report.
 */
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ address: string }> }
) {
  try {
    const params = await props.params;
    const address = params.address;

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // [SECURITY] Wallet intelligence is premium/sensitive - require valid session
    const validation = await validateSecureRequest(req, 'PREMIUM');
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const deep = req.nextUrl.searchParams.get('deep') === 'true';

    console.log(`[API-INTELLIGENCE] Fetching report for ${address} (forceRefresh: ${forceRefresh}, deep: ${deep})`);
    
    const analytics = await walletAnalyticsService.getFullAnalytics(address, forceRefresh, deep);

    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error(`[API-INTELLIGENCE-ERROR]:`, error);
    return NextResponse.json({ 
      error: 'Failed to fetch wallet analytics',

      details: 'Error details redacted' 
    }, { status: 500 });
  }
}
