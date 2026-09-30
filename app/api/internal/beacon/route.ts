/**
 * HL-BEACON v1 — Deployment Tracker
 * ============================================================
 * Copyright (c) 2024-2026 Stefan Antonio Cirisanu. All Rights Reserved.
 * Humanity Ledger — https://humanidfi.com
 *
 * This endpoint receives pings from ALL running instances of this
 * codebase (legitimate or cloned). Every time any deployment of
 * Humanity Ledger loads, it sends a beacon here with:
 *   - The origin URL (tells us WHERE it's deployed)
 *   - A fingerprint hash of the deployment
 *   - The user agent of the server runtime
 *
 * This allows Stefan Antonio Cirisanu to see EVERY deployment
 * of the codebase globally, including unauthorized commercial copies.
 *
 * DB table: CloneBeacon (see prisma schema)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// This is the CANONICAL origin — any other origin is a potential clone
const CANONICAL_ORIGIN = 'https://humanidfi.com';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Extract deployment fingerprint data
    const origin      = req.headers.get('origin') || req.headers.get('referer') || body.origin || 'unknown';
    const host        = req.headers.get('host') || 'unknown';
    const userAgent   = req.headers.get('user-agent') || 'unknown';
    const fingerprint = body.fingerprint || 'none';
    const deployEnv   = body.env || 'unknown';
    const ip          = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                        || req.headers.get('x-real-ip')
                        || 'unknown';

    // Determine if this is the canonical deployment or a clone
    const isCanonical = origin.includes('humanidfi.com') || host.includes('humanidfi.com');
    const isClone     = !isCanonical;
    const commercialState = body.commercialState ? JSON.stringify(body.commercialState) : '{}';

    // Auto-heal: Ensure table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CloneBeacon" (
        "fingerprint" TEXT NOT NULL,
        "origin" TEXT NOT NULL,
        "host" TEXT NOT NULL,
        "ip" TEXT NOT NULL,
        "deployEnv" TEXT NOT NULL,
        "userAgent" TEXT NOT NULL,
        "isClone" BOOLEAN NOT NULL DEFAULT false,
        "hitCount" INTEGER NOT NULL DEFAULT 1,
        "commercialData" TEXT,
        "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CloneBeacon_pkey" PRIMARY KEY ("fingerprint")
      );
    `).catch(() => {});

    // Store beacon in DB
    await prisma.$executeRawUnsafe(`
      INSERT INTO "CloneBeacon" 
        ("origin", "host", "ip", "fingerprint", "deployEnv", "userAgent", "isClone", "commercialData", "seenAt")
      VALUES 
        ('${origin.replace(/'/g,"''")}', '${host.replace(/'/g,"''")}', '${ip.replace(/'/g,"''")}', '${fingerprint.replace(/'/g,"''")}', '${deployEnv.replace(/'/g,"''")}', '${userAgent.replace(/'/g,"''")}', ${isClone}, '${commercialState.replace(/'/g,"''")}', NOW())
      ON CONFLICT ("fingerprint") DO UPDATE SET
        "seenAt" = NOW(),
        "hitCount" = "CloneBeacon"."hitCount" + 1,
        "commercialData" = EXCLUDED."commercialData",
        "ip" = EXCLUDED."ip"
    `).catch((e) => console.error("Beacon save failed", e));

    // If it's a clone, also log it more prominently
    if (isClone) {
      console.warn(
        `[HL-BEACON] ⚠️ UNAUTHORIZED DEPLOYMENT DETECTED\n` +
        `  Origin:      ${origin}\n` +
        `  Host:        ${host}\n` +
        `  IP:          ${ip}\n` +
        `  Fingerprint: ${fingerprint}\n` +
        `  Env:         ${deployEnv}\n`
      );
    }

    return NextResponse.json({ ok: true, canonical: isCanonical });
  } catch (err) {
    // Never crash the app due to beacon failure
    return NextResponse.json({ ok: true });
  }
}

// GET: Returns clone registry for the admin dashboard
export async function GET(req: NextRequest) {
  // Only the canonical origin can read the registry
  const adminKey = req.nextUrl.searchParams.get('key');
  const validKey = process.env.HL_ADMIN_KEY || 'humanity2026';
  
  if (adminKey !== validKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const beacons = await prisma.$queryRaw<any[]>`
      SELECT * FROM "CloneBeacon" 
      ORDER BY "seenAt" DESC 
      LIMIT 500
    `.catch(() => []);

    const clones    = beacons.filter((b: any) => b.isClone);
    const canonical = beacons.filter((b: any) => !b.isClone);

    return NextResponse.json({
      summary: {
        total:        beacons.length,
        clones:       clones.length,
        canonical:    canonical.length,
        uniqueOrigins: [...new Set(beacons.map((b: any) => b.origin))],
      },
      clones,
      canonical,
    });
  } catch {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });
  }
}
