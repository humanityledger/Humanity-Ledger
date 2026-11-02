import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { createPublicClient, http, parseAbi } from 'viem';
import { optimism } from 'viem/chains';

// ============================================
// SECURITY LAYER 1: Rate Limiting
// ============================================

const RATE_LIMITS = {
  FREE: { window: 60000, requests: 10 },
  PREMIUM: { window: 60000, requests: 100 },
  CRITICAL: { window: 60000, requests: 1000 }
};

const rateLimitStore = new Map<string, { count: number, resetTime: number, blacklisted: boolean }>();

export function rateLimit(
  identifier: string,
  tier: 'FREE' | 'PREMIUM' | 'CRITICAL' = 'FREE'
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const config = RATE_LIMITS[tier];
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + config.window, blacklisted: false });
    return { allowed: true, remaining: config.requests - 1, resetIn: config.window };
  }

  if (entry.blacklisted) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }

  entry.count++;
  if (entry.count > config.requests) {
    entry.blacklisted = true;
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }

  return { allowed: true, remaining: config.requests - entry.count, resetIn: entry.resetTime - now };
}

// ============================================
// SECURITY LAYER 2: Subscription Verification  NATIVE Cryptographic
// ============================================

export async function verifyPremiumAccess(userId: string): Promise<{
  valid: boolean;
  tier: 'FREE' | 'PREMIUM' | 'TRIAL' | 'Enterprise';
  expiresAt?: Date;
}> {
  try {
    const normalizedUserId = userId.toLowerCase();

    // SECURITY FIX VULN-06: NFT contract was set to 0x000...000 (zero address).
    // Querying balanceOf on the zero address is either a no-op or could return unexpected
    // values depending on the chain/RPC, potentially granting Cryptographic tier to any wallet.
    // This block is DISABLED until a real NFT contract address is configured via env.
    // To enable: set NFT_CONTRACT_ADDRESS=0x<real_contract> in Railway environment variables.
    const nftContract = process.env.NFT_CONTRACT_ADDRESS;
    if (nftContract && /^0x[a-fA-F0-9]{40}$/.test(nftContract) && nftContract !== '0x0000000000000000000000000000000000000000') {
      try {
        const publicClient = createPublicClient({ chain: optimism, transport: http() });
        const balance = await publicClient.readContract({
            address: nftContract as `0x${string}`,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [normalizedUserId as `0x${string}`],
        });
        if (balance > 0n) {
            console.log(`[Zero-Trust] ✅ Validated System NFT holding for ${normalizedUserId}`);
            return { valid: true, tier: 'PREMIUM' };
        }
      } catch (rpcErr) {
        // Silent fallback to database if RPC fails (Network Resilience)
      }
    }

    // 1. Native DB TIER check (One-time payments and System tier)
    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedUserId },
      select: { tier: true }
    });

    if (!user) {
      user = await prisma.user.findFirst({
        where: { walletAddress: { equals: normalizedUserId, mode: 'insensitive' } },
        select: { tier: true }
      });
    }

    if (user?.tier === 'Cryptographic' || user?.tier === 'HUMAN' || user?.tier === 'FULL_NODE' || user?.tier === 'ARCHIVE_PROVER') {
       return { valid: true, tier: 'PREMIUM' }; // Note: returns PREMIUM to unlock features
    }

    // 2. Subscription check from native DB (case insensitive fallback)
    let subscription = await prisma.subscription.findFirst({
      where: {
        userId: normalizedUserId,
        status: 'ACTIVE',
        expiresAt: { gte: new Date() },
      },
    });

    if (!subscription) {
      subscription = await prisma.subscription.findFirst({
        where: {
          userId: { equals: normalizedUserId, mode: 'insensitive' },
          status: 'ACTIVE',
          expiresAt: { gte: new Date() },
        },
      });
    }
    
    if (!subscription) return { valid: false, tier: 'FREE' };
    return { valid: true, tier: 'PREMIUM', expiresAt: subscription.expiresAt ?? undefined };
  } catch (error) {
    return { valid: false, tier: 'FREE' };
  }
}

// ============================================
// SECURITY LAYER 6: CSRF Protection
// ============================================

