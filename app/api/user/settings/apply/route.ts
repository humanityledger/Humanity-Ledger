import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { Prisma } from '@prisma/client';
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
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

    let body: { key?: unknown; value?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { key, value } = body;
    if (typeof key !== 'string' || !key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    const rule = EXTENDED_RULES[key] ?? DIRECT_RULES[key];
    if (!rule) return NextResponse.json({ error: 'This setting is not stored on the server' }, { status: 400 });
    if (!rule(value)) return NextResponse.json({ error: 'Invalid value' }, { status: 400 });

    const updateData: Prisma.UserUpdateInput = {};

    if (DIRECT_COLUMNS[key]) {
      // Map to a direct schema column
      (updateData as Record<string, unknown>)[DIRECT_COLUMNS[key]] = value;
    } else {
      // Merge into extendedSettings JSON
      const current = await prisma.user.findUnique({
        where: { walletAddress: address },
        select: { extendedSettings: true },
      });

      const ext = current?.extendedSettings;
      const currentExt: Record<string, Prisma.JsonValue> =
        typeof ext === 'string' ? (() => { try { return JSON.parse(ext); } catch { return {}; } })()
          : (ext && typeof ext === 'object' && !Array.isArray(ext) ? ext as Record<string, Prisma.JsonValue> : {});

      updateData.extendedSettings = { ...currentExt, [key]: value as Prisma.JsonValue };
    }

    await prisma.user.upsert({
      where: { walletAddress: address },
      update: updateData,
      create: { ...(updateData as Prisma.UserCreateInput), walletAddress: address },
    });

    return NextResponse.json({ success: true, applied: { key, value } });
  } catch (e) {
    console.error('[settings/apply] Error:', (e as Error).message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
