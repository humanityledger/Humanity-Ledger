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
import { CALL_AUDIO, FALLBACK_ICE, callConstraints, callVideo, loadIceConfig, loadIceServers, peerServerOptions, preferRed, tuneOpusSdp, tuneSenders } from '@/lib/calls/media';
import { finishCallMetrics, markFirstAudio, markSetup, recentCallMetrics, sampleHeap, startCallMetrics } from '@/lib/calls/metrics';
import { RESUME_ATTEMPT_MS, RESUME_DEADLINE_MS, acceptResume, basePeerId, glareKeepsMine, isResumeMeta, resumeDelay, shouldDialResume } from '@/lib/calls/resume';

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
    expect(fmtp).toMatch(/maxaveragebitrate=32000/);
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

describe('call media: loss resilience and long sessions', () => {
  const RED_SDP = [
    'v=0',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111 63 0',
    'a=rtpmap:111 opus/48000/2',
    'a=rtpmap:63 red/48000/2',
    'a=fmtp:63 111/111',
    'm=video 9 UDP/TLS/RTP/SAVPF 96 63',
    'a=rtpmap:96 VP8/90000',
    '',
  ].join('\r\n');

  it('prefers RED (redundant audio) in audio sections only, by order alone', () => {
    const out = preferRed(RED_SDP);
    expect(out).toContain('m=audio 9 UDP/TLS/RTP/SAVPF 63 111 0');
    expect(out).toContain('m=video 9 UDP/TLS/RTP/SAVPF 96 63'); // a video payload 63 is not RED
    expect(out.split('\r\n').length).toBe(RED_SDP.split('\r\n').length);
    expect(preferRed(out)).toBe(out);
    const noRed = 'm=audio 9 RTP 111\r\na=rtpmap:111 opus/48000/2\r\n';
    expect(preferRed(noRed)).toBe(noRed);
    // tuneOpusSdp applies it too.
    expect(tuneOpusSdp(RED_SDP)).toContain('m=audio 9 UDP/TLS/RTP/SAVPF 63 111 0');
  });

  it('refreshes TURN credentials before they expire', async () => {
    const ok = (body: any) => (async () => ({ ok: true, json: async () => body })) as any;
    const c = await loadIceConfig(ok({ iceServers: [{ urls: 'turn:t.example:3478', username: 'u', credential: 'c' }], ttl: 6 * 3600 }));
    expect(c.own).toBe(true);
    expect(c.refreshInMs).toBe((6 * 3600 - 15 * 60) * 1000);
    const short = await loadIceConfig(ok({ iceServers: [{ urls: 'turn:t.example:3478' }], ttl: 60 }));
    expect(short.refreshInMs).toBe(5 * 60_000);
    const none = await loadIceConfig(ok({ iceServers: [] }));
    expect(none.own).toBe(false);
    expect(none.refreshInMs).toBe(10 * 60_000);
  });

  it('uses our own PeerServer only when one is configured, always over TLS', () => {
    expect(peerServerOptions({})).toEqual({});
    expect(peerServerOptions({ NEXT_PUBLIC_PEERJS_HOST: 'peer.ledgerchat.org' })).toEqual({ host: 'peer.ledgerchat.org', port: 443, path: '/', secure: true });
    expect(peerServerOptions({ NEXT_PUBLIC_PEERJS_HOST: 'evil.example/x?' })).toEqual({});
    expect(peerServerOptions({ NEXT_PUBLIC_PEERJS_HOST: 'p.example', NEXT_PUBLIC_PEERJS_PORT: '99999', NEXT_PUBLIC_PEERJS_KEY: 'k' })).toMatchObject({ port: 443, key: 'k' });
  });
});

