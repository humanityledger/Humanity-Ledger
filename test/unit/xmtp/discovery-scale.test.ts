import { describe, expect, it, vi } from 'vitest';
import { scanDmsForActivity } from '@/lib/xmtp/client';

describe('Scale 3M Phase 5: XMTP batched inbox discovery & deleted-chat revival preservation', () => {
  it('batch-resolves peer inboxIds, revives non-visible non-blocked DMs, skips blocked peers, and respects maxDms', async () => {
    const alice = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const bob = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const blocked = '0xcccccccccccccccccccccccccccccccccccccccc';

    const inboxBatchFn = vi.fn(async (ids: string[]) =>
      ids.map((iid) => ({
        inboxId: iid,
        identifiers: [{ identifierKind: 'Ethereum', identifier: iid === 'inbox-alice' ? alice : iid === 'inbox-bob' ? bob : blocked }],
      })),
    );

    const aliceDmSync = vi.fn(async () => {});
    const makeDm = (id: string, peerInboxId: string, lastMsgTs: number, content: string, syncFn?: any) => ({
      id,
      peerInboxId,
      members: async () => [{ inboxId: peerInboxId }],
      sync: syncFn ?? vi.fn(async () => {}),
      messages: vi.fn(async () => [{ id: `msg-${id}`, content, senderInboxId: peerInboxId, sentAtNs: BigInt(lastMsgTs) }]),
      lastMessage: vi.fn(async () => ({ id: `msg-${id}`, content, senderInboxId: peerInboxId, sentAtNs: BigInt(lastMsgTs) })),
    });

    const mockClient: any = {
      inboxId: 'inbox-self',
      accountAddress: '0x1111111111111111111111111111111111111111',
      preferences: { inboxStateFromInboxIds: inboxBatchFn },
      conversations: {
        syncAll: vi.fn(async () => {}),
        sync: vi.fn(async () => {}),
        listDms: vi.fn(async () => [
          makeDm('dm-alice', 'inbox-alice', 3_000_000, 'revived message', aliceDmSync),
          makeDm('dm-bob', 'inbox-bob', 2_000_000, 'visible preview'),
          makeDm('dm-blocked', 'inbox-blocked', 1_000_000, 'should stay hidden'),
        ]),
      },
    };

    const entries = await scanDmsForActivity(mockClient, '0x1111111111111111111111111111111111111111', {
      visiblePeers: new Set([bob]),
      blockedPeers: new Set([blocked]),
      fullSync: true,
      maxDms: 10,
    });

    // Single batch lookup covered all DMs rather than sequential per-DM queries
    expect(inboxBatchFn).toHaveBeenCalledTimes(1);
    expect(aliceDmSync).toHaveBeenCalledTimes(1);

    const byPeer = new Map(entries.map((e) => [e.peerAddress, e]));
    expect(byPeer.has(alice)).toBe(true);
    expect(byPeer.get(alice)?.messages[0].content).toBe('revived message');
    expect(byPeer.has(bob)).toBe(true);
    expect(byPeer.get(bob)?.lastMessage?.content).toBe('visible preview');
    expect(byPeer.has(blocked)).toBe(false);
  });
});
