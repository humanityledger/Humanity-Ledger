import { vi } from 'vitest';

vi.mock('@xmtp/browser-sdk', () => ({
  Client: { canMessage: async () => new Map() },
}));

const PEER = '0x' + 'a'.repeat(40);

/** A fake XMTP DM: records how many messages were CREATED vs publish attempts. */
function fakeDm(publishPlan: Array<'ok' | 'fail'>) {
  const created: string[] = [];
  let publishCalls = 0;
  return {
    created,
    get publishCalls() { return publishCalls; },
    async sync() {},
    async sendOptimistic(content: string) { created.push(content); return 'msg-' + created.length; },
    async publishMessages() {
      const step = publishPlan[Math.min(publishCalls, publishPlan.length - 1)];
      publishCalls++;
      if (step === 'fail') throw new Error('network hiccup');
    },
    async send() { throw new Error('send() must not be used: it is not idempotent under retries'); },
  };
}

function fakeClient(dm: any) {
  return { inboxId: 'inbox-me', conversations: { newDmWithIdentifier: async () => dm } } as any;
}

describe('sendMessage sends exactly once', () => {
  beforeEach(() => vi.resetModules());

  it('a failed publish returns the real id at once and keeps publishing in the background, never creating a second copy', async () => {
    vi.useFakeTimers();
    try {
      const { sendMessage } = await import('@/lib/xmtp/client');
      const dm = fakeDm(['fail', 'fail', 'ok']);
      const id = await sendMessage(fakeClient(dm), PEER, 'hola');
      expect(id).toBe('msg-1');
      expect(dm.created).toEqual(['hola']); // ONE message, whatever the retries
      expect(dm.publishCalls).toBe(1); // the chat's queue is not held for more attempts
      await vi.advanceTimersByTimeAsync(1000);
      expect(dm.publishCalls).toBe(2);
      await vi.advanceTimersByTimeAsync(2000);
      expect(dm.publishCalls).toBe(3);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(dm.publishCalls).toBe(3); // confirmed: no more publishes
      expect(dm.created).toEqual(['hola']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never runs two publishes of one conversation at once (message, typing and receipts together)', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    let inFlight = 0;
    let maxInFlight = 0;
    const created: string[] = [];
    const dm = {
      async sync() {},
      async sendOptimistic(c: string) { created.push(c); return 'm' + created.length; },
      async publishMessages() {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 20));
        inFlight--;
      },
    };
    const client = fakeClient(dm);
    await Promise.all([
      sendMessage(client, PEER, 'hola'),
      sendMessage(client, PEER, '__TYPING__'),
      sendMessage(client, PEER, '__READ__x'),
    ]);
    expect(created).toHaveLength(3);
    expect(maxInFlight).toBe(1);
  });

  it('a publish that never settles does not block the conversation: the next one runs after SERIAL_WAIT_MS', async () => {
    vi.useFakeTimers();
    try {
      const { publishSerial, SERIAL_WAIT_MS } = await import('@/lib/xmtp/client');
      let calls = 0;
      const dm = {
        publishMessages() {
          calls++;
          // The first call hangs for good (a stuck WebAssembly call); later ones succeed.
          return calls === 1 ? new Promise<void>(() => {}) : Promise.resolve();
        },
      };
      publishSerial('k', dm);
      let second = false;
      publishSerial('k', dm).then(() => { second = true; });
      await vi.advanceTimersByTimeAsync(SERIAL_WAIT_MS - 1);
      expect(second).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect(calls).toBe(2);
      expect(second).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushPendingPublishes publishes waiting messages at once (network back, page visible again)', async () => {
    vi.useFakeTimers();
    try {
      const { sendMessage, flushPendingPublishes } = await import('@/lib/xmtp/client');
      const dm = fakeDm(['fail', 'ok']);
      await sendMessage(fakeClient(dm), PEER, 'offline');
      expect(dm.publishCalls).toBe(1);
      expect(await flushPendingPublishes()).toBe(1);
      expect(dm.publishCalls).toBe(2);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(dm.publishCalls).toBe(2); // the scheduled retry was cancelled by the flush
    } finally {
      vi.useRealTimers();
    }
  });

  it('a clean send creates one message and publishes once', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const dm = fakeDm(['ok']);
    expect(await sendMessage(fakeClient(dm), PEER, 'hey')).toBe('msg-1');
    expect(dm.created).toHaveLength(1);
    expect(dm.publishCalls).toBe(1);
  });

  it('when the network never confirms, the message still exists once and its id is returned', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const dm = fakeDm(['fail']);
    const id = await sendMessage(fakeClient(dm), PEER, 'offline');
    expect(dm.created).toEqual(['offline']);
    expect(id).toBe('msg-1');
  }, 20000);

  it('throws when nothing could be created at all', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const client = { inboxId: 'inbox-me', conversations: { newDmWithIdentifier: async () => { throw new Error('no route'); } } } as any;
    await expect(sendMessage(client, PEER, 'x')).rejects.toThrow(/delivery failed/);
  }, 20000);
});
