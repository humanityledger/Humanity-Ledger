import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const chat = read('components/terminal/LedgerChatV2.tsx');
const picker = read('components/chat/ExpressionPicker.tsx');
const screens = read('components/chat/call/CallScreens.tsx');
const client = read('lib/xmtp/client.ts');
const vault = read('lib/xmtp/device-key-vault.ts');
const audio = read('components/chat/CustomAudioPlayer.tsx');

describe('a call rings whatever chat is open', () => {
  it('names the call by its own peer, never the open chat', () => {
    expect(chat).not.toMatch(/callPeerAddrRef\.current = activePeerRef\.current/);
    expect(chat).toMatch(/peerName=\{callPeer \? getDisplayName\(callPeer\) : 'Unknown caller'\}/);
    expect(chat).toMatch(/peerAddress=\{callPeer\}/);
  });
  it('takes the PeerJS caller hint only when it matches the id the call came from', () => {
    expect(chat).toMatch(/metadata: \{ callType: type, from: \(address \|\| ''\)\.toLowerCase\(\) \}/);
    expect(chat).toMatch(/connection\.peer === baseId \|\| String\(connection\.peer\)\.startsWith\(`\$\{baseId\}-r`\)/);
  });
  it('accepts an offer from a device whose clock is ahead', () => {
    expect(chat).toMatch(/const isFreshCall = callAge > -120000 && callAge < 45000;/);
    expect(chat).not.toMatch(/callAge >= 0 && callAge < 35000/);
  });
  it('does not switch the open chat while ringing, and opens the caller on answer', () => {
    expect(chat).toMatch(/The chat that is open stays open while it rings/);
    expect(chat).toMatch(/const caller = callPeerAddrRef\.current;[\s\S]{0,160}setActivePeer\(caller\)/);
  });
});

describe('hanging up ends both sides in every state', () => {
  it('a hang-up or decline over XMTP ends any non-idle call from that person', () => {
    expect(chat).toMatch(/content === '__CALL_HANGUP__' \|\| content === '__CALL_DECLINE__'[\s\S]{0,700}if \(st !== 'idle' && fromCallPeer/);
    expect(chat).not.toMatch(/if \(callStateRef\.current === 'ringing'\) \{[^}]*\} else if \(callStateRef\.current === 'active'\)/);
  });
  it('the other device also hears it straight over PeerJS', () => {
    expect(chat).toMatch(/peer\.on\('connection', \(dc: any\) => \{[\s\S]{0,300}kind !== 'hangup' && kind !== 'decline'/);
    expect(chat).toMatch(/const endCall = useCallback\(async \(\) => \{[\s\S]{0,700}sendDirectHangupRef\.current\(\);/);
    expect(chat).toMatch(/const declineCall = useCallback\(async \(\) => \{\s*sendDirectHangupRef\.current\('decline'\);/);
  });
});

describe('call screens', () => {
  it('answer is one tap and the screens say the call is encrypted device to device', () => {
    expect(screens).toMatch(/const once = \(fn: \(\) => void\) => \(\) => \{\s*if \(busy\) return;/);
    expect(screens).toMatch(/Encrypted end to end, device to device/);
  });
  it('a phone browser gets no screen-share button that can only fail', () => {
    expect(chat).toMatch(/getDisplayMedia\(\{ video: true, audio: false \}\)/);
  });
});

describe('expression picker', () => {
  it('keeps panes mounted and swipes between them', () => {
    expect(picker).toMatch(/const \[mounted, setMounted\] = useState<Set<ExpressionTab>>/);
    expect(picker).toMatch(/style=\{\{ touchAction: 'pan-y', overscrollBehaviorX: 'none' \}\}/);
    expect(picker).toMatch(/onPointerMove=\{onPointerMove\}/);
    expect(picker).toMatch(/data-no-swipe/);
    expect(picker).toMatch(/autoFocusSearch=\{false\}/);
  });
});

describe('clear chat', () => {
  it('the list fallback obeys the cut-off', () => {
    expect(chat).toMatch(/survivesClear\(m\.sentAtNs, cut\) &&/);
  });
  it('the list line counts in the cut-off', () => {
    expect(chat).toMatch(/listLine\?\.lastMessage \? listLine\.lastAt : undefined/);
  });
});

describe('one signature to sign in', () => {
  it('opens the database from the device vault, and signs only for a signature-locked database', () => {
    expect(client).toMatch(/fromVault = await loadDeviceDbKey\(address\)/);
    expect(client).toMatch(/if \(!signatureLocked\) \{[\s\S]{0,200}randomDbKey\(\)/);
    expect(client).toMatch(/const resolved = await resolveDbKey\(address/);
  });
  it('the vault key is non-extractable and verified after writing', () => {
    expect(vault).toMatch(/generateKey\(\{ name: 'AES-GCM', length: 256 \}, false, \['encrypt', 'decrypt'\]\)/);
    expect(vault).toMatch(/const back = await loadDeviceDbKey\(address\);/);
    expect(vault).not.toMatch(/localStorage\.setItem/);
  });
});

describe('voice notes in Safari', () => {
  it('falls back to Web Audio when the element cannot play the file', () => {
    expect(audio).toMatch(/a\.error\?\.code === 4/);
    expect(audio).toMatch(/decodeAudioData\(bytes, resolve, reject\)/);
    expect(audio).toMatch(/This browser cannot play this recording\./);
  });
});
