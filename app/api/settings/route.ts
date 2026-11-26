import { NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { readSettings, writeSettings } from '@/lib/settings/store';

export const dynamic = 'force-dynamic';

const MAX_SETTINGS_SIZE = 50 * 1024; // 50KB

/**
 * Legacy app-wide settings writer (lib/store/useSettingsStore.ts). Same row and
 * same sanitizer as /api/chat/settings, but MERGED: it only updates the keys
 * it sends and can no longer erase the chat's settings.
 */
export async function POST(req: Request) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const raw = await req.text();
  if (raw.length > MAX_SETTINGS_SIZE) return NextResponse.json({ error: 'Settings payload too large' }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
  }
  try {
    return NextResponse.json({ success: true, settings: await writeSettings(auth.walletAddress, body, 'merge') });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  try {
    const settings = await readSettings(auth.walletAddress);
    return NextResponse.json({ settings: Object.keys(settings).length ? settings : null });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
