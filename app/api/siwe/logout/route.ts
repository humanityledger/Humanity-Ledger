import { NextRequest, NextResponse } from 'next/server';
import { expireSessionCookies, revokeRequestSessions } from '@/lib/security/sessionCookies';

/**
 * POST /api/siwe/logout — same behaviour as /api/auth/logout.
 *
 * GET was removed: a state-changing GET lets any page sign the user out with
 * an <img src>. Both callers in this repository use POST.
 */
export async function POST(req: NextRequest) {
  await revokeRequestSessions(req).catch(() => 0);
  const res = NextResponse.json({ ok: true, message: 'System session terminated.' });
  expireSessionCookies(res, req.headers.get('host'));
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
