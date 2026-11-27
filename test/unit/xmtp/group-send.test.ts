import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const GID = 'group-id-0123456789abcdef';
const ADDR_A = '0x1111111111111111111111111111111111111111';
const ADDR_B = '0x2222222222222222222222222222222222222222';

function makeGroup(overrides: Record<string, any> = {}) {
  const storedMsgs: Array<{ id: string; content: string; deliveryStatus: string | number; senderInboxId: string; sentAtNs: bigint }> = [];
  const state = {
    consent: 1,
    active: true,
    syncs: 0,
    publishes: 0,
    optimisticCalls: 0,
    sendCalls: 0,
  };
  const group: any = {
    id: GID,
    name: 'Test Group',
    state,
    storedMsgs,
    async consentState() { return state.consent; },
    async updateConsentState(v: number) { state.consent = v; },
    async isActive() { return state.active; },
    async sync() { state.syncs++; },
    async messages() { return [...storedMsgs]; },
    async sendOptimistic(content: string) {
      state.optimisticCalls++;
      const id = `msg-${state.optimisticCalls}`;
      storedMsgs.push({ id, content, deliveryStatus: 'unpublished', senderInboxId: 'inbox-a', sentAtNs: BigInt(Date.now()) * 1_000_000n });
      return id;
    },
    async publishMessages() {
      state.publishes++;
      for (const m of storedMsgs) m.deliveryStatus = 'published';
    },
    async send(content: string) {
      state.sendCalls++;
      const id = `direct-${state.sendCalls}`;
      storedMsgs.push({ id, content, deliveryStatus: 'published', senderInboxId: 'inbox-a', sentAtNs: BigInt(Date.now()) * 1_000_000n });
      return id;
    },
    ...overrides,
  };
  return group;
}

