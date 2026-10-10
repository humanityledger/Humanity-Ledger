import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getCaller(req: NextRequest): Promise<string | null> {
  return req.headers.get('x-web3-address')?.toLowerCase() ||
    req.headers.get('x-verified-session-address')?.toLowerCase() || null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const community = await (prisma as any).community.findUnique({
      where: { id: params.id },
      include: {
        members: true,
        _count: { select: { members: true, posts: true } }
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const community = await (prisma as any).community.findUnique({ where: { id: params.id } });
    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const membership = await (prisma as any).communityMember.findFirst({
      where: { communityId: params.id, walletAddress: caller }
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

    const updated = await (prisma as any).community.update({ where: { id: params.id }, data });
    return NextResponse.json({ community: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const community = await (prisma as any).community.findUnique({ where: { id: params.id } });
    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (community.ownerAddress?.toLowerCase() !== caller)
      return NextResponse.json({ error: 'Only owner can delete' }, { status: 403 });

    await (prisma as any).community.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
