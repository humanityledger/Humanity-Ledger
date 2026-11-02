import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, isValidEmail } from '@/lib/auth';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';

export async function POST(request: NextRequest) {
  // Rate limit: 5 sign-in attempts per 5 minutes per IP to block credential stuffing
  const ip = getClientIP(request);
  const rl = await checkRateLimit(ip, { max: 5, windowSec: 300, prefix: 'rl:signin' });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many sign-in attempts. Please wait 5 minutes.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    // [PERSISTENCE FIX] Trim inputs — mobile keyboards inject trailing whitespace
    // causing "Invalid credentials" even with correct passwords
    const email    = (body.email    || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // [INDEXATION FIX] Primary lookup by exact normalized email.
    // Fallback to case-insensitive search to handle accounts created before
    // the email normalization fix (toLower) was introduced.
    let user = await prisma.authUser.findUnique({
      where: { email }
    });

    if (!user) {
      // Case-insensitive fallback — catches legacy accounts stored with mixed case
      user = await prisma.authUser.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
      });
    }

    if (!user) {
      // Generic message — never reveal whether the account exists
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash ?? '');

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate access and refresh tokens
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    
    const { createAccessToken, createRefreshToken, setSessionCookies, generateFingerprint } = await import('@/lib/session');
    const fingerprint = generateFingerprint(userAgent, ip);
    
    const accessToken  = await createAccessToken(user.id, user.email || '', fingerprint);
    const refreshToken = await createRefreshToken(user.id, user.email || '', fingerprint);

    // Set secure httpOnly cookies
    await setSessionCookies(accessToken, refreshToken);

    // [INDEXATION FIX] Also update lastLoginAt so the DB record shows as active
    await prisma.authUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }).catch(() => {}); // Non-fatal

    return NextResponse.json({
      success: true,
      token: accessToken,
      user: {
        id:    user.id,
        email: user.email,
        name:  user.name
      }
    });

  } catch (error) {
    console.error('[Signin] Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
