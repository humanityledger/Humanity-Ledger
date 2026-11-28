/**
 * Legacy communities are read-only (decision of 25 November 2026, lib/communities/legacy.ts,
 * docs/communities/LEGACY_READ_ONLY.md).
 *
 * A community made before 24 November 2026 keeps its posts on our server, which can read them.
 * From now on: no new post and no new system notice is written for it; old posts stay readable; a
 * community without an MLS group is not created; an owner or admin can re-create it on MLS once;
 * each member decides whether to follow. Nothing is deleted, moved or copied.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';
import { untranslated } from '../../helpers/untranslated';

const { db, WALLET, OTHER } = vi.hoisted(() => ({
  WALLET: '0x1111111111111111111111111111111111111111',
  OTHER: '0x2222222222222222222222222222222222222222',
  db: {
    communityPost: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    community: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    communityMember: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    communityChannel: { findFirst: vi.fn() },
    communityPermission: { findUnique: vi.fn(async () => null) },
  },
}));

vi.mock('@/lib/security/requireWallet', () => ({ requireWallet: vi.fn(async () => ({ walletAddress: WALLET })) }));
vi.mock('@/lib/security/resolveCaller', () => ({ resolveVerifiedCaller: vi.fn(async () => WALLET) }));
vi.mock('@/lib/security/rateLimiter', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock('@/lib/security/qrLogin', () => ({ setOnce: vi.fn(async () => true) }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/communities/in-memory-communities', () => ({
  getInMemoryCommunityBySlugOrId: () => null,
  listInMemoryCommunities: () => [],
}));
vi.mock('@/lib/communities/member-names', () => ({ memberNames: vi.fn(async () => new Map()) }));

import {
  canFollowSuccessor,
  canRecreate,
  isLegacyCommunity,
  legacyPostsClosed,
  legacyReadOnlyOn,
  serverStoredCreationAllowed,
} from '@/lib/communities/legacy';
import { followSuccessor, recreateOnMls } from '@/lib/communities/recreate';
import { GET as getPosts, POST as postById } from '@/app/api/chat/communities/[id]/posts/route';
import { POST as postFlat } from '@/app/api/chat/communities/posts/route';
import { POST as createCommunity } from '@/app/api/chat/communities/route';
import { POST as join } from '@/app/api/chat/communities/join/route';

const GROUP = '0123456789abcdef';
const SECRET = 'a post that must never be written for a legacy community';
const LEGACY = { id: 'old', name: 'Old', description: 'd', isPrivate: true, ownerAddress: WALLET, communityMls: false, successorId: null, joinCode: 'ABC' };

const req = (url: string, body?: unknown, method = 'POST') =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const written = () => JSON.stringify(db.communityPost.create.mock.calls);

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.COMMUNITY_LEGACY_READONLY;
  delete process.env.COMMUNITY_MLS_NEW;
  db.communityPost.create.mockResolvedValue({ id: 'p' });
  db.communityPost.findMany.mockResolvedValue([]);
});
afterEach(() => {
  delete process.env.COMMUNITY_LEGACY_READONLY;
  delete process.env.COMMUNITY_MLS_NEW;
});

describe('the rule', () => {
  it('every community not on MLS is legacy, and closed while the rule is on (the default)', () => {
    expect(isLegacyCommunity({ communityMls: false })).toBe(true);
    expect(isLegacyCommunity({})).toBe(true);
    expect(isLegacyCommunity({ communityMls: true })).toBe(false);
    expect(legacyReadOnlyOn({})).toBe(true);
    expect(legacyPostsClosed({ communityMls: false }, {})).toBe(true);
    expect(legacyPostsClosed({ communityMls: true }, {})).toBe(false);
    expect(serverStoredCreationAllowed({})).toBe(false);
  });

  it('either operator switch reopens legacy communities (rollback)', () => {
    for (const e of [{ COMMUNITY_LEGACY_READONLY: 'off' }, { COMMUNITY_MLS_NEW: 'off' }]) {
      expect(legacyReadOnlyOn(e)).toBe(false);
      expect(legacyPostsClosed({ communityMls: false }, e)).toBe(false);
      expect(serverStoredCreationAllowed(e)).toBe(true);
    }
  });

  it('only an owner or admin re-creates, only a legacy community, only once', () => {
    expect(canRecreate(null, true).status).toBe(404);
    expect(canRecreate(LEGACY, false).status).toBe(403);
    expect(canRecreate({ ...LEGACY, communityMls: true }, true).code).toBe('ALREADY_MLS');
    expect(canRecreate({ ...LEGACY, successorId: 'new' }, true).code).toBe('ALREADY_RECREATED');
    expect(canRecreate(LEGACY, true).ok).toBe(true);
  });

  it('only a member follows, and only to a successor that exists; a non-member learns nothing', () => {
    expect(canFollowSuccessor({ ...LEGACY, successorId: 'new' }, false)).toMatchObject({ ok: false, status: 404, code: 'NOT_FOUND' });
    expect(canFollowSuccessor(LEGACY, true).code).toBe('NO_SUCCESSOR');
    expect(canFollowSuccessor({ ...LEGACY, successorId: 'new' }, true).ok).toBe(true);
  });
});

describe('our server writes nothing new for a legacy community', () => {
  it('POST /api/chat/communities/:id/posts answers 410 and writes nothing', async () => {
    db.community.findUnique.mockResolvedValue({ ...LEGACY, successorId: 'new' });
    db.communityMember.findFirst.mockResolvedValue({ role: 'MEMBER' });
    const res = await postById(req('/api/chat/communities/old/posts', { content: SECRET }), { params: Promise.resolve({ id: 'old' }) });
    expect(res.status).toBe(410);
    const d = await res.json();
    expect(d.code).toBe('COMMUNITY_LEGACY_READ_ONLY');
    expect(d.successorId).toBe('new');
    expect(db.communityPost.create).not.toHaveBeenCalled();
    expect(written()).not.toContain(SECRET);
  });

  it('POST /api/chat/communities/posts answers 410 and writes nothing', async () => {
    db.community.findUnique.mockResolvedValue(LEGACY);
    db.communityMember.findFirst.mockResolvedValue({ role: 'MEMBER' });
    const res = await postFlat(req('/api/chat/communities/posts', { communityId: 'old', content: SECRET }) as any);
    expect(res.status).toBe(410);
    expect((await res.json()).code).toBe('COMMUNITY_LEGACY_READ_ONLY');
    expect(db.communityPost.create).not.toHaveBeenCalled();
  });

  it('old posts stay readable, and the answer says the community is read-only', async () => {
    db.community.findUnique.mockResolvedValue({ ...LEGACY, isPrivate: false });
    db.communityPost.findMany.mockResolvedValue([{ id: 'p1', authorAddress: OTHER, title: 't', content: 'old post' }]);
    const res = await getPosts(req('/api/chat/communities/old/posts', undefined, 'GET'), { params: Promise.resolve({ id: 'old' }) });
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.readOnly).toBe(true);
    expect(d.posts.map((p: any) => p.content)).toEqual(['old post']);
  });

  it('joining a legacy community stores no "joined" notice', async () => {
    db.community.findUnique.mockResolvedValue({ ...LEGACY, _count: { members: 1 } });
    db.communityMember.findUnique.mockResolvedValue(null);
    db.communityMember.create.mockResolvedValue({});
    const res = await join(req('/api/chat/communities/join', { joinCode: 'ABC' }));
    expect((await res.json()).status).toBe('JOINED');
    expect(db.communityPost.create).not.toHaveBeenCalled();
  });

  it('with the rollback switch the old route works exactly as before', async () => {
    process.env.COMMUNITY_LEGACY_READONLY = 'off';
    db.community.findUnique.mockResolvedValue(LEGACY);
    db.communityMember.findFirst.mockResolvedValue({ role: 'MEMBER' });
    const res = await postById(req('/api/chat/communities/old/posts', { content: 'hello' }), { params: Promise.resolve({ id: 'old' }) });
    expect(res.status).toBe(200);
    expect(db.communityPost.create).toHaveBeenCalled();
  });
});

describe('creating and re-creating', () => {
  it('a community without an MLS group is not created', async () => {
    const res = await createCommunity(req('/api/chat/communities', { name: 'Team' }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('MLS_REQUIRED');
    expect(db.community.create).not.toHaveBeenCalled();
  });

  it('with COMMUNITY_MLS_NEW=off it is created as before', async () => {
    process.env.COMMUNITY_MLS_NEW = 'off';
    db.community.create.mockResolvedValue({ id: 'c' });
    const res = await createCommunity(req('/api/chat/communities', { name: 'Team' }));
    expect(res.status).toBe(201);
    expect(db.community.create.mock.calls[0][0].data.communityMls).toBeUndefined();
  });

  it('a member who is not an admin cannot re-create', async () => {
    db.community.findUnique.mockResolvedValue({ ...LEGACY, ownerAddress: OTHER });
    db.communityMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
    const res = await createCommunity(req('/api/chat/communities', { name: 'Old', mls: true, xmtpGroupId: GROUP, recreateOf: 'old' }));
    expect(res.status).toBe(403);
    expect(db.community.create).not.toHaveBeenCalled();
  });

  it('a re-creation without an MLS group is refused, even with the rule off', async () => {
    process.env.COMMUNITY_LEGACY_READONLY = 'off';
    const res = await createCommunity(req('/api/chat/communities', { name: 'Old', recreateOf: 'old' }));
    expect(res.status).toBe(409);
    expect(db.community.create).not.toHaveBeenCalled();
  });

  it('the owner re-creates on MLS; the old community points to it, set only while still empty', async () => {
    db.community.findUnique.mockResolvedValue(LEGACY);
    db.communityMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    db.community.create.mockResolvedValue({ id: 'new' });
    db.community.updateMany.mockResolvedValue({ count: 1 });
    const res = await createCommunity(req('/api/chat/communities', { name: 'Old', mls: true, xmtpGroupId: GROUP, recreateOf: 'old' }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ community: { id: 'new' }, linked: true, recreatedFrom: 'old' });
    const data = db.community.create.mock.calls[0][0].data;
    expect(data.communityMls).toBe(true);
    expect(data.channels.create[0].xmtpGroupId).toBe(GROUP);
    // Only the creator is a member: nobody from the old community is added for them.
    expect(data.members).toEqual({ create: { walletAddress: WALLET, role: 'ADMIN' } });
    expect(db.community.updateMany).toHaveBeenCalledWith({ where: { id: 'old', successorId: null }, data: { successorId: 'new' } });
    // Old posts are not copied.
    expect(db.communityPost.create).not.toHaveBeenCalled();
  });

  it('two taps: the second is told the old community already points elsewhere', async () => {
    db.community.findUnique.mockResolvedValue(LEGACY);
    db.communityMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    db.community.create.mockResolvedValue({ id: 'new2' });
    db.community.updateMany.mockResolvedValue({ count: 0 });
    const res = await createCommunity(req('/api/chat/communities', { name: 'Old', mls: true, xmtpGroupId: GROUP, recreateOf: 'old' }));
    expect((await res.json()).linked).toBe(false);
  });
});

describe('a member follows the re-creation, by choice', () => {
  it('a member of the old community joins the new one without an invite code', async () => {
    db.community.findUnique
      .mockResolvedValueOnce({ ...LEGACY, ownerAddress: OTHER, successorId: 'new' })
      .mockResolvedValueOnce({ id: 'new', name: 'Old', communityMls: true });
    db.communityMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
    db.communityMember.create.mockResolvedValue({});
    const res = await join(req('/api/chat/communities/join', { fromCommunityId: 'old' }));
    expect(await res.json()).toMatchObject({ ok: true, status: 'JOINED', community: { id: 'new' } });
    expect(db.communityMember.create).toHaveBeenCalledWith({ data: { communityId: 'new', walletAddress: WALLET, role: 'MEMBER' } });
    expect(db.communityPost.create).not.toHaveBeenCalled();
  });

  it('someone who was not a member gets 404 and is not added', async () => {
    db.community.findUnique.mockResolvedValueOnce({ ...LEGACY, ownerAddress: OTHER, successorId: 'new' });
    db.communityMember.findUnique.mockResolvedValue(null);
    const res = await join(req('/api/chat/communities/join', { fromCommunityId: 'old' }));
    expect(res.status).toBe(404);
    expect(db.communityMember.create).not.toHaveBeenCalled();
  });
});

describe('the client', () => {
  const okFetch = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('re-creating makes the group first, then sends only its id with recreateOf', async () => {
    const f = okFetch(201, { community: { id: 'new' }, linked: true });
    const r = await recreateOnMls({ community: { id: 'old', name: 'Old', description: 'd', isPrivate: true }, headers: {}, fetchImpl: f, createGroup: async () => GROUP });
    expect(r).toEqual({ ok: true, id: 'new', linked: true });
    const sent = JSON.parse((f as any).mock.calls[0][1].body);
    expect(sent).toEqual({ name: 'Old', description: 'd', isPrivate: true, mls: true, xmtpGroupId: GROUP, recreateOf: 'old' });
  });

  it('when the group cannot be made, nothing is sent', async () => {
    const f = okFetch(201, {});
    const r = await recreateOnMls({ community: { id: 'old', name: 'Old' }, headers: {}, fetchImpl: f, createGroup: async () => { throw new Error('x'); } });
    expect(r).toMatchObject({ ok: false, code: 'MLS_REQUIRED' });
    expect(f).not.toHaveBeenCalled();
  });

  it('following sends fromCommunityId and opens what the server answers', async () => {
    const f = okFetch(200, { ok: true, community: { id: 'new' } });
    expect(await followSuccessor('old', {}, f)).toEqual({ ok: true, id: 'new' });
    expect(JSON.parse((f as any).mock.calls[0][1].body)).toEqual({ fromCommunityId: 'old' });
  });

  it('the reader replaces the composer with the notice, and says why in plain words', () => {
    const src = untranslated(fs.readFileSync('components/communities/CommunityReader.tsx', 'utf8'));
    expect(src).toMatch(/\{readOnly \? \(/);
    expect(src).toContain('data-testid="legacy-read-only"');
    expect(src).toContain("export const READ_ONLY_SENTENCE = 'It was made before 24 November 2026, when posts were stored on our server, which can read them.");
    for (const s of ['Join the encrypted community', 'Re-create it end-to-end encrypted', 'Old posts are not copied.', 'An owner or admin can re-create it end-to-end encrypted.']) {
      expect(src, s).toContain(s);
    }
    // The text of a refused post is kept in the box, not lost.
    expect(src).toMatch(/COMMUNITY_LEGACY_READ_ONLY'\) \{[\s\S]{0,300}setDraft\(body\)/);
  });

  it('a community that fails to start on MLS says so, instead of quietly creating a readable one', () => {
    // Creation moved to CreateCommunitySheet, which the Communities tab mounts.
    expect(fs.readFileSync('components/chat/LedgerCommunitiesTab.tsx', 'utf8')).toContain('<CreateCommunitySheet');
    const src = untranslated(fs.readFileSync('components/communities/CreateCommunitySheet.tsx', 'utf8'));
    expect(src).toMatch(/d\?\.code === 'MLS_REQUIRED'/);
    expect(src).toContain('MLS is required for new communities');
  });

  it('the migration only adds a nullable column', () => {
    const sql = fs.readFileSync('prisma/migrations/20261125140000_community_successor/migration.sql', 'utf8').replace(/^--.*$/gm, '').trim();
    expect(sql).toBe('ALTER TABLE "Community" ADD COLUMN "successorId" TEXT;');
    expect(fs.readFileSync('prisma/schema.prisma', 'utf8')).toMatch(/successorId\s+String\?/);
  });
});
