import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.join(process.cwd(), 'components/terminal/LedgerChatV2.tsx'), 'utf8');

describe('video calls', () => {
  it('sets the active connection ref in the same tick as the state', () => {
    expect(src).toMatch(/const setActiveConnection = \(conn: any\) => \{\s*activeConnectionRef\.current = conn;\s*setActiveConnectionState\(conn\);/);
    expect(src).not.toMatch(/useEffect\(\(\) => \{ activeConnectionRef\.current = activeConnection; \}/);
  });

  it('shows the other camera when its frames arrive and starts every call video', () => {
    expect(src).toMatch(/st\.getVideoTracks\(\)\.some\(\(t\) => t\.readyState === 'live' && !t\.muted\)/);
    expect(src).toMatch(/callType === 'video' && remoteHasVideo && \(callState === 'active' \|\| remoteVideoLive\)/);
    expect(src).toMatch(/if \(stream && el\.paused\) el\.play\(\)\.catch\(\(\) => \{\}\);/);
    expect(src).not.toMatch(/ref=\{el => \{ if \(el && el\.srcObject !== remoteStream\) el\.srcObject = remoteStream; \}\}/);
  });

  it('offers screen sharing everywhere and says when a phone browser cannot', () => {
    expect(src).toMatch(/onScreenShare=\{toggleScreenShare\}/);
    expect(src).toMatch(/This browser cannot share your screen/);
  });
});

describe('call signals reach the person being called', () => {
  it('sends the offer to the call target, not to the chat that was open', () => {
    expect(src).toMatch(/executeSend\(`__CALL_OFFER__:\$\{myStablePeerId\}:\$\{type\}`, \{ to: targetPeer \}\)/);
    expect(src).toMatch(/const executeSend = async \(content: string, opts: \{ to\?: string \} = \{\}\): Promise<boolean> => \{\s*const activePeer = opts\.to \|\| activePeerState;/);
  });
  it('answer, decline and hang up go to the person in the call', () => {
    for (const sig of ['__CALL_HANGUP__', '__CALL_DECLINE__']) {
      const plain = new RegExp(`executeSend(?:Ref\\.current\\??)?\\('${sig}'\\)`);
      expect(src).not.toMatch(plain);
    }
    expect(src).toMatch(/__CALL_ANSWER__:\$\{myStableId\}`, \{ to: callPeerAddrRef\.current \|\| undefined \}/);
  });
  it('the Calls tab starts voice calls as audio', () => {
    expect(src).toMatch(/handleStartCall\(type === 'video' \? 'video' : 'audio', addr\)/);
  });
});
