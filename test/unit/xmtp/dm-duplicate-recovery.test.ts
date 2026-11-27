import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@xmtp/browser-sdk', () => ({
  Client: { canMessage: async (ids: { identifier: string }[]) => new Map(ids.map((i) => [i.identifier, true])) },
}));

const SELF_ADDR = '0x1111111111111111111111111111111111111111';
const PEER_ADDR = '0x2222222222222222222222222222222222222222';
const SELF_INBOX = 'a'.repeat(64);
const PEER_INBOX = 'b'.repeat(64);

describe('wallet-to-wallet DM recovery across duplicates and signals', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getMessages merges duplicate DMs sorted by timestamp and deduplicated by id', async () => {
    const { getMessages } = await import('@/lib/xmtp/client');

    const dupDm = {
      id: 'dm-dup',
      sync: vi.fn(async () => {}),
      messages: vi.fn(async () => [
        { id: 'm2', senderInboxId: PEER_INBOX, content: 'from-duplicate', sentAtNs: 200n },
        { id: 'm1', senderInboxId: SELF_INBOX, content: 'already-present', sentAtNs: 100n },
      ]),
    };

    const primaryDm = {
      id: 'dm-primary',
      sync: vi.fn(async () => {}),
      messages: vi.fn(async () => [
        { id: 'm1', senderInboxId: SELF_INBOX, content: 'already-present', sentAtNs: 100n },
        { id: 'm3', senderInboxId: PEER_INBOX, content: 'from-primary', sentAtNs: 300n },
      ]),
      getDuplicateDms: vi.fn(async () => [dupDm]),
    };

    const client: any = {
      inboxId: SELF_INBOX,
      accountAddress: SELF_ADDR,
      findInboxIdByIdentifier: vi.fn(async () => PEER_INBOX),
      conversations: {
        sync: vi.fn(async () => {}),
        getDmByInboxId: vi.fn(async () => primaryDm),
        listDms: vi.fn(async () => [primaryDm]),
      },
    };

    const msgs = await getMessages(client, PEER_ADDR);
    expect(dupDm.sync).toHaveBeenCalledTimes(1);
    expect(msgs.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('getMessages syncs welcomes when no DM exists locally yet', async () => {
    const { getMessages } = await import('@/lib/xmtp/client');

    let synced = false;
    const incomingDm = {
      id: 'dm-welcomed',
      sync: vi.fn(async () => {}),
      messages: vi.fn(async () => [
        { id: 'w1', senderInboxId: PEER_INBOX, content: 'hello after welcome', sentAtNs: 500n },
      ]),
    };

    const client: any = {
      inboxId: SELF_INBOX,
      accountAddress: SELF_ADDR,
      findInboxIdByIdentifier: vi.fn(async () => PEER_INBOX),
      conversations: {
        syncAll: vi.fn(async () => { synced = true; }),
        sync: vi.fn(async () => { synced = true; }),
        getDmByInboxId: vi.fn(async () => (synced ? incomingDm : null)),
        listDms: vi.fn(async () => (synced ? [incomingDm] : [])),
      },
    };

    const msgs = await getMessages(client, PEER_ADDR);
    expect(synced).toBe(true);
    expect(msgs.map((m) => m.id)).toEqual(['w1']);
  });

  it('scanDmsForActivity requests duplicate DMs and recovers real message masked by __READ__/__TYPING__', async () => {
    const { scanDmsForActivity } = await import('@/lib/xmtp/client');

    const dm = {
      id: 'dm-bob',
      peerInboxId: PEER_INBOX,
      members: async () => [{ inboxId: PEER_INBOX }],
      lastMessage: vi.fn(async () => ({
        id: 'sig-1',
        senderInboxId: PEER_INBOX,
        content: '__READ__msg-real',
        sentAtNs: 2000n,
      })),
      messages: vi.fn(async () => [
        { id: 'msg-real', senderInboxId: PEER_INBOX, content: 'hola wallet', sentAtNs: 1000n },
        { id: 'sig-1', senderInboxId: PEER_INBOX, content: '__READ__msg-real', sentAtNs: 2000n },
      ]),
    };

    const listDms = vi.fn(async () => [dm]);
    const client: any = {
      inboxId: SELF_INBOX,
      accountAddress: SELF_ADDR,
      preferences: {
        inboxStateFromInboxIds: vi.fn(async () => [
          { inboxId: PEER_INBOX, identifiers: [{ identifierKind: 'Ethereum', identifier: PEER_ADDR }] },
        ]),
      },
      conversations: {
        syncAll: vi.fn(async () => {}),
        sync: vi.fn(async () => {}),
        listDms,
      },
    };

    const entries = await scanDmsForActivity(client, SELF_ADDR, {
      visiblePeers: new Set([PEER_ADDR]),
      fullSync: true,
    });

    expect(listDms).toHaveBeenCalledWith({ includeDuplicateDms: true });
    expect(entries).toHaveLength(1);
    expect(entries[0].lastMessage?.content).toBe('hola wallet');
  });
});
