/**
 * 1:1 calls: clear voice with low delay, screen sharing in voice and video calls, a relay that
 * connects every call, and a chat that does not re-render on every frame during a call.
 * lib/calls/media.ts, app/api/calls/ice/route.ts, components/chat/call/CallScreens.tsx,
 * components/terminal/LedgerChatV2.tsx.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { CALL_AUDIO, FALLBACK_ICE, callConstraints, callVideo, loadIceServers, tuneOpusSdp, tuneSenders } from '@/lib/calls/media';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const SDP = [
  'v=0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111 0',
  'a=rtpmap:111 opus/48000/2',
  'a=fmtp:111 minptime=10;useinbandfec=0',
  'a=rtpmap:0 PCMU/8000',
  'm=video 9 UDP/TLS/RTP/SAVPF 96',
  'a=rtpmap:96 VP8/90000',
  '',
].join('\r\n');

describe('call media', () => {
  it('asks for echo cancellation, noise suppression and gain control, as hints that never fail', () => {
    expect(CALL_AUDIO).toMatchObject({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
    const c = callConstraints('video');
    expect(c.audio).toBe(CALL_AUDIO);
    expect((c.video as any).width).toEqual({ ideal: 1280 });
    expect(callConstraints('audio').video).toBe(false);
    expect((callVideo('environment', true) as any).frameRate).toEqual({ ideal: 15, max: 15 });
    // No `exact` anywhere: one getUserMedia call must not fail on a device that cannot meet it.
    expect(JSON.stringify([CALL_AUDIO, callVideo(), callVideo('user', true)])).not.toMatch(/exact|min"/);
  });

  it('tunes Opus for speech: FEC on, mono, capped bitrate; other lines untouched', () => {
    const out = tuneOpusSdp(SDP);
    const fmtp = out.split('\r\n').find((l) => l.startsWith('a=fmtp:111'))!;
    expect(fmtp).toMatch(/useinbandfec=1/);
    expect(fmtp).not.toMatch(/useinbandfec=0/);
    expect(fmtp).toMatch(/stereo=0/);
    expect(fmtp).toMatch(/maxaveragebitrate=40000/);
    expect(out).toContain('a=rtpmap:0 PCMU/8000');
    expect(out).toContain('a=rtpmap:96 VP8/90000');
    expect(out.split('\r\n').length).toBe(SDP.split('\r\n').length);
    expect(tuneOpusSdp(out)).toBe(out); // idempotent
  });

  it('adds an fmtp line for Opus when the offer has none, and leaves SDP without Opus alone', () => {
    const bare = 'm=audio 9 RTP 111\na=rtpmap:111 opus/48000/2\n';
    expect(tuneOpusSdp(bare)).toMatch(/a=rtpmap:111 opus\/48000\/2\na=fmtp:111 useinbandfec=1/);
    const video = 'm=video 9 RTP 96\na=rtpmap:96 VP8/90000\n';
    expect(tuneOpusSdp(video)).toBe(video);
  });

  it('gives the voice the highest priority and caps video; a shared screen keeps its resolution', async () => {
    const sent: any[] = [];
    const sender = (kind: string) => ({
      track: { kind },
      getParameters: () => ({ encodings: [{}] }),
      setParameters: async (p: any) => { sent.push({ kind, p }); },
    });
    await tuneSenders({ getSenders: () => [sender('audio'), sender('video')] });
    expect(sent.find((x) => x.kind === 'audio').p.encodings[0]).toMatchObject({ priority: 'high', networkPriority: 'high' });
    expect(sent.find((x) => x.kind === 'video').p).toMatchObject({ degradationPreference: 'maintain-framerate' });
    sent.length = 0;
    await tuneSenders({ getSenders: () => [sender('video')] }, { screen: true });
    expect(sent[0].p).toMatchObject({ degradationPreference: 'maintain-resolution' });
    // A browser that refuses is left on its defaults, without throwing.
    await expect(tuneSenders({ getSenders: () => [{ track: { kind: 'audio' }, getParameters: () => { throw new Error('no'); }, setParameters: async () => {} }] })).resolves.toBeUndefined();
    await expect(tuneSenders(null)).resolves.toBeUndefined();
  });

  it('uses the server\'s TURN first, keeps a public relay as backup, and falls back when offline', async () => {
    const ok = (body: any) => (async () => ({ ok: true, json: async () => body })) as any;
    const own = await loadIceServers(ok({ iceServers: [{ urls: ['turn:turn.example:3478'], username: 'u', credential: 'c' }, { urls: 'javascript:alert(1)' }] }));
    expect(own[0]).toEqual({ urls: ['turn:turn.example:3478'], username: 'u', credential: 'c' });
    expect(own).toHaveLength(2);
    expect(await loadIceServers(ok({ iceServers: [] }))).toBe(FALLBACK_ICE);
    expect(await loadIceServers((async () => { throw new TypeError('Load failed'); }) as any)).toBe(FALLBACK_ICE);
    // Few servers: each extra one slows candidate gathering.
    expect(FALLBACK_ICE.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls])).length).toBeLessThanOrEqual(4);
  });
});

describe('/api/calls/ice', () => {
  const route = read('app/api/calls/ice/route.ts');

  it('keeps TURN secrets on the server and issues short-lived credentials', () => {
    expect(route).toMatch(/CLOUDFLARE_TURN_API_TOKEN/);
    expect(route).toMatch(/credentials\/generate-ice-servers/);
    expect(route).toMatch(/TURN_SECRET/);
    expect(route).toMatch(/'cache-control': 'private, no-store'/);
  });

  it('coturn REST credentials are the standard HMAC of expiry:label', () => {
    // Same formula as the route: what coturn's static-auth-secret checks.
    const username = '1900000000:ledger';
    const credential = createHmac('sha1', 'secret').update(username).digest('base64');
    expect(route).toMatch(/createHmac\('sha1', secret\)\.update\(username\)\.digest\('base64'\)/);
    expect(credential).toHaveLength(28);
  });

  it('needs a signed-in session', async () => {
    const { isPublicPath } = await import('@/middleware');
    expect(isPublicPath('/api/calls/ice')).toBe(false);
  });
});

describe('call screen and chat', () => {
  const chat = read('components/terminal/LedgerChatV2.tsx');
  const screens = read('components/chat/call/CallScreens.tsx');

  it('plays the other person through ONE always-mounted audio element; every video is muted', () => {
    expect(chat.match(/ref=\{remoteAudioRef\}/g)).toHaveLength(1);
    expect(chat).not.toMatch(/muted=\{false\}/);
    const remoteVideos = chat.match(/<video\s+ref=\{el => \{ if \(el && el\.srcObject !== (remoteStream|remoteScreen)\)[^>]*>/g) ?? [];
    expect(remoteVideos.length).toBeGreaterThanOrEqual(3);
    for (const v of remoteVideos) expect(v).toMatch(/\bmuted\b/);
  });

  it('tunes every offer and answer, and wires every call connection the same way', () => {
    expect(chat).toMatch(/const CALL_SDP = \{ sdpTransform: \(sdp: string\) => tuneOpusSdp\(sdp\) \};/);
    expect(chat.match(/\.answer\([^)]*CALL_SDP\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(chat.match(/\.\.\.CALL_SDP/g)?.length).toBeGreaterThanOrEqual(3);
    expect(chat.match(/wireCallRef\.current\((outConn|pendingConn|conn|connection)\)/g)?.length).toBe(4);
    expect(chat).toMatch(/getUserMedia\(callConstraints\(type\)\)/);
  });

  it('accepts a shared screen only from the person in the call, and stops it with the call', () => {
    expect(chat).toMatch(/connection\.metadata\?\.kind === 'screen'[\s\S]{0,200}callStateRef\.current === 'active' && current && connection\.peer === current\.peer/);
    expect(chat).toMatch(/livePeer\.call\(main\.peer, stream, \{ metadata: \{ kind: 'screen' \}/);
    expect(chat).toMatch(/const performEndCall = useCallback\(\(\) => \{\s*stopRingtone\(\);\s*stopScreenShareRef\.current\(\);/);
    expect(screens).toMatch(/\{onScreenShare && \(/); // voice calls too
  });

  it('does not re-render the chat every frame or every second during a call', () => {
    expect(chat).not.toMatch(/setAudioLevel|setCallDurationSeconds/);
    expect(chat).not.toMatch(/requestAnimationFrame\(checkQuality\)/);
    expect(screens).toMatch(/export function CallClock/);
    expect(screens).toMatch(/el\.style\.transform = `scale/); // the voice pulse writes the style, no state
  });

  it('loads on-demand panels lazily, and never the emoji picker with the chat', () => {
    for (const name of ['QrScanner', 'LedgerSettingsFull', 'CommunityView', 'ExpressionPicker', 'LedgerCallsTab']) {
      expect(chat).toMatch(new RegExp(`const ${name} = dynamic\\(`));
      expect(chat).not.toMatch(new RegExp(`import \\{ ${name}\\b`));
    }
    expect(read('components/chat/ExpressionPicker.tsx')).toMatch(/import type \{ EmojiClickData, EmojiStyle, Theme \} from 'emoji-picker-react';/);
  });

  it('formats the call time like a phone', async () => {
    const { formatCallDuration } = await import('@/lib/calls/format');
    expect(formatCallDuration(0)).toBe('0:00');
    expect(formatCallDuration(65)).toBe('1:05');
    expect(formatCallDuration(3725)).toBe('1:02:05');
  });
});

describe('private wallet memory', () => {
  it('a wallet idle in a background tab closes after a while, never during a payment', () => {
    const src = read('lib/aztec/wallet/client.ts');
    expect(src).toMatch(/document\.visibilityState === 'hidden' && this\.stores && !this\.transacting && this\.snapshot\.phase === 'ready'/);
    expect(src).toMatch(/void this\.release\(IDLE_CLOSED_MESSAGE\)/);
  });
});
