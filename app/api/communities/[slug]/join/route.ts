import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Retired (lib/security/retiredRoutes.ts). It joined any community by its id, private ones
 * included, with no invite code. The middleware answers 410 before this runs; the handler refuses
 * too, so removing the line from the retired list can never reopen it. Joining goes through
 * /api/chat/communities/join (invite code or signed invite, approval, rate limit).
 */
export async function POST() {
  return NextResponse.json({ error: 'Gone', message: 'Join with an invite link.' }, { status: 410 });
}
