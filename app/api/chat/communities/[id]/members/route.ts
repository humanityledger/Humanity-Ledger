import { NextRequest, NextResponse } from 'next/server';
import { legacyPostsClosed } from '@/lib/communities/legacy';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';
import { memberNames } from '@/lib/communities/member-names';
import { zkVerifiedWallets } from '@/lib/communities/identity';
import { listJoinRequests, removeJoinRequest } from '@/lib/communities/join-requests';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['ADMIN', 'MODERATOR', 'MEMBER'];
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * Owner > Admin > Moderator > Member (lib/communities/roles.ts). Acting on someone needs a higher
 * rank than theirs, and a role can only be given below your own: an admin can no longer demote or
 * remove another admin, and nobody but the owner makes admins (security review, 27/11/2026).
 */
const RANK: Record<string, number> = { OWNER: 3, ADMIN: 2, MODERATOR: 1, MEMBER: 0 };

async function roleIn(communityId: string, address: string): Promise<'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | null> {
  const community = await (prisma as any).community.findUnique({ where: { id: communityId }, select: { ownerAddress: true } });
  if (!community) return null;
  if (String(community.ownerAddress || '').toLowerCase() === address) return 'OWNER';
  const m = await (prisma as any).communityMember.findUnique({ where: { communityId_walletAddress: { communityId, walletAddress: address } } });
  if (!m) return null;
  return m.role === 'ADMIN' || m.role === 'MODERATOR' ? m.role : 'MEMBER';
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
    const community = await (prisma as any).community.findUnique({ where: { id: communityId }, select: { ownerAddress: true } });
    const manager = String(community?.ownerAddress || '').toLowerCase() === caller || mine.role === 'ADMIN';
    const requests = manager ? await listJoinRequests(communityId).catch(() => []) : [];
    const [names, verified] = await Promise.all([
      memberNames([...members.map((m: any) => m.walletAddress), ...requests.map((r) => r.address)]),
      zkVerifiedWallets(members.map((m: any) => m.walletAddress)),
    ]);
    return NextResponse.json({
      members: members.map((m: any) => {
        const a = String(m.walletAddress || '').toLowerCase();
        return { ...m, name: names.get(a) ?? null, isZkVerified: verified.has(a) };
      }),
      ...(manager ? { requests: requests.map((r) => ({ walletAddress: r.address, at: r.at, name: names.get(r.address) ?? null })) } : {}),
    });
  } catch (e: any) {
    console.error('[communities members GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Add a member by Ethereum address (admin or owner). Adding someone already there updates nothing
// but their role; the owner's role is never changed here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: communityId } = await params;
    const actor = await roleIn(communityId, caller);
    if (actor !== 'OWNER' && actor !== 'ADMIN')
      return NextResponse.json({ error: 'Only the owner and admins can add members.' }, { status: 403 });

    const { walletAddress, role = 'MEMBER' } = await req.json().catch(() => ({}));
    if (typeof walletAddress !== 'string' || !ADDRESS.test(walletAddress))
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    if (typeof role !== 'string' || !ALLOWED_ROLES.includes(role))
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    if (RANK[role] >= RANK[actor])
      return NextResponse.json({ error: 'You can only give a role below your own.' }, { status: 403 });

    const target = walletAddress.toLowerCase();
    const current = await roleIn(communityId, target);
    if (current === 'OWNER') return NextResponse.json({ error: 'The owner is already a member' }, { status: 409 });
    // Adding someone who is already in changes nothing: roles change through PATCH, with its checks.
    if (current) return NextResponse.json({ error: 'Already a member', code: 'ALREADY_MEMBER' }, { status: 409 });

    const member = await (prisma as any).communityMember.create({
      data: { communityId, walletAddress: target, role },
    });
    await removeJoinRequest(communityId, target).catch(() => {});

    try {
      const row = await (prisma as any).community.findUnique({ where: { id: communityId }, select: { communityMls: true } });
      // MLS: the text never lives here. Legacy: read-only (lib/communities/legacy.ts).
      if (row?.communityMls !== true && !legacyPostsClosed(row)) {
        await (prisma as any).communityPost.create({
          data: { communityId, authorAddress: 'system', content: `__SYSTEM__${target} was added to the group` },
        });
      }
    } catch (e) {
      console.error('[communities members POST] welcome post', e);
    }

    return NextResponse.json({ ok: true, member }, { status: 201 });
  } catch (e: any) {
    console.error('[communities members POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Change member role (admin can promote or demote). The owner's role is fixed.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: communityId } = await params;
    const actor = await roleIn(communityId, caller);
    if (actor !== 'OWNER' && actor !== 'ADMIN')
      return NextResponse.json({ error: 'Only the owner and admins can change roles.' }, { status: 403 });

    const { walletAddress, role } = await req.json().catch(() => ({}));
    if (typeof walletAddress !== 'string' || !ADDRESS.test(walletAddress) || typeof role !== 'string')
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    const target = walletAddress.toLowerCase();
    const current = await roleIn(communityId, target);
    if (!current) return NextResponse.json({ error: 'Not a member' }, { status: 404 });
    if (current === 'OWNER')
      return NextResponse.json({ error: 'The owner role cannot be changed' }, { status: 403 });
    if (RANK[current] >= RANK[actor] || RANK[role] >= RANK[actor])
      return NextResponse.json({ error: 'You can only change the role of someone below you, to a role below your own.' }, { status: 403 });

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

    // Declining a join request (requireApproval): owner and admins only.
    if (body?.request === true) {
      const actor = await roleIn(communityId, caller);
      if (actor !== 'OWNER' && actor !== 'ADMIN') return NextResponse.json({ error: 'Only the owner and admins answer join requests.' }, { status: 403 });
      await removeJoinRequest(communityId, target);
      return NextResponse.json({ ok: true });
    }

    const current = await roleIn(communityId, target);
    if (current === 'OWNER')
      return NextResponse.json({ error: 'The owner cannot be removed. Delete the community instead.' }, { status: 403 });
    if (!current) return NextResponse.json({ error: 'Not a member' }, { status: 404 });
    if (target !== caller) {
      // Owner, admins and moderators remove members; only someone of a higher rank than the target.
      const actor = await roleIn(communityId, caller);
      if (!actor || actor === 'MEMBER' || RANK[current] >= RANK[actor])
        return NextResponse.json({ error: 'You can only remove someone below you.' }, { status: 403 });
    }

    await (prisma as any).communityMember.deleteMany({ where: { communityId, walletAddress: target } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[communities members DELETE]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
