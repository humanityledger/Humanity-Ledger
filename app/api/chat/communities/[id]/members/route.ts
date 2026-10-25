import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['ADMIN', 'MODERATOR', 'MEMBER'];
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

async function isAdminOrOwner(communityId: string, caller: string): Promise<boolean> {
  const community = await (prisma as any).community.findUnique({ where: { id: communityId } });
  if (!community) return false;
  if (community.ownerAddress?.toLowerCase() === caller) return true;
  const membership = await (prisma as any).communityMember.findFirst({
    where: { communityId, walletAddress: caller, role: 'ADMIN' },
  });
  return !!membership;
}

async function isOwner(communityId: string, address: string): Promise<boolean> {
  const community = await (prisma as any).community.findUnique({ where: { id: communityId } });
  return !!community && community.ownerAddress?.toLowerCase() === address;
}

// Only members can see who else is in a community.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: communityId } = await params;
    const mine = await (prisma as any).communityMember.findFirst({ where: { communityId, walletAddress: caller } });
    if (!mine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const members = await (prisma as any).communityMember.findMany({
      where: { communityId },
      orderBy: { joinedAt: 'asc' },
      take: 1000,
    });
    return NextResponse.json({ members });
  } catch (e: any) {
    console.error('[communities members GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Change member role (admin can promote or demote). The owner's role is fixed.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: communityId } = await params;
    if (!(await isAdminOrOwner(communityId, caller)))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { walletAddress, role } = await req.json().catch(() => ({}));
    if (typeof walletAddress !== 'string' || !ADDRESS.test(walletAddress) || typeof role !== 'string')
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    const target = walletAddress.toLowerCase();
    if (await isOwner(communityId, target))
      return NextResponse.json({ error: 'The owner role cannot be changed' }, { status: 403 });

    const updated = await (prisma as any).communityMember.updateMany({
      where: { communityId, walletAddress: target },
      data: { role },
    });
    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    console.error('[communities members PATCH]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Kick a member (admin) or leave (self). The owner can neither be kicked nor
// leave, because the community would be left without an owner. Delete it instead.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: communityId } = await params;
    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.walletAddress === 'string' ? body.walletAddress : caller;
    if (!ADDRESS.test(raw)) return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    const target = raw.toLowerCase();

    if (target !== caller && !(await isAdminOrOwner(communityId, caller)))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (await isOwner(communityId, target))
      return NextResponse.json({ error: 'The owner cannot be removed. Delete the community instead.' }, { status: 403 });

    await (prisma as any).communityMember.deleteMany({ where: { communityId, walletAddress: target } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[communities members DELETE]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
