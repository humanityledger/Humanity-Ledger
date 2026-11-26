import { vi } from 'vitest';

/**
 * 26 November 2026 (production log): Chrome on the desktop reported publish_pending "Sync failed
 * to wait for intent" conversation after conversation, and publish_debug showed a DM at epoch=0,
 * a DM the other person was never added to (libxmtp 1.6.6 create_dm_and_insert, then
 * add_members_by_inbox_id). These specs pin the send path that keeps messages out of such a DM,
 * never races a second creation of one, and never creates one from a read.
 */
vi.mock('@xmtp/browser-sdk', () => ({
  Client: { canMessage: async (ids: { identifier: string }[]) => new Map(ids.map((i) => [i.identifier, true])) },
}));

const PEER = '0x' + 'b'.repeat(40);
const ME = 'inbox-me';
const THEM = 'inbox-them';

function dmWith(members: string[], id = 'dm-' + members.join('-')) {
  const created: string[] = [];
  const state = { members, syncs: 0, publishes: 0 };
  return {
    id,
    created,
    state,
    async members() { return state.members.map((inboxId) => ({ inboxId })); },
    async sync() { state.syncs++; },
    async sendOptimistic(c: string) { created.push(c); return `${id}-msg-${created.length}`; },
    async publishMessages() { state.publishes++; },
  };
}

describe('the send path never writes into a DM the other person cannot read', () => {
  beforeEach(() => vi.resetModules());

  it('a healthy DM: one message, one publish, no extra syncs of the conversation list', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const dm = dmWith([ME, THEM]);
    const convSync = vi.fn(async () => {});
    const client = { inboxId: ME, conversations: { newDmWithIdentifier: async () => dm, sync: convSync } } as any;
    expect(await sendMessage(client, PEER, 'hola')).toBe(`${dm.id}-msg-1`);
    expect(dm.created).toEqual(['hola']);
    expect(dm.state.publishes).toBe(1);
    expect(convSync).not.toHaveBeenCalled();
  });

  it('typing, read and delivery receipts are not written into a DM without the other person', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const broken = dmWith([ME]); // epoch 0: only us
    const client = { inboxId: ME, conversations: { newDmWithIdentifier: async () => broken, sync: async () => {} } } as any;
    for (const s of ['__TYPING__', '__READ__abc', '__DELIVERED__abc']) {
      expect(await sendMessage(client, PEER, s)).toBeUndefined();
    }
    expect(broken.created).toEqual([]); // nothing refreshed its last_message_ns
    expect(broken.state.publishes).toBe(0);
  });

  it('a message into a DM without the other person repairs it first and moves to the DM they can read', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const broken = dmWith([ME], 'broken');
    const healthy = dmWith([ME, THEM], 'healthy');
    const convSync = vi.fn(async () => {});
    const client = {
      inboxId: ME,
      findInboxIdByIdentifier: async () => THEM,
      conversations: { newDmWithIdentifier: async () => broken, sync: convSync, getDmByInboxId: async (i: string) => (i === THEM ? healthy : null) },
    } as any;
    const id = await sendMessage(client, PEER, 'hola');
    expect(broken.state.syncs).toBeGreaterThanOrEqual(1); // the pending add of the other person published
    expect(convSync).toHaveBeenCalled(); // welcomes processed
    expect(broken.created).toEqual([]);
    expect(healthy.created).toEqual(['hola']);
    expect(id).toBe('healthy-msg-1');
  });

  it('a message is never dropped: with no readable DM yet it is written and published once the add lands', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const broken = dmWith([ME], 'only-ours');
    broken.sync = async () => { broken.state.syncs++; broken.state.members = [ME, THEM]; }; // the add lands on sync
    const client = { inboxId: ME, conversations: { newDmWithIdentifier: async () => broken, sync: async () => {} } } as any;
    expect(await sendMessage(client, PEER, 'sigo aquí')).toBe('only-ours-msg-1');
    expect(broken.created).toEqual(['sigo aquí']);
    expect(broken.state.publishes).toBe(1);
  });

  it('an SDK without members() is treated as sendable (never blocks a working chat)', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const dm = dmWith([ME, THEM]) as any;
    delete dm.members;
    const client = { inboxId: ME, conversations: { newDmWithIdentifier: async () => dm } } as any;
    expect(await sendMessage(client, PEER, 'x')).toBe(`${dm.id}-msg-1`);
  });
});

