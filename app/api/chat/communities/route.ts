import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function resolveCaller(req: NextRequest) {
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  return req.headers.get('x-web3-address')?.toLowerCase();
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
            _count: { select: { members: true } }
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, description, isPrivate } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

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
        }
      }
    });

    return NextResponse.json({ community });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
