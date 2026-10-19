import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyJWT, mintJWT } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const cookieDomain = (isProd && appUrl) ? (() => { try { return new URL(appUrl).hostname; } catch { return undefined; } })() : undefined;

    // 1. Try to heal Google/NextAuth session first
    const nextAuthSession = await getServerSession(authOptions).catch(() => null);
    if (nextAuthSession?.user?.email) {
      const email = nextAuthSession.user.email;
      const emailId = `email_${email.toLowerCase().replace(/[^a-z0-9@._-]/g, '')}`;
      const res = NextResponse.json({ healed: true, type: 'google_oauth', address: emailId });
      res.cookies.set('system_handshake', emailId, { httpOnly: false, secure: isProd, sameSite: 'lax', maxAge: 604800, path: '/', domain: cookieDomain });
      return res;
    }

    // 2. Try to heal from existing JWT cookies (refresh expiry)
    const ledgerSession = req.cookies.get('ledger_session')?.value;
    const humanSession = req.cookies.get('human_session')?.value;
    const primaryJwt = ledgerSession || humanSession;

    if (primaryJwt) {
      try {
        const payload = await verifyJWT(primaryJwt);
        const address = (payload.walletAddress || payload.address || payload.sub) as string;
        if (address) {
          const newJwt = await mintJWT({ walletAddress: address.toLowerCase(), tier: payload.tier ?? 'FREE' });
          const res = NextResponse.json({ healed: true, type: 'jwt', address });
          res.cookies.set('ledger_session', newJwt, { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 604800, path: '/', domain: cookieDomain });
          res.cookies.set('human_session', newJwt, { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 604800, path: '/', domain: cookieDomain });
          res.cookies.set('system_handshake', address.toLowerCase(), { httpOnly: false, secure: isProd, sameSite: 'lax', maxAge: 604800, path: '/', domain: cookieDomain });
          return res;
        }
      } catch { /* Expired or invalid, fall through */ }
    }

    // Unauthenticated handshake cookie must NEVER mint a JWT (C1 fix)
    return NextResponse.json({ healed: false });
  } catch (e: any) {
    console.error('[session-heal] Error:', e);
    return NextResponse.json({ healed: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
