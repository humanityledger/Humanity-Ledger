import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { validateSecureRequest } from '@/lib/security/premium-security';

const updateProfileSchema = z.object({
  walletAddress: z.string().min(10),
  displayName: z.string().max(50).optional(),
  chatName: z.string().max(50).optional(),
  // Same rule as /api/user/register: no third-party image URLs, because a
  // remote avatar reports the IP of everyone who views the profile.
  avatarUrl: z.string().max(500_000)
    .refine(v => v === '' || /^\/(?!\/)[\w\-./]{1,300}$/.test(v) || /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v), 'The avatar must be an uploaded image.')
    .optional(),
  bio: z.string().max(250).optional().or(z.literal('')),
  theme: z.string().optional(),
  currency: z.string().optional(),
  language: z.string().optional(),
  displayUnit: z.string().optional(),
  gasPreset: z.string().optional(),
  mevProtection: z.boolean().optional(),
  stealthMode: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const validation = await validateSecureRequest(req);

    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');
    if (!walletAddress) return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });

    const isOwner = validation.valid && validation.userId?.toLowerCase() === walletAddress.toLowerCase();

    // Try extended schema first, fall back to base columns
    let user: any = null;
    try {
      user = await (prisma as any).user.findFirst({ where: { walletAddress: { equals: walletAddress, mode: 'insensitive' } },
        select: { 
          id: true, walletAddress: true, displayName: true, chatName: true, avatarUrl: true, bio: true, isPro: true, tier: true,
          theme: true, currency: true, language: true, displayUnit: true, gasPreset: true, mevProtection: true, stealthMode: true,
          creditsBalance: true, humanityScore: true
        }
      });
    } catch {
      // Extended columns not yet in DB  use base
      user = await prisma.user.findFirst({ where: { walletAddress: { equals: walletAddress, mode: 'insensitive' } },
        select: { id: true, walletAddress: true }
      });
      if (user) user = { ...user, displayName: null, chatName: null, avatarUrl: null, bio: null, isPro: false, tier: 'basic' };
    }

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Strip private fields if not owner
    if (!isOwner) {
        // Anyone can read the public profile (name, photo, bio). Balances,
        // plan and preferences stay private to the owner.
        delete user.id;
        delete user.creditsBalance;
        delete user.isPro;
        delete user.tier;
        delete user.humanityScore;
        delete user.theme;
        delete user.currency;
        delete user.language;
        delete user.displayUnit;
        delete user.gasPreset;
        delete user.mevProtection;
        delete user.stealthMode;
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    console.error('[API] GET User Profile Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const validation = await validateSecureRequest(req);
    if (!validation.valid || !validation.userId) {
        return NextResponse.json({ error: 'Unauthorized: Authentication required to modify profile.' }, { status: 401 });
    }

    const body = await req.json();
    const result = updateProfileSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.format() }, { status: 400 });

    const { walletAddress, displayName, chatName, avatarUrl, bio, theme, currency, language, displayUnit, gasPreset, mevProtection, stealthMode } = result.data;

    let authorizedUserId = validation.userId.toLowerCase();
    
    // UUID mapping for email users
    if (authorizedUserId.includes('-') && authorizedUserId.length > 30) {
      const authUser = await prisma.authUser.findUnique({ where: { id: validation.userId } });
      if (authUser?.walletAddress) {
        authorizedUserId = authUser.walletAddress.toLowerCase();
      } else if (authUser?.email) {
        // Fallback to email if no wallet connected
        authorizedUserId = authUser.email.toLowerCase();
      }
    }

    if (authorizedUserId !== walletAddress.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden: You can only modify your own profile.' }, { status: 403 });
    }

    // Usernames are unique, case-insensitively (see /api/user/register).
    if (chatName) {
      const taken = await (prisma as any).user.findFirst({
        where: { chatName: { equals: chatName, mode: 'insensitive' }, NOT: { walletAddress: { equals: walletAddress, mode: 'insensitive' } } },
        select: { id: true },
      }).catch(() => null);
      if (taken) return NextResponse.json({ error: 'That username is taken.' }, { status: 409 });
    }

    // Try full upsert with all profile columns
    try {
      const user = await (prisma as any).user.upsert({
        where:  { walletAddress: walletAddress.toLowerCase() },
        update: {
          ...(displayName !== undefined && { displayName }),
          ...(chatName !== undefined && { chatName }),
          ...(avatarUrl !== undefined && { avatarUrl: avatarUrl === '' ? null : avatarUrl }),
          ...(bio !== undefined && { bio: bio === '' ? null : bio }),
          ...(theme !== undefined && { theme }),
          ...(currency !== undefined && { currency }),
          ...(language !== undefined && { language }),
          ...(displayUnit !== undefined && { displayUnit }),
          ...(gasPreset !== undefined && { gasPreset }),
          ...(mevProtection !== undefined && { mevProtection }),
          ...(stealthMode !== undefined && { stealthMode }),
        },
        create: {
          walletAddress: walletAddress.toLowerCase(),
          displayName: displayName || null,
          chatName: chatName || null,
          avatarUrl: avatarUrl === '' ? null : (avatarUrl || null),
          bio: bio === '' ? null : (bio || null),
          theme: theme || "light",
          currency: currency || "USD",
          language: language || "en-US",
          displayUnit: displayUnit || "FIAT",
          gasPreset: gasPreset || "STANDARD",
          mevProtection: mevProtection ?? false,
          stealthMode: stealthMode ?? false,
          creditsBalance: 0, // No welcome bonus
        }
      });
      return NextResponse.json({ success: true, data: user });
    } catch {
      // Extended columns don't exist yet  minimal fallback (walletAddress only)
      const fallbackUser = await prisma.user.upsert({
        where:  { walletAddress: walletAddress.toLowerCase() },
        update: {},
        create: { walletAddress: walletAddress.toLowerCase() }
      });
      return NextResponse.json({ success: true, data: fallbackUser, warning: 'Profile columns not yet in DB  run /api/admin/sync-db' });
    }
  } catch (error: any) {
    console.error('[API] PUT User Profile Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
