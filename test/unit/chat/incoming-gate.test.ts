import { decideIncoming, streamGate, LIVE_SKEW_MS, deletionWatermark, saveDeleteSnapshot, isPreDeleteId } from '@/lib/chat/incoming-revival';
import { markDeleted, deletedAtMs, clearedAtMs, unmarkDeleted } from '@/lib/chat/cleared-chats';
import { createSingleFlightRunner } from '@/lib/chat/poll-runner';
import { isEphemeralSignal, singleFlight, dmHealth } from '@/lib/xmtp/dm-health';

/**
 * Receive side of wallet-to-wallet delivery (26 November 2026). Blocking is the only reason to
 * drop a message; a deleted or cleared chat hides its history and comes back, clean, with the next
 * message. The live stream now decides through the same rule as every other path.
 */
function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  } as Storage;
}

const NOW = 1_764_000_000_000;
const base = {
  hidden: false, msgMs: NOW, cutMs: 0, deletedAt: 0, fromPeer: true, firstSight: true,
  liveAfterOpen: true, preMaxMs: 0, rescued: false, rescuable: true,
};

describe('decideIncoming: block is the only drop', () => {
  it('blocked drops whatever the rest says', () => {
    expect(decideIncoming({ blocked: true, msgMs: NOW, cutMs: 0, deletedAt: 0, preDelete: false })).toBe('drop');
    expect(decideIncoming({ blocked: true, msgMs: NOW, cutMs: 0, deletedAt: 0, preDelete: false, live: true, rescued: true })).toBe('drop');
  });
  it('a chat never cleared or deleted delivers everything', () => {
    expect(decideIncoming({ blocked: false, msgMs: 1, cutMs: 0, deletedAt: 0, preDelete: false })).toBe('deliver');
  });
  it('deleted chat: history suppressed, a newer message revives it', () => {
    expect(decideIncoming({ blocked: false, msgMs: NOW - 1, cutMs: NOW, deletedAt: NOW, preDelete: false })).toBe('suppress');
    expect(decideIncoming({ blocked: false, msgMs: NOW + 1, cutMs: NOW, deletedAt: NOW, preDelete: false })).toBe('revive');
    expect(decideIncoming({ blocked: false, msgMs: NOW + 1, cutMs: NOW, deletedAt: NOW, preDelete: true })).toBe('suppress');
  });
});

describe('streamGate: the live stream', () => {
  it('no cut-off: delivered', () => {
    expect(streamGate(base)).toEqual({ verdict: 'deliver', rescueNow: false });
  });
  it('deleted for me (snapshot): suppressed with its reason', () => {
    const d = streamGate({ ...base, hidden: true });
    expect(d.verdict).toBe('suppress');
    expect(d.reason).toBe('deleted on this device');
  });
  it('cleared: an old message stays hidden, a newer one shows', () => {
    expect(streamGate({ ...base, liveAfterOpen: false, msgMs: NOW - 10 * 60_000, cutMs: NOW }).verdict).toBe('suppress');
    expect(streamGate({ ...base, msgMs: NOW + 1, cutMs: NOW }).verdict).toBe('deliver');
  });
  it('deleted chat + a new message from them: revive, with that message', () => {
    expect(streamGate({ ...base, msgMs: NOW + 5, cutMs: NOW, deletedAt: NOW }).verdict).toBe('revive');
  });
  it('clock skew: a live message stamped up to 3 min before the cut-off, newer than anything shown, is rescued', () => {
    const d = streamGate({ ...base, msgMs: NOW - 60_000, cutMs: NOW, deletedAt: NOW, preMaxMs: NOW - 120_000 });
    expect(d.verdict).toBe('revive');
    expect(d.rescueNow).toBe(true);
  });
  it('clock skew has limits: older than the window, older than what was shown, a replay, our own, a receipt', () => {
    expect(streamGate({ ...base, msgMs: NOW - LIVE_SKEW_MS - 1, cutMs: NOW }).verdict).toBe('suppress');
    expect(streamGate({ ...base, msgMs: NOW - 60_000, cutMs: NOW, preMaxMs: NOW - 30_000 }).verdict).toBe('suppress');
    expect(streamGate({ ...base, msgMs: NOW - 60_000, cutMs: NOW, firstSight: false }).verdict).toBe('suppress');
    expect(streamGate({ ...base, msgMs: NOW - 60_000, cutMs: NOW, fromPeer: false }).verdict).toBe('suppress');
    expect(streamGate({ ...base, msgMs: NOW - 60_000, cutMs: NOW, rescuable: false }).verdict).toBe('suppress');
    expect(streamGate({ ...base, msgMs: NOW - 60_000, cutMs: NOW, liveAfterOpen: false }).verdict).toBe('suppress');
  });
  it('rescued earlier (persisted): still delivered after a reload', () => {
    expect(streamGate({ ...base, msgMs: NOW - 60_000, cutMs: NOW, liveAfterOpen: false, firstSight: false, rescued: true }).verdict).toBe('deliver');
  });
  it('nanosecond timestamps (XMTP sentAtNs) are read as such', () => {
    expect(streamGate({ ...base, msgMs: BigInt(NOW + 1000) * 1_000_000n, cutMs: NOW }).verdict).toBe('deliver');
  });
});

