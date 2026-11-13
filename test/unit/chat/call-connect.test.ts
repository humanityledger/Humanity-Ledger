import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// "Connected" must mean media flows: the stream PeerJS hands over arrives before ICE finds a path.
const src = readFileSync(join(process.cwd(), 'components/terminal/LedgerChatV2.tsx'), 'utf8');

describe('calls: active only once a network path exists', () => {
  it('the stream handler waits for ICE instead of marking the call active', () => {
    const wire = src.slice(src.indexOf('wireCallRef.current = (conn'), src.indexOf("conn.on('close', () => endCallIfCurrentRef.current(conn));"));
    expect(wire).toContain('goLiveWhenConnectedRef.current(conn)');
    expect(wire).not.toMatch(/setCallState\('active'\)/);
  });

  it('goes active on ICE connected, and reports a call that never connects', () => {
    const go = src.slice(src.indexOf('goLiveWhenConnectedRef.current = (conn'), src.indexOf('// ── Keeping the call alive'));
    expect(go).toMatch(/iceConnectionState === 'connected'/);
    expect(go).toMatch(/setCallState\('active'\)/);
    expect(go).toMatch(/'failed'/);
    expect(go).toContain('ICE_CONNECT_MS');
    expect(src).toMatch(/if \(callStateRef\.current === 'connecting'\) \{ connectFailedRef\.current\(\); return; \}/);
  });

  it('shows the other person\'s video once the call is active or its frames arrive, and the live clock only when active', () => {
    expect(src).toContain("callType === 'video' && remoteHasVideo && (callState === 'active' || remoteVideoLive) ? (");
    expect(src).toContain("connected={callState === 'active' && !!remoteStream}");
  });
});
