import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import {
  resolveStudioIdentity,
  checkDbSessionValidInTx,
} from '@/lib/security/studio-identity-adapter';
import { serializePassport, slugifyTitle } from '@/lib/passport/serialize';
import { sequencer } from '@/lib/provenance/qd-sequencer';
import { z } from 'zod';
import OpenAI from 'openai';
import { NODE_TIERS, PlanTier } from '@/lib/node_infrastructure/tiers';
import crypto from 'crypto';

// ─── Strict Sovereign Schema ──────────────────────────────────────────────────
const passportSchema = z.object({
  title: z.string().min(2).max(150).regex(/^[a-zA-Z0-9\s\-_.]+$/, "Invalid characters in title"),
  category: z.enum(['PHARMA', 'FOOD', 'TECH', 'INFRASTRUCTURE', 'TEXTILE', 'DOCUMENTS', 'OTHER']),
  payload: z.object({
    batchId: z.string().min(1).max(64).regex(/^[A-Z0-9\-_]+$/, "Batch ID must be uppercase alphanumeric").optional(),
    origin: z.string().min(2).max(100).optional(),
    description: z.string().max(1000).optional(),
    carbonKg: z.number().nonnegative().optional(),
    certifications: z.array(z.string().max(50)).optional(),
    logistics: z.object({
      carrier: z.string().max(100).optional(),
      trackingNumber: z.string().max(100).optional(),
      weightKg: z.number().nonnegative().optional(),
      dimensions: z.string().max(50).optional(),
      handlingConditions: z.string().max(100).optional(),
    }).optional(),
    lifecycle: z.object({
      carbonFootprintTotal: z.number().nonnegative().optional(),
      recyclabilityPercent: z.number().min(0).max(100).optional(),
      waterUsageLiters: z.number().nonnegative().optional(),
      materialComposition: z.string().max(500).optional(),
    }).optional(),
    telemetry: z.object({
      hasTemperatureSensors: z.boolean().optional(),
      hasShockSensors: z.boolean().optional(),
      lastReportedLocation: z.string().max(100).optional(),
    }).optional(),
  }).strict(),
  // GS1 GTIN: 8, 12, 13, or 14 digit numeric string (EAN-8, UPC-A, EAN-13, ITF-14)
  gs1Gtin: z.string().regex(/^\d{8}(\d{4}|\d{5}|\d{6})?$/, {
    message: 'GS1 barcode must be a valid GTIN: 8, 12, 13, or 14 numeric digits.'
  }).optional(),
  publicSlug: z.string().max(64).optional(),
  // Events are accepted from the frontend but handled server-side separately
  events: z.array(z.object({
    eventType: z.string(),
    payload: z.record(z.string(), z.any()),
  })).optional(),
});

