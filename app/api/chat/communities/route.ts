import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';

import { randomBytes } from 'crypto';

// Invite codes are secrets for private communities, so they come from the
// system CSPRNG (Math.random is predictable). 10 bytes = 80 bits.
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

    if (isDiscover) {
      // Fetch all public communities natively
      const publicCommunities = await (prisma as any).community.findMany({
        where: { isPrivate: false },
        include: {
          _count: { select: { members: true, channels: true } },
          channels: { orderBy: { position: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const communities = publicCommunities.map((c: any) => ({
        ...c,
        membersCount: c._count?.members || 1,
        channelsCount: c._count?.channels || 1,
        isMember: false,
      }));

      return NextResponse.json({ communities });
    }

    // Fetch communities the user is a member of
    const memberships = await (prisma as any).communityMember.findMany({
      where: { walletAddress: caller },
      include: {
        community: {
          include: {
            _count: { select: { members: true } },
            channels: { orderBy: { position: 'asc' } },
            permissions: true
          }
        }
      }
    });

    const communities = memberships.map((m: any) => ({
      ...m.community,
      membersCount: m.community._count.members,
      myRole: m.role
    }));

    return NextResponse.json({ communities });
  } catch (error: any) {
    console.error('[communities GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const community = await (prisma as any).community.create({
      data: {
        name,
        description,
        // Private unless the creator explicitly chose public.
        isPrivate: body?.isPrivate !== false,
        ownerAddress: caller,
        joinCode,
        members: {
          create: {
            walletAddress: caller,
            role: 'ADMIN'
          }
        },
        channels: {
          create: [
            { name: 'general', description: 'General discussion', isPaid: false, position: 0 },
            { name: 'announcements', description: 'Server announcements', isPaid: false, position: 1 }
          ]
        },
        permissions: {
          create: {}
        }
      }
    });

    return NextResponse.json({ community });
  } catch (error: any) {
    console.error('[communities POST]', error);
    if ((error as any)?.code === 'P2002') {
      return NextResponse.json({ error: 'Already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update Community Settings & Revoke Links
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const caller = auth.walletAddress;

    const body = await req.json();
    const { communityId, action, isPrivate } = body;
    if (!communityId || typeof communityId !== 'string') return NextResponse.json({ error: 'Invalid communityId' }, { status: 400 });

    // Validate admin
    const member = await (prisma as any).communityMember.findUnique({
      where: { communityId_walletAddress: { communityId, walletAddress: caller } }
    });

    if (!member || member.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can modify settings' }, { status: 403 });
    }

    if (action === 'REVOKE_LINK') {
      const newJoinCode = generateJoinCode() + generateJoinCode(); // Double entropy for private links
      const updated = await (prisma as any).community.update({
        where: { id: communityId },
        data: { joinCode: newJoinCode }
      });
      return NextResponse.json({ ok: true, joinCode: updated.joinCode });
    }

    if (action === 'UPDATE_INFO') {
      const { name, description, avatarUrl } = body;
      const safeAvatar =
        typeof avatarUrl === 'string' && /^(https:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(avatarUrl) && avatarUrl.length <= 400_000
          ? avatarUrl
          : null;
      const updated = await (prisma as any).community.update({
        where: { id: communityId },
        data: {
          ...(clean(name, MAX_NAME) ? { name: clean(name, MAX_NAME) } : {}),
          ...(description !== undefined ? { description: clean(description, MAX_DESCRIPTION) } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl: safeAvatar } : {})
        }
      });
      return NextResponse.json({ ok: true, community: updated });
    }

    if (action === 'CREATE_CHANNEL') {
      const { name, description, isPaid, price, currency } = body;
      const channelName = clean(name, 40);
      if (!channelName) return NextResponse.json({ error: 'Channel name required' }, { status: 400 });
      const parsedPrice = price ? Number(price) : null;
      if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 1_000_000)) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
      }
      const count = await (prisma as any).communityChannel.count({ where: { communityId } });
      if (count >= 50) return NextResponse.json({ error: 'A community can have up to 50 channels' }, { status: 400 });
      const channel = await (prisma as any).communityChannel.create({
        data: {
          communityId,
          name: channelName,
          description: clean(description, MAX_DESCRIPTION),
          isPaid: Boolean(isPaid),
          price: parsedPrice,
          currency: typeof currency === 'string' ? currency.slice(0, 12) : null,
          position: count
        }
      });
      return NextResponse.json({ ok: true, channel });
    }

    if (action === 'UPDATE_CHANNEL') {
      const { channelId, name, description, isPaid, price, currency, position } = body;
      if (!channelId || typeof channelId !== 'string') return NextResponse.json({ error: 'Invalid channelId' }, { status: 400 });
      // The channel must belong to the community the caller administers.
      // Without this scope an admin of any community could edit any channel.
      const owned = await (prisma as any).communityChannel.findFirst({ where: { id: channelId, communityId } });
      if (!owned) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      const parsedPrice = price === undefined ? undefined : price === null ? null : Number(price);
      if (parsedPrice !== undefined && parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 1_000_000)) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
      }
      const channel = await (prisma as any).communityChannel.update({
        where: { id: channelId },
        data: {
          ...(name !== undefined && clean(name, 40) && { name: clean(name, 40) }),
          ...(description !== undefined && { description: clean(description, MAX_DESCRIPTION) }),
          ...(isPaid !== undefined && { isPaid: Boolean(isPaid) }),
          ...(parsedPrice !== undefined && { price: parsedPrice }),
          ...(typeof currency === 'string' && { currency: currency.slice(0, 12) }),
          ...(Number.isInteger(position) && position >= 0 && position < 1000 && { position })
        }
      });
      return NextResponse.json({ ok: true, channel });
    }
    
    if (action === 'DELETE_CHANNEL') {
      const { channelId } = body;
      if (!channelId || typeof channelId !== 'string') return NextResponse.json({ error: 'Invalid channelId' }, { status: 400 });
      // Scoped to the administered community (see UPDATE_CHANNEL).
      const removed = await (prisma as any).communityChannel.deleteMany({ where: { id: channelId, communityId } });
      if (!removed?.count) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'UPDATE_PERMISSIONS') {
      // Only boolean flags are accepted, and never identity or relation fields,
      // so a request cannot repoint the row at another community.
      const flags: Record<string, boolean> = {};
      if (body.permissions && typeof body.permissions === 'object') {
        for (const [k, v] of Object.entries(body.permissions as Record<string, unknown>)) {
          if (typeof v === 'boolean' && !['id', 'communityId'].includes(k) && /^[A-Za-z]{1,40}$/.test(k)) flags[k] = v;
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
      const updated = await (prisma as any).community.update({
        where: { id: communityId },
        data: { isPrivate: Boolean(isPrivate) }
      });
      return NextResponse.json({ ok: true, isPrivate: updated.isPrivate });
    }


    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[communities PATCH]', error);
    if ((error as any)?.code === 'P2002') {
      return NextResponse.json({ error: 'Already exists' }, { status: 409 });
    }
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

    const community = await (prisma as any).community.findUnique({
      where: { id }
    });

    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (community.ownerAddress !== caller) return NextResponse.json({ error: 'Only the creator can delete the community' }, { status: 403 });

    await (prisma as any).community.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[communities DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
