/**
 * lib/calls/media.ts
 *
 * Media settings for 1:1 calls in Ledger Chat (PeerJS / WebRTC), in one place:
 *
 *   - capture: echo cancellation, noise suppression and gain control on the microphone; 720p30
 *     camera. All are `ideal` hints, so the single getUserMedia call (Android keeps the user
 *     gesture only for one) never fails on a device that cannot meet them.
 *   - Opus tuned for speech: in-band FEC (covers lost packets without retransmission delay), mono,
 *     32 kbps cap, 10 ms minimum packet time. Applied to the SDP of every offer and answer. RED
 *     (preferRed) is no longer forced first: reordering payloads by hand is the one SDP change
 *     here that touches what each browser sends, and Safari↔Chrome calls must work before
 *     anything else. The browsers still negotiate RED by themselves where both want it.
 *   - sending: voice has the highest priority on the link; video and screen get bitrate caps, and a
 *     shared screen keeps its resolution (text stays readable) while a camera keeps its frame rate.
 *   - ICE: few servers (each extra one slows candidate gathering), our TURN first when configured.
 */

export const CALL_AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: { ideal: 1 },
};

export function callVideo(facingMode: 'user' | 'environment' = 'user', saver = false): MediaTrackConstraints {
  return saver
    ? { facingMode, width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 15 } }
    : { facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
}

export function callConstraints(kind: 'audio' | 'video'): MediaStreamConstraints {
  return { audio: CALL_AUDIO, video: kind === 'video' ? callVideo('user') : false };
}

const OPUS_PARAMS: Record<string, string> = {
  useinbandfec: '1',
  stereo: '0',
  'sprop-stereo': '0',
  maxaveragebitrate: '32000',
  maxplaybackrate: '48000',
  minptime: '10',
};

/** Rewrites the Opus fmtp line(s) of an SDP for speech. Leaves everything else untouched. */
export function tuneOpusSdp(sdp: string): string {
  if (typeof sdp !== 'string' || !sdp) return sdp;
  const eol = sdp.includes('\r\n') ? '\r\n' : '\n';
  const lines = sdp.split(eol);
  const opus = new Set<string>();
  for (const l of lines) {
    const m = /^a=rtpmap:(\d+) opus\/48000/i.exec(l);
    if (m) opus.add(m[1]);
  }
  if (!opus.size) return sdp;
  const seen = new Set<string>();
  const out = lines.map((l) => {
    const m = /^a=fmtp:(\d+) (.*)$/.exec(l);
    if (!m || !opus.has(m[1])) return l;
    seen.add(m[1]);
    const params = new Map<string, string>();
    for (const kv of m[2].split(';')) {
      const [k, v] = kv.split('=').map((x) => x.trim());
      if (k) params.set(k, v ?? '');
    }
    for (const [k, v] of Object.entries(OPUS_PARAMS)) params.set(k, v);
    return `a=fmtp:${m[1]} ${[...params].map(([k, v]) => `${k}=${v}`).join(';')}`;
  });
  // An Opus payload without an fmtp line gets one, right after its rtpmap.
  const result: string[] = [];
  for (const l of out) {
    result.push(l);
    const m = /^a=rtpmap:(\d+) opus\/48000/i.exec(l);
    if (m && !seen.has(m[1])) {
      result.push(`a=fmtp:${m[1]} ${Object.entries(OPUS_PARAMS).map(([k, v]) => `${k}=${v}`).join(';')}`);
      seen.add(m[1]);
    }
  }
  return result.join(eol);
}

/**
 * Puts RED (RFC 2198 audio redundancy, Chrome and Edge) first in each audio m-line when the SDP
 * offers it. Only the order changes: a browser without RED answers plain Opus.
 */
