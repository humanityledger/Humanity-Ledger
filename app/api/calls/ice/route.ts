import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/calls/ice — STUN/TURN servers for a call, with short-lived TURN credentials.
 * Signed-in sessions only (middleware). A relay is what makes a call connect when both people are
 * behind strict NATs or mobile carriers, and what "Hide my IP address in calls" relies on.
 *
 * Configure ONE of (server variables, never NEXT_PUBLIC):
 *   CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN   Cloudflare Realtime TURN
 *   TURN_URLS + TURN_SECRET                              coturn with static-auth-secret (REST credentials)
 *   TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL          fixed credentials
 * NEXT_PUBLIC_TURN_URLS / _USERNAME / _CREDENTIAL are still read, for existing setups.
 */
const TTL_SECONDS = 6 * 60 * 60;

function urlsFrom(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter((u) => /^(stun|stuns|turn|turns):/i.test(u));
}

export async function GET() {
  const headers = { 'cache-control': 'private, no-store' };

  const cfId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const cfToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (cfId && cfToken && /^[A-Za-z0-9_-]{8,128}$/.test(cfId)) {
    try {
      const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${cfId}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { authorization: `Bearer ${cfToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.iceServers) && data.iceServers.length) {
          return NextResponse.json({ iceServers: data.iceServers, ttl: TTL_SECONDS, source: 'cloudflare' }, { headers });
        }
      }
    } catch {
      /* fall through to the other options */
    }
  }

  const urls = urlsFrom(process.env.TURN_URLS || process.env.NEXT_PUBLIC_TURN_URLS);
  const secret = process.env.TURN_SECRET;
  if (urls.length && secret) {
    // coturn REST API: username = expiry:label, credential = base64(HMAC-SHA1(secret, username)).
    const username = `${Math.floor(Date.now() / 1000) + TTL_SECONDS}:ledger`;
    const credential = createHmac('sha1', secret).update(username).digest('base64');
    return NextResponse.json({ iceServers: [{ urls, username, credential }], ttl: TTL_SECONDS, source: 'coturn' }, { headers });
  }
  const username = process.env.TURN_USERNAME || process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL || process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (urls.length) {
    return NextResponse.json(
      { iceServers: [{ urls, ...(username ? { username } : {}), ...(credential ? { credential } : {}) }], source: 'static' },
      { headers },
    );
  }
  return NextResponse.json({ iceServers: [], source: 'none' }, { headers });
}