const _rawEncKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
if (!_rawEncKey) {
  console.error('[SECURITY CRITICAL] ENCRYPTION_KEY is not set. CSRF tokens are insecurely signed!');
}
const ENCRYPTION_KEY = _rawEncKey ?? require('crypto').randomBytes(32).toString('hex');

export function generateCSRFToken(userId: string): string {
  const timestamp = Date.now();
  const randomData = crypto.randomBytes(32).toString('hex');
  const payload = `${userId}:${timestamp}:${randomData}`;
  const hmac = crypto.createHmac('sha256', ENCRYPTION_KEY);
  const signature = hmac.update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64')}.${signature}`;
}

export function verifyCSRFToken(token: string, userId: string): boolean {
  try {
    const [payloadB64, signature] = token.split('.');
    const payload = Buffer.from(payloadB64, 'base64').toString('utf8');
    const [tokenUserId, timestamp] = payload.split(':');
    if (tokenUserId !== userId) return false;
    if (Date.now() - parseInt(timestamp) > 900000) return false;
    const hmac = crypto.createHmac('sha256', ENCRYPTION_KEY);
    const expectedSignature = hmac.update(payload).digest('hex');
    // SECURITY FIX VULN-05: Use timingSafeEqual to prevent HMAC timing side-channel attacks.
    // A normal `===` comparison leaks the number of matching characters via measurable
    // latency differences, allowing brute-force recovery of valid CSRF tokens.
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false; // Malformed hex (wrong length) — reject
    }
  } catch (error) {
    return false;
  }
}

// ============================================
// SECURITY LAYER 8: Security Event Logging
// ============================================

export async function logSecurityEvent(
  event: string,
  details: any
): Promise<void> {
  console.error(`[SECURITY EVENT] ${event}`, details);
  try {
    await prisma.securityEvent.create({
      data: {
        type: event,
        ipAddress: details.ip || 'unknown',
        details: JSON.stringify(details) || null,
        severity: details.severity || 'INFO',
      },
    });
  } catch (error) {
    console.error('[SECURITY] Failed to log security event:', error);
  }
}

export async function logAuditEvent(log: {
  userId: string;
  action: string;
  resource: string;
  metadata?: any;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  // AuditLog table does not exist in schema.prisma  log to native Log model
  try {
    await prisma.log.create({
      data: {
        level: 'info',
        message: `AUDIT: ${log.action} on ${log.resource}`,
        source: 'premium-security',
        metadata: {
          userId: log.userId,
          action: log.action,
          resource: log.resource,
          data: log.metadata || {},
          ip: log.ip,
          userAgent: log.userAgent,
        },
      },
    });
  } catch (error) {
    console.error('[SECURITY] Audit log failed:', error);
  }
}

// ============================================
// SECURITY LAYER 9: Request Validation  Cryptographic SIWE
// ============================================

export async function validateSecureRequest(
  req: NextRequest,
  requiredTier: 'FREE' | 'PREMIUM' = 'FREE',
  options: { requireCsrf?: boolean } = {}
): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  // PRIMARY: SIWE session JWT (full desktop auth flow)
  const session = await getSession();
  let userId = session?.userId;

  // [QUANTUM AEGIS FIX]
  // Completely removed the `system_handshake` cookie and `x-web3-address` header fallbacks.
  // Those fallbacks allowed complete Account Takeover / Spoofing of any address by simply 
  // setting an HTTP header. All authentication must strictly derive from the cryptographic JWT.

  if (!userId) {
    return { valid: false, error: 'Unauthorized' };
  }

  if (requiredTier === 'PREMIUM') {
    const access = await verifyPremiumAccess(userId);
    if (!access.valid) return { valid: false, error: 'Premium required' };
  }

  // CSRF is opt-in  only enforced for sensitive mutations that explicitly require it.
  // Payment checkout and session-based flows do NOT send this header and must not be blocked.
  if (options.requireCsrf && req.method !== 'GET') {
    const csrfToken = req.headers.get('x-csrf-token');
    if (!csrfToken || !verifyCSRFToken(csrfToken, userId)) {
      return { valid: false, error: 'Invalid CSRF' };
    }
  }

  return { valid: true, userId };
}

export function watermarkData(data: any, userId: string): any {
  return { ...data, _ts: Date.now() };
}

export function sanitizeInput(input: string): string {
  return input.replace(/[<>'"\\]/g, '').trim().slice(0, 1000);
}

export function validateWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address) || /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
}
