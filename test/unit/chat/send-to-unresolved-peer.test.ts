import { vi } from 'vitest';

/**
 * 24 November 2026: a chat titled "71e71fd9…8f34" showed "Not sent" under every message.
 * When the stream cannot resolve who wrote, the chat is filed under the sender's XMTP inbox id
 * (64 hex) or the conversation id (32 hex), and sendMessage handed that id to XMTP as an
 * Ethereum address. These chats now reach the same conversation.
 */
vi.mock('@xmtp/browser-sdk', () => ({
  Client: { canMessage: async () => new Map(), inboxStateFromInboxIds: async () => [] },
}));

const INBOX = '71e71fd9' + 'c'.repeat(52) + '8f34';
const CONV = 'd'.repeat(32);

function fakeDm() {
  const created: string[] = [];
  return {
    created,
    async sync() {},
    async sendOptimistic(content: string) { created.push(content); return 'msg-' + created.length; },
    async publishMessages() {},
  };
}

describe('sending in a chat keyed by an inbox id or a conversation id', () => {
  beforeEach(() => vi.resetModules());

  it('an unresolved inbox id opens the DM by inbox id, never as an Ethereum identifier', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const dm = fakeDm();
    const newDmWithIdentifier = vi.fn(async () => { throw new Error('invalid address'); });
    const newDm = vi.fn(async () => dm);
    const client = {
      inboxId: 'inbox-me',
      conversations: { newDmWithIdentifier, newDm, getDmByInboxId: async () => null, listDms: async () => [] },
    } as any;
    const id = await sendMessage(client, INBOX, 'Hola');
    expect(id).toBe('msg-1');
    expect(dm.created).toEqual(['Hola']);
    expect(newDm).toHaveBeenCalledWith(INBOX);
    expect(newDmWithIdentifier).not.toHaveBeenCalled();
  });

  it('a conversation id sends into that conversation', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const dm = fakeDm();
    const client = {
      inboxId: 'inbox-me',
      conversations: { newDmWithIdentifier: vi.fn(), getConversationById: async (cid: string) => (cid === CONV ? dm : null), sync: async () => {} },
    } as any;
    expect(await sendMessage(client, CONV, 'Jsjs')).toBe('msg-1');
    expect(client.conversations.newDmWithIdentifier).not.toHaveBeenCalled();
  });

  it('anything else fails with a sentence a person can act on', async () => {
    const { sendMessage } = await import('@/lib/xmtp/client');
    const client = { inboxId: 'inbox-me', conversations: {} } as any;
    await expect(sendMessage(client, 'not-a-peer', 'x')).rejects.toThrow(/Start a new chat with their address/);
  });
});
