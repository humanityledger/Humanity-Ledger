import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/check-email — does an account exist for this e-mail?
 *
 * The sign-in page uses it to choose between "sign in" and "create account".
 * It answers whether an address is registered, so it is rate limited per
 * network address: without a limit it listed who uses the service, one
 * request per guess.
 */
export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(getClientIP(request), { max: 20, windowSec: 600, prefix: 'rl:check-email' });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.authUser.findUnique({ where: { email } });

    return NextResponse.json({
      exists: user !== null,
      requiresVerification: user !== null && !user.verified,
    });
  } catch (error) {
    console.error('Check email error:', error);
    return NextResponse.json({ error: 'Failed to check email' }, { status: 500 });
  }
}
