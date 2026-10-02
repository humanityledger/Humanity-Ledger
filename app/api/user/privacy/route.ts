import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user/privacy?address=0x...
 * 
 * Returns the public-facing privacy settings for a given address.
 * Used by the sender side to respect the recipient's privacy preferences.
 * 
 * Example: If recipient has show_read_receipts=false, sender should NOT
 * show a read indicator.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
  }

  try {
    const user = await (prisma as any).user.findUnique({
      where: { walletAddress: address },
      select: {
        extendedSettings: true,
        lastActive: true,
      },
    });

    if (!user) {
      // Default permissive settings for unknown users
      return NextResponse.json({
        showReadReceipts: true,
        privacyLastSeen: 'everybody',
        privacyProfilePhoto: 'everybody',
        privacyBio: 'everybody',
        privacyGroupInvites: 'contacts',
      });
    }

    const ext: Record<string, any> =
      typeof user.extendedSettings === 'string'
        ? JSON.parse(user.extendedSettings)
        : (user.extendedSettings ?? {});

    return NextResponse.json({
      showReadReceipts:    ext.show_read_receipts    ?? true,
      privacyLastSeen:     ext.privacy_last_seen     ?? 'everybody',
      privacyProfilePhoto: ext.privacy_profile_photo ?? 'everybody',
      privacyBio:          ext.privacy_bio           ?? 'everybody',
      privacyGroupInvites: ext.privacy_group_invites ?? 'contacts',
      lastActive:          ext.privacy_last_seen === 'nobody' ? null : user.lastActive,
    });
  } catch (e: any) {
    console.error('[user/privacy] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
