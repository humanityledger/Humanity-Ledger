import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json(
        { error: 'UserId and code are required' },
        { status: 400 }
      );
    }

    // Find verification code (no include - VerificationCode has no user relation)
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        userId,
        code,
        used: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!verificationCode) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 401 }
      );
    }

    // Fetch the user separately
    const user = await prisma.authUser.findUnique({
      where: { id: verificationCode.userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Mark code as used
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { used: true }
    });

    // Update user as verified
    await prisma.authUser.update({
      where: { id: userId },
      data: { verified: true }
    });

    // Generate access and refresh tokens
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    
    const { createAccessToken, createRefreshToken, setSessionCookies, generateFingerprint } = await import('@/lib/session');
    const fingerprint = generateFingerprint(userAgent, ip);
    
    const accessToken = await createAccessToken(user.id, user.email || '', fingerprint);
    const refreshToken = await createRefreshToken(user.id, user.email || '', fingerprint);

    // Set secure httpOnly cookies
    await setSessionCookies(accessToken, refreshToken);

    return NextResponse.json({
      success: true,
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        verified: true
      }
    });

  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify code. Please try again.' },
      { status: 500 }
    );
  }
}

