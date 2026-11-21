/**
 * "Delete chat" must not come back (21 November 2026): the conversation and its messages
 * reappeared on the next sync because nothing was recorded. lib/chat/cleared-chats.ts now records
 * a deletion: the clear cut-off plus a deletion time that keeps the line out of the list until a
 * newer message arrives.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { clearedAtMs, deletedAtMs, hiddenAfterDelete, markDeleted, survivesClear } from '@/lib/chat/cleared-chats';

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}

const ME = '0x' + 'a'.repeat(40);
const PEER = '0x' + 'B'.repeat(40);

describe('delete chat', () => {
  it('records the deletion and the clear cut-off for the account', () => {
    const s = new MemStorage() as unknown as Storage;
    expect(markDeleted(PEER, [ME], 1_000_000, s)).toBe(true);
    expect(deletedAtMs(PEER, [ME], s)).toBe(1_000_000);
    expect(clearedAtMs(PEER, [ME], s)).toBe(1_000_000);
    // keys are lower case, whatever case the address came in
    expect(deletedAtMs(PEER.toLowerCase(), [ME], s)).toBe(1_000_000);
  });

  it('keeps the line hidden until a newer message, then shows it again', () => {
    const at = 1_700_000_000_000;
    expect(hiddenAfterDelete({ peerAddress: PEER, lastMessage: 'old', lastAt: at - 5 }, at)).toBe(true);
    expect(hiddenAfterDelete({ peerAddress: PEER, lastMessage: '', lastAt: undefined }, at)).toBe(true);
    expect(hiddenAfterDelete({ peerAddress: PEER, lastMessage: 'new', lastAt: at + 1 }, at)).toBe(false);
    // XMTP times are nanoseconds: converted before comparing
    expect(hiddenAfterDelete({ peerAddress: PEER, lastMessage: 'new', lastAt: (at + 1000) * 1e6 }, at)).toBe(false);
    expect(hiddenAfterDelete({ peerAddress: PEER, lastMessage: 'x', lastAt: at - 1 }, 0)).toBe(false);
  });

  it('hides every older message through the clear cut-off', () => {
    const s = new MemStorage() as unknown as Storage;
    markDeleted(PEER, [ME], 5_000, s);
    const cut = clearedAtMs(PEER, [ME], s);
    expect(survivesClear(4_999, cut)).toBe(false);
    expect(survivesClear(5_001, cut)).toBe(true);
  });

  it('reports failure when nothing could be written', () => {
    const broken = { getItem: () => null, setItem: () => { throw new Error('full'); } } as unknown as Storage;
    expect(markDeleted(PEER, [ME], 10, broken)).toBe(false);
  });

  it('is wired in the chat: recorded, synced, and filtered out of the list', () => {
    const src = readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    const fn = src.slice(src.indexOf('const deleteConversation = (peer: string) => {'), src.indexOf('const markConversationAsRead'));
    expect(fn).toMatch(/markDeleted\(/);
    expect(fn).toMatch(/`deleted:\$\{peerLower\}`/);
    expect(fn).toMatch(/clearConversation\(dmId\)/);
    expect(src).toMatch(/hiddenAfterDelete\(conv, deletedAtMs\(conv\.peerAddress/);
    expect(src).toMatch(/k\.startsWith\('deleted:'\)/);
  });
});
