import { NextResponse } from 'next/server';
import { validateSecureRequest } from '@/lib/security/premium-security';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/user/settings/apply
 * 
 * Called whenever a single setting changes and needs server-side enforcement.
 * Handles both direct DB columns and the extendedSettings JSON blob.
 * 
 * Body: { key: string, value: any }
 */

// Keys that map directly to typed columns on the User model
const DIRECT_COLUMNS: Record<string, string> = {
  language:              'language',
  theme:                 'theme',
  currency:              'currency',
  allow_analytics:       'allowAnalytics',
  stealthy_mode:         'stealthMode',
};

export async function POST(req: Request) {
  try {
    const validation = await validateSecureRequest(req);
    if (!validation.valid || !validation.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const address = validation.userId;

    let body: { key: string; value: any };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { key, value } = body;
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });

    let updateData: Record<string, any> = {};

    if (DIRECT_COLUMNS[key]) {
      // Map to a direct schema column
      updateData[DIRECT_COLUMNS[key]] = value;
    } else {
      // Merge into extendedSettings JSON
      const current = await (prisma as any).user.findUnique({
        where: { walletAddress: address },
        select: { extendedSettings: true },
      });

      const currentExt: Record<string, any> =
        typeof current?.extendedSettings === 'string'
          ? JSON.parse(current.extendedSettings)
          : (current?.extendedSettings ?? {});

      updateData.extendedSettings = { ...currentExt, [key]: value };
    }

    await (prisma as any).user.update({
      where: { walletAddress: address },
      data: updateData,
    });

    return NextResponse.json({ success: true, applied: { key, value } });
  } catch (e: any) {
    console.error('[settings/apply] Error:', e.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
