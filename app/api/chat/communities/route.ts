import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { randomBytes } from 'crypto';
import {
  createInMemoryCommunity,
  listInMemoryCommunities,
  getInMemoryCommunityBySlugOrId,
} from '@/lib/communities/in-memory-communities';

export const dynamic = 'force-dynamic';

function generateJoinCode() {
  return randomBytes(10).toString('hex').toUpperCase();
}

const MAX_NAME = 60;
const MAX_DESCRIPTION = 280;
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const caller = auth.walletAddress;

    const isDiscover = req.nextUrl.searchParams.get('discover') === 'true';

    let dbCommunities: any[] = [];
    try {
      if (isDiscover) {
        const publicCommunities = await (prisma as any).community.findMany({
          where: { isPrivate: false },
          include: {
            _count: { select: { members: true, channels: true } },
            channels: { orderBy: { position: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        dbCommunities = publicCommunities.map((c: any) => ({
          ...c,
          membersCount: c._count?.members || 1,
          channelsCount: c._count?.channels || 1,
          isMember: false,
        }));
      } else {
        const memberships = await (prisma as any).communityMember.findMany({
          where: { walletAddress: caller.toLowerCase() },
          include: {
            community: {
              include: {
                _count: { select: { members: true } },
                channels: { orderBy: { position: 'asc' } },
                permissions: true,
              },
            },
          },
        });

        dbCommunities = memberships.map((m: any) => ({
          ...m.community,
          membersCount: m.community._count?.members || 1,
          myRole: m.role,
        }));
      }
    } catch {}

    const memCommunities = listInMemoryCommunities({
      walletAddress: caller,
      isDiscover,
    });

    const seen = new Set<string>();
    const combined: any[] = [];

    for (const c of dbCommunities) {
      seen.add(c.id);
      combined.push(c);
    }

    for (const mc of memCommunities) {
      if (!seen.has(mc.id)) {
        seen.add(mc.id);
        combined.push({
          ...mc,
          myRole: mc.ownerAddress === caller.toLowerCase() ? 'ADMIN' : 'MEMBER',
          isMember: mc.ownerAddress === caller.toLowerCase() || mc.members.some(m => m.walletAddress === caller.toLowerCase()),
        });
      }
    }

    return NextResponse.json({ communities: combined });
  } catch (error: any) {
    console.error('[chat/communities GET]', error);
    const fallback = listInMemoryCommunities({ isDiscover: true });
    return NextResponse.json({ communities: fallback });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const caller = auth.walletAddress;

    const body = await req.json().catch(() => ({}));
    const name = clean(body?.name, MAX_NAME);
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const description = clean(body?.description, MAX_DESCRIPTION);

    const joinCode = generateJoinCode();

    // Try DB first
    try {
      const community = await (prisma as any).community.create({
        data: {
          name,
          description,
          isPrivate: body?.isPrivate !== false,
          ownerAddress: caller.toLowerCase(),
          joinCode,
          members: {
            create: {
              walletAddress: caller.toLowerCase(),
              role: 'ADMIN',
            },
          },
          channels: {
            create: [
              { name: 'general', description: 'General discussion', isPaid: false, position: 0 },
              { name: 'announcements', description: 'Server announcements', isPaid: false, position: 1 },
            ],
          },
          permissions: {
            create: {},
          },
        },
      });

      return NextResponse.json({ community });
    } catch {
      // Standalone mode: save in memory
      const memCommunity = createInMemoryCommunity({
        name,
        description,
        isPrivate: body?.isPrivate !== false,
        ownerAddress: caller,
      });

      return NextResponse.json({ community: memCommunity }, { status: 201 });
    }
  } catch (error: any) {
    console.error('[chat/communities POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const caller = auth.walletAddress;

    const body = await req.json();
    const { communityId, action, isPrivate } = body;
    if (!communityId || typeof communityId !== 'string') {
      return NextResponse.json({ error: 'Invalid communityId' }, { status: 400 });
    }

    const memComm = getInMemoryCommunityBySlugOrId(communityId);
    if (memComm && memComm.ownerAddress === caller.toLowerCase()) {
      if (action === 'REVOKE_LINK') {
        memComm.joinCode = generateJoinCode();
        return NextResponse.json({ ok: true, joinCode: memComm.joinCode });
      }
      if (action === 'UPDATE_INFO') {
        if (body.name) memComm.name = clean(body.name, MAX_NAME);
        if (body.description) memComm.description = clean(body.description, MAX_DESCRIPTION);
        return NextResponse.json({ ok: true, community: memComm });
      }
      if (action === 'CREATE_CHANNEL') {
        const chanId = `chan_${Date.now()}`;
        const newChan = {
          id: chanId,
          communityId: memComm.id,
          name: clean(body.name, 40),
          description: clean(body.description, MAX_DESCRIPTION),
          isPaid: Boolean(body.isPaid),
          position: memComm.channels.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        memComm.channels.push(newChan);
        memComm.channelsCount = memComm.channels.length;
        return NextResponse.json({ ok: true, channel: newChan });
      }
      if (action === 'UPDATE_PRIVACY') {
        memComm.isPrivate = Boolean(isPrivate);
        return NextResponse.json({ ok: true, isPrivate: memComm.isPrivate });
      }
    }

    try {
      const member = await (prisma as any).communityMember.findUnique({
        where: { communityId_walletAddress: { communityId, walletAddress: caller.toLowerCase() } },
      });

      if (!member || member.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only admins can modify settings' }, { status: 403 });
      }

      if (action === 'REVOKE_LINK') {
        const newJoinCode = generateJoinCode() + generateJoinCode();
        const updated = await (prisma as any).community.update({
          where: { id: communityId },
          data: { joinCode: newJoinCode },
        });
        return NextResponse.json({ ok: true, joinCode: updated.joinCode });
      }

      if (action === 'UPDATE_INFO') {
        const { name, description, avatarUrl } = body;
        const updated = await (prisma as any).community.update({
          where: { id: communityId },
          data: {
            ...(clean(name, MAX_NAME) ? { name: clean(name, MAX_NAME) } : {}),
            ...(description !== undefined ? { description: clean(description, MAX_DESCRIPTION) } : {}),
          },
        });
        return NextResponse.json({ ok: true, community: updated });
      }

      if (action === 'CREATE_CHANNEL') {
        const { name, description, isPaid, price, currency } = body;
        const count = await (prisma as any).communityChannel.count({ where: { communityId } });
        const channel = await (prisma as any).communityChannel.create({
          data: {
            communityId,
            name: clean(name, 40),
            description: description ? clean(description, MAX_DESCRIPTION) : '',
            isPaid: Boolean(isPaid),
            price: price ? parseFloat(price) : null,
            currency: currency || null,
            position: count
          }
        });
        return NextResponse.json({ ok: true, channel });
      }

      if (action === 'UPDATE_CHANNEL') {
        const { channelId, name, description, isPaid, price, currency, position } = body;
        if (!channelId || typeof channelId !== 'string') return NextResponse.json({ error: 'Invalid channelId' }, { status: 400 });
        const existing = await (prisma as any).communityChannel.findFirst({ where: { id: channelId, communityId } });
        if (!existing) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
        const channel = await (prisma as any).communityChannel.update({
          where: { id: channelId },
          data: {
            ...(name !== undefined && { name: clean(name, 40) }),
            ...(description !== undefined && { description: clean(description, MAX_DESCRIPTION) }),
            ...(isPaid !== undefined && { isPaid: Boolean(isPaid) }),
            ...(price !== undefined && { price: price === null ? null : parseFloat(price) }),
            ...(currency !== undefined && { currency }),
            ...(position !== undefined && { position })
          }
        });
        return NextResponse.json({ ok: true, channel });
      }

      if (action === 'DELETE_CHANNEL') {
        const { channelId } = body;
        if (!channelId || typeof channelId !== 'string') return NextResponse.json({ error: 'Invalid channelId' }, { status: 400 });
        const removed = await (prisma as any).communityChannel.deleteMany({ where: { id: channelId, communityId } });
        if (!removed?.count) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
        return NextResponse.json({ ok: true });
      }

      if (action === 'UPDATE_PERMISSIONS') {
        const flags: Record<string, boolean> = {};
        if (body.permissions && typeof body.permissions === 'object') {
          for (const [k, v] of Object.entries(body.permissions as Record<string, unknown>)) {
            if (typeof v === 'boolean' && !['id', 'communityId'].includes(k) && /^[A-Za-z]{1,40}$/.test(k)) {
              flags[k] = v;
            }
          }
        }
        const updated = await (prisma as any).communityPermission.upsert({
          where: { communityId },
          create: { communityId, ...flags },
          update: { ...flags }
        });
        return NextResponse.json({ ok: true, permissions: updated });
      }

      if (action === 'UPDATE_PRIVACY') {
        const { isPrivate } = body;
        const updated = await (prisma as any).community.update({
          where: { id: communityId },
          data: { isPrivate: Boolean(isPrivate) }
        });
        return NextResponse.json({ ok: true, community: updated });
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[chat/communities PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const caller = auth.walletAddress;

    const id = req.nextUrl.searchParams.get('id');
    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Invalid community id' }, { status: 400 });

    try {
      const community = await (prisma as any).community.findUnique({ where: { id } });
      if (community && community.ownerAddress === caller.toLowerCase()) {
        await (prisma as any).community.delete({ where: { id } });
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[chat/communities DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
