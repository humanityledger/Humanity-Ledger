/**
 * lib/calls/ice.ts
 *
 * Shapes the STUN/TURN list a call starts with. Every URL costs gathering time (each TURN URL is
 * its own allocation round trip), so a call gets few servers, in the order ICE should try them:
 *
 *   1. STUN: one URL. It gives the server-reflexive (srflx) candidate that a direct call uses.
 *   2. TURN over UDP, then TCP, then TLS on 443: one URL each, the relay of last resort.
 *
 * Host and srflx candidates already rank above relay ones in ICE itself (RFC 8445 type
 * preference), as long as the transport policy is 'all'; listing STUN first only makes them
 * arrive first. Cloudflare Realtime TURN is anycast, so turn.cloudflare.com already resolves to
 * the nearest location: the geo-relevant list is that one host, without far-away extras.
 * Port 53 duplicates are dropped (blocked or intercepted on many networks; TLS on 443 covers
 * strict firewalls).
 */

type Kind = 'stun' | 'turn-udp' | 'turn-tcp' | 'turns';

const SCHEME = /^(stun|stuns|turn|turns):/i;

/** Preferred ports per kind, best first. Any other port ranks after these; 53 is never kept. */
const PORTS: Record<Kind, number[]> = {
  stun: [3478, 19302],
  'turn-udp': [3478],
  'turn-tcp': [3478, 80],
  turns: [443, 5349],
};
const ORDER: Kind[] = ['stun', 'turn-udp', 'turn-tcp', 'turns'];

export function iceUrlKind(url: string): Kind | null {
  const u = url.trim().toLowerCase();
  if (!SCHEME.test(u)) return null;
  if (u.startsWith('stun')) return 'stun';
  if (u.startsWith('turns:')) return 'turns';
  return /[?&]transport=tcp\b/.test(u) ? 'turn-tcp' : 'turn-udp';
}

function iceUrlPort(url: string): number {
  // stun:host:port, turn:host:port?transport=x, turn:[v6]:port
  const m = url.replace(/\?.*$/, '').match(/:(\d+)$/);
  if (m) return Number(m[1]);
  return url.toLowerCase().startsWith('turns:') || url.toLowerCase().startsWith('stuns:') ? 5349 : 3478;
}

function portRank(kind: Kind, port: number): number {
  const i = PORTS[kind].indexOf(port);
  return i === -1 ? PORTS[kind].length : i;
}

/**
 * Cleans, orders and trims a list of ICE servers (from /api/calls/ice or Cloudflare):
 * only stun/stuns/turn/turns URLs, at most one URL per kind, STUN first, credentials kept on the
 * TURN entries only. Entries that mix STUN and TURN URLs are split.
 */
export function shapeIceServers(list: unknown): RTCIceServer[] {
  if (!Array.isArray(list)) return [];
  const best = new Map<Kind, { url: string; rank: number; username?: string; credential?: string }>();
  for (const s of list as any[]) {
    const urls = (Array.isArray(s?.urls) ? s.urls : [s?.urls]).filter((u: unknown): u is string => typeof u === 'string');
    for (const raw of urls) {
      const url = raw.trim();
      const kind = iceUrlKind(url);
      if (!kind) continue;
      const port = iceUrlPort(url);
      if (port === 53) continue;
      const rank = portRank(kind, port);
      const cur = best.get(kind);
      if (cur && cur.rank <= rank) continue;
      best.set(kind, {
        url,
        rank,
        ...(kind !== 'stun' && typeof s.username === 'string' ? { username: s.username } : {}),
        ...(kind !== 'stun' && typeof s.credential === 'string' ? { credential: s.credential } : {}),
      });
    }
  }
  const out: RTCIceServer[] = [];
  const stun = best.get('stun');
  if (stun) out.push({ urls: [stun.url] });
  // TURN URLs that share credentials go in one entry (one allocation set per server).
  for (const kind of ORDER.slice(1)) {
    const t = best.get(kind);
    if (!t) continue;
    const same = out.find((e) => !hasStun([e]) && e.username === t.username && e.credential === t.credential);
    if (same) (same.urls as string[]).push(t.url);
    else out.push({ urls: [t.url], ...(t.username !== undefined ? { username: t.username } : {}), ...(t.credential !== undefined ? { credential: t.credential } : {}) });
  }
  return out;
}

/** True if the list has a STUN URL of its own (then no public STUN needs adding). */
export function hasStun(list: RTCIceServer[]): boolean {
  return list.some((s) => [s.urls].flat().some((u) => iceUrlKind(String(u)) === 'stun'));
}
