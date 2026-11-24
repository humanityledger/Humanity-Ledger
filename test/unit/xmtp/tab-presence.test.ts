import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { watchOtherTabs, type PresenceChannel } from '@/lib/xmtp/tab-presence';

/** A broadcast bus: what one tab posts, every other tab hears (like BroadcastChannel). */
function bus() {
  const tabs: Array<(ev: { data: unknown }) => void> = [];
  return (): PresenceChannel => {
    let mine: ((ev: { data: unknown }) => void) | null = null;
    return {
      postMessage(msg) { for (const fn of tabs) if (fn !== mine) fn({ data: msg }); },
      addEventListener(_t, fn) { mine = fn; tabs.push(fn); },
      close() { const i = tabs.indexOf(mine!); if (i >= 0) tabs.splice(i, 1); },
    };
  };
}

describe('Ledger Chat open in two tabs', () => {
  it('both tabs learn of each other, once each', () => {
    const open = bus();
    let a = 0, b = 0;
    watchOtherTabs(() => { a++; }, { channel: open(), tabId: 'a' });
    watchOtherTabs(() => { b++; }, { channel: open(), tabId: 'b' });
    expect(a).toBe(1); // heard b's hello
    expect(b).toBe(1); // heard a's answer
    watchOtherTabs(() => {}, { channel: open(), tabId: 'c' });
    expect([a, b]).toEqual([1, 1]);
  });

  it('a single tab hears nothing, and ignores its own and malformed messages', () => {
    const open = bus();
    let n = 0;
    const ch = open();
    watchOtherTabs(() => { n++; }, { channel: ch, tabId: 'solo' });
    ch.postMessage({ t: 'hello', from: 'solo' });
    expect(n).toBe(0);
    const other = open();
    other.addEventListener('message', () => {});
    other.postMessage({ t: 'nope', from: 'x' });
    other.postMessage('hello');
    expect(n).toBe(0);
  });

  it('stops after the returned function runs; no channel means no-op', () => {
    const open = bus();
    let n = 0;
    const stop = watchOtherTabs(() => { n++; }, { channel: open(), tabId: 'a' });
    stop();
    watchOtherTabs(() => {}, { channel: open(), tabId: 'b' });
    expect(n).toBe(0);
    expect(watchOtherTabs(() => {}, { channel: null })).toBeTypeOf('function');
  });

  it('is wired into the chat and reported, never as a block', () => {
    const chat = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    expect(chat).toMatch(/watchOtherTabs\(\(\) => \{/);
    expect(chat).toMatch(/reportDelivery\('multi_tab'/);
    expect(fs.readFileSync('app/api/chat/delivery-report/route.ts', 'utf8')).toMatch(/'multi_tab'/);
  });
});
