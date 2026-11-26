import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { compareChats, newerLastAt, orderChats } from '@/lib/chat/chat-order';

const ui = readFileSync(path.resolve(__dirname, '../../../components/terminal/LedgerChatV2.tsx'), 'utf8');
const A = '0x' + 'a'.repeat(40), B = '0x' + 'b'.repeat(40), C = '0x' + 'c'.repeat(40), D = '0x' + 'd'.repeat(40);

describe('chat list order', () => {
  it('newest last message first, whatever shape the time is stored in', () => {
    const list = [
      { peerAddress: A, lastAt: new Date('2026-11-26T10:00:00Z') },
      { peerAddress: B, lastAt: '2026-11-26T12:00:00Z' },
      { peerAddress: C, lastAt: Date.parse('2026-11-26T11:00:00Z') * 1_000_000 }, // ns
      { peerAddress: D }, // no message yet
    ];
    expect(orderChats(list).map((c) => c.peerAddress)).toEqual([B, C, A, D]);
  });
  it('pinned chats stay on top, each group in time order; ties are stable', () => {
    const list = [
      { peerAddress: A, lastAt: 3 * 1e12 }, { peerAddress: B, lastAt: 1e12 }, { peerAddress: C, lastAt: 2 * 1e12 }, { peerAddress: D, lastAt: 2 * 1e12 },
    ];
    expect(orderChats(list, new Set([B])).map((c) => c.peerAddress)).toEqual([B, A, C, D]);
    expect(compareChats(list[2], list[3])).toBeLessThan(0);
  });
  it('a late older message never moves a chat back in time', () => {
    const now = new Date('2026-11-26T12:00:00Z');
    expect(newerLastAt(now, new Date('2026-11-26T09:00:00Z'))).toBe(now);
    const later = new Date('2026-11-26T13:00:00Z');
    expect(newerLastAt(now, later)).toBe(later);
  });
  it('the list sorts at render, and server contacts without a message are not stamped "now"', () => {
    expect(ui).toMatch(/\.sort\(\(a, b\) => compareChats\(a, b, pinnedPeers\)\)/);
    expect(ui).not.toMatch(/merged\.push\(\{ peerAddress: peer, lastMessage: '', lastAt: new Date\(\) \}\)/);
  });
});
