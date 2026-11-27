import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  classifyStreamConversation,
  isDmConversation,
  isGroupConversation,
  isXmtpConversationId,
  loadCachedCommunityGroupIds,
  saveCachedCommunityGroupIds,
} from '@/lib/xmtp/group-routing';
import {
  reconcileIncomingBatch,
  reconcileIncomingMessage,
} from '@/lib/chat/optimistic-send';
import {
  scanGroupsForActivity,
  sendMessage,
  streamGroupCreations,
} from '@/lib/xmtp/client';
import { getGroupMessages } from '@/lib/xmtp/groups';
import { checkPost, effectivePermissions } from '@/lib/communities/settings';

const root = path.resolve(__dirname, '../../..');
const readRepo = (p: string) => readFileSync(path.join(root, p), 'utf8');

const GID = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
const COMM_GID = 'f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4';
const DM_CID = '11223344556677889900aabbccddeeff';
const UNKNOWN_CID = 'deadbeefdeadbeefdeadbeefdeadbeef';
const SELF_INBOX = 'self-inbox-001';
const PEER_INBOX = 'peer-inbox-002';

describe('group routing & live sync invariants (prevent phantom wallets)', () => {
  it('routes confirmed group messages as group without falling back to senderInboxId DM lookup', async () => {
    const groupConv = {
      id: GID,
      name: 'Core Devs',
      metadata: { conversationType: 'group' },
      addMembersByIdentifiers: vi.fn(),
    };
    const client = {
      conversations: {
        getConversationById: vi.fn().mockResolvedValue(groupConv),
      },
    };

    const route = await classifyStreamConversation({
      convoId: GID.toUpperCase(),
      msgConversation: undefined,
      client,
      standaloneGroupIds: new Set(),
      communityGroupIds: new Set(),
      visibleGroupIds: new Set(),
      knownDmConvoIds: new Set(),
    });

    expect(route).toEqual({
      kind: 'group',
      groupId: GID,
      groupName: 'Core Devs',
    });
  });

  it('skips community MLS groups even when discovered lazily via refreshCommunityGroupIds', async () => {
    const commConv = {
      id: COMM_GID,
      name: 'Alpha Community',
      metadata: { conversationType: 'group' },
      addMembersByIdentifiers: vi.fn(),
    };
    const route = await classifyStreamConversation({
      convoId: COMM_GID,
      msgConversation: undefined,
      client: {
        conversations: {
          getConversationById: vi.fn().mockResolvedValue(commConv),
        },
      },
      standaloneGroupIds: new Set(),
      communityGroupIds: new Set(),
      visibleGroupIds: new Set(),
      knownDmConvoIds: new Set(),
      refreshCommunityGroupIds: async () => new Set([COMM_GID]),
    });

    expect(route).toEqual({ kind: 'skip', reason: 'community' });
  });

  it('skips device sync groups and unresolved convoIds so group speakers never spawn phantom wallet rows', async () => {
    const syncRoute = await classifyStreamConversation({
      convoId: UNKNOWN_CID,
      msgConversation: { id: UNKNOWN_CID, name: 'hl.device-sync.v1' },
      client: {},
      standaloneGroupIds: new Set(),
      communityGroupIds: new Set(),
      visibleGroupIds: new Set(),
      knownDmConvoIds: new Set(),
    });
    expect(syncRoute).toEqual({ kind: 'skip', reason: 'sync' });

    const unresolvedClient = {
      conversations: {
        getConversationById: vi.fn().mockResolvedValue(null),
        listGroups: vi.fn().mockResolvedValue([]),
        listDms: vi.fn().mockResolvedValue([]),
        syncAll: vi.fn().mockResolvedValue(undefined),
      },
    };
    const unresolvedRoute = await classifyStreamConversation({
      convoId: UNKNOWN_CID,
      msgConversation: undefined,
      client: unresolvedClient,
      standaloneGroupIds: new Set(),
      communityGroupIds: new Set(),
      visibleGroupIds: new Set(),
      knownDmConvoIds: new Set(),
    });

    expect(unresolvedRoute).toEqual({ kind: 'skip', reason: 'unresolved_group_or_conv' });
    expect(unresolvedClient.conversations.syncAll).toHaveBeenCalled();
  });

  it('recognizes DM vs Group wrappers and persists community group caches cleanly', () => {
    expect(isXmtpConversationId(GID)).toBe(true);
    expect(isXmtpConversationId('0x' + 'a'.repeat(40))).toBe(false);

    const dmWrapper = { peerInboxId: async () => PEER_INBOX, metadata: { conversationType: 'dm' } };
    const grpWrapper = { addMembersByIdentifiers: async () => {}, metadata: { conversationType: 'group' } };
    expect(isDmConversation(dmWrapper)).toBe(true);
    expect(isGroupConversation(dmWrapper)).toBe(false);
    expect(isGroupConversation(grpWrapper)).toBe(true);
    expect(isDmConversation(grpWrapper)).toBe(false);

    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    } as unknown as Storage;

    saveCachedCommunityGroupIds('0xAbCd', [COMM_GID, COMM_GID.toUpperCase()], mockStorage);
    const loaded = loadCachedCommunityGroupIds('0xabcd', mockStorage);
    expect(Array.from(loaded)).toEqual([COMM_GID]);
  });

  it('allows DM routing when convoId is known DM or omitted (legacy stream mock)', async () => {
    const routeNoConvo = await classifyStreamConversation({
      convoId: '',
      client: {},
      standaloneGroupIds: new Set(),
      communityGroupIds: new Set(),
      visibleGroupIds: new Set(),
      knownDmConvoIds: new Set(),
    });
    expect(routeNoConvo.kind).toBe('dm');

    const routeKnownDm = await classifyStreamConversation({
      convoId: DM_CID,
      client: {},
      standaloneGroupIds: new Set(),
      communityGroupIds: new Set(),
      visibleGroupIds: new Set(),
      knownDmConvoIds: new Set([DM_CID]),
    });
    expect(routeKnownDm.kind).toBe('dm');
  });
});

