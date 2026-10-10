import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

// Whitelist of allowed setting keys — prevents prototype pollution and garbage injection
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

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawText = await req.text();
    if (rawText.length > MAX_SETTINGS_SIZE) {
      return NextResponse.json({ error: 'Settings payload too large' }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (typeof body !== 'object' || Array.isArray(body) || body === null) {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
    }

    // Strip keys not in the whitelist to prevent pollution
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_SETTING_KEYS.has(k)) {
        if (k === 'custom_rpc_url' && typeof v === 'string') {
          try {
            const u = new URL(v);
            if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
            sanitized[k] = v.slice(0, 512);
          } catch { /* invalid URL — skip */ }
        } else if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') {
          sanitized[k] = v;
        }
      }
    }

    const settings = await prisma.userSettings.upsert({
      where: { walletAddress: userId.toLowerCase() },
      update: { settings: sanitized, lastSyncedAt: new Date() },
      create: {
        walletAddress: userId.toLowerCase(),
        settings: sanitized,
        lastSyncedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, settings: settings.settings });
  } catch (error: any) {
    console.error('[Settings API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settingsRow = await prisma.userSettings.findUnique({
      where: { walletAddress: userId.toLowerCase() }
    });

    if (!settingsRow || !settingsRow.settings) {
      return NextResponse.json({ settings: null });
    }

    return NextResponse.json({ settings: settingsRow.settings });
  } catch (error: any) {
    console.error('[Settings API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
