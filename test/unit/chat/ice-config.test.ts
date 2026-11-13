import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasStun, iceUrlKind, shapeIceServers } from '@/lib/calls/ice';
import { FALLBACK_ICE, loadIceConfig } from '@/lib/calls/media';
import { callMetricsDetail, callMetricsLabel, routeFromStats } from '@/lib/calls/metrics';

// What Cloudflare Realtime TURN returns from generate-ice-servers (shape of the documented answer).
const CLOUDFLARE = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    {
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:53?transport=udp',
        'turn:turn.cloudflare.com:3478?transport=tcp',
        'turn:turn.cloudflare.com:80?transport=tcp',
        'turns:turn.cloudflare.com:5349?transport=tcp',
        'turns:turn.cloudflare.com:443?transport=tcp',
      ],
      username: 'u1',
      credential: 'c1',
    },
  ],
};

const ok = (body: unknown) => (async () => ({ ok: true, json: async () => body })) as any;

describe('ICE servers: few, ordered, nearest', () => {
  it('trims Cloudflare to STUN + one TURN URL per transport, STUN first, no port 53', () => {
    const out = shapeIceServers(CLOUDFLARE.iceServers);
    expect(out).toEqual([
      { urls: ['stun:stun.cloudflare.com:3478'] },
      {
        urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:3478?transport=tcp', 'turns:turn.cloudflare.com:443?transport=tcp'],
        username: 'u1',
        credential: 'c1',
      },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/:53\b/);
    expect(out.flatMap((s) => [s.urls].flat()).length).toBeLessThanOrEqual(4);
  });

  it('splits mixed entries, keeps credentials off STUN and drops other schemes', () => {
    const out = shapeIceServers([
      { urls: ['turns:t.example:5349', 'stun:t.example:3478', 'javascript:alert(1)', 'https://x'], username: 'u', credential: 'c' },
      { urls: 'turn:t.example:3478' , username: 'u', credential: 'c' },
    ]);
    expect(out[0]).toEqual({ urls: ['stun:t.example:3478'] });
    expect(out[1]).toEqual({ urls: ['turn:t.example:3478', 'turns:t.example:5349'], username: 'u', credential: 'c' });
    expect(shapeIceServers('nope')).toEqual([]);
    expect(shapeIceServers([{ urls: 'data:x' }])).toEqual([]);
  });

  it('orders UDP before TCP before TLS (the relay is the last resort)', () => {
    expect(iceUrlKind('turns:a:443?transport=tcp')).toBe('turns');
    expect(iceUrlKind('turn:a:3478?transport=tcp')).toBe('turn-tcp');
    expect(iceUrlKind('turn:a:3478')).toBe('turn-udp');
    expect(iceUrlKind('stun:a')).toBe('stun');
    expect(iceUrlKind('http://a')).toBeNull();
    const urls = shapeIceServers([{ urls: ['turns:a:443', 'turn:a:3478?transport=tcp', 'turn:a:3478?transport=udp', 'stun:a:3478'] }]).flatMap((s) => [s.urls].flat());
    expect(urls).toEqual(['stun:a:3478', 'turn:a:3478?transport=udp', 'turn:a:3478?transport=tcp', 'turns:a:443']);
  });

  it('adds the public STUN only when our list has none', async () => {
    const withStun = await loadIceConfig(ok({ ...CLOUDFLARE, ttl: 6 * 3600 }));
    expect(withStun.own).toBe(true);
    expect(withStun.iceServers.some((s) => s === FALLBACK_ICE[0])).toBe(false);
    expect(hasStun(withStun.iceServers)).toBe(true);
    const turnOnly = await loadIceConfig(ok({ iceServers: [{ urls: 'turn:t:3478', username: 'u', credential: 'c' }] }));
    expect(turnOnly.iceServers.at(-1)).toBe(FALLBACK_ICE[0]);
  });

  it('the server route trims Cloudflare and keeps the IP-hiding policy on the client', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/calls/ice/route.ts'), 'utf8');
    expect(route).toMatch(/shapeIceServers\(data\?\.iceServers\)/);
    expect(route).toMatch(/'cache-control': 'private, no-store'/);
    const chat = readFileSync(join(process.cwd(), 'components/terminal/LedgerChatV2.tsx'), 'utf8');
    // 'all' lets ICE prefer host/srflx over relay; 'relay' only when the user hides their IP.
    expect(chat).toMatch(/iceTransportPolicy: \(\(ledgerSettings as any\)\?\.webrtc_ip_masking \? 'relay' : 'all'\)/);
  });
});