// ─── Anti-XSS sanitization ────────────────────────────────────────────────────
function sanitizeHTML(str: string): string {
  return str.replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ─── Static Profanity / Obscenity Filter ─────────────────────────────────────
const PROFANITY_BLACKLIST = [
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'fag', 'nigger', 'cock', 'bastard',
  'puta', 'mierda', 'pendejo', 'cabron', 'maricon', 'verga', 'culo', 'zorra', 'puto', 'gilipollas', 'concha', 'cojones',
  // Cryptographic Strict Mode / Anti-Nonsense
  'scam', 'ponzi', 'rugpull', 'fake', 'bullshit', 'crap', 'idiot', 'moron', 'stupid', 'tonto', 'estupido', 'estúpido', 'basura', 'engaño'
];

function containsProfanity(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PROFANITY_BLACKLIST.some(word => {
    // Escape special regex chars to prevent ReDoS attacks
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
}

// ─── POST /api/passport ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3+4: Studio Identity Adapter (Shadow → Pilot/Live)
  //
  // resolveStudioIdentity() returns:
  //   OFF/SHADOW → authorizedAddress = legacy getSession() address (unchanged behaviour)
  //   PILOT/LIVE → authorizedAddress = HumanityIdentity address verified in DB
  //              → null if session is revoked or expired (→ 401)
  //
  // For PILOT/LIVE modes: The DB authority check below runs INSIDE the Prisma
  // $transaction that creates the passport. This eliminates the race window
  // between session verification and the actual mutation (Option D architecture).
  // ─────────────────────────────────────────────────────────────────────────────
  const identity = await resolveStudioIdentity(/* skipDbCheck = */ false);

  if (!identity.authorizedAddress) {
    return NextResponse.json(
      { error: 'Connect your wallet to create a passport' },
      { status: 401 }
    );
  }

  const issuerAddress = identity.authorizedAddress.toLowerCase();
  const adminWallet = (process.env.ADMIN_WALLET_ADDRESS || process.env.OWNER_WALLET || '').toLowerCase();
  const isOwner = Boolean(adminWallet && issuerAddress === adminWallet);

  if (!isOwner) {
    // ── Rate Limiting: max 5 passports per minute per wallet ─────────────────
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentCount = await prisma.productPassport.count({
      where: {
        issuerAddress,
        createdAt: { gte: oneMinuteAgo },
      },
    });

    if (recentCount >= 5) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 5 records per minute allowed to prevent spam.' },
        { status: 429 }
      );
    }

    // ── Strict Global Limit based on Tier ────────────────────────────────────
    const userNode = await prisma.user.findUnique({ where: { walletAddress: issuerAddress } });
    const tier = userNode?.tier || 'FREE';

    const totalCount = await prisma.productPassport.count({
      where: { issuerAddress },
    });

    const maxPassports = tier === 'FREE' ? 3 : 100;

    if (totalCount >= maxPassports) {
      return NextResponse.json(
        { error: `Free tier limit reached. You can only create ${maxPassports} Product Passports maximum on the ${tier} tier.` },
        { status: 403 }
      );
    }
  }

  // ── Parse and validate body ───────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = passportSchema.safeParse(body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues?.[0];
    const fieldName = firstError?.path?.join('.') || 'unknown field';
    const message = firstError?.message || 'Validation failed';
    return NextResponse.json(
      { error: `${message} (field: ${fieldName})` },
      { status: 400 }
    );
  }

  const validData = parseResult.data;

  // ── Static Profanity Check ────────────────────────────────────────────────
  const fieldsToCheck = [
    validData.title,
    validData.category,
    validData.payload?.description,
    validData.payload?.batchId,
    validData.payload?.origin,
    validData.payload?.logistics?.carrier,
    validData.payload?.logistics?.trackingNumber,
    validData.payload?.logistics?.dimensions,
    validData.payload?.logistics?.handlingConditions,
    validData.payload?.lifecycle?.materialComposition,
  ];

  if (fieldsToCheck.some(field => typeof field === 'string' && containsProfanity(field))) {
    return NextResponse.json(
      { error: 'Inappropriate content detected. Please use normal words.' },
      { status: 400 }
    );
  }

  // ── Semantic AI Validation ────────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    const openai = new OpenAI({ apiKey });
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a strict sovereign provenance auditor. Evaluate the JSON and return {"valid": true} or {"valid": false, "reason": "..."}.' },
          { role: 'user', content: JSON.stringify(validData) }
        ],
        response_format: { type: 'json_object' }
      });
      const aiResult = JSON.parse(completion.choices[0]?.message?.content || '{"valid": true}');
      if (!aiResult.valid) {
        return NextResponse.json({ error: `Semantic validation failed: ${aiResult.reason}` }, { status: 400 });
      }
    } catch (e) {
      console.error('[OpenAI] Semantic validation error:', e);
    }
  }

  // ── Build slug ────────────────────────────────────────────────────────────
  let publicSlug = (validData.publicSlug || '').trim();
  if (!publicSlug) publicSlug = slugifyTitle(validData.title);
  publicSlug = publicSlug.replace(/[^a-z0-9-]/gi, '').toLowerCase();

  // ── Sanitize payload ──────────────────────────────────────────────────────
  const sanitizedPayload = validData.payload ? JSON.parse(JSON.stringify({
    ...validData.payload,
    description: validData.payload.description ? sanitizeHTML(validData.payload.description) : undefined,
    origin: validData.payload.origin ? sanitizeHTML(validData.payload.origin) : undefined,
    batchId: validData.payload.batchId ? sanitizeHTML(validData.payload.batchId) : undefined,
    logistics: validData.payload.logistics,
    lifecycle: validData.payload.lifecycle,
    telemetry: validData.payload.telemetry,
  })) : {};

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4 — OPTION D: Authoritative Session Check INSIDE the Prisma transaction.
  //
  // This is the core security primitive that closes the 24h revocation gap.
  // For PILOT/LIVE modes, we verify the HumanitySession is not revoked WITHIN
  // the same atomic transaction that creates the passport. If the session is
  // revoked between the initial resolveStudioIdentity() call and this write,
  // the transaction will throw and rollback — no passport is created.
  //
  // For OFF/SHADOW modes, identity.sessionId is null and the check is a no-op.
  // ─────────────────────────────────────────────────────────────────────────────
  let passport: any = null;
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    try {
      passport = await prisma.$transaction(async (tx) => {
        // ── [OPTION D] Authoritative DB Session Check ─────────────────────
        // Only enforce in PILOT/LIVE. In OFF/SHADOW, sessionId is null → skip.
        if (identity.sessionId && (identity.mode === 'PILOT' || identity.mode === 'LIVE')) {
          const sessionStillValid = await checkDbSessionValidInTx(
            tx,
            identity.sessionId,
            issuerAddress
          );
          if (!sessionStillValid) {
            throw Object.assign(
              new Error('SESSION_REVOKED'),
              { code: 'SESSION_REVOKED' }
            );
          }
        }

        // ── Create passport atomically ─────────────────────────────────────
        return tx.productPassport.create({
          data: {
            publicSlug,
            title: sanitizeHTML(validData.title),
            category: validData.category,
            issuerAddress,
            payload: sanitizedPayload,
            gs1Gtin: validData.gs1Gtin?.replace(/\D/g, '') || null,
            events: {
              create: [{ eventType: 'manufactured', payload: { note: 'Registered via Studio Provenance API' } }],
            },
          },
          include: { events: { orderBy: { createdAt: 'desc' } } },
        });
      });

      break; // Success — exit retry loop

    } catch (error: any) {
      if (error.code === 'SESSION_REVOKED') {
        // Session was revoked between identity resolution and mutation — deny
        return NextResponse.json(
          { error: 'Session has been revoked. Please sign in again.' },
          { status: 401 }
        );
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('publicSlug')) {
        // Slug collision — retry with entropy suffix
        attempts++;
        publicSlug = `${slugifyTitle(validData.title)}-${crypto.randomUUID().split('-')[0]}`;
        continue;
      }
      // Unknown DB error — fail with 500
      console.error('[LedgerFortress] Atomic DB Guard caught Prisma exception:', error);
      return NextResponse.json(
        { error: 'Internal database error during quantum registry.' },
        { status: 500 }
      );
    }
  }

  if (!passport) {
    return NextResponse.json(
      { error: 'System under heavy load. Unique slug generation failed. Try again.' },
      { status: 409 }
    );
  }

  // ── Async Aztec Sequencer (fire-and-forget, non-blocking) ─────────────────
  sequencer.submitPassportToAztec(passport.id, {
    slug: publicSlug,
    batchId: validData.payload?.batchId,
    supplierId: issuerAddress,
    metadata: validData.payload
  }).catch(err => {
    console.error(`[API] Failed to trigger sequencer for ${passport.id}:`, err);
  });

  return NextResponse.json(serializePassport(passport), { status: 201 });
}
