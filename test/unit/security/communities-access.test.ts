import { vi } from 'vitest';
import { NextRequest } from 'next/server';

const { db, ADMIN } = vi.hoisted(() => ({
  ADMIN: '0x1111111111111111111111111111111111111111',
  db: {
    communityMember: { findUnique: vi.fn(), findFirst: vi.fn() },
    communityChannel: { findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    communityPermission: { upsert: vi.fn() },
    community: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/security/requireWallet', () => ({
  requireWallet: vi.fn(async () => ({ walletAddress: ADMIN })),
}));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

import { PATCH, POST } from '@/app/api/chat/communities/route';

const patch = (body: unknown) =>
  PATCH(
    new NextRequest('http://localhost/api/chat/communities', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

describe('communities access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.communityMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
  });

  it('a community that is not on MLS ignores a group id', async () => {
    db.community.findUnique.mockResolvedValue({ communityMls: false });
    db.communityChannel.count.mockResolvedValue(0);
    db.communityChannel.create.mockResolvedValue({ id: 'ch' });
    const res = await patch({
      communityId: 'mine',
      action: 'CREATE_CHANNEL',
      name: 'general',
      xmtpGroupId: '0123456789abcdef',
    });
    expect(res.status).toBe(200);
    expect(db.communityChannel.create.mock.calls[0][0].data.xmtpGroupId).toBeUndefined();
  });

  it('an MLS community stores only a group id the client created', async () => {
    db.community.findUnique.mockResolvedValue({ communityMls: true });
    db.communityChannel.count.mockResolvedValue(0);
    db.communityChannel.create.mockResolvedValue({ id: 'ch' });
    const missing = await patch({ communityId: 'mine', action: 'CREATE_CHANNEL', name: 'general' });
    expect(missing.status).toBe(400);
    expect(db.communityChannel.create).not.toHaveBeenCalled();
    const ok = await patch({
      communityId: 'mine',
      action: 'CREATE_CHANNEL',
      name: 'general',
      xmtpGroupId: '0123456789abcdef',
    });
    expect(ok.status).toBe(200);
    expect(db.communityChannel.create.mock.calls[0][0].data.xmtpGroupId).toBe('0123456789abcdef');
  });

  it('an admin cannot edit a channel that belongs to another community', async () => {
    db.communityChannel.findFirst.mockResolvedValue(null);
    const res = await patch({ communityId: 'mine', action: 'UPDATE_CHANNEL', channelId: 'foreign', name: 'x' });
    expect(res.status).toBe(404);
    expect(db.communityChannel.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', communityId: 'mine' } });
    expect(db.communityChannel.update).not.toHaveBeenCalled();
  });

  it('an admin cannot delete a channel that belongs to another community', async () => {
    db.communityChannel.deleteMany.mockResolvedValue({ count: 0 });
    const res = await patch({ communityId: 'mine', action: 'DELETE_CHANNEL', channelId: 'foreign' });
    expect(res.status).toBe(404);
    expect(db.communityChannel.deleteMany).toHaveBeenCalledWith({ where: { id: 'foreign', communityId: 'mine' } });
  });

  it('permissions only accept boolean flags and never repoint the row', async () => {
    db.communityPermission.upsert.mockResolvedValue({});
    await patch({
      communityId: 'mine',
      action: 'UPDATE_PERMISSIONS',
      // Only real CommunityPermission columns pass (sendMessages); canPost is not one of them.
      permissions: { sendMessages: true, canPost: true, communityId: 'other', id: 'x', nested: { connect: { id: '1' } }, label: 'text' },
    });
    const call = db.communityPermission.upsert.mock.calls[0][0];
    expect(call.create).toEqual({ communityId: 'mine', sendMessages: true });
    expect(call.update).toEqual({ sendMessages: true });
  });

  it('a new community is private unless the creator says otherwise', async () => {
    db.community.create.mockResolvedValue({ id: 'c' });
    await POST(
      new NextRequest('http://localhost/api/chat/communities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Team' }),
      }),
    );
    expect(db.community.create.mock.calls[0][0].data.isPrivate).toBe(true);
  });

  it('invite codes are long and unpredictable', async () => {
    db.community.create.mockResolvedValue({ id: 'c' });
    const make = async () => {
      await POST(
        new NextRequest('http://localhost/api/chat/communities', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Team' }),
        }),
      );
      return db.community.create.mock.calls.at(-1)![0].data.joinCode as string;
    };
    const a = await make();
    const b = await make();
    expect(a).toMatch(/^[0-9A-F]{20}$/);
    expect(a).not.toBe(b);
  });
});
