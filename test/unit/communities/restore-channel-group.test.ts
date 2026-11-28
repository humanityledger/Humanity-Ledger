import fs from 'node:fs';
import { vi } from 'vitest';
import { untranslated } from '../../helpers/untranslated';

/**
 * 28 Nov 2026 (iPhone, community "LOL", 2 members): every member's post failed with "This device
 * has not received access to the encrypted group yet". The channel's group was created on one
 * device only (newGroupOptimistic) and that device no longer had it, so nobody could post or add
 * anyone. The owner or an admin can now restore the channel: a new group with every member,
 * swapped in on the server with a compare-and-set.
 */
const OLD = 'a'.repeat(32);
const NEW = 'c'.repeat(32);
const OTHER = 'd'.repeat(32);
const ME = '0x' + '1'.repeat(40);
const PEER = '0x' + '2'.repeat(40);

function community() {
  return {
    id: 'comm1', name: 'LOL', ownerAddress: ME, communityMls: true,
    members: [{ walletAddress: ME, role: 'ADMIN' }, { walletAddress: PEER, role: 'MEMBER' }],
    channels: [{ id: 'ch1', name: 'general', xmtpGroupId: OLD }],
  };
}

function fakeClient(opts: { hasOld?: boolean } = {}) {
  const created: Array<{ ids: unknown[] }> = [];
  const groups = new Map<string, any>();
  const mk = (id: string) => ({
    id, sync: async () => {}, members: async () => [], isSuperAdmin: async () => false, publishMessages: async () => {},
  });
  if (opts.hasOld) groups.set(OLD, mk(OLD));
  const client = {
    inboxId: 'inbox-me',
    conversations: {
      getConversationById: async (id: string) => groups.get(id) ?? null,
      sync: async () => {},
      syncAll: async () => {},
      listGroups: async () => [...groups.values()],
      newGroupWithIdentifiers: async (ids: unknown[]) => { created.push({ ids }); const g = mk(NEW); groups.set(NEW, g); return g; },
    },
  };
  return { client, created };
}

function fakeFetch(patchStatus = 200, patchBody: unknown = { ok: true, xmtpGroupId: NEW }) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (init?.method === 'PATCH') return new Response(JSON.stringify(patchBody), { status: patchStatus });
    return new Response(JSON.stringify({ community: community() }), { status: 200 });
  });
  return { f: f as unknown as typeof fetch, calls };
}

describe('restoreChannelGroup', () => {
  it('a channel still reachable on this device is left as it is', async () => {
    const { restoreChannelGroup } = await import('@/lib/communities/mls');
    const { client, created } = fakeClient({ hasOld: true });
    const { f, calls } = fakeFetch();
    const r = await restoreChannelGroup({ client, communityId: 'comm1', oldGroupId: OLD, me: ME, headers: {}, fetchImpl: f });
    expect(r).toEqual({ ok: true, groupId: OLD, restored: false });
    expect(created).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('an unreachable channel gets a new group with every other member, swapped in on the old id', async () => {
    const { restoreChannelGroup } = await import('@/lib/communities/mls');
    const { client, created } = fakeClient();
    const { f, calls } = fakeFetch();
    const r = await restoreChannelGroup({ client, communityId: 'comm1', oldGroupId: OLD, me: ME, headers: { 'x-web3-address': ME }, fetchImpl: f });
    expect(r).toEqual({ ok: true, groupId: NEW, restored: true });
    expect(created).toHaveLength(1);
    expect(JSON.stringify(created[0].ids).toLowerCase()).toContain(PEER);
    expect(JSON.stringify(created[0].ids).toLowerCase()).not.toContain(ME);
    const patch = calls.find((c) => c.init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({
      action: 'REPLACE_CHANNEL_GROUP', communityId: 'comm1', channelId: 'ch1', expectedXmtpGroupId: OLD, xmtpGroupId: NEW,
    });
  });

  it('another admin restored it first: their group is used', async () => {
    const { restoreChannelGroup } = await import('@/lib/communities/mls');
    const { client } = fakeClient();
    const { f } = fakeFetch(409, { code: 'CHANNEL_GROUP_CHANGED', xmtpGroupId: OTHER });
    const r = await restoreChannelGroup({ client, communityId: 'comm1', oldGroupId: OLD, me: ME, headers: {}, fetchImpl: f });
    expect(r).toEqual({ ok: true, groupId: OTHER, restored: false });
  });

  it('the server refuses (not an admin): an error, nothing claimed', async () => {
    const { restoreChannelGroup } = await import('@/lib/communities/mls');
    const { client } = fakeClient();
    const { f } = fakeFetch(403, { error: 'Only admins can change these settings.' });
    const r = await restoreChannelGroup({ client, communityId: 'comm1', oldGroupId: OLD, me: ME, headers: {}, fetchImpl: f });
    expect(r).toEqual({ ok: false, error: 'Only admins can change these settings.' });
  });
});

describe('wiring', () => {
  it('the send error is coded, and a new community group is published before its id is returned', () => {
    const groups = fs.readFileSync('lib/xmtp/groups.ts', 'utf8');
    expect(groups).toContain('{ code: GROUP_NOT_REACHABLE }');
    expect(groups).not.toContain('void runGroupSerial(group.id, async () => {');
  });

  it('the server swaps the group only from the old id, in the admin-only section', () => {
    const route = fs.readFileSync('app/api/chat/communities/route.ts', 'utf8');
    const at = route.indexOf("action === 'REPLACE_CHANNEL_GROUP'");
    expect(at).toBeGreaterThan(route.indexOf("Only admins can change these settings."));
    expect(route.slice(at, at + 2500)).toMatch(/updateMany\(\{\s*where: \{ id: channelId, communityId, xmtpGroupId: expected \}/);
    expect(route.slice(at, at + 2500)).toContain("status: 409");
  });

  it('the reader offers the restore to the owner or an admin only', () => {
    const reader = untranslated(fs.readFileSync('components/communities/CommunityReader.tsx', 'utf8'));
    expect(reader).toContain("const canRestore = myRank === 'OWNER' || myRank === 'ADMIN';");
    expect(reader).toMatch(/p\.unreachable && canRestore &&/);
    expect(reader).toContain('Restore the channel');
  });
});
