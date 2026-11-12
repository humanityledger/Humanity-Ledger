import { describe, expect, it } from 'vitest';
import {
  addScheduled,
  describeSendTime,
  dueScheduled,
  loadScheduled,
  markAttempt,
  removeScheduled,
  scheduleTimeError,
  scheduledForPeer,
} from '@/lib/chat/scheduled';

const OWNER = '0x1ba9c5cc429ac7b8742f58c0215d6d58c009f675';
const MAYA = '0x' + 'b'.repeat(40);
const LEO = '0x' + 'c'.repeat(40);
const NOW = Date.UTC(2026, 10, 12, 21, 0);

// A tiny, empty localStorage for node, made fresh for each test.
function fresh() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
}

describe('scheduled messages', () => {
  it('belong to the chat they were written in', () => {
    fresh();
    addScheduled(OWNER, { peer: MAYA.toUpperCase().replace('0X', '0x'), content: 'Happy birthday', sendAt: NOW + 3_600_000 }, NOW);
    addScheduled(OWNER, { peer: LEO, content: 'Call me', sendAt: NOW + 60_000 * 5 }, NOW);
    const list = loadScheduled(OWNER);
    expect(scheduledForPeer(list, MAYA).map((m) => m.content)).toEqual(['Happy birthday']);
    expect(scheduledForPeer(list, LEO).map((m) => m.content)).toEqual(['Call me']);
    expect(list[0].peer).toBe(LEO); // soonest first
  });

  it('survive a reload and are only due at their time', () => {
    fresh();
    addScheduled(OWNER, { peer: MAYA, content: 'later', sendAt: NOW + 3_600_000 }, NOW);
    const reloaded = loadScheduled(OWNER);
    expect(dueScheduled(reloaded, NOW)).toEqual([]);
    expect(dueScheduled(reloaded, NOW + 3_600_000).map((m) => m.content)).toEqual(['later']);
  });

  it('can be cancelled, and count failed attempts', () => {
    fresh();
    const [m] = addScheduled(OWNER, { peer: MAYA, content: 'x', sendAt: NOW + 120_000 }, NOW);
    markAttempt(OWNER, m.id);
    expect(loadScheduled(OWNER)[0].attempts).toBe(1);
    removeScheduled(OWNER, m.id);
    expect(loadScheduled(OWNER)).toEqual([]);
  });

  it('ignore corrupted storage', () => {
    fresh();
    localStorage.setItem(`ledger_scheduled_${OWNER}`, '{"broken"');
    expect(loadScheduled(OWNER)).toEqual([]);
    localStorage.setItem(`ledger_scheduled_${OWNER}`, JSON.stringify([{ id: 'a', peer: 'not-an-address', content: 'x', sendAt: 1, createdAt: 1 }]));
    expect(loadScheduled(OWNER)).toEqual([]);
  });

  it('accept times between a minute and a year ahead', () => {
    fresh();
    expect(scheduleTimeError(NOW + 30_000, NOW)).toMatch(/minute/);
    expect(scheduleTimeError(NOW + 2 * 365 * 86_400_000, NOW)).toMatch(/year/);
    expect(scheduleTimeError(NaN, NOW)).toMatch(/Choose/);
    expect(scheduleTimeError(NOW + 3_600_000, NOW)).toBeNull();
  });

  it('describe the send time plainly', () => {
    fresh();
    expect(describeSendTime(NOW + 3_600_000, NOW, 'en-GB')).toMatch(/^Today at /);
    expect(describeSendTime(NOW + 86_400_000, NOW, 'en-GB')).toMatch(/^Tomorrow at /);
  });
});
