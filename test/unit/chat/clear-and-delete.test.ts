/**
 * "Clear chat" and "Delete for me" are local and must not come back:
 * not in the thread, not in the line under the address, not after a reload
 * or the next sync. The rules live in lib/chat/cleared-chats.ts and
 * lib/chat/deleted-messages.ts; LedgerChatV2 calls them on every path.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  clearCutoff,
  clearedAtMs,
  markCleared,
  lineWasCleared,
  previewAfterClear,
  previewAfterDelete,
  survivesClear,
  toMs,
} from '@/lib/chat/cleared-chats';
import { hiddenIds, markDeletedForMe } from '@/lib/chat/deleted-messages';

class MemoryStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
class FullStorage extends MemoryStorage {
  setItem(): void { throw new Error('QuotaExceededError'); }
}
const kv = () => new MemoryStorage() as unknown as Storage;

const ME = '0xAbCdEf0000000000000000000000000000000001';
const PEER = '0x1ba9c5cc429ac7b8742f58c0215d6d58c009f675';
const isSystem = (c: string) => c.startsWith('__');

describe('clear chat', () => {
  it('records one cut-off that every reader finds, whatever the address case', () => {
    const s = kv();
    expect(markCleared(PEER, [ME.toLowerCase(), ME], 1_000, s)).toBe(true);
    expect(clearedAtMs(PEER, [ME], s)).toBe(1_000);
    expect(clearedAtMs(PEER.toUpperCase().replace('0X', '0x'), [ME.toLowerCase()], s)).toBe(1_000);
    // Older builds wrote only the peer key; it is still honoured.
    const old = kv();
    old.setItem(`ledger_cleared_${PEER}`, '777');
    expect(clearedAtMs(PEER, [ME], old)).toBe(777);
  });

  it('reports a cut-off it could not store, so the chat is not shown as cleared', () => {
    expect(markCleared(PEER, [ME], 1_000, new FullStorage() as unknown as Storage)).toBe(false);
    expect(markCleared(PEER, [ME], 1_000, undefined)).toBe(false);
  });

  it('cuts at now, not in the future, so a reply a moment later still shows', () => {
    const cut = clearCutoff(10_000, [9_000, 9_500]);
    expect(cut).toBe(10_000);
    expect(survivesClear(10_001, cut)).toBe(true);
    expect(survivesClear(10_000, cut)).toBe(false);
    // A message stamped ahead of this device's clock is still cleared.
    expect(clearCutoff(10_000, [12_000])).toBe(12_000);
  });

  it('treats XMTP nanoseconds and milliseconds alike', () => {
    expect(toMs(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(toMs(1_700_000_000_000_000_000)).toBe(1_700_000_000_000);
    expect(toMs(new Date(5_000))).toBe(5_000);
    expect(toMs('2026-11-17T08:00:00.000Z')).toBe(Date.parse('2026-11-17T08:00:00.000Z'));
    expect(survivesClear(1_000_000_001 * 1e6, 1_000_000_000)).toBe(true);
  });

  it('blanks the list line from before the clear, before the chat is opened and after reload', () => {
    const s = kv();
    markCleared(PEER, [ME], 2_000, s);
    const stored = { peerAddress: PEER, lastMessage: 'nknmk', lastAt: new Date(1_500) };
    // Reload: the line comes back from storage and is checked again.
    const reloaded = JSON.parse(JSON.stringify(stored));
    expect(previewAfterClear(stored, clearedAtMs(PEER, [ME], s)).lastMessage).toBe('');
    expect(previewAfterClear(reloaded, clearedAtMs(PEER, [ME], s)).lastMessage).toBe('');
    // A line with no time cannot show it came later: blank too.
    expect(previewAfterClear({ peerAddress: PEER, lastMessage: 'dwadwa' }, 2_000).lastMessage).toBe('');
  });

  it('a cleared line must not be refilled from messages still in memory', () => {
    const cleared = previewAfterClear(
      { peerAddress: PEER, lastMessage: 'nknmk', lastAt: new Date(1_500) },
      2_000,
    );
    expect(cleared.lastMessage).toBe('');
    expect(lineWasCleared(cleared, 2_000)).toBe(true);
    const later = previewAfterClear(
      { peerAddress: PEER, lastMessage: 'after', lastAt: new Date(2_500) },
      2_000,
    );
    expect(lineWasCleared(later, 2_000)).toBe(false);
    expect(lineWasCleared({ peerAddress: PEER, lastMessage: 'hello', lastAt: 1 }, 0)).toBe(false);
  });

  it('shows a later message, and only that one', () => {
    const later = { peerAddress: PEER, lastMessage: 'new one', lastAt: new Date(2_500) };
    expect(previewAfterClear(later, 2_000).lastMessage).toBe('new one');
    expect(previewAfterClear(later, 0)).toBe(later);
  });
});

describe('delete for me', () => {
  const thread = [
    { id: 'a', content: 'first', sentAtNs: 1_000 },
    { id: 'r', content: '__READ__a', sentAtNs: 1_500 },
    { id: 'b', content: 'second', sentAtNs: 2_000 },
    { id: 'c', content: 'third', sentAtNs: 3_000 },
  ];

  it('stores the id and reports it, so reload and sync keep it hidden', () => {
    const s = kv();
    expect(markDeletedForMe(PEER, 'c', s)).toBe(true);
    expect(hiddenIds(PEER, s).has('c')).toBe(true);
    // Twice is fine and still true.
    expect(markDeletedForMe(PEER, 'c', s)).toBe(true);
  });

  it('a delete that cannot be stored says so and leaves the message', () => {
    expect(markDeletedForMe(PEER, 'c', new FullStorage() as unknown as Storage)).toBe(false);
    expect(markDeletedForMe(PEER, '', kv())).toBe(false);
  });

  it('the last line becomes the previous visible message', () => {
    expect(previewAfterDelete(thread, 'c', isSystem)).toEqual({ kind: 'previous', content: 'second', atMs: 2_000 });
  });

  it('an older message leaves the line alone', () => {
    expect(previewAfterDelete(thread, 'a', isSystem)).toEqual({ kind: 'unchanged' });
  });

  it('the only visible message leaves the line empty, skipping signals', () => {
    expect(previewAfterDelete([thread[1], { id: 'x', content: 'only', sentAtNs: 9 }], 'x', isSystem)).toEqual({ kind: 'empty' });
  });
});

describe('every path in the chat screen asks the same rule', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'components/terminal/LedgerChatV2.tsx'), 'utf8');

  it('clear has no margin into the future and fails visibly', () => {
    expect(src).not.toMatch(/Date\.now\(\)\s*\+\s*5000/);
    expect(src).toMatch(/markCleared\(peerLower/);
    expect(src).toContain('Could not clear this chat on this device. Nothing was removed.');
  });

  it('queue, legacy reads, stream replays, stored history and the list line use the cut-off', () => {
    expect(src.match(/survivesClear\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(src.match(/previewAfterClear\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(src).toContain('lineWasCleared(conv, cut)');
  });

  it('delete for me records first, then updates thread and line', () => {
    expect(src).toContain('Could not delete this message on this device. It is still in the chat.');
    expect(src).toMatch(/previewAfterDelete\(thread, id, isSystemSignal\)/);
  });
});
