import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';
import { RedisRateLimiter } from './redis/rate-limiter';
import { safeRedisGet, safeRedisSet, redisClient } from './redis/client';
import { timingSafeEqual } from 'crypto';
import { safeJsonParse } from '@/lib/utils/json';

export interface ApiKeyValidation {
  valid: boolean;
  subscription?: any;
  error?: string;
  statusCode?: number;
}

export async function validateApiKey(req: NextRequest): Promise<ApiKeyValidation> {
  const apiKey = req.headers.get('x-wac-api-key')
               || req.headers.get('authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    return { valid: false, error: 'Missing API key. Include X-WAC-API-Key header.', statusCode: 401 };
  }

  //  INTERNAL BYPASS for development/dashboard (LEGENDARY) 
  if (process.env.NODE_ENV !== 'production' && apiKey === 'DEV_INTERNAL_WAC') {
    return { 
      valid: true, 
      subscription: { 
        id: 'internal_dev', 
        tier: 'Elite', // Give full access to the dashboard
        walletAddress: 'SYSTEM',
        status: 'active',
        dailyRequestLimit: 0, // Unlimited
        ledgerThresholdUsd: 50000,
        ipWhitelist: []
      } 
    };
  }

  if (!apiKey.startsWith('wac_live_')) {
    return { valid: false, error: 'Invalid API key format. Keys start with wac_live_', statusCode: 401 };
  }

  //  Phase 1: Redis API Key Caching 
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const cacheKey = `apikey:${keyHash}`;
  
  let subscription: any = null;
  const cachedKey = await safeRedisGet(cacheKey);
  
  if (cachedKey && cachedKey !== 'TIMEOUT') {
    subscription = safeJsonParse(cachedKey, null, 'API_GUARD_KEY_CACHE');
  } else {
    subscription = await (prisma as any).apiSubscription.findFirst({
      where: { keyHash },
    });
    
    if (subscription) {
      // Cache valid keys for 60s to reduce DB load
      await safeRedisSet(cacheKey, JSON.stringify(subscription), 'EX', 60);
    }
  }

  if (!subscription) {
    return { valid: false, error: 'API key not found.', statusCode: 401 };
  }

  // Check suspension
  if (subscription.status === 'disputed') {
    return {
      valid: false,
      error: 'API key suspended due to active payment dispute. Contact support@ledgeralert.corp.',
      statusCode: 403,
    };
  }

  if (subscription.status === 'canceled') {
    return {
      valid: false,
      error: 'Subscription canceled. Renew at ledgeralert.corp/api-marketplace.',
      statusCode: 403,
    };
  }

  // Check grace period for past_due
  if (subscription.status === 'past_due') {
    const grace = subscription.gracePeriodEnd;
    if (grace && grace < new Date()) {
      await (prisma as any).apiSubscription.update({
        where: { id: subscription.id },
        data: { status: 'suspended', updatedAt: new Date() },
      });
      return {
        valid: false,
        error: 'Subscription suspended due to failed payment. Update payment at ledgeralert.corp/billing.',
        statusCode: 403,
      };
    }
    // In grace period  allow access
  }

  // Check period end
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
    return {
      valid: false,
      error: 'Subscription expired. Renew at ledgeralert.corp/api-marketplace.',
      statusCode: 402,
    };
  }

  //  Tier Enforcement (Starter / Pro / Elite) 
  const tier = subscription.tier.toLowerCase();
  
  // Set default limits if not in DB
  const tierLimits: Record<string, { threshold: number, windowDays: number }> = {
    starter: { threshold: 500000, windowDays: 1 },
    pro: { threshold: 100000, windowDays: 30 },
    Elite: { threshold: 50000, windowDays: 365 }
  };

  const limit = tierLimits[tier] || tierLimits.starter;
  
  // Attach limits to the subscription object for the route handler
  subscription.enforcedThreshold = subscription.ledgerThresholdUsd || limit.threshold;
  subscription.enforcedWindowDays = limit.windowDays;

  //  IP Whitelisting (Elite/Pro) 
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (subscription.ipWhitelist && subscription.ipWhitelist.length > 0) {
    if (!subscription.ipWhitelist.includes(clientIp)) {
      return {
        valid: false,
        error: `IP Unauthorized: ${clientIp}. Add it to your whitelist in the developer dashboard.`,
        statusCode: 403,
      };
    }
  }

  //  HMAC Request Signing (Elite) 
  if (tier === 'Elite' && subscription.hmacSecret) {
    const signature = req.headers.get('x-wac-signature');
    const timestamp = req.headers.get('x-wac-timestamp');

    if (!signature || !timestamp) {
      return {
        valid: false,
        error: 'Missing HMAC headers for Elite access: X-WAC-Signature, X-WAC-Timestamp.',
        statusCode: 401,
      };
    }

    // Check clock drift (max 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return { valid: false, error: 'Request timestamp expired (clock drift > 5m).', statusCode: 401 };
    }

    // Verify signature: HMAC-SHA256(secret, timestamp + method + path)
    const computedSignature = createHmac('sha256', subscription.hmacSecret)
      .update(`${timestamp}${req.method}${req.nextUrl.pathname}`)
      .digest('hex');

    // ️ [AUDITED SECURITY] Use timingSafeEqual to prevent side-channel timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex');
    const computedBuffer = Buffer.from(computedSignature, 'hex');

    if (signatureBuffer.length !== computedBuffer.length || !timingSafeEqual(signatureBuffer, computedBuffer)) {
      return { valid: false, error: 'Invalid HMAC signature. Integrity check failed.', statusCode: 401 };
    }
  }

  //  High-Frequency Rate Limiting (Redis) 
  if (subscription.dailyRequestLimit > 0) {
    const { success, current } = await RedisRateLimiter.check(
      subscription.id, 
      subscription.dailyRequestLimit
    );

    if (!success) {
      return {
        valid: false,
        error: `${tier.toUpperCase()} High-Frequency Limit Reached (${subscription.dailyRequestLimit.toLocaleString()} req/day). Upgrade for more.`,
        statusCode: 429,
      };
    }
  }

  return { valid: true, subscription };
}

//  Log a successful API request 
export async function logApiRequest(req: NextRequest, subscriptionId: string, endpoint: string, statusCode: number) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  
  //  Phase 3: Redis-Buffered Logging (Unlocking 100M Scale) 
  // Instead of direct DB writes, we push to a Redis list for background worker processing
  if (redisClient && !(redisClient as any).__isMock) {
    const logData = JSON.stringify({
      subscriptionId,
      endpoint,
      ip,
      statusCode,
      createdAt: new Date().toISOString()
    });
    
    // LPUSH to the analytics queue
    await redisClient.lpush('queue:api_usage_logs', logData).catch(() => {});
  } else {
    // Fallback to direct write if Redis is unavailable
    await (prisma as any).apiUsageLog.create({
      data: {
        subscriptionId,
        endpoint,
        ip,
        statusCode,
        createdAt: new Date(),
      },
    }).catch(() => {});
  }
}

