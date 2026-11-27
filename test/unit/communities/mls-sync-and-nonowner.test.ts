import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';

const { db, CALLER } = vi.hoisted(() => ({
  CALLER: '0x2222222222222222222222222222222222222222',
  db: {
    community: { findUnique: vi.fn(), findMany: vi.fn() },
    communityMember: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    communityPermission: { findUnique: vi.fn() },
    communityPost: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('@/lib/security/requireWallet', () => ({ requireWallet: vi.fn(async () => ({ walletAddress: CALLER })) }));
vi.mock('@/lib/security/resolveCaller', () => ({ resolveVerifiedCaller: vi.fn(async () => CALLER) }));
vi.mock('@/lib/security/rateLimiter', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock('@/lib/security/qrLogin', () => ({ setOnce: vi.fn(async () => true) }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/lib/communities/in-memory-communities', () => ({
  getInMemoryCommunityBySlugOrId: () => null,
  listInMemoryCommunities: () => [],
}));
vi.mock('@/lib/communities/member-names', () => ({ memberNames: vi.fn(async () => new Map()) }));

import { GET as getPosts } from '@/app/api/chat/communities/[id]/posts/route';
import { POST as joinCommunity } from '@/app/api/chat/communities/join/route';
import { readGroupPosts } from '@/lib/communities/mls';

const req = (url: string, body?: unknown, method = 'POST') =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('communities MLS sync & non-owner fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/chat/communities/[id]/posts returns 410 COMMUNITY_MLS instead of fake empty 200', async () => {
    db.community.findUnique.mockResolvedValue({
      id: 'comm-mls',
      isPrivate: false,
      ownerAddress: '0x9999999999999999999999999999999999999999',
      communityMls: true,
    });

    const res = await getPosts(req('/api/chat/communities/comm-mls/posts', undefined, 'GET'), {
      params: Promise.resolve({ id: 'comm-mls' }),
    });
    const json = await res.json();
    expect(res.status).toBe(410);
    expect(json.code).toBe('COMMUNITY_MLS');
    expect(db.communityPost.findMany).not.toHaveBeenCalled();
  });

  it('GET /posts still hides private MLS communities from non-members (404)', async () => {
    db.community.findUnique.mockResolvedValue({
      id: 'priv-mls',
      isPrivate: true,
      ownerAddress: '0x9999999999999999999999999999999999999999',
      communityMls: true,
    });
    db.communityMember.findFirst.mockResolvedValue(null);

    const res = await getPosts(req('/api/chat/communities/priv-mls/posts', undefined, 'GET'), {
      params: Promise.resolve({ id: 'priv-mls' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /api/chat/communities/join allows joining public communities by communityId without joinCode', async () => {
    db.community.findUnique.mockResolvedValue({
      id: 'pub-1',
      name: 'Public MLS',
      isPrivate: false,
      communityMls: true,
      ownerAddress: '0x9999999999999999999999999999999999999999',
    });
    db.communityMember.findUnique.mockResolvedValue(null);
    db.communityPermission.findUnique.mockResolvedValue({ requireApproval: false });
    db.communityMember.create.mockResolvedValue({ id: 'mem-1' });

    const res = await joinCommunity(req('/api/chat/communities/join', { communityId: 'pub-1' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('JOINED');
    expect(db.communityMember.create).toHaveBeenCalledTimes(1);
  });

  it('POST /api/chat/communities/join rejects joining private communities by communityId alone', async () => {
    db.community.findUnique.mockResolvedValue({
      id: 'priv-1',
      name: 'Private MLS',
      isPrivate: true,
      communityMls: true,
    });

    const res = await joinCommunity(req('/api/chat/communities/join', { communityId: 'priv-1' }));
    expect(res.status).toBe(400);
  });

  it('readGroupPosts supports string, object.text, and fallback payloads without dropping posts', async () => {
    const fakeGroup = {
      id: 'grp-1',
      sync: vi.fn(async () => {}),
      messages: vi.fn(async () => [
        { id: '1', senderInboxId: 'inb1', content: 'plain string post', sentAtNs: 1000n },
        { id: '2', senderInboxId: 'inb2', content: { text: 'object text post' }, sentAtNs: 2000n },
        { id: '3', senderInboxId: 'inb3', content: null, fallback: 'fallback text post', sentAtNs: 3000n },
        { id: '4', senderInboxId: 'inb4', content: 'failed post', deliveryStatus: 'failed', sentAtNs: 4000n },
      ]),
    };
    const fakeClient = {
      conversations: {
        getConversationById: vi.fn(async () => fakeGroup),
      },
    };

    const posts = await readGroupPosts(fakeClient, 'grp-1');
    expect(posts.map((p) => p.content)).toEqual([
      'plain string post',
      'object text post',
      'fallback text post',
    ]);
  });

  it('CommunityReader separates community reset from post fetch and preserves viewer/composer invariants', () => {
    const src = fs.readFileSync('components/communities/CommunityReader.tsx', 'utf8');
    expect(src).toContain('joinCommunity');
    expect(src).toContain('if (!mlsGroup && mlsOn) return;');
    expect(src).not.toContain('[communityId, fetchCommunity, fetchPosts]');
  });
});
