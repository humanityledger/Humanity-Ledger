import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Fixes from the 2026-10-28 audit: community governance, push notifications,
 * plan checkout and the routes retired at the edge.
 */

const { db, ME, OTHER, wallet } = vi.hoisted(() => ({
  ME: '0x1111111111111111111111111111111111111111',
  OTHER: '0x2222222222222222222222222222222222222222',
  wallet: { current: '0x1111111111111111111111111111111111111111' as string | null },
  db: {
    community: { findUnique: vi.fn() },
    communityMember: { findUnique: vi.fn() },
    marketProposal: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    proposalVote: { findUnique: vi.fn(), create: vi.fn() },
    pushSubscription: { findUnique: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

vi.mock('@/lib/security/requireWallet', () => ({
  requireWallet: vi.fn(async () =>
    wallet.current
      ? { walletAddress: wallet.current, userId: wallet.current, isEmailUser: false }
      : { errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) },
  ),
}));
vi.mock('@/lib/security/rateLimiter', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }));

import { GET as govGet, POST as govPost } from '@/app/api/chat/communities/[id]/proposals/route';
import { POST as pushPost } from '@/app/api/push/send/route';
import { isRetiredApiRoute } from '@/lib/security/retiredRoutes';

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (url: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('community governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.current = ME;
    db.community.findUnique.mockResolvedValue({ id: 'c1', ownerAddress: OTHER });
    db.communityMember.findUnique.mockResolvedValue({ id: 'm1' });
    db.marketProposal.findUnique.mockResolvedValue({ id: 'p1', category: 'COMMUNITY_c1', votingEndsAt: new Date(Date.now() + 86_400_000) });
    db.proposalVote.findUnique.mockResolvedValue(null);
  });

  it('needs a session', async () => {
    wallet.current = null;
    expect((await govGet(req('/api/chat/communities/c1/proposals'), params('c1'))).status).toBe(401);
    expect((await govPost(req('/api/chat/communities/c1/proposals', { action: 'VOTE', proposalId: 'p1', vote: 'FOR' }), params('c1'))).status).toBe(401);
  });

  it('only members read, propose and vote', async () => {
    db.communityMember.findUnique.mockResolvedValue(null);
    expect((await govGet(req('/api/chat/communities/c1/proposals'), params('c1'))).status).toBe(403);
    const res = await govPost(req('/api/chat/communities/c1/proposals', { action: 'VOTE', proposalId: 'p1', vote: 'FOR' }), params('c1'));
    expect(res.status).toBe(403);
    expect(db.proposalVote.create).not.toHaveBeenCalled();
  });

  it('the owner counts as a member', async () => {
    db.community.findUnique.mockResolvedValue({ id: 'c1', ownerAddress: ME });
    db.communityMember.findUnique.mockResolvedValue(null);
    db.marketProposal.findMany.mockResolvedValue([]);
    expect((await govGet(req('/api/chat/communities/c1/proposals'), params('c1'))).status).toBe(200);
  });

  it('votes as the session wallet, never as an address from the body', async () => {
    const forged = await govPost(req('/api/chat/communities/c1/proposals', { action: 'VOTE', proposalId: 'p1', vote: 'FOR', voterAddress: OTHER }), params('c1'));
    expect(forged.status).toBe(403);
    expect(db.proposalVote.create).not.toHaveBeenCalled();

    const ok = await govPost(req('/api/chat/communities/c1/proposals', { action: 'VOTE', proposalId: 'p1', vote: 'for' }), params('c1'));
    expect(ok.status).toBe(200);
    expect(db.proposalVote.create.mock.calls[0][0].data).toMatchObject({ voterAddress: ME, vote: 'FOR' });
  });

  it('refuses a proposal from another community and a second vote', async () => {
    db.marketProposal.findUnique.mockResolvedValue({ id: 'p9', category: 'COMMUNITY_other', votingEndsAt: new Date(Date.now() + 1e6) });
    expect((await govPost(req('/api/chat/communities/c1/proposals', { action: 'VOTE', proposalId: 'p9', vote: 'FOR' }), params('c1'))).status).toBe(404);

    db.marketProposal.findUnique.mockResolvedValue({ id: 'p1', category: 'COMMUNITY_c1', votingEndsAt: new Date(Date.now() + 1e6) });
    db.proposalVote.findUnique.mockResolvedValue({ id: 'v1' });
    expect((await govPost(req('/api/chat/communities/c1/proposals', { action: 'VOTE', proposalId: 'p1', vote: 'FOR' }), params('c1'))).status).toBe(409);
  });

  it('creates proposals in the caller\'s name', async () => {
    db.marketProposal.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
    const res = await govPost(req('/api/chat/communities/c1/proposals', { title: 'Plant trees', description: 'Spend the treasury on trees.' }), params('c1'));
    expect(res.status).toBe(201);
    expect(db.marketProposal.create.mock.calls[0][0].data).toMatchObject({ creatorAddress: ME, category: 'COMMUNITY_c1' });
  });
});

describe('push notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.current = ME;
  });

  it('cannot be sent to someone else', async () => {
    const res = await pushPost(req('/api/push/send', { toAddress: OTHER, title: 'Hi', body: 'Click', url: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(db.pushSubscription.findUnique).not.toHaveBeenCalled();
  });

  it('needs a session', async () => {
    wallet.current = null;
    expect((await pushPost(req('/api/push/send', { title: 'x' }))).status).toBe(401);
  });
});

describe('retired routes', () => {
  it.each([
    '/api/notifications/telegram',
    '/api/projects/abc',
    '/api/chat/onion/queue',
    '/api/auth/signup',
    '/api/ai/forensic',
    '/api/newsletter/subscribe',
  ])('%s answers 410 at the edge', p => {
    expect(isRetiredApiRoute(p)).toBe(true);
  });

  it('keeps the routes the app uses', () => {
    for (const p of ['/api/push/send', '/api/chat/communities/c1/proposals', '/api/chat/onion/relay', '/api/auth/send-code']) {
      expect(isRetiredApiRoute(p)).toBe(false);
    }
  });
});
