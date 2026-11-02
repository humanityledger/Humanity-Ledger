import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getRedisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';

// [BUILD-TIME GUARD] Validation fires lazily at request time via getSessionSecret().
function getSessionSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            '[SECURITY CRITICAL] JWT_SECRET is not set. '
            + 'Set JWT_SECRET environment variable immediately.'
        );
    }
    return new TextEncoder().encode(secret);
}

// B-010: Session configuration — Access 15 min, Refresh 30 days
export const SESSION_CONFIG = {
    SESSION_ACCESS_TTL: 15 * 60, // 15 minutes in seconds
    ACCESS_TOKEN_DURATION: 15 * 60, // 15 minutes
    REFRESH_TOKEN_DURATION: 30 * 24 * 60 * 60, // 30 days in seconds
    REFRESH_INTERVAL: 10 * 60 * 1000, // 10 minutes in milliseconds (for client refresh)
    COOKIE_NAME: 'hl_session', // B-007: Single unified HttpOnly session cookie
} as const;

export interface SessionPayload extends JWTPayload {
    userId: string;
    email: string;
    type: 'access' | 'refresh';
    familyId?: string; // For refresh token rotation (B-009)
    fingerprint?: string;
    walletAddress?: string;
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
 * Create an access token (15 min duration)
 */
export async function createAccessToken(
    userId: string,
    email: string,
    fingerprint: string,
    familyId?: string
): Promise<string> {
    const token = await new SignJWT({
        userId,
        email,
        type: 'access',
        familyId: familyId || crypto.randomUUID(),
        fingerprint,
    } as SessionPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_CONFIG.ACCESS_TOKEN_DURATION}s`)
        .sign(getSessionSecret());

    return token;
}

/**
 * Create a refresh token (30 day duration) with family ID for rotation
 */
export async function createRefreshToken(
    userId: string,
    email: string,
    fingerprint: string,
    familyId?: string
): Promise<string> {
    const fid = familyId || crypto.randomUUID();
    const token = await new SignJWT({
        userId,
        email,
        type: 'refresh',
        familyId: fid,
        fingerprint,
    } as SessionPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_CONFIG.REFRESH_TOKEN_DURATION}s`)
        .sign(getSessionSecret());

    // Record valid refresh token in Redis (B-009)
    try {
        const redis = await getRedisClient();
        const tokenId = crypto.createHash('sha256').update(token).digest('hex');
        await redis.setex(`refresh:${fid}:${tokenId}`, SESSION_CONFIG.REFRESH_TOKEN_DURATION, userId);
    } catch (err) {
        logger.warn({ err }, 'Redis unavailable for refresh token tracking — continuing');
    }

    return token;
}

/**
 * Rotate refresh token with reuse detection (B-009).
 * If a previously used refresh token is presented, the entire family is revoked.
 */
export async function rotateRefreshToken(oldRefreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    const payload = await verifyToken(oldRefreshToken);
    if (!payload || payload.type !== 'refresh' || !payload.familyId) return null;

    const { userId, email, fingerprint, familyId } = payload;
    const tokenId = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');

    try {
        const redis = await getRedisClient();
        const key = `refresh:${familyId}:${tokenId}`;
        const exists = await redis.get(key);

        if (!exists) {
            // REUSE DETECTED: Revoke all tokens in this family (B-009)
            logger.warn({ familyId, userId }, 'Refresh token reuse detected — revoking family');
            const keys = await redis.keys(`refresh:${familyId}:*`);
            if (keys.length > 0) await redis.del(...keys);
            return null;
        }

        // Delete used token and generate new pair
        await redis.del(key);
    } catch {
        // Fall back if Redis unavailable
    }

    const newAccess = await createAccessToken(userId, email, fingerprint || '', familyId);
    const newRefresh = await createRefreshToken(userId, email, fingerprint || '', familyId);
    return { accessToken: newAccess, refreshToken: newRefresh };
}

/**
 * Revoke all sessions on all devices for a user (B-010).
 */
