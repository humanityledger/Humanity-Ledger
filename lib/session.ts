import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'crypto';

//  CRITICAL SECURITY GUARD 
// FIX: 'VOID_SECRET_99_POLY' was the hardcoded fallback. This secret is now
// publicly visible in source code, making every SIWE+session JWT forgeable.
// An attacker could craft:
//   { alg:'HS256' }.{ sub:'0x<any_address>', clearance:'Cryptographic', exp:... }
// sign it with the known secret and bypass ALL middleware authentication checks.
//
// [BUILD-TIME GUARD] Do NOT throw at module level — `next build` eagerly imports
// all server modules with NODE_ENV=production but secrets are NOT injected until
// the container starts. Validation fires lazily at request time via getSessionSecret().
function getSessionSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            '[SECURITY CRITICAL] JWT_SECRET is not set. '
            + 'This fires at request time — set JWT_SECRET immediately.'
        );
    }
    return new TextEncoder().encode(secret);
}

// Session configuration
export const SESSION_CONFIG = {
    // Single Source of Truth for Session TTL
    SESSION_ACCESS_TTL: 24 * 60 * 60, // 24 hours in seconds
    ACCESS_TOKEN_DURATION: 24 * 60 * 60, // Legacy email access token (align with SIWE)
    REFRESH_TOKEN_DURATION: 7 * 24 * 60 * 60, // 7 days in seconds
    REFRESH_INTERVAL: 15 * 60 * 1000, // 15 minutes in milliseconds (for client-side)
} as const;

export interface SessionPayload extends JWTPayload {
    userId: string;
    email: string;
    type: 'access' | 'refresh';
    fingerprint?: string;
}

/**
 * Generate device fingerprint from request headers
 */
export function generateFingerprint(userAgent: string, ip: string): string {
    return crypto
        .createHash('sha256')
        .update(`${userAgent}:${ip}`)
        .digest('hex');
}

/**
 * Create an access token (30 min duration)
 */
export async function createAccessToken(userId: string, email: string, fingerprint: string): Promise<string> {
    const token = await new SignJWT({
        userId,
        email,
        type: 'access',
        fingerprint,
    } as SessionPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_CONFIG.ACCESS_TOKEN_DURATION}s`)
        .sign(getSessionSecret());

    return token;
}

/**
 * Create a refresh token (7 day duration)
 */
export async function createRefreshToken(userId: string, email: string, fingerprint: string): Promise<string> {
    const token = await new SignJWT({
        userId,
        email,
        type: 'refresh',
        fingerprint,
    } as SessionPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_CONFIG.REFRESH_TOKEN_DURATION}s`)
        .sign(getSessionSecret());

    return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
    try {
        const verified = await jwtVerify(token, getSessionSecret());
        return verified.payload as SessionPayload;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

/**
 * Set secure httpOnly cookies for both tokens
 */
export async function setSessionCookies(accessToken: string, refreshToken: string) {
    const cookieStore = await cookies();
    
    // Access token cookie - 30 minutes
    cookieStore.set('human.access-token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: SESSION_CONFIG.ACCESS_TOKEN_DURATION,
        path: '/',
    });

    // Refresh token cookie - 7 days
    cookieStore.set('human.refresh-token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: SESSION_CONFIG.REFRESH_TOKEN_DURATION,
        path: '/',
    });
}

/**
 * Get session from cookies.
 * Supports TWO token formats:
 * 1. SIWE system session: cookie 'human_session', JWT payload { sub, address, clearance }
 * 2. Email/legacy session:   cookie 'human.access-token', JWT payload { userId, email, type }
 */
export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();

    //  Priority 1: SIWE system session 
    const ledgerSession = cookieStore.get('ledger_session')?.value;
    const humanSession = cookieStore.get('human_session')?.value;
    const siweToken = ledgerSession || humanSession;
    if (siweToken) {
        try {
            const { verifyJWT } = await import('@/lib/jwt');
            const payload = await verifyJWT(siweToken) as any;
            // Normalize SIWE payload  SessionPayload shape
            const siweUserId = payload.walletAddress || payload.address || payload.sub;
            if (siweUserId) {
                return {
                    userId: (siweUserId as string).toLowerCase(),
                    email: '',
                    type: 'access',
                    sub: payload.sub,
                    exp: payload.exp,
                    iat: payload.iat,
                };
            }
        } catch {
            // Expired or invalid SIWE token  fall through to email session
        }
    }

    //  Priority 2: Email/legacy access token 
    const accessToken = cookieStore.get('human.access-token')?.value;
    if (accessToken) {
        const verified = await verifyToken(accessToken);
        if (verified) return verified;
    }

    // [SECURITY PATCh] Removed Priority 3: System QR Handshake. 
    // It was blindly trusting an unencrypted, client-side mutable cookie, leading to massive IDOR vulnerabilities.
    
    return null;
}

/**
 * Clear all session cookies
 */
export async function clearSessionCookies() {
    const cookieStore = await cookies();
    
    cookieStore.delete('human.access-token');
    cookieStore.delete('human.refresh-token');
}

/**
 * Validate device fingerprint
 */
export function validateFingerprint(sessionFingerprint: string, requestFingerprint: string): boolean {
    return sessionFingerprint === requestFingerprint;
}

