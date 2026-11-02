import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ALLOWED_SETTING_KEYS = new Set([
  'notification_sound','haptics_intensity','typing_indicators','read_receipts',
  'auto_download_photos','auto_download_videos','saveToPhotos','chat_background',
  'text_size','bubble_style','biometric_lock','passcode_enabled','auto_lock_timer',
  'zkObfuscation','requireSignature','ghost_auto_reply','webrtc_ip_masking',
  'mev_protection','custom_rpc_url','auto_delete_timer','link_previews',
  'media_quality','contact_sync','display_name','avatar_url','status_message',
  'language','theme','font_size','send_on_enter','spell_check',
  'notification_preview','notification_badge','notification_vibrate',
]);

const MAX_SETTINGS_SIZE = 50 * 1024; // 50KB

async function resolveCaller(req: NextRequest) {
  // [SECURITY FIX] Never trust client headers like x-verified-session-address directly.
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userSettings = await (prisma as any).userSettings.findUnique({
      where: { walletAddress: caller }
    });

    return NextResponse.json({ settings: userSettings?.settings || {} });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rawText = await req.text();
    if (rawText.length > MAX_SETTINGS_SIZE) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { settings } = body;
    if (typeof settings !== 'object' || Array.isArray(settings) || settings === null) {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
    }

    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (ALLOWED_SETTING_KEYS.has(k)) {
        if (k === 'custom_rpc_url' && typeof v === 'string') {
          try {
            const u = new URL(v);
            if (u.protocol === 'https:' || u.protocol === 'http:') sanitized[k] = v.slice(0, 512);
          } catch {}
        } else if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') {
          sanitized[k] = v;
        }
      }
    }

    const updated = await (prisma as any).userSettings.upsert({
      where: { walletAddress: caller },
      update: { settings: sanitized, lastSyncedAt: new Date() },
      create: { walletAddress: caller, settings: sanitized, lastSyncedAt: new Date() }
    });

    return NextResponse.json({ settings: updated.settings });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
