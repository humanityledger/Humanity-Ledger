import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/login — disabled.
 *
 * The previous handler never checked the password it asked for. Any email on
 * a hard-coded public list, plus the second-factor code "123456" (accepted
 * unconditionally, next to a default of "246810"), returned an admin token.
 *
 * Admin routes are protected by ADMIN_SECRET (lib/admin-guard.ts) or by the
 * ADMIN_WALLET_ADDRESS session check (lib/admin.ts). A browser sign-in for
 * admins needs a real password hash and a real TOTP secret per admin before
 * it comes back.
 */
export async function POST() {
  return NextResponse.json(
    { success: false, message: 'Admin sign-in is disabled. Sign in with the admin wallet instead.' },
    { status: 410 },
  );
}
