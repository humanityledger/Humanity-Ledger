import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@xmtp/browser-sdk', () => ({
  Client: { canMessage: async (ids: { identifier: string }[]) => new Map(ids.map((i) => [i.identifier, true])) },
}));

const ME = '0x1111111111111111111111111111111111111111';
const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BLOCKED = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('scanDmsForActivity and forgetResolvedPeer', () => {
  beforeEach(() => vi.resetModules());

  it('discovers and syncs deleted/non-visible DMs so new BigInt-timestamped messages revive the conversation', async () => {
    const { scanDmsForActivity, discoverNewPeers, forgetResolvedPeer } = await import('@/lib/xmtp/client');
    let dmSynced = false;
    const aliceDm = {
      id: 'dm-alice-id',
      members: async () => [
        { inboxId: 'me-inbox', accountAddresses: [ME] },
        { inboxId: 'alice-inbox', accountAddresses: [ALICE] },
      ],
      sync: async () => { dmSynced = true; },
      messages: async () => [
        {
          id: 'm1',
          senderInboxId: 'alice-inbox',
          content: 'hola despues de borrar',
          sentAtNs: BigInt('1750000005000000000'),
        },
      ],
    };
    const blockedDm = {
      id: 'dm-blocked-id',
      members: async () => [
        { inboxId: 'me-inbox', accountAddresses: [ME] },
        { inboxId: 'blocked-inbox', accountAddresses: [BLOCKED] },
      ],
      sync: async () => {},
      messages: async () => [{ id: 'mb', senderInboxId: 'blocked-inbox', content: 'spam', sentAtNs: BigInt('1750000005000000000') }],
    };
    const client = {
      inboxId: 'me-inbox',
      accountAddress: ME,
      conversations: {
        sync: async () => {},
        syncAll: async () => {},
        listDms: async () => [aliceDm, blockedDm],
      },
    } as any;

    const known = new Set<string>();
    const discovered = await discoverNewPeers(client, ME, known);
    expect(discovered).toContain(ALICE);

    // User deletes ALICE: even if forgotten locally, scanDmsForActivity checks non-visible DMs
    forgetResolvedPeer(client, ALICE);
    const entries = await scanDmsForActivity(client, ME, {
      visiblePeers: new Set<string>(), // ALICE was deleted so not in visible list
      blockedPeers: new Set([BLOCKED]),
      fullSync: true,
    });

    expect(dmSynced).toBe(true);
    expect(entries).toHaveLength(1);
    expect(entries[0].peerAddress).toBe(ALICE);
    expect(entries[0].messages).toHaveLength(1);
    expect(entries[0].messages[0].content).toBe('hola despues de borrar');
  });

  it('requests Unknown and Allowed consentStates on streamMessages so revived DMs never stall', async () => {
    const { streamMessages } = await import('@/lib/xmtp/client');
    let capturedOpts: any = null;
    const ctrl = new AbortController();
    const client = {
      inboxId: 'me-inbox',
      conversations: {
        sync: async () => {},
        streamAllMessages: async (opts: any) => {
          capturedOpts = opts;
          return {
            async *[Symbol.asyncIterator]() {
              yield { id: 'm-live', senderInboxId: 'alice-inbox', content: 'ping', sentAtNs: BigInt(1000) };
            },
            return: async () => {},
          };
        },
      },
    } as any;

    const out: any[] = [];
    for await (const m of streamMessages(client, ctrl.signal)) {
      out.push(m);
    }
    expect(out).toHaveLength(1);
    expect(capturedOpts?.consentStates).toEqual([0, 1]);
  });
});