describe('optimistic deduplication across live stream & poll', () => {
  it('swaps optimistic message atomically on stream echo without duplicating', () => {
    const opt = {
      id: 'optimistic-100',
      clientKey: 'optimistic-100',
      conversationId: `dm-${GID}`,
      content: 'Hola grupo',
      senderInboxId: SELF_INBOX,
      sentAtNs: 1000,
      status: 'sending',
    };
    const confirmed = {
      id: 'real-msg-1',
      conversationId: `dm-${GID}`,
      content: 'Hola grupo',
      senderInboxId: SELF_INBOX,
      sentAtNs: 1005,
      status: 'sent',
    };

    const next = reconcileIncomingMessage([opt], confirmed, {
      isOwnMessage: true,
      knownOptimisticId: 'optimistic-100',
    });

    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('real-msg-1');
    expect(next[0].clientKey).toBe('optimistic-100');

    // Second arrival (e.g., reconnect/poll replay) is a no-op
    const replay = reconcileIncomingMessage(next, confirmed, { isOwnMessage: true });
    expect(replay).toHaveLength(1);
    expect(replay[0].id).toBe('real-msg-1');
  });

  it('deduplicates when poll catches own message before stream echo & leaves peer twins untouched', () => {
    const ownOpt = {
      id: 'optimistic-200',
      clientKey: 'optimistic-200',
      conversationId: `dm-${GID}`,
      content: 'Mismo texto',
      senderInboxId: SELF_INBOX,
      sentAtNs: 2000,
      status: 'sending',
    };
    const burnOpt = {
      id: 'optimistic-300',
      clientKey: 'optimistic-300',
      conversationId: `dm-${GID}`,
      content: '__BURN_60__::secreto',
      senderInboxId: SELF_INBOX,
      sentAtNs: 3000,
      status: 'sending',
    };

    // Peer sends identical text "Mismo texto": must NOT swallow our optimistic placeholder
    const afterPeer = reconcileIncomingBatch(
      [ownOpt, burnOpt],
      [{
        id: 'peer-msg-1',
        conversationId: `dm-${GID}`,
        content: 'Mismo texto',
        senderInboxId: PEER_INBOX,
        sentAtNs: 2500,
      }],
      { selfInboxId: SELF_INBOX },
    );
    expect(afterPeer.map((m) => m.id)).toEqual(['optimistic-200', 'peer-msg-1', 'optimistic-300']);

    // Poll catches both own messages
    const afterSelfPoll = reconcileIncomingBatch(
      afterPeer,
      [
        {
          id: 'self-msg-2',
          conversationId: `dm-${GID}`,
          content: 'Mismo texto',
          senderInboxId: SELF_INBOX,
          sentAtNs: 2005,
        },
        {
          id: 'self-msg-3',
          conversationId: `dm-${GID}`,
          content: 'secreto',
          senderInboxId: SELF_INBOX,
          sentAtNs: 3005,
        },
      ],
      { selfInboxId: SELF_INBOX },
    );

    expect(afterSelfPoll.map((m) => m.id)).toEqual(['self-msg-2', 'peer-msg-1', 'self-msg-3']);
    expect(afterSelfPoll.find((m) => m.id === 'self-msg-2')?.clientKey).toBe('optimistic-200');
    expect(afterSelfPoll.find((m) => m.id === 'self-msg-3')?.clientKey).toBe('optimistic-300');
  });
});

