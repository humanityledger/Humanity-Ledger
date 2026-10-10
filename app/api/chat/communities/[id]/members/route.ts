import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getCaller(req: NextRequest): Promise<string | null> {
  return req.headers.get('x-web3-address')?.toLowerCase() || null;
}

async function isAdminOrOwner(communityId: string, caller: string): Promise<boolean> {
  const community = await (prisma as any).community.findUnique({ where: { id: communityId } });
  if (!community) return false;
  if (community.ownerAddress?.toLowerCase() === caller) return true;
  const membership = await (prisma as any).communityMember.findFirst({
    where: { communityId, walletAddress: caller, role: 'ADMIN' }
  });
  return !!membership;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const members = await (prisma as any).communityMember.findMany({
      where: { communityId: params.id },
      orderBy: { joinedAt: 'asc' }
    });
    return NextResponse.json({ members });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Change member role (admin can promote/demote)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!(await isAdminOrOwner(params.id, caller)))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { walletAddress, role } = await req.json();
    if (!walletAddress || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const updated = await (prisma as any).communityMember.updateMany({
      where: { communityId: params.id, walletAddress: walletAddress.toLowerCase() },
      data: { role }
    });
    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Kick member (admin) or leave (self)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const target = (body.walletAddress || caller).toLowerCase();

    if (target !== caller) {
      if (!(await isAdminOrOwner(params.id, caller)))
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await (prisma as any).communityMember.deleteMany({
      where: { communityId: params.id, walletAddress: target }
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
