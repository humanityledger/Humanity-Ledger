import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SiweMessage } from 'siwe';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json();

    if (!message || !signature) {
      return NextResponse.json({ error: 'Message and signature required' }, { status: 400 });
    }

    const siweMessage = new SiweMessage(message);
    
    // 1. Atomic Nonce Consumption
    try {
      // Prisma delete is atomic. If the nonce doesn't exist, it throws P2025.
      // We also verify it hasn't expired.
      const dbNonce = await prisma.siweNonce.delete({
        where: { nonce: siweMessage.nonce }
      });
      
      if (dbNonce.expiresAt < new Date()) {
        return NextResponse.json({ error: 'Nonce expired' }, { status: 400 });
      }

      // Nonce TTL: reject if issued more than 10 minutes ago
      const issuedAt = dbNonce.createdAt ? new Date(dbNonce.createdAt).getTime() : 0;
      if (Date.now() - issuedAt > 10 * 60 * 1000) {
        return NextResponse.json({ error: 'Nonce expired' }, { status: 400 });
      }
    } catch (e: any) {
      console.warn('[SIWE] Nonce consumption failed or reused:', siweMessage.nonce);
      return NextResponse.json({ error: 'Invalid or consumed nonce' }, { status: 400 });
    }

    // 2. Validate SIWE Message Signature and Parameters
    let verificationResult;
    try {
      const expectedDomain = process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
        : 'localhost:3000';
      verificationResult = await siweMessage.verify({
        signature,
        domain: expectedDomain,
        nonce: siweMessage.nonce,
        time: new Date().toISOString()
      });

      // 2b. URI Validation — compare canonical origins (scheme + host + port).
      // EIP-4361 requires the URI to be a valid URI under the same origin as the domain.
      // We cannot rely on naive startsWith: 'https://evil.com' startsWith 'https://e' would pass.
      // Parse both to URL objects and compare the origin (scheme://host:port).
      const expectedOrigin = (() => {
        try {
          const raw = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          // Normalize: strip trailing slash, parse origin
          return new URL(raw).origin; // e.g. "https://humanidfi.com" (no trailing slash)
        } catch {
          return 'http://localhost:3000';
        }
      })();

      const msgOrigin = (() => {
        try {
          return new URL(siweMessage.uri).origin;
        } catch {
          return null; // unparseable URI → reject
        }
      })();

      if (!msgOrigin || msgOrigin !== expectedOrigin) {
        console.warn('[SIWE] URI origin mismatch:', msgOrigin, 'expected:', expectedOrigin);
        return NextResponse.json({ error: 'URI origin mismatch' }, { status: 401 });
      }

    } catch (e: any) {
      console.warn('[SIWE] Signature validation failed:', e.message);
      return NextResponse.json({ error: 'Invalid signature or domain mismatch' }, { status: 401 });
    }

    if (!verificationResult.success) {
      return NextResponse.json({ error: 'SIWE Verification Failed' }, { status: 401 });
    }

    const { data } = verificationResult;

    // 2c. Chain ID Validation — environment-aware policy.
    // 31337 (Hardhat) must NEVER be accepted in production.
    // Policy is server-side only; client cannot influence it.
    function getAllowedChainIds(): number[] {
      const appEnv = process.env.APP_ENV || process.env.NODE_ENV;
      if (appEnv === 'production') {
        return [137]; // Polygon Mainnet ONLY
      }
      if (appEnv === 'qa' || appEnv === 'staging') {
        return [137, 80002]; // Polygon + Polygon Mainnet
      }
      // development / local — also allow Hardhat
      return [137, 80002, 31337];
    }

    const allowedChains = getAllowedChainIds();
    if (!allowedChains.includes(data.chainId)) {
      console.warn(`[SIWE] Invalid chainId: ${data.chainId} (allowed in ${process.env.NODE_ENV}: ${allowedChains})`);
      return NextResponse.json({ error: 'Unsupported chain' }, { status: 401 });
    }

    // 3. Resolve Identity
    // Handle concurrent creation using retry/upsert logic
    let identity;
    try {
      identity = await prisma.humanityIdentity.upsert({
        where: { walletAddress: data.address.toLowerCase() },
        update: { lastVerifiedAt: new Date() },
        create: {
          walletAddress: data.address.toLowerCase(),
          chainId: data.chainId,
          verificationStatus: 'SIWE_VERIFIED',
          lastVerifiedAt: new Date(),
          permissions: [] // New accounts start with no elevated permissions
        }
      });
    } catch (e: any) {
      console.error('[SIWE] DB identity resolve failed', e);
      return NextResponse.json({ error: 'Identity resolution failed' }, { status: 500 });
    }

    // 4. Session Creation
    // Do not use IP as primary identity, but store it as telemetry/securityContext
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    
    // Create new persistent session
    const { SESSION_CONFIG } = await import('@/lib/session');
    const session = await prisma.humanitySession.create({
      data: {
        identityId: identity.id,
        authenticationMethod: 'SIWE',
        expiresAt: new Date(Date.now() + SESSION_CONFIG.SESSION_ACCESS_TTL * 1000),
        securityContext: { ipAddress, userAgent },
      }
    });

    // 5. Sign a JWT for Edge Middleware compatibility
    const { mintJWT } = await import('@/lib/jwt');
    const expectedIssuer = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const jwt = await mintJWT({ 
        sub: session.sessionId,
        sessionId: session.sessionId, 
        identityId: identity.id, 
        walletAddress: identity.walletAddress,
        iss: expectedIssuer,
        aud: expectedIssuer
    });

    // 5. Issue secure HttpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'humanity_session',
      value: jwt,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_CONFIG.SESSION_ACCESS_TTL,
    });

    return NextResponse.json({ success: true, identityId: identity.id, address: identity.walletAddress });
  } catch (error: any) {
    console.error('[SIWE-VERIFY] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