export async function revokeAllSessions(userId: string): Promise<void> {
    try {
        const redis = await getRedisClient();
        const keys = await redis.keys(`refresh:*`);
        for (const k of keys) {
            const owner = await redis.get(k);
            if (owner === userId) await redis.del(k);
        }
    } catch (err) {
        logger.error({ err, userId }, 'Error revoking all sessions in Redis');
    }
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
    try {
        const verified = await jwtVerify(token, getSessionSecret());
        return verified.payload as SessionPayload;
    } catch {
        return null;
    }
}

/**
 * Set secure single HttpOnly session cookie (B-007)
 */
export async function setSessionCookies(token: string, refreshToken?: string) {
    const cookieStore = await cookies();
    
    // B-007: Single unified cookie 'hl_session'
    cookieStore.set(SESSION_CONFIG.COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: SESSION_CONFIG.ACCESS_TOKEN_DURATION,
        path: '/',
    });

    if (refreshToken) {
        cookieStore.set('hl_refresh', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: SESSION_CONFIG.REFRESH_TOKEN_DURATION,
            path: '/',
        });
    }
}

/**
 * Get session from cookies.
 * Priority 1: Unified 'hl_session' cookie (B-007)
 * Priority 2: Transparent migration of legacy cookies ('human_session', 'ledger_session', 'human.access-token')
 */
export async function getSession(req?: any): Promise<SessionPayload | null> {
    let cookieStore: any;
    try {
        cookieStore = await cookies();
    } catch {
        cookieStore = req?.cookies;
    }

    const { isSessionTokenRevoked } = await import('@/lib/security/sessionRevocation');

    // Priority 1: B-007 unified session cookie 'hl_session'
    const hlSession = cookieStore.get(SESSION_CONFIG.COOKIE_NAME)?.value;
    if (hlSession) {
        try {
            const { verifyJWT } = await import('@/lib/jwt');
            const payload = (await verifyJWT(hlSession)) as any;
            // A token revoked by logout (on any instance) is not a session.
            if (await isSessionTokenRevoked(hlSession)) throw new Error('revoked');
            const uid = payload.walletAddress || payload.address || payload.userId || payload.sub;
            if (uid) {
                return {
                    userId: String(uid).toLowerCase(),
                    email: payload.email || '',
                    type: 'access',
                    walletAddress: payload.walletAddress || payload.address || (String(uid).startsWith('0x') ? String(uid).toLowerCase() : undefined),
                    sub: payload.sub,
                    exp: payload.exp,
                    iat: payload.iat,
                };
            }
        } catch {
            // Token expired or invalid
        }
    }

    // Priority 2: Transparent fallback & migration for active legacy sessions
    const legacyCookies = ['ledger_session', 'human_session', 'humanity_session', 'human.access-token'];
    for (const name of legacyCookies) {
        const legacyVal = cookieStore.get(name)?.value;
        if (legacyVal) {
            try {
                const { verifyJWT } = await import('@/lib/jwt');
                const payload = (await verifyJWT(legacyVal)) as any;
                if (await isSessionTokenRevoked(legacyVal)) continue;
                const uid = payload.walletAddress || payload.address || payload.userId || payload.sub;
                if (uid) {
                    return {
                        userId: String(uid).toLowerCase(),
                        email: payload.email || '',
                        type: 'access',
                        walletAddress: payload.walletAddress || payload.address || (String(uid).startsWith('0x') ? String(uid).toLowerCase() : undefined),
                        sub: payload.sub,
                        exp: payload.exp,
                        iat: payload.iat,
                    };
                }
            } catch {
                continue;
            }
        }
    }

    return null;
}

/**
 * Clear all session cookies (including legacy cookies during logout)
 */
export async function clearSessionCookies() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_CONFIG.COOKIE_NAME);
    cookieStore.delete('hl_refresh');
    cookieStore.delete('human.access-token');
    cookieStore.delete('human.refresh-token');
    cookieStore.delete('ledger_session');
    cookieStore.delete('human_session');
    cookieStore.delete('humanity_session');
    cookieStore.delete('system_handshake');
}

/**
 * Validate device fingerprint
 */
export function validateFingerprint(sessionFingerprint: string, requestFingerprint: string): boolean {
    return sessionFingerprint === requestFingerprint;
}
