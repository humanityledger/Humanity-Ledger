import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: communityId } = await params;
    const community = await (prisma as any).community.findUnique({
      where: { id: communityId },
      include: {
        members: true,
        channels: { orderBy: { position: 'asc' } },
        permissions: true,
        _count: { select: { members: true, posts: true, channels: true } }
      }
    });
    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      community: {
        ...community,
        membersCount: community._count.members,
        postsCount: community._count.posts,
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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
      where: { communityId, walletAddress: caller }
    });
    const isAdmin =
      community.ownerAddress?.toLowerCase() === caller ||
      membership?.role === 'ADMIN';
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const data: Record<string, any> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.isPrivate !== undefined) data.isPrivate = Boolean(body.isPrivate);
    if (body.permissions !== undefined) data.permissions = body.permissions;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;

    const updated = await (prisma as any).community.update({ where: { id: communityId }, data });
    return NextResponse.json({ community: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