describe('one DM creation per conversation at a time', () => {
  beforeEach(() => vi.resetModules());

  it('an attempt that stopped waiting after 8 s joins the creation still running instead of starting another', async () => {
    vi.useFakeTimers();
    try {
      const { sendMessage } = await import('@/lib/xmtp/client');
      const dm = dmWith([ME, THEM]);
      let finish!: (v: unknown) => void;
      const newDmWithIdentifier = vi.fn(() => new Promise((r) => { finish = r; }));
      const client = { inboxId: ME, conversations: { newDmWithIdentifier } } as any;
      const sent = sendMessage(client, PEER, 'hola');
      await vi.advanceTimersByTimeAsync(8_500); // first attempt timed out ("newDm timeout")
      await vi.advanceTimersByTimeAsync(400); // backoff, second attempt starts
      expect(newDmWithIdentifier).toHaveBeenCalledTimes(1);
      finish(dm);
      await vi.advanceTimersByTimeAsync(10);
      expect(await sent).toBe(`${dm.id}-msg-1`);
      expect(newDmWithIdentifier).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('two messages sent together into a new chat create one DM', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const dm = dmWith([ME, THEM]);
    const newDmWithIdentifier = vi.fn(async () => { await new Promise((r) => setTimeout(r, 20)); return dm; });
    const client = { inboxId: ME, conversations: { newDmWithIdentifier } } as any;
    await Promise.all([sendMessage(client, PEER, 'uno'), sendMessage(client, PEER, 'dos')]);
    expect(newDmWithIdentifier).toHaveBeenCalledTimes(1);
    expect(dm.created.sort()).toEqual(['dos', 'uno']);
  });
});

describe('reading never creates a conversation', () => {
  beforeEach(() => vi.resetModules());

  it('getMessages with no local DM returns [] and does not call newDmWithIdentifier', async () => {
    const { getMessages } = await import('@/lib/xmtp/client');
    const newDmWithIdentifier = vi.fn();
    const client = {
      inboxId: ME,
      findInboxIdByIdentifier: async () => THEM,
      conversations: { sync: async () => {}, getDmByInboxId: async () => undefined, listDms: async () => [], newDmWithIdentifier },
    } as any;
    expect(await getMessages(client, PEER)).toEqual([]);
    expect(newDmWithIdentifier).not.toHaveBeenCalled();
  });

  it('getMessages reads the existing DM', async () => {
    const { getMessages } = await import('@/lib/xmtp/client');
    const dm = { ...dmWith([ME, THEM]), messages: async () => [{ id: 'm1', content: 'hi' }] };
    const client = {
      inboxId: ME,
      findInboxIdByIdentifier: async () => THEM,
      conversations: { sync: async () => {}, getDmByInboxId: async () => dm, newDmWithIdentifier: vi.fn() },
    } as any;
    expect(await getMessages(client, PEER)).toEqual([{ id: 'm1', content: 'hi' }]);
  });
});

describe('a publish that keeps waiting on its intent', () => {
  beforeEach(() => vi.resetModules());

  it('retries sync the DM and the conversation list, and stop sending receipts meanwhile', async () => {
    vi.useFakeTimers();
    try {
      const { sendMessage } = await import('@/lib/xmtp/client');
      const { diagEvents } = await import('@/lib/xmtp/diag');
      const dm = dmWith([ME, THEM]);
      let fails = 4;
      dm.publishMessages = async () => { dm.state.publishes++; if (fails-- > 0) throw new Error('Sync failed to wait for intent'); };
      (dm as any).pausedForVersion = async () => '1.9.0';
      (dm as any).debugInfo = async () => ({ epoch: 6n, maybeForked: false });
      const convSync = vi.fn(async () => {});
      const client = { inboxId: ME, conversations: { newDmWithIdentifier: async () => dm, sync: convSync } } as any;
      expect(await sendMessage(client, PEER, 'hola')).toBe(`${dm.id}-msg-1`);
      // While it is pending, a typing signal is not queued behind it.
      expect(await sendMessage(client, PEER, '__TYPING__')).toBeUndefined();
      expect(dm.created).toEqual(['hola']);
      await vi.advanceTimersByTimeAsync(1_000); // retry 0 fails → syncs
      expect(convSync).toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2_000 + 4_000); // retries 1 and 2 (2 explains)
      await vi.advanceTimersByTimeAsync(8_000); // retry 3 succeeds
      const kinds = diagEvents().map((e) => e.kind);
      expect(kinds).toContain('publish_paused');
      expect(kinds).toContain('publish_recovered');
      // Confirmed: receipts go out again.
      expect(await sendMessage(client, PEER, '__READ__x')).toBe(`${dm.id}-msg-2`);
    } finally {
      vi.useRealTimers();
    }
  });
});
