/**
 * lib/calls/media.ts
 *
 * Media settings for 1:1 calls in Ledger Chat (PeerJS / WebRTC), in one place:
 *
 *   - capture: echo cancellation, noise suppression and gain control on the microphone; 720p30
 *     camera. All are `ideal` hints, so the single getUserMedia call (Android keeps the user
 *     gesture only for one) never fails on a device that cannot meet them.
 *   - Opus tuned for speech: in-band FEC (covers lost packets without retransmission delay), mono,
 *     40 kbps cap, 10 ms minimum packet time. Applied to the SDP of every offer and answer.
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
  maxaveragebitrate: '40000',
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

/** Default ICE servers when the server gives none: two STUN, then the public relay as last resort. */
export const FALLBACK_ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  {
    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443?transport=tcp'],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
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
 * has a TURN service, else the fallback. Our TURN goes first; the public relay stays as backup.
 */
export async function loadIceServers(fetchImpl: typeof fetch = fetch): Promise<RTCIceServer[]> {
  try {
    const res = await fetchImpl('/api/calls/ice', { credentials: 'include', cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const own = cleanIce(data?.iceServers);
      if (own.length) return [...own, FALLBACK_ICE[1]];
    }
  } catch {
    /* offline or signed out: fallback */
  }
  return FALLBACK_ICE;
}
