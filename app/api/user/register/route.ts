import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/register — create or update the caller's own chat profile.
 *
 * This path is public in middleware.ts, so the middleware never injects a
 * verified identity here. The previous version compared the body's address
 * with `x-verified-session-address`, which on a public path is always
 * missing, so the check never ran: anyone, signed in or not, could rewrite
 * the name, @username, bio and avatar of any wallet. Identity now comes from
 * the session only, and a body address that differs is refused.
 *
 * Usernames are unique, case-insensitively. Without that, anyone could take
 * the @name of someone people already talk to.
 */
const AVATAR_MAX = 500_000;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const caller = auth.walletAddress;

    const rl = await checkRateLimit(caller, { max: 20, windowSec: 600, prefix: 'rl:profile' });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many profile changes. Try again in a few minutes.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { walletAddress, displayName, chatName, bio, avatarUrl } = body ?? {};
    if (typeof walletAddress === 'string' && walletAddress.toLowerCase() !== caller) {
      return NextResponse.json({ error: 'You can only set up your own profile.' }, { status: 403 });
    }

    const safeDisplayName = typeof displayName === 'string' ? displayName.trim().slice(0, 50) : undefined;
    const safeChatName = typeof chatName === 'string' ? chatName.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 32) : undefined;
    const safeBio = typeof bio === 'string' ? bio.trim().slice(0, 250) : undefined;
    let safeAvatarUrl: string | undefined;
    if (typeof avatarUrl === 'string' && avatarUrl) {
      // An avatar is shown to everyone who sees this person. Only images we
      // can render without contacting a third party: an inline image, or one
      // served by us. A remote URL would report every viewer's IP address to
      // whoever runs that server.
      const inline = avatarUrl.length < AVATAR_MAX && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatarUrl);
      const ours = /^\/(?!\/)[\w\-./]{1,300}$/.test(avatarUrl);
      if (!inline && !ours) return NextResponse.json({ error: 'The avatar must be an uploaded image.' }, { status: 400 });
      safeAvatarUrl = avatarUrl;
    }

    if (safeChatName) {
      if (safeChatName.length < 3) {
        return NextResponse.json({ error: 'A username needs at least 3 characters.' }, { status: 400 });
      }
      const taken = await (prisma as any).user.findFirst({
        where: { chatName: { equals: safeChatName, mode: 'insensitive' }, NOT: { walletAddress: caller } },
        select: { id: true },
      });
      if (taken) return NextResponse.json({ error: 'That username is taken.' }, { status: 409 });
    }

    const user = await (prisma as any).user.upsert({
      where: { walletAddress: caller },
      update: {
        ...(safeDisplayName !== undefined && { displayName: safeDisplayName }),
        ...(safeChatName && { chatName: safeChatName }),
        ...(safeBio !== undefined && { bio: safeBio }),
        ...(safeAvatarUrl !== undefined && { avatarUrl: safeAvatarUrl }),
      },
      create: {
        walletAddress: caller,
        displayName: safeDisplayName || null,
        ...(safeChatName && { chatName: safeChatName }),
        bio: safeBio || null,
        avatarUrl: safeAvatarUrl || null,
        creditsBalance: 0,
      },
      select: { walletAddress: true, displayName: true, chatName: true, bio: true, avatarUrl: true },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    console.error('[user/register] Error:', error?.message);
    return NextResponse.json({ error: 'The profile could not be saved.' }, { status: 500 });
  }
}