describe('delete, then a new message: a clean chat with only the new message', () => {
  it('end to end on the stored marks', () => {
    const s = memStorage();
    const me = '0x' + '1'.repeat(40);
    const peer = '0x' + '2'.repeat(40);
    const shown = [NOW - 3_000, NOW - 2_000, NOW - 1_000];
    // Device clock 10 min ahead of the network: the cut-off is the network watermark, not the clock.
    const cut = deletionWatermark(NOW + 10 * 60_000, shown);
    expect(cut).toBe(NOW - 1_000);
    expect(markDeleted(peer, [me], cut, s)).toBe(true);
    saveDeleteSnapshot(peer, [me], ['old-1', 'old-2', 'old-3'], s);
    const facts = (id: string, at: number) => ({
      ...base,
      hidden: isPreDeleteId(peer, id, [me], s),
      msgMs: at,
      cutMs: Math.max(clearedAtMs(peer, [me], s), deletedAtMs(peer, [me], s)),
      deletedAt: deletedAtMs(peer, [me], s),
    });
    // History replayed by a sync: hidden.
    expect(streamGate({ ...facts('old-2', NOW - 2_000), liveAfterOpen: false }).verdict).toBe('suppress');
    // The new message: revives the chat.
    expect(streamGate(facts('new-1', NOW + 500)).verdict).toBe('revive');
    unmarkDeleted(peer, [me], s);
    // The clear cut-off stays: history still hidden after the revival, the new message still shown.
    expect(streamGate({ ...facts('old-3', NOW - 1_000), liveAfterOpen: false }).verdict).toBe('suppress');
    expect(streamGate(facts('new-1', NOW + 500)).verdict).toBe('deliver');
  });
});

describe('the global sync never overlaps itself', () => {
  it('starts during a run ask for one more run after it, never a second run alongside', async () => {
    let inFlight = 0; let max = 0; let runs = 0;
    const runner = createSingleFlightRunner(async () => {
      runs++; inFlight++; max = Math.max(max, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight--;
    });
    const p = runner();
    runner(); runner(); runner();
    await p;
    await new Promise((r) => setTimeout(r, 40));
    expect(max).toBe(1);
    expect(runs).toBe(2);
  });
  it('stops when the chat unmounts', async () => {
    let stopped = false; let runs = 0;
    const runner = createSingleFlightRunner(async () => { runs++; }, () => stopped);
    await runner();
    stopped = true;
    await runner();
    expect(runs).toBe(1);
  });
});

describe('dm-health helpers', () => {
  it('ephemeral signals are typing, read and delivery receipts only', () => {
    expect(isEphemeralSignal('__TYPING__')).toBe(true);
    expect(isEphemeralSignal('__READ__abc')).toBe(true);
    expect(isEphemeralSignal('__DELIVERED__abc')).toBe(true);
    expect(isEphemeralSignal('__REACT__x__::👍')).toBe(false);
    expect(isEphemeralSignal('__PAYMENT__{}')).toBe(false);
    expect(isEphemeralSignal('hola')).toBe(false);
  });
  it('singleFlight runs one operation per key until it settles', async () => {
    const m = new Map<string, Promise<number>>();
    let calls = 0;
    const op = () => new Promise<number>((r) => { calls++; setTimeout(() => r(calls), 10); });
    const [a, b] = await Promise.all([singleFlight(m, 'k', op), singleFlight(m, 'k', op)]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    await singleFlight(m, 'k', op);
    expect(calls).toBe(2);
  });
  it('dmHealth: ok with the other person, peer_missing without, unknown when it cannot tell', async () => {
    expect(await dmHealth({ id: 'a', members: async () => [{ inboxId: 'me' }, { inboxId: 'them' }] }, 'me')).toBe('ok');
    expect(await dmHealth({ id: 'b', members: async () => [{ inboxId: 'ME' }] }, 'me')).toBe('peer_missing');
    expect(await dmHealth({ id: 'c' }, 'me')).toBe('unknown');
    expect(await dmHealth({ id: 'd', members: async () => { throw new Error('worker'); } }, 'me')).toBe('unknown');
    expect(await dmHealth({ id: 'e', members: () => new Promise(() => {}) }, 'me', 20)).toBe('unknown');
  });
});