describe('sendGroupMessage and getGroupMessages reliability', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sends optimistically, updates non-allowed consent to Allowed (1), and returns msgId', async () => {
    const { sendGroupMessage } = await import('@/lib/xmtp/groups');
    const group = makeGroup();
    group.state.consent = 0; // Unknown
    const client = { conversations: { getConversationById: async () => group } } as any;

    const id = await sendGroupMessage(client, GID, 'hello world');
    expect(id).toBe('msg-1');
    expect(group.state.consent).toBe(1);
    expect(group.state.optimisticCalls).toBe(1);
    expect(group.state.publishes).toBe(1);
  });

  it('resolves a group missing locally by syncing welcomes (syncAll([0, 1])) before failing', async () => {
    const { sendGroupMessage } = await import('@/lib/xmtp/groups');
    const group = makeGroup();
    let synced = false;
    const syncAll = vi.fn(async () => { synced = true; return { numEligible: 1, numSynced: 1 }; });
    const client = {
      conversations: {
        syncAll,
        getConversationById: async (id: string) => (synced && id === GID ? group : undefined),
      },
    } as any;

    expect(await sendGroupMessage(client, GID, 'from new device')).toBe('msg-1');
    expect(syncAll).toHaveBeenCalledWith([0, 1]);
  });

  it('throws clear access guidance when group is still missing after welcome sync', async () => {
    const { sendGroupMessage } = await import('@/lib/xmtp/groups');
    const client = {
      conversations: {
        syncAll: vi.fn(async () => {}),
        getConversationById: async () => undefined,
        listGroups: async () => [],
      },
    } as any;

    await expect(sendGroupMessage(client, GID, 'hello')).rejects.toThrow(
      /Not sent\. This device has not received access to the encrypted group yet/
    );
  });

  it('recovers an inactive optimistic group via sync+publishMessages, and rejects truly removed members', async () => {
    const { sendGroupMessage } = await import('@/lib/xmtp/groups');
    // Case 1: becomes active after publishMessages commits optimistic group creation
    const optimistic = makeGroup();
    optimistic.state.active = false;
    optimistic.publishMessages = async () => {
      optimistic.state.publishes++;
      optimistic.state.active = true;
      for (const m of optimistic.storedMsgs) m.deliveryStatus = 'published';
    };
    const client1 = { conversations: { getConversationById: async () => optimistic, sync: async () => {} } } as any;
    expect(await sendGroupMessage(client1, GID, 'first post')).toBe('msg-1');

    // Case 2: stays inactive after sync + publish -> user was removed
    vi.resetModules();
    const { sendGroupMessage: sendAgain } = await import('@/lib/xmtp/groups');
    const removed = makeGroup();
    removed.state.active = false;
    const client2 = { conversations: { getConversationById: async () => removed, sync: async () => {} } } as any;
    await expect(sendAgain(client2, GID, 'hi')).rejects.toThrow('Not sent. You are no longer a member of this encrypted group.');
  });

  it('retries transient errors without calling sendOptimistic twice, and recovers from SyncFailedToWait', async () => {
    vi.useFakeTimers();
    const { sendGroupMessage } = await import('@/lib/xmtp/groups');
    const group = makeGroup();
    let tries = 0;
    group.publishMessages = async () => {
      tries++;
      group.state.publishes++;
      if (tries === 1) throw new Error('ProcessIntentLockUnavailable');
      if (tries === 2) throw new Error('synced 1 messages, 0 failed 1 succeeded from cursor Some(Cursor { originator_id: 10 })');
      for (const m of group.storedMsgs) m.deliveryStatus = 'published';
    };
    const client = { conversations: { getConversationById: async () => group, sync: async () => {} } } as any;

    const p = sendGroupMessage(client, GID, 'hello');
    await vi.runAllTimersAsync();
    expect(await p).toBe('msg-1');
    expect(group.state.optimisticCalls).toBe(1);
    expect(tries).toBe(3);
  });

  it('resolves SyncFailedToWait via background publish rather than marking the post failed', async () => {
    const { sendGroupMessage } = await import('@/lib/xmtp/groups');
    const group = makeGroup();
    group.publishMessages = async () => {
      group.state.publishes++;
      throw new Error('SyncFailedToWait');
    };
    const client = { conversations: { getConversationById: async () => group, sync: async () => {} } } as any;

    expect(await sendGroupMessage(client, GID, 'eventually consistent')).toBe('msg-1');
    expect(group.state.optimisticCalls).toBe(1);
  });

  it('hides failed local messages in getGroupMessages and reuses the pending queue on manual Retry without duplicating', async () => {
    vi.useFakeTimers();
    const { sendGroupMessage, getGroupMessages } = await import('@/lib/xmtp/groups');
    const group = makeGroup();
    let fail = true;
    group.publishMessages = async () => {
      group.state.publishes++;
      if (fail) throw new Error('connection refused');
      for (const m of group.storedMsgs) m.deliveryStatus = 'published';
    };
    const client = { conversations: { getConversationById: async () => group, sync: async () => {} } } as any;

    const first = expect(sendGroupMessage(client, GID, 'important post')).rejects.toThrow(
      'Not sent. Could not reach the encrypted group. Check your connection and try again.'
    );
    await vi.runAllTimersAsync();
    await first;

    // Must not appear as delivered while failed, AND SDK string 'failed' + numeric 2 messages are filtered out.
    group.storedMsgs.push(
      { id: 'sdk-str-fail', content: 'x', deliveryStatus: 'failed', senderInboxId: 'inbox-a', sentAtNs: 1n },
      { id: 'wasm-num-fail', content: 'y', deliveryStatus: 2, senderInboxId: 'inbox-a', sentAtNs: 2n },
      { id: 'good-post', content: 'ok', deliveryStatus: 'published', senderInboxId: 'inbox-a', sentAtNs: 3n },
    );
    const read = await getGroupMessages(client, GID);
    expect(read.map((m) => m.id)).toEqual(['good-post']);

    // Now connection recovers and user clicks "Try again" with the same text -> zero duplicate sendOptimistic calls!
    fail = false;
    expect(await sendGroupMessage(client, GID, 'important post')).toBe('msg-1');
    expect(group.state.optimisticCalls).toBe(1);
  });

  it('surfaces version pause clearly and validates post length', async () => {
    const { sendGroupMessage } = await import('@/lib/xmtp/groups');
    const group = makeGroup({
      publishMessages: async () => { throw new Error('Group is paused until version 2.0.0 is available'); },
    });
    const client = { conversations: { getConversationById: async () => group, sync: async () => {} } } as any;

    await expect(sendGroupMessage(client, GID, 'x'.repeat(10_001))).rejects.toThrow(/too long/);
    await expect(sendGroupMessage(client, GID, 'hi')).rejects.toThrow(
      'Not sent. This encrypted group needs a newer app version. Reload the page and try again.'
    );
  });

  it('serializes concurrent group WASM operations via runGroupSerial', async () => {
    const { sendGroupMessage, getGroupMessages } = await import('@/lib/xmtp/groups');
    let inFlight = 0;
    let maxConcurrent = 0;
    const group = makeGroup();
    const origSync = group.sync.bind(group);
    group.sync = async () => {
      inFlight++;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight--;
      return origSync();
    };
    const origPub = group.publishMessages.bind(group);
    group.publishMessages = async () => {
      inFlight++;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight--;
      return origPub();
    };
    const client = { conversations: { getConversationById: async () => group, sync: async () => {} } } as any;

    await Promise.all([
      sendGroupMessage(client, GID, 'msg one'),
      getGroupMessages(client, GID),
      sendGroupMessage(client, GID, 'msg two'),
    ]);
    expect(maxConcurrent).toBe(1);
  });
});

