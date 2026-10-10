import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function resolveCaller(req: NextRequest) {
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  return null; // Spoofing vector closed
}

function generateJoinCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, description, isPrivate } = await req.json();
    if (!name || typeof name !== 'string') return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const joinCode = generateJoinCode();

    const community = await (prisma as any).community.create({
      data: {
        name,
        description: description || '',
        isPrivate: isPrivate || false,
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
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
      const updated = await (prisma as any).community.update({
        where: { id: communityId },
        data: { 
          ...(name ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {})
        }
      });
      return NextResponse.json({ ok: true, community: updated });
    }

    if (action === 'CREATE_CHANNEL') {
      const { name, description, isPaid, price, currency } = body;
      const count = await (prisma as any).communityChannel.count({ where: { communityId } });
      const channel = await (prisma as any).communityChannel.create({
        data: {
          communityId,
          name,
          description: description || '',
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
      const channel = await (prisma as any).communityChannel.update({
        where: { id: channelId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(isPaid !== undefined && { isPaid }),
          ...(price !== undefined && { price: price === null ? null : parseFloat(price) }),
          ...(currency !== undefined && { currency }),
          ...(position !== undefined && { position })
        }
      });
      return NextResponse.json({ ok: true, channel });
    }
    
    if (action === 'DELETE_CHANNEL') {
      const { channelId } = body;
      await (prisma as any).communityChannel.delete({ where: { id: channelId } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'UPDATE_PERMISSIONS') {
      const { permissions } = body;
      const updated = await (prisma as any).communityPermission.upsert({
        where: { communityId },
        create: { communityId, ...permissions },
        update: { ...permissions }
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

    if (action === 'UPDATE_PERMISSIONS') {
      const { permissions } = body;
      const updated = await (prisma as any).community.update({
        where: { id: communityId },
        data: { permissions: permissions || {} }
      });
      return NextResponse.json({ ok: true, community: updated });
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
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
