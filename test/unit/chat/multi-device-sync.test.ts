/**
 * Same account open on a phone and a computer (28 Nov 2026): messages the live stream missed in a
 * visible chat are fetched and stored by the global scan, and a text sent from the other device to
 * another chat is never pulled into the open one by the optimistic-text shortcut.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

describe('multi-device sync', () => {
  it('stores messages the stream missed in visible chats, bounded per run', () => {
    expect(src).toContain('const missedSince = new Map<string, number>()');
    expect(src).toMatch(/missedSince\.entries\(\)\]\.filter\(\(\[p\]\) => p !== activeNow\)\.slice\(0, 4\)/);
    expect(src).toMatch(/const raw = await getMessages\(client, peer\);[\s\S]{0,2600}chatDB\.saveMessages\(recs\)/);
  });

  it('keeps the newest preview when one person has several DM handles', () => {
    expect(src).toMatch(/\(!prevUpd \|\| msgMs > toMs\(prevUpd\.lastAt\)\)/);
  });

  it('matches an optimistic text to the open chat only when the message peer agrees', () => {
    expect(src).toMatch(/optimisticContentMap\.current\.has\(content\) &&\s*\(!normalizedMsgPeer \|\| normalizedMsgPeer === 'unknown' \|\| normalizedMsgPeer === normalizedActivePeer\)/);
  });
});
