import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { shapeIceServers } from '@/lib/calls/ice';

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

/**
 * Cloudflare credentials are bearer credentials for the TURN service, not tied to a person: one set
 * serves every signed-in caller of this instance until half its lifetime has passed. Without this,
 * every call (and every refresh) made one request to Cloudflare's API, so a rush of new users meant
 * thousands of upstream requests a minute and, past its limits, calls without a relay. Concurrent
 * misses share one request; a failed refresh keeps serving the last good set while it is valid.
 */
type IceServers = ReturnType<typeof shapeIceServers>;
let cfCache: { iceServers: IceServers; expiresAt: number; validUntil: number } | null = null;
let cfInFlight: Promise<IceServers | null> | null = null;

async function cloudflareIce(cfId: string, cfToken: string): Promise<IceServers | null> {
  const now = Date.now();
  if (cfCache && now < cfCache.expiresAt) return cfCache.iceServers;
  if (cfInFlight) return cfInFlight;
  const stale = cfCache && now < cfCache.validUntil - 30 * 60_000 ? cfCache.iceServers : null;
  cfInFlight = (async () => {
    try {
      const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${cfId}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { authorization: `Bearer ${cfToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return stale;
      const data = await res.json();
      // Cloudflare lists ~8 URLs (anycast, so already the nearest location). Trimmed to STUN plus
      // one TURN URL per transport: each extra URL is one more allocation before the call connects.
      const iceServers = shapeIceServers(data?.iceServers);
      if (!iceServers.length) return stale;
      const at = Date.now();
      cfCache = { iceServers, expiresAt: at + (TTL_SECONDS * 1000) / 2, validUntil: at + TTL_SECONDS * 1000 };
      return iceServers;
    } catch {
      return stale;
    } finally {
      cfInFlight = null;
    }
  })();
  return cfInFlight;
}

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
    const iceServers = await cloudflareIce(cfId, cfToken);
    if (iceServers?.length) {
      // Valid at least half the TTL from now; the client refreshes before that (lib/calls/media.ts).
      return NextResponse.json({ iceServers, ttl: TTL_SECONDS / 2, source: 'cloudflare' }, { headers });
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
