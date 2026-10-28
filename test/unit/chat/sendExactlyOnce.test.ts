import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  it('a failed publish is retried without creating a second copy, and returns the real id', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const dm = fakeDm(['fail', 'fail', 'ok']);
    const id = await sendMessage(fakeClient(dm), PEER, 'hola');
    expect(dm.created).toEqual(['hola']);    // ONE message, whatever the retries
    expect(dm.publishCalls).toBe(3);
    expect(id).toBe('msg-1');
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
