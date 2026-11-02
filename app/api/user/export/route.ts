/**
 * C-017 — GDPR Article 20 Data Export
 * GET /api/user/export
 * Returns all server-side data for the authenticated user as JSON.
 * Does NOT include data encrypted with XMTP (private messages stored client-side).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const caller = await requireWallet(req);
  if (caller.errorResponse) return caller.errorResponse;

  const address = caller.walletAddress.toLowerCase();

  // Collect all server-side data for this user
  const [profile, communityMemberships, posts, contacts] = await Promise.all([
    prisma.user.findFirst({
      where: {
        OR: [
          { walletAddress: { equals: address, mode: 'insensitive' } },
          { walletAddress: address },
        ],
      },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
      },
    }).catch(() => null),

    prisma.communityMember.findMany({
      where: { walletAddress: { equals: address, mode: 'insensitive' } },
      select: {
        communityId: true,
        role: true,
        joinedAt: true,
      },
      take: 1000,
    }).catch(() => []),

    prisma.communityPost.findMany({
      where: { authorAddress: { equals: address, mode: 'insensitive' } },
      select: {
        id: true,
        communityId: true,
        content: true,
        createdAt: true,
      },
      take: 1000,
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),

    prisma.chatContact.findMany({
      where: { owner: { equals: address, mode: 'insensitive' } },
      select: {
        peer: true,
        updatedAt: true,
      },
      take: 500,
    }).catch(() => []),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    dataController: 'Humanity Ledger',
    subject: address,
    profile,
    communityMemberships,
    publicCommunityPosts: posts,
    contacts,
    note: 'Private messages are stored end-to-end encrypted on XMTP and are not accessible to the server.',
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="humanity-ledger-export-${Date.now()}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