describe('MLS membership and linked-device installation sync', () => {
  beforeEach(() => vi.resetModules());

  it('welcomes new valid installations (even for non-admin members) and skips expired ones', async () => {
    const { addMissingMembers, syncGroupMembers } = await import('@/lib/communities/mls');
    const addMembers = vi.fn(async () => {});
    const group: any = {
      id: GID,
      sync: async () => {},
      members: async () => [
        { inboxId: 'INBOX-A', installationIds: ['0xinst1'], accountIdentifiers: [{ identifier: ADDR_A }] },
        { inboxId: 'inbox-b', installationIds: ['inst-b1'], accountIdentifiers: [{ identifier: ADDR_B }] },
      ],
      addMembersByIdentifiers: vi.fn(async () => {}),
      removeMembersByIdentifiers: vi.fn(async () => {}),
      addMembers,
    };
    const client: any = {
      inboxId: 'INBOX-A',
      conversations: { getConversationById: async () => group },
      getKeyPackageStatusesForInstallationIds: vi.fn(async () => new Map([
        ['inst2', { lifetime: { notBefore: 1n, notAfter: 9999n } }], // valid new device for A!
        ['inst-b-expired', { validationError: 'expired key package' }], // dead browser install for B
      ])),
      preferences: {
        inboxStateFromInboxIds: vi.fn(async () => [
          { inboxId: 'inbox-a', installations: [{ id: 'INST1' }, { id: 'inst2' }] },
          { inboxId: 'inbox-b', installations: [{ id: 'inst-b1' }, { id: 'inst-b-expired' }] },
        ]),
      },
    };
    const community = {
      ownerAddress: ADDR_A,
      members: [{ walletAddress: ADDR_A, role: 'ADMIN' }, { walletAddress: ADDR_B, role: 'MEMBER' }],
    };

    // Regular member opening on their phone also welcomes their own newly linked device.
    await addMissingMembers(client, GID, community, ADDR_B);
    expect(addMembers).toHaveBeenCalledWith(['INBOX-A']);

    addMembers.mockClear();
    // Admin sync welds valid new installations and skips expired legacy ones without throwing.
    await syncGroupMembers(client, GID, community, ADDR_A);
    expect(addMembers).toHaveBeenCalledWith(['INBOX-A']);
    expect(addMembers).not.toHaveBeenCalledWith(expect.arrayContaining(['inbox-b']));
  });

  it('per-member fallback in syncGroupMembers completes without deadlocking', async () => {
    const { syncGroupMembers } = await import('@/lib/communities/mls');
    const batchAdd = vi.fn(async () => { throw new Error('one bad inbox'); });
    const singleAdd = vi.fn(async (ids: { identifier: string }[]) => {
      if (ids[0].identifier === ADDR_B.toLowerCase()) throw new Error('not registered');
    });
    const addrC = '0x3333333333333333333333333333333333333333';
    let firstBatch = true;
    const group: any = {
      id: GID,
      sync: async () => {},
      members: async () => [{ inboxId: 'inbox-a', installationIds: ['i1'], accountIdentifiers: [{ identifier: ADDR_A }] }],
      addMembersByIdentifiers: async (ids: { identifier: string }[]) => {
        if (firstBatch && ids.length > 1) { firstBatch = false; return batchAdd(); }
        return singleAdd(ids);
      },
      removeMembersByIdentifiers: async () => {},
    };
    const client: any = { inboxId: 'inbox-a', conversations: { getConversationById: async () => group } };
    const community = {
      ownerAddress: ADDR_A,
      _count: { members: 3 },
      members: [
        { walletAddress: ADDR_A, role: 'ADMIN' },
        { walletAddress: ADDR_B, role: 'MEMBER' },
        { walletAddress: addrC, role: 'MEMBER' },
      ],
    };

    const res = await syncGroupMembers(client, GID, community, ADDR_A);
    expect(res.added).toBe(1); // addrC succeeded even though ADDR_B failed
  });

  it('retries sendOptimistic after syncAll + group sync when a newly welcomed member hits stale epoch', async () => {
    const { sendGroupMessage } = await import('@/lib/xmtp/groups');
    let prepAttempt = 0;
    const syncAll = vi.fn(async () => {});
    const group: any = {
      id: GID,
      consentState: async () => 0,
      updateConsentState: vi.fn(async () => {}),
      isActive: async () => true,
      sync: vi.fn(async () => {}),
      sendOptimistic: vi.fn(async () => {
        prepAttempt++;
        if (prepAttempt === 1) throw new Error('WrongEpoch');
        return 'msg-recovered';
      }),
      publishMessages: vi.fn(async () => {}),
      send: vi.fn(async () => 'fallback-should-not-run'),
      messages: async () => [],
    };
    const client: any = { conversations: { getConversationById: async () => group, syncAll } };

    expect(await sendGroupMessage(client, GID, 'member post')).toBe('msg-recovered');
    expect(group.updateConsentState).toHaveBeenCalledWith(1);
    expect(syncAll).toHaveBeenCalledWith([0, 1]);
    expect(group.send).not.toHaveBeenCalled();
  });

  it('createChannelGroup falls back to creator-only + individual member adds when one member lacks XMTP', async () => {
    const { createChannelGroup } = await import('@/lib/communities/mls');
    const addrC = '0x3333333333333333333333333333333333333333';
    const addedIndividual: string[] = [];
    const createdGroup: any = {
      id: '00112233445566778899aabbccddeeff',
      consentState: async () => 1,
      isActive: async () => true,
      sync: async () => {},
      publishMessages: async () => {},
      members: async () => [],
      addMembersByIdentifiers: vi.fn(async (ids: { identifier: string }[]) => {
        const addr = ids[0].identifier.toLowerCase();
        if (addr === ADDR_B.toLowerCase()) throw new Error('not registered');
        addedIndividual.push(addr);
      }),
    };
    const client: any = {
      inboxId: 'inbox-a',
      conversations: {
        newGroupWithIdentifiers: vi.fn(async () => { throw new Error('one bad address'); }),
        newGroupOptimistic: vi.fn(async () => createdGroup),
        getConversationById: vi.fn(async () => createdGroup),
      },
    };
    const community = {
      ownerAddress: ADDR_A,
      communityMls: true,
      members: [
        { walletAddress: ADDR_A, role: 'ADMIN' },
        { walletAddress: ADDR_B, role: 'MEMBER' },
        { walletAddress: addrC, role: 'MEMBER' },
      ],
    };

    const gid = await createChannelGroup(client, community, 'announcements', ADDR_A);
    expect(gid).toBe('00112233445566778899aabbccddeeff');
    expect(addedIndividual).toEqual([addrC.toLowerCase()]);
  });
});
