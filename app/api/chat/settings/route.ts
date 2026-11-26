import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { readSettings, writeSettings } from '@/lib/settings/store';

export const dynamic = 'force-dynamic';

const MAX_SETTINGS_SIZE = 50 * 1024; // 50KB

export async function GET(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  try {
    return NextResponse.json({ settings: await readSettings(auth.walletAddress) });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const rawText = await req.text();
  if (rawText.length > MAX_SETTINGS_SIZE) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  let body: { settings?: unknown };
  try { body = JSON.parse(rawText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { settings } = body ?? {};
  if (typeof settings !== 'object' || Array.isArray(settings) || settings === null) {
    return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
  }
  try {
    // The settings engine sends the full object: replace (lib/settings/store.ts).
    return NextResponse.json({ settings: await writeSettings(auth.walletAddress, settings, 'replace') });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
