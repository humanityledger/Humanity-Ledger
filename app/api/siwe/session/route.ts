import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('hl_session')?.value
      ?? req.cookies.get('human_session')?.value
      ?? req.cookies.get('ledger_session')?.value
      ?? req.cookies.get('humanity_session')?.value;
    
    if (!token) {
      // Return 401 unauthenticated safely so AppKit knows NO session exists
      return NextResponse.json(null, { status: 401 });
    }

    // Cryptographically verify session token
    const payload = await verifyJWT(token);
    const address = (payload.walletAddress || payload.address || payload.sub) as string;

    if (!address) {
       return NextResponse.json(null, { status: 401 });
    }

    // AppKit requires address and chainId to persist the SIWE Session natively
    return NextResponse.json({
      address,
      chainId: (payload.chainId as number) || 1,
    }, { status: 200 });

  } catch (error) {
    // Token is invalid, expired, or manipulated
    return NextResponse.json(null, { status: 401 });
  }
}