function stats(reports: any[]) {
  return { forEach: (cb: (r: any) => void) => reports.forEach(cb) };
}

describe('call route and local metrics', () => {
  it('reads the selected pair (Chrome/Safari transport report)', () => {
    const r = routeFromStats(stats([
      { type: 'transport', selectedCandidatePairId: 'p2' },
      { type: 'candidate-pair', id: 'p1', state: 'succeeded', nominated: true, localCandidateId: 'l1', remoteCandidateId: 'r1', currentRoundTripTime: 0.2 },
      { type: 'candidate-pair', id: 'p2', state: 'succeeded', nominated: true, localCandidateId: 'l2', remoteCandidateId: 'r2', currentRoundTripTime: 0.043 },
      { type: 'local-candidate', id: 'l1', candidateType: 'relay' },
      { type: 'remote-candidate', id: 'r1', candidateType: 'relay' },
      { type: 'local-candidate', id: 'l2', candidateType: 'srflx' },
      { type: 'remote-candidate', id: 'r2', candidateType: 'host' },
    ]));
    expect(r).toEqual({ kind: 'direct', path: 'srflx', rttMs: 40 });
  });

  it('relay on either side is a relayed call (Firefox selected flag)', () => {
    const r = routeFromStats(stats([
      { type: 'candidate-pair', id: 'p', state: 'succeeded', selected: true, localCandidateId: 'l', remoteCandidateId: 'r' },
      { type: 'local-candidate', id: 'l', candidateType: 'host' },
      { type: 'remote-candidate', id: 'r', candidateType: 'relay' },
    ]));
    expect(r).toEqual({ kind: 'relay', path: 'relay', rttMs: null });
    expect(routeFromStats(stats([{ type: 'candidate-pair', state: 'in-progress' }]))).toBeNull();
  });

  it('labels the minimized call with route and setup time', () => {
    expect(callMetricsLabel({ path: 'srflx' }, { setupMs: 1234 })).toBe('Direct · 1.2 s');
    expect(callMetricsLabel({ path: 'relay' }, {})).toBe('Relay');
    expect(callMetricsLabel({ path: 'host' }, { setupMs: 800 })).toBe('Local · 0.8 s');
    expect(callMetricsLabel(null, null)).toBe('');
    expect(callMetricsDetail({ path: 'relay', rttMs: 60 }, { setupMs: 1500, firstAudioMs: 1700 }))
      .toBe('Connected in 1.5 s, first audio at 1.7 s, route relay (TURN), 60 ms round trip');
  });

  it('the call turns active only once ICE connects, and records the timing', () => {
    const chat = readFileSync(join(process.cwd(), 'components/terminal/LedgerChatV2.tsx'), 'utf8');
    expect(chat).toMatch(/pc\.iceConnectionState === 'connected' \|\| pc\.iceConnectionState === 'completed'/);
    const live = chat.slice(chat.indexOf('goLiveWhenConnectedRef.current = (conn: any) => {'), chat.indexOf('// ── Keeping the call alive'));
    expect(live).toMatch(/setCallState\('connecting'\)/);
    expect(live.indexOf("setCallState('active')")).toBeGreaterThan(-1);
    expect(live).toMatch(/markSetup\(callMetricsRef\.current\);\n\s+setCallTiming/);
    expect(chat).toMatch(/routeFromStats\(stats\)/);
  });
});
