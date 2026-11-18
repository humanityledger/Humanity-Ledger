import { NextRequest, NextResponse } from 'next/server';
import { isPersistableXmtpGroupId } from '@/lib/xmtp/groupId';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { randomBytes } from 'crypto';
import {
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

    // The database is the only place a community lives. When it cannot be written, nothing is
    // created and the caller is told so: a copy kept in this server's memory used to be returned as
    // created, then vanished on the next deploy or on another server, and its invite link answered
    // "expired" because joining reads the database.
    for (let attempt = 0; attempt < 3; attempt++) {
      const joinCode = generateJoinCode();
      try {
        const community = await (prisma as any).community.create({
          data: {
            name,
            description,
            isPrivate: body?.isPrivate !== false,
            ownerAddress: caller.toLowerCase(),
            joinCode,
            members: { create: { walletAddress: caller.toLowerCase(), role: 'ADMIN' } },
            channels: {
              create: [
                { name: 'general', description: 'General discussion', isPaid: false, position: 0 },
                { name: 'announcements', description: 'Announcements', isPaid: false, position: 1 },
              ],
            },
            permissions: { create: {} },
          },
        });
        return NextResponse.json({ community }, { status: 201 });
      } catch (e: any) {
        if (e?.code === 'P2002' && attempt < 2) continue; // join code already taken: draw another
        console.error('[chat/communities POST] not created:', e?.code || e?.message);
        return NextResponse.json(
          { error: 'Communities are unavailable right now. Nothing was created; try again in a minute.', code: 'STORE_UNAVAILABLE' },
          { status: 503 },
        );
      }
    }
    return NextResponse.json({ error: 'Could not create the community. Try again.', code: 'STORE_UNAVAILABLE' }, { status: 503 });
  } catch (error: any) {
    console.error('[chat/communities POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const PERMISSION_FLAGS = new Set([
  'sendMessages', 'sendMedia', 'sendStickers', 'sendPolls', 'embedLinks', 'addUsers', 'pinMessages',
  'changeInfo', 'antiSpam', 'requireApproval', 'postApproval', 'notifyNewMember',
]);
/** Slow mode choices offered in Manage: off, 10 s, 30 s, 1 min, 5 min, 1 h. */
const SLOW_MODE_SECONDS = [0, 10, 30, 60, 300, 3600];

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

    // Pin and Unpin: an admin, the owner, or any member when the community lets members pin.
    if (action === 'PIN_MESSAGE' || action === 'UNPIN_MESSAGE') {
      const messageId = body?.messageId;
      if (typeof messageId !== 'string' || messageId.length === 0 || messageId.length > 64) {
        return NextResponse.json({ error: 'Invalid post' }, { status: 400 });
      }
      if (memComm) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      try {
        const me = caller.toLowerCase();
        const [community, member, perms, post] = await Promise.all([
          (prisma as any).community.findUnique({ where: { id: communityId }, select: { ownerAddress: true } }),
          (prisma as any).communityMember.findUnique({ where: { communityId_walletAddress: { communityId, walletAddress: me } } }),
          (prisma as any).communityPermission.findUnique({ where: { communityId }, select: { pinMessages: true } }),
          (prisma as any).communityPost.findFirst({ where: { id: messageId, communityId }, select: { id: true } }),
        ]);
        if (!community) return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        const isOwner = community.ownerAddress?.toLowerCase() === me;
        const allowed = isOwner || member?.role === 'ADMIN' || (Boolean(member) && perms?.pinMessages === true);
        if (!allowed) return NextResponse.json({ error: 'Only admins can pin in this community' }, { status: 403 });
        if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        const pin = action === 'PIN_MESSAGE';
        const updated = await (prisma as any).communityPost.update({
          where: { id: messageId },
          // Unpin only clears the pin. The post is not deleted.
          data: pin ? { pinnedAt: new Date(), pinnedBy: me } : { pinnedAt: null, pinnedBy: null },
          select: { id: true, pinnedAt: true },
        });
        return NextResponse.json({ ok: true, post: updated });
      } catch (e: any) {
        console.error('[chat/communities PATCH pin]', e?.code || e?.message);
        return NextResponse.json({ error: 'Could not change the pin. Try again.' }, { status: 503 });
      }
    }

    try {
      const [member, owned] = await Promise.all([
        (prisma as any).communityMember.findUnique({
          where: { communityId_walletAddress: { communityId, walletAddress: caller.toLowerCase() } },
        }),
        (prisma as any).community.findUnique({ where: { id: communityId }, select: { ownerAddress: true } }),
      ]);
      // The owner always manages their community, even without an ADMIN membership row (older
      // communities, or one whose owner row was lost): the screen showed them every setting and the
      // server answered 403 to channels, permissions and the invite link (18 November 2026).
      const isOwner = !!owned?.ownerAddress && String(owned.ownerAddress).toLowerCase() === caller.toLowerCase();
      if (!isOwner && (!member || member.role !== 'ADMIN')) {
        return NextResponse.json({ error: 'Only admins can change these settings.' }, { status: 403 });
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
        const { name, description, isPaid, price, currency, xmtpGroupId } = body;
        const community = await (prisma as any).community.findUnique({
          where: { id: communityId },
          select: { communityMls: true },
        });
        // Only a community already flagged communityMls may store a group id.
        // The id is the one createSecureGroup returned. Existing communities stay without one.
        const mls = community?.communityMls === true;
        if (mls && !isPersistableXmtpGroupId(xmtpGroupId)) {
          return NextResponse.json(
            { error: 'Create the XMTP group in the client first and send its group id.', code: 'XMTP_GROUP_REQUIRED' },
            { status: 400 },
          );
        }
        const count = await (prisma as any).communityChannel.count({ where: { communityId } });
        const channel = await (prisma as any).communityChannel.create({
          data: {
            communityId,
            name: clean(name, 40),
            description: description ? clean(description, MAX_DESCRIPTION) : '',
            isPaid: Boolean(isPaid),
            price: price ? parseFloat(price) : null,
            currency: currency || null,
            position: count,
            ...(mls ? { xmtpGroupId } : {}),
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
        // Only the columns of CommunityPermission. An unknown key used to reach Prisma and fail the
        // whole save; slow mode is a number and was dropped, so it never saved.
        const flags: Record<string, boolean | number> = {};
        if (body.permissions && typeof body.permissions === 'object') {
          for (const [k, v] of Object.entries(body.permissions as Record<string, unknown>)) {
            if (typeof v === 'boolean' && PERMISSION_FLAGS.has(k)) flags[k] = v;
            if (k === 'slowModeSeconds' && typeof v === 'number' && SLOW_MODE_SECONDS.includes(v)) flags[k] = v;
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