export function preferRed(sdp: string): string {
  if (typeof sdp !== 'string' || !/a=rtpmap:\d+ red\/48000/i.test(sdp)) return sdp;
  const eol = sdp.includes('\r\n') ? '\r\n' : '\n';
  const lines = sdp.split(eol);
  // Section boundaries: each m= line starts one.
  const starts = lines.map((l, i) => (l.startsWith('m=') ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k < starts.length; k++) {
    const at = starts[k];
    if (!lines[at].startsWith('m=audio ')) continue;
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const red = new Set<string>();
    for (let i = at + 1; i < end; i++) {
      const m = /^a=rtpmap:(\d+) red\/48000/i.exec(lines[i]);
      if (m) red.add(m[1]);
    }
    if (!red.size) continue;
    const parts = lines[at].split(' ');
    const head = parts.slice(0, 3);
    const pts = parts.slice(3);
    lines[at] = [...head, ...pts.filter((p) => red.has(p)), ...pts.filter((p) => !red.has(p))].join(' ');
  }
  return lines.join(eol);
}

type SenderLike = {
  track: { kind: string; contentHint?: string } | null;
  getParameters: () => any;
  setParameters: (p: any) => Promise<void>;
};

/** Sending priorities and caps. Best effort: a browser that refuses a field keeps its default. */
export async function tuneSenders(pc: { getSenders: () => SenderLike[] } | null | undefined, opts: { screen?: boolean } = {}) {
  if (!pc?.getSenders) return;
  await Promise.all(
    pc.getSenders().map(async (sender) => {
      const kind = sender.track?.kind;
      if (!kind) return;
      try {
        const p = sender.getParameters() ?? {};
        if (!p.encodings || !p.encodings.length) p.encodings = [{}];
        for (const e of p.encodings) {
          if (kind === 'audio') {
            e.priority = 'high';
            e.networkPriority = 'high';
          } else if (opts.screen) {
            e.maxBitrate = 2_500_000;
            e.maxFramerate = 15;
            e.priority = 'medium';
          } else {
            e.maxBitrate = 1_500_000;
            e.priority = 'low';
          }
        }
        if (kind === 'video') p.degradationPreference = opts.screen ? 'maintain-resolution' : 'maintain-framerate';
        await sender.setParameters(p);
      } catch {
        /* not supported here: browser defaults */
      }
    }),
  );
}

/**
 * ICE servers when the server has no TURN service: STUN only. The public "openrelayproject" relay
 * used to be listed here; its shared credentials no longer allocate (checked from ledgerchat.org:
 * error 701 on every URL), so it only slowed candidate gathering. Without TURN, two people behind
 * strict NATs or mobile carriers cannot reach each other: /api/calls/ice says `source: 'none'` and
 * the call screen reports it instead of staying silent.
 */
export const FALLBACK_ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];

function cleanIce(list: unknown): RTCIceServer[] {
  if (!Array.isArray(list)) return [];
  const out: RTCIceServer[] = [];
  for (const s of list as any[]) {
    const urls = (Array.isArray(s?.urls) ? s.urls : [s?.urls]).filter((u: unknown) => typeof u === 'string' && /^(stun|stuns|turn|turns):/i.test(u as string));
    if (!urls.length) continue;
    out.push({ urls, ...(typeof s.username === 'string' ? { username: s.username } : {}), ...(typeof s.credential === 'string' ? { credential: s.credential } : {}) });
  }
  return out.slice(0, 6);
}

/**
 * ICE servers for this account: short-lived TURN credentials from /api/calls/ice when the server
 * has a TURN service, else STUN only. Our TURN goes first, STUN after it.
 * `refreshInMs`: when to fetch again, before the credentials expire (PeerJS reads its config for
 * every new connection, so a long session keeps working TURN).
 */
export async function loadIceConfig(fetchImpl: typeof fetch = fetch): Promise<{ iceServers: RTCIceServer[]; refreshInMs: number; own: boolean }> {
  try {
    const res = await fetchImpl('/api/calls/ice', { credentials: 'include', cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const own = cleanIce(data?.iceServers);
      if (own.length) {
        const ttl = Number(data?.ttl);
        const refreshInMs = Number.isFinite(ttl) && ttl > 0 ? Math.max(5 * 60_000, (ttl - 15 * 60) * 1000) : 60 * 60_000;
        return { iceServers: [...own, ...FALLBACK_ICE], refreshInMs, own: true };
      }
    }
  } catch {
    /* offline or signed out: fallback */
  }
  return { iceServers: FALLBACK_ICE, refreshInMs: 10 * 60_000, own: false };
}

export async function loadIceServers(fetchImpl: typeof fetch = fetch): Promise<RTCIceServer[]> {
  return (await loadIceConfig(fetchImpl)).iceServers;
}

/**
 * PeerJS signalling server. Unset: the public PeerJS cloud (free, best effort, shared). A
 * self-hosted PeerServer (the `peerjs/peerjs-server` image, one small Railway service) removes that
 * dependency: NEXT_PUBLIC_PEERJS_HOST (+ _PORT, _PATH, _KEY). All clients must use the same one.
 */
export function peerServerOptions(env: Record<string, string | undefined> = {
  NEXT_PUBLIC_PEERJS_HOST: process.env.NEXT_PUBLIC_PEERJS_HOST,
  NEXT_PUBLIC_PEERJS_PORT: process.env.NEXT_PUBLIC_PEERJS_PORT,
  NEXT_PUBLIC_PEERJS_PATH: process.env.NEXT_PUBLIC_PEERJS_PATH,
  NEXT_PUBLIC_PEERJS_KEY: process.env.NEXT_PUBLIC_PEERJS_KEY,
}): { host?: string; port?: number; path?: string; key?: string; secure?: boolean } {
  const host = (env.NEXT_PUBLIC_PEERJS_HOST || '').trim();
  if (!host || !/^[a-z0-9.-]+$/i.test(host)) return {};
  const port = Number(env.NEXT_PUBLIC_PEERJS_PORT || 443);
  const path = (env.NEXT_PUBLIC_PEERJS_PATH || '/').trim() || '/';
  const key = (env.NEXT_PUBLIC_PEERJS_KEY || '').trim();
  return { host, port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 443, path, ...(key ? { key } : {}), secure: true };
}
