// "Last seen" privacy, applied on the server.
//
// Each heartbeat stores `<timestamp>|<audience>` under presence:<address>.
// A peer's online status and last-seen time are only returned when
//  - the two wallets are mutual contacts (checked by the route), and
//  - the peer has not chosen "Nobody", and
//  - the person asking has not chosen "Nobody" either. As in other
//    messengers, hiding your own last seen hides everyone else's from you.

export type PresenceAudience = 'everybody' | 'contacts' | 'nobody';
export const DEFAULT_PRESENCE_AUDIENCE: PresenceAudience = 'contacts';

export function normalizeAudience(value: unknown): PresenceAudience {
  if (typeof value !== 'string') return DEFAULT_PRESENCE_AUDIENCE;
  const v = value.trim().toLowerCase();
  if (v === 'everybody' || v === 'all') return 'everybody';
  if (v === 'nobody') return 'nobody';
  if (v === 'contacts') return 'contacts';
  return DEFAULT_PRESENCE_AUDIENCE;
}

/**
 * "Online" means: a Ledger Chat window of that person is open and in the foreground, and it said so
 * within this window. Foreground clients heartbeat every 10 s; a window that goes to the background
 * or closes says "off" at once, so "Online" disappears within seconds, as in WhatsApp.
 */
export const ONLINE_WINDOW_MS = 30_000;
/** "Last seen" is kept for 30 days (the key's TTL), not the 2 minutes it used to live. */
export const PRESENCE_TTL_S = 30 * 24 * 3600;

export type PresenceState = 'on' | 'off';

export function encodePresence(timestampMs: number, audience: PresenceAudience, state: PresenceState = 'on'): string {
  const base = `${Math.floor(timestampMs)}|${audience}`;
  return state === 'off' ? `${base}|off` : base;
}

export function decodePresence(raw: string | null | undefined): { at: number; audience: PresenceAudience; offline?: true } | null {
  if (!raw || raw === 'TIMEOUT') return null;
  const [ts, aud, state] = raw.split('|');
  const at = Number(ts);
  if (!Number.isFinite(at) || at <= 0) return null;
  // Values written before this format carry no audience; treat as the default.
  const out: { at: number; audience: PresenceAudience; offline?: true } = { at, audience: aud ? normalizeAudience(aud) : DEFAULT_PRESENCE_AUDIENCE };
  if (state === 'off') out.offline = true;
  return out;
}

export function visibleLastActive(peerRaw: string | null | undefined, callerAudience: PresenceAudience): number | null {
  if (callerAudience === 'nobody') return null;
  const peer = decodePresence(peerRaw);
  if (!peer || peer.audience === 'nobody') return null;
  return peer.at;
}

/**
 * What the caller may see of a peer: their last-seen time (or null when either side hides it) and
 * whether they are online right now. Online is never shown when last seen is hidden.
 */
export function visiblePresence(
  peerRaw: string | null | undefined,
  callerAudience: PresenceAudience,
  now: number = Date.now(),
): { lastActiveAt: number | null; online: boolean } {
  const lastActiveAt = visibleLastActive(peerRaw, callerAudience);
  if (lastActiveAt == null) return { lastActiveAt: null, online: false };
  const peer = decodePresence(peerRaw)!;
  return { lastActiveAt, online: !peer.offline && now - peer.at < ONLINE_WINDOW_MS };
}
