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

export function encodePresence(timestampMs: number, audience: PresenceAudience): string {
  return `${Math.floor(timestampMs)}|${audience}`;
}

export function decodePresence(raw: string | null | undefined): { at: number; audience: PresenceAudience } | null {
  if (!raw || raw === 'TIMEOUT') return null;
  const [ts, aud] = raw.split('|');
  const at = Number(ts);
  if (!Number.isFinite(at) || at <= 0) return null;
  // Values written before this format carry no audience; treat as the default.
  return { at, audience: aud ? normalizeAudience(aud) : DEFAULT_PRESENCE_AUDIENCE };
}

export function visibleLastActive(peerRaw: string | null | undefined, callerAudience: PresenceAudience): number | null {
  if (callerAudience === 'nobody') return null;
  const peer = decodePresence(peerRaw);
  if (!peer || peer.audience === 'nobody') return null;
  return peer.at;
}
