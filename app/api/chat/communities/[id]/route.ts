import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

export const dynamic = 'force-dynamic';

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const isSafeAvatar = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length <= 400_000 &&
  /^(https:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(v);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Reading a community requires a signed in wallet. Private communities are
    // visible to members only, and the invite code and member list are never
    // shown to people who have not joined.
    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: communityId } = await params;
    const community = await (prisma as any).community.findUnique({
      where: { id: communityId },
      include: {
        members: true,
        channels: { orderBy: { position: 'asc' } },
        permissions: true,
        _count: { select: { members: true, posts: true, channels: true } },
      },
    });
    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isMember =
      community.ownerAddress?.toLowerCase() === caller ||
      (community.members || []).some((m: any) => String(m.walletAddress).toLowerCase() === caller);

    if (community.isPrivate && !isMember) {
      // Same answer as a missing community, so ids cannot be probed.
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { joinCode, members, ...rest } = community;
    return NextResponse.json({
      community: {
        ...rest,
        ...(isMember ? { members, joinCode } : { members: [] }),
        isMember,
        membersCount: community._count.members,
        postsCount: community._count.posts,
      },
    });
  } catch (e: any) {
    console.error('[communities/[id] GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: communityId } = await params;
    const community = await (prisma as any).community.findUnique({ where: { id: communityId } });
    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const membership = await (prisma as any).communityMember.findFirst({
      where: { communityId, walletAddress: caller },
    });
    const isAdmin = community.ownerAddress?.toLowerCase() === caller || membership?.role === 'ADMIN';
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, any> = {};
    if (body.name !== undefined) {
      const name = clean(body.name, 60);
      if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
      data.name = name;
    }
    if (body.description !== undefined) data.description = clean(body.description, 280);
    if (body.isPrivate !== undefined) data.isPrivate = Boolean(body.isPrivate);
    if (body.avatarUrl !== undefined) data.avatarUrl = isSafeAvatar(body.avatarUrl) ? body.avatarUrl : null;
    // Permissions are changed through /api/chat/communities (UPDATE_PERMISSIONS),
    // which accepts boolean flags only. Passing a client object straight into a
    // Prisma relation would allow nested writes, so it is not accepted here.

    const updated = await (prisma as any).community.update({ where: { id: communityId }, data });
    return NextResponse.json({ community: updated });
  } catch (e: any) {
    console.error('[communities/[id] PATCH]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: communityId } = await params;
    const community = await (prisma as any).community.findUnique({ where: { id: communityId } });
    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (community.ownerAddress?.toLowerCase() !== caller)
      return NextResponse.json({ error: 'Only owner can delete' }, { status: 403 });

    await (prisma as any).community.delete({ where: { id: communityId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[communities/[id] DELETE]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
