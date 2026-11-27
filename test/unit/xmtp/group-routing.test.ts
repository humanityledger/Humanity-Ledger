import fs from 'node:fs';
import {
  classifyStreamConversation,
  isGroupConversation,
  isXmtpConversationId,
  loadCachedCommunityGroupIds,
  saveCachedCommunityGroupIds,
} from '@/lib/xmtp/group-routing';

/** 27 Nov 2026: the module PR #318 imported but never committed (Railway build: Module not found). */
const GID = 'a'.repeat(32);
const DMID = 'b'.repeat(32);
const base = {
  client: null,
  standaloneGroupIds: new Set<string>(),
  communityGroupIds: new Set<string>(),
  visibleGroupIds: new Set<string>(),
  knownDmConvoIds: new Set<string>(),
};

function mem(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } } as unknown as Storage;
}

describe('group-routing', () => {
  it('every name LedgerChatV2 imports from it exists', () => {
    const src = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    const m = /import \{([^}]+)\} from '@\/lib\/xmtp\/group-routing'/.exec(src);
    expect(m).toBeTruthy();
    const mod = { classifyStreamConversation, isGroupConversation, isXmtpConversationId, loadCachedCommunityGroupIds, saveCachedCommunityGroupIds } as Record<string, unknown>;
    for (const name of m![1].split(',').map((s) => s.trim()).filter(Boolean)) expect(typeof mod[name]).toBe('function');
  });

  it('conversation ids and group handles', () => {
    expect(isXmtpConversationId(GID)).toBe(true);
    expect(isXmtpConversationId('0x' + 'a'.repeat(40))).toBe(false);
    expect(isXmtpConversationId(null)).toBe(false);
    expect(isGroupConversation({ metadata: { conversationType: 'group' } })).toBe(true);
    expect(isGroupConversation({ addMembersByIdentifiers() {} })).toBe(true);
    expect(isGroupConversation({ peerInboxId() {}, addMembers() {} })).toBe(false);
    expect(isGroupConversation(null)).toBe(false);
  });

  it('a community channel post is skipped (stays in the community reader)', async () => {
    expect(await classifyStreamConversation({ ...base, convoId: GID, communityGroupIds: new Set([GID]) })).toEqual({ kind: 'skip', reason: 'community' });
  });

  it('a new group found to be a community channel after a refresh is skipped', async () => {
    const r = await classifyStreamConversation({
      ...base, convoId: GID, msgConversation: { metadata: { conversationType: 'group' } },
      refreshCommunityGroupIds: async () => new Set([GID]),
    });
    expect(r.kind).toBe('skip');
  });

  it('a standalone group routes to its thread, with its name', async () => {
    const r = await classifyStreamConversation({ ...base, convoId: GID.toUpperCase(), msgConversation: { name: ' Amigos ', addMembers() {} } });
    expect(r).toEqual({ kind: 'group', groupId: GID, groupName: 'Amigos' });
    const known = await classifyStreamConversation({ ...base, convoId: GID, standaloneGroupIds: new Set([GID]), refreshCommunityGroupIds: async () => { throw new Error('not called'); } });
    expect(known.kind).toBe('group');
  });

  it('looks the conversation up when the stream does not say, and never skips a DM', async () => {
    const dm = { peerInboxId: async () => 'them' };
    const client = { conversations: { getConversationById: async (id: string) => (id === DMID ? dm : { addMembers() {} }) } };
    expect(await classifyStreamConversation({ ...base, client, convoId: DMID })).toEqual({ kind: 'dm', dmConvo: dm });
    expect((await classifyStreamConversation({ ...base, client, convoId: GID })).kind).toBe('group');
    const broken = { conversations: { getConversationById: async () => { throw new Error('worker'); } } };
    expect(await classifyStreamConversation({ ...base, client: broken, convoId: DMID })).toEqual({ kind: 'dm' });
    expect(await classifyStreamConversation({ ...base, client, convoId: DMID, knownDmConvoIds: new Set([DMID]) })).toEqual({ kind: 'dm' });
  });

  it('community ids are cached per account', () => {
    const s = mem();
    saveCachedCommunityGroupIds('0xABC', new Set([GID, 'not-an-id']), s);
    expect([...loadCachedCommunityGroupIds('0xabc', s)]).toEqual([GID]);
    expect(loadCachedCommunityGroupIds('0xother', s).size).toBe(0);
    expect(loadCachedCommunityGroupIds(null, s).size).toBe(0);
  });
});