describe('call resume: network changes and voice → video', () => {
  it('recognises resume connections and nothing else', () => {
    expect(isResumeMeta({ kind: 'resume', callType: 'audio', reason: 'network' })).toBe(true);
    expect(isResumeMeta({ kind: 'resume', callType: 'video', reason: 'upgrade' })).toBe(true);
    for (const m of [null, {}, { kind: 'screen' }, { kind: 'resume', callType: 'x', reason: 'network' }, { kind: 'resume', callType: 'audio' }]) {
      expect(isResumeMeta(m)).toBe(false);
    }
  });

  it('answers a resume only during a call, only from the same person', () => {
    const base = { callState: 'active', remoteId: 'abc123', hasLocalStream: true };
    expect(acceptResume({ ...base, fromId: 'abc123' })).toBe(true);
    expect(acceptResume({ ...base, fromId: 'abc123-r2' })).toBe(true); // re-registered, same account
    expect(acceptResume({ ...base, fromId: 'someone-else' })).toBe(false);
    expect(acceptResume({ ...base, fromId: 'abc1234' })).toBe(false);
    expect(acceptResume({ ...base, callState: 'ringing', fromId: 'abc123' })).toBe(false);
    expect(acceptResume({ ...base, remoteId: '', fromId: '' })).toBe(false);
    expect(acceptResume({ ...base, hasLocalStream: false, fromId: 'abc123' })).toBe(false);
    expect(basePeerId('x-r12')).toBe('x');
  });

  it('one side dials by rule; a tie is broken the same way on both sides', () => {
    expect(shouldDialResume({ isCaller: true, myId: 'a', myIdAtStart: 'a' })).toBe(true);
    expect(shouldDialResume({ isCaller: false, myId: 'b', myIdAtStart: 'b' })).toBe(false);
    expect(shouldDialResume({ isCaller: false, myId: 'b-r1', myIdAtStart: 'b' })).toBe(true);
    expect(glareKeepsMine('b', 'a')).toBe(true);
    expect(glareKeepsMine('a', 'b')).toBe(false);
    expect(glareKeepsMine('a', 'b') !== glareKeepsMine('b', 'a')).toBe(true);
  });

  it('retries quickly, never cuts an attempt in progress, and gives up in bounded time', () => {
    expect(resumeDelay(0)).toBe(0);
    expect(resumeDelay(1)).toBe(1_500);
    expect(resumeDelay(99)).toBe(5_000);
    expect(RESUME_ATTEMPT_MS).toBeGreaterThan(resumeDelay(1));
    expect(RESUME_DEADLINE_MS).toBeLessThanOrEqual(30_000);
  });

  const chat = read('components/terminal/LedgerChatV2.tsx');

  it('a dropped connection of a running call recovers instead of ending it', () => {
    expect(chat).toMatch(/if \(active === conn && callStateRef\.current === 'active'\) \{ beginReconnectRef\.current\(\); return; \}/);
    // Hanging up forgets the connection before closing it, so its close is not read as a loss.
    expect(chat).toMatch(/activeConnectionRef\.current = null;\s*callStateRef\.current = 'idle';\s*stopReconnectRef\.current\(\);/);
    // The deadline ends the call on both sides.
    expect(chat).toMatch(/toast\.error\('The call lost its connection\.'\);\s*executeSendRef\.current\?\.\('__CALL_HANGUP__'\)/);
  });

  it('the signalling socket dropping during a call never destroys the peer (it would end the call)', () => {
    expect(chat).toMatch(/peer\.on\('disconnected', \(\) => \{[\s\S]{0,700}if \(callStateRef\.current !== 'idle'\) \{[\s\S]{0,600}peer\.reconnect\(\)/);
    expect(chat).toMatch(/err\.type === 'socket-closed'\) \{[\s\S]{0,300}if \(callStateRef\.current !== 'idle'\) return;/);
  });

  it('a resume replaces the connection only once it carries the other person (make before break)', () => {
    expect(chat).toMatch(/if \(opts\.resume && activeConnectionRef\.current !== conn\) \{\s*adoptConnectionRef\.current\(conn\);/);
    expect(chat).toMatch(/if \(isResumeMeta\(connection\.metadata\)\) \{\s*if \(!acceptResume\(/);
    expect(chat).toMatch(/connection\.answer\(localStreamRef\.current!, CALL_SDP\);\s*wireCallRef\.current\(connection, \{ resume: true \}\);/);
  });

  it('turning the camera on in a voice call upgrades it in place, and is undone if the other app cannot', () => {
    expect(chat).toMatch(/if \(!localStream\.getVideoTracks\(\)\.length\) \{ void enableCameraRef\.current\(\); return; \}/);
    expect(chat).toMatch(/const conn = dialResumeRef\.current\('upgrade'\);/);
    expect(chat).toMatch(/if \(upgradeRef\.current === conn\) undoUpgradeRef\.current\(\);/);
  });

  it('TURN credentials are refreshed on the live peer; a first call opens the devices once', () => {
    expect(chat).toMatch(/\(peer as any\)\.options\.config = \{ \.\.\.\(peer as any\)\.options\.config, iceServers: next\.iceServers \}/);
    expect(chat).not.toMatch(/await navigator\.mediaDevices\.getUserMedia\(constraints\);/);
    expect(chat).not.toMatch(/await navigator\.mediaDevices\.getUserMedia\(\{ audio: true, video: true \}\);/);
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

describe('call visibility and measurements', () => {
  const chat = read('components/terminal/LedgerChatV2.tsx');

  it('cancelling an outgoing call stops the other phone ringing', () => {
    expect(chat).toMatch(/onCancel=\{\(\) => endCallRef\.current\(\)\}/);
    expect(chat).not.toMatch(/onCancel=\{\(\) => performEndCallRef\.current\?\.\(\)\}/);
  });

  it('shows the call screen while connecting, not the chat', () => {
    expect(chat).toMatch(/\(callState === 'active' \|\| callState === 'connecting'\) && isMounted && \(/);
  });

  it('a voice the browser refuses to play gets a button, not a silent call', () => {
    expect(chat).toMatch(/if \(err\?\.name === 'NotAllowedError'\) setAudioBlocked\(true\);/);
    expect(chat).toMatch(/\{audioBlocked && \(/);
  });

  it('a shared screen disappears when the sharer stops, without waiting for a timeout', () => {
    expect(chat).toMatch(/t\?\.addEventListener\('ended'/);
    expect(chat).toMatch(/t\?\.addEventListener\('mute'/);
  });

  it('own camera is mirrored while ringing too', () => {
    expect(read('components/chat/call/CallScreens.tsx')).toMatch(/preview\.getVideoTracks\(\)\.length > 0[\s\S]{0,400}transform: 'scaleX\(-1\)'/);
  });

  it('measures setup time, first audio, route and memory, on this device only', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    const m = startCallMetrics('caller', 'audio', 1_000);
    markSetup(m, 1_800);
    markSetup(m, 9_999); // first one counts
    markFirstAudio(m, 2_100);
    sampleHeap(m, { memory: { usedJSHeapSize: 150 * 1_048_576 } });
    sampleHeap(m, {}); // no performance.memory (Safari, Firefox): nothing recorded
    expect(m).toMatchObject({ setupMs: 800, firstAudioMs: 1_100, heapMb: [150], resumes: 0 });
    const list = finishCallMetrics(m, storage, 5_000);
    expect(list).toHaveLength(1);
    expect(finishCallMetrics(m, storage, 6_000)).toHaveLength(1); // not recorded twice
    for (let i = 0; i < 15; i++) finishCallMetrics(startCallMetrics('callee', 'video', i), storage, i + 1);
    expect(recentCallMetrics(storage)).toHaveLength(10);
    expect(chat).toMatch(/finishCallMetrics\(callMetricsRef\.current\);/);
    expect(read('lib/calls/metrics.ts')).not.toMatch(/fetch\(/);
  });
});
