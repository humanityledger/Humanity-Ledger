import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/register
 *
 * PUBLIC endpoint — no SIWE session required.
 * Called during the LedgerChatOnboarding flow BEFORE a session cookie is
 * established (user has just connected wallet but hasn't completed SIWE sign).
 *
 * Creates or updates a User record in the DB so that profile data persists
 * across devices and sessions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, displayName, chatName, bio, avatarUrl } = body;

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 10) {
      return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    }

    const normalized = walletAddress.toLowerCase();

    // Verify caller is registering themselves.
    // After SIWE the middleware injects x-verified-session-address.
    // During onboarding (pre-SIWE) that header may be absent — still allowed
    // since this is a self-registration endpoint (no sensitive data exposed).
    const sessionAddr = req.headers.get('x-verified-session-address');
    if (sessionAddr && sessionAddr.toLowerCase() !== normalized) {
      return NextResponse.json({ error: 'Forbidden: you can only register your own address' }, { status: 403 });
    }

    // Sanitize inputs
    const safeDisplayName = typeof displayName === 'string' ? displayName.slice(0, 50).trim() : undefined;
    const safeChatName    = typeof chatName    === 'string' ? chatName.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 50) : undefined;
    const safeBio         = typeof bio         === 'string' ? bio.slice(0, 250).trim() : undefined;
    // avatarUrl is expected to be a data: URI (compressed on client) or https URL
    const safeAvatarUrl   = typeof avatarUrl   === 'string' && avatarUrl.length < 500_000 ? avatarUrl : undefined;

    let user: any;
    try {
      // Attempt full upsert with extended profile columns
      user = await (prisma as any).user.upsert({
        where:  { walletAddress: normalized },
        update: {
          ...(safeDisplayName !== undefined && { displayName: safeDisplayName }),
          ...(safeChatName    !== undefined && { chatName:    safeChatName }),
          ...(safeBio         !== undefined && { bio:         safeBio }),
          ...(safeAvatarUrl   !== undefined && { avatarUrl:   safeAvatarUrl }),
          updatedAt: new Date(),
        },
        create: {
          walletAddress:  normalized,
          displayName:    safeDisplayName || null,
          chatName:       safeChatName    || null,
          bio:            safeBio         || null,
          avatarUrl:      safeAvatarUrl   || null,
          creditsBalance: 0,
        },
      });
    } catch {
      // Fallback: some extended columns may not exist yet in the DB schema
      user = await prisma.user.upsert({
        where:  { walletAddress: normalized },
        update: {},
        create: { walletAddress: normalized },
      });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    console.error('[user/register] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
