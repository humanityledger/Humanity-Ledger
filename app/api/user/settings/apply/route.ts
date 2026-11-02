import { NextRequest, NextResponse } from 'next/server';
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

// Only settings other people's apps or the server act on are stored here.
// Anything else (display preferences, avatars, notes) stays on the device and
// in the encrypted settings sync, so this endpoint is not a free-form blob
// store anyone signed in can fill.
const AUDIENCE = ['everybody', 'contacts', 'nobody'] as const;
const EXTENDED_RULES: Record<string, (v: unknown) => boolean> = {
  privacy_last_seen:     v => (AUDIENCE as readonly unknown[]).includes(v),
  privacy_profile_photo: v => (AUDIENCE as readonly unknown[]).includes(v),
  privacy_bio:           v => (AUDIENCE as readonly unknown[]).includes(v),
  privacy_group_invites: v => (AUDIENCE as readonly unknown[]).includes(v),
  show_read_receipts:    v => typeof v === 'boolean',
};
const DIRECT_RULES: Record<string, (v: unknown) => boolean> = {
  language:        v => typeof v === 'string' && v.length <= 16,
  theme:           v => typeof v === 'string' && v.length <= 32,
  currency:        v => typeof v === 'string' && v.length <= 8,
  allow_analytics: v => typeof v === 'boolean',
  stealthy_mode:   v => typeof v === 'boolean',
};
// Keep in step with SERVER_SETTING_KEYS in lib/hooks/useSettingsEffect.ts.

export async function POST(req: NextRequest) {
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
    const rule = EXTENDED_RULES[key] ?? DIRECT_RULES[key];
    if (!rule) return NextResponse.json({ error: 'This setting is not stored on the server' }, { status: 400 });
    if (!rule(value)) return NextResponse.json({ error: 'Invalid value' }, { status: 400 });

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

    await (prisma as any).user.upsert({
      where: { walletAddress: address },
      update: updateData,
      create: {
        walletAddress: address,
        ...updateData,
      },
    });

    return NextResponse.json({ success: true, applied: { key, value } });
  } catch (e: any) {
    console.error('[settings/apply] Error:', e.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
