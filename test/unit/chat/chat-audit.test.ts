import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Regressions found in the November 2026 audit of Ledger Chat.
const src = readFileSync(join(process.cwd(), 'components/terminal/LedgerChatV2.tsx'), 'utf8');
const xmtp = readFileSync(join(process.cwd(), 'lib/xmtp/client.ts'), 'utf8');

describe('voice messages', () => {
  it('leaving the chat mid-recording discards the note instead of sending it', () => {
    const unmount = src.slice(src.indexOf('// Auditor Fix: Stop rogue timeouts'), src.indexOf('// Ringtone refs'));
    expect(unmount).toMatch(/isRecordingCancelledRef\.current = true;\s*\n\s*mediaRecorderRef\.current\.stop\(\)/);
  });

  it('opening another chat while recording cancels the recording', () => {
    expect(src).toContain('recordingPeerRef.current !== activePeer');
    expect(src).toMatch(/recordingPeerRef\.current !== activePeer\) \{\s*\n\s*cancelRecording\(\)/);
  });
});

describe('scheduled messages', () => {
  it('are stored with their chat, not fired at whichever chat is open', () => {
    expect(src).not.toMatch(/setTimeout\(\(\) => executeSendRef\.current\?\.\(txt\), delayMs\)/);
    expect(src).toContain('addScheduled(address, { peer: activePeer, content: txt, sendAt })');
    // The sender addresses each message to its own chat.
    expect(src).toContain('await sendMessage(client, m.peer, m.content, address)');
  });

  it('can be reached from the attach menu and a slash command', () => {
    expect(src).toContain("label: 'Schedule a message'");
    expect(src).toContain("cmd: '/schedule'");
  });
});

describe('scheduled calls', () => {
  it('are offered in the attach menu, as /meet and in the Calls tab', () => {
    expect(src).toContain("label: 'Schedule a call'");
    expect(src).toContain("cmd: '/meet'");
    expect(src).toContain('onScheduleCall={(addr) =>');
  });

  it('never show their JSON as a preview', () => {
    expect(src).toMatch(/const meeting = parseMeeting\(cleanContent\);\s*\n\s*if \(meeting\) return meetingPreview\(meeting\);/);
  });
});

describe('history and logging', () => {
  it('keeps the loader up while a chat with history is still syncing', () => {
    expect(src).toContain('for (const wait of [1500, 3000, 6000, 10000])');
  });

  it('finds the DM by inbox before scanning every conversation', () => {
    const fn = xmtp.slice(xmtp.indexOf('export async function getMessages'), xmtp.indexOf('export async function discoverNewPeers'));
    expect(fn).toContain('client.conversations.getDmByInboxId(peerInboxId)');
    expect(fn.indexOf('getDmByInboxId')).toBeLessThan(fn.indexOf('client.conversations.listDms()'));
  });

  it('asks the XMTP SDK for warnings and errors only', () => {
    expect(xmtp).toContain("loggingLevel: 'warn'");
  });
});

describe('panels', () => {
  it('Escape closes the top panel, and the header menu opens one at a time', () => {
    expect(src).toContain('const closeChatPanels = useCallback(');
    expect(src).toContain('onClick={() => { setShowHeaderMenu(false); closeChatPanels(); item.onClick(); }}');
  });
});