describe('non-creator member sending, group sync, & system filtering', () => {
  it('routes 32-hex group send even when openDm resolves null (member send path)', async () => {
    const sendOptimistic = vi.fn().mockResolvedValue('xmtp-msg-99');
    const publishMessages = vi.fn().mockResolvedValue(undefined);
    const groupConv = {
      id: GID,
      metadata: { conversationType: 'group' },
      consentState: vi.fn().mockResolvedValue(1),
      sendOptimistic,
      publishMessages,
      sync: vi.fn().mockResolvedValue(undefined),
      addMembersByIdentifiers: vi.fn(),
    };
    const client = {
      inboxId: PEER_INBOX,
      conversations: {
        getConversationById: vi.fn().mockResolvedValue(groupConv),
        sync: vi.fn().mockResolvedValue(undefined),
        listGroups: vi.fn().mockResolvedValue([groupConv]),
      },
    };

    const res = await sendMessage(client as any, GID, 'Mensaje de miembro');
    expect(res).toBe('xmtp-msg-99');
    expect(sendOptimistic).toHaveBeenCalledWith('Mensaje de miembro');
    expect(publishMessages).toHaveBeenCalled();
  });

  it('filters Worker numeric kind===1 & deliveryStatus===2 in scanGroupsForActivity & getGroupMessages', async () => {
    const validAppMsg = {
      id: 'app-1',
      kind: 0,
      deliveryStatus: 1,
      senderInboxId: PEER_INBOX,
      content: 'Hola a todos',
      sentAtNs: BigInt(5_000_000_000),
    };
    const membershipChangeMsg = {
      id: 'sys-1',
      kind: 1,
      deliveryStatus: 1,
      senderInboxId: PEER_INBOX,
      content: 'member added',
      sentAtNs: BigInt(6_000_000_000),
    };
    const failedMsg = {
      id: 'fail-1',
      kind: 0,
      deliveryStatus: 2,
      senderInboxId: SELF_INBOX,
      content: 'Fallo envio',
      sentAtNs: BigInt(7_000_000_000),
    };

    const activeGroup = {
      id: GID,
      name: 'Equipo',
      sync: vi.fn().mockResolvedValue(undefined),
      messages: vi.fn().mockResolvedValue([validAppMsg, membershipChangeMsg, failedMsg]),
    };
    const communityGroup = {
      id: COMM_GID,
      name: 'Comunidad MLS',
      sync: vi.fn().mockResolvedValue(undefined),
      messages: vi.fn().mockResolvedValue([validAppMsg]),
    };
    const syncGroup = {
      id: UNKNOWN_CID,
      name: 'hl.device-sync.v1',
      sync: vi.fn().mockResolvedValue(undefined),
      messages: vi.fn().mockResolvedValue([validAppMsg]),
    };

    const client = {
      inboxId: SELF_INBOX,
      conversations: {
        syncAll: vi.fn().mockResolvedValue(undefined),
        listGroups: vi.fn().mockResolvedValue([activeGroup, communityGroup, syncGroup]),
        getConversationById: vi.fn().mockResolvedValue(activeGroup),
      },
    };

    const entries = await scanGroupsForActivity(client as any, new Set([COMM_GID]), { fullSync: true });
    expect(client.conversations.syncAll).toHaveBeenCalledWith([0, 1]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      groupId: GID,
      name: 'Equipo',
      lastMessage: expect.objectContaining({
        id: 'app-1',
        content: 'Hola a todos',
      }),
    });

    const filtered = await getGroupMessages(client as any, GID);
    expect(filtered.map((m) => m.id)).toEqual(['app-1']);
  });

  it('streams non-sync group creations live and ignores sync groups', async () => {
    const ac = new AbortController();
    const yielded = [
      { id: UNKNOWN_CID, name: 'hl.device-sync.v1' },
      { id: GID, name: 'Grupo Live' },
    ];
    const client = {
      conversations: {
        streamGroups: vi.fn().mockResolvedValue({
          async *[Symbol.asyncIterator]() {
            for (const g of yielded) yield g;
          },
          return: vi.fn(),
        }),
      },
    };

    const out: string[] = [];
    for await (const g of streamGroupCreations(client, ac.signal)) {
      out.push(String(g.id));
    }
    expect(out).toEqual([GID]);
  });

  it('permits regular members to post by default and keeps live stream & dedup wiring in place', () => {
    const defaults = effectivePermissions(null);
    expect(checkPost(defaults, 'MEMBER', 'text', 'Hola comunidad', null).ok).toBe(true);

    const routeSrc = readRepo('app/api/chat/communities/[id]/route.ts');
    expect(routeSrc).toContain('myRole');

    const readerSrc = readRepo('components/communities/CommunityReader.tsx');
    expect(readerSrc).toContain('communityLoaded');
    expect(readerSrc).toContain('pendingRefetch');
    expect(readerSrc).toContain('streamAllGroupMessages');
    expect(readerSrc).toContain('const sentId = await postToGroup');

    const v2Src = readRepo('components/terminal/LedgerChatV2.tsx');
    expect(v2Src).toContain('classifyStreamConversation');
    expect(v2Src).toContain('streamGroupCreations');
    expect(v2Src).toContain('reconcileIncomingMessage');
    expect(v2Src).toContain('reconcileIncomingBatch');
    expect(v2Src).toContain('senderLabel={senderLabel}');
    expect(v2Src).toContain('!isBgGroup');
  });
});
