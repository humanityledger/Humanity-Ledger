import { NextRequest, NextResponse } from 'next/server';

/**
 * withAuth — Higher-order function wrapper for authenticated route handlers.
 *
 * Usage:
 *   export const GET = withAuth(async (req, ctx, caller) => {
 *     // caller.walletAddress is verified
 *   });
 *
 *   export const POST = withAuth(async (req, ctx, caller) => { ... }, { admin: true });
 */

import { requireWallet } from './requireWallet';

interface AuthOptions {
  /** Require a wallet session (default: true) */
  wallet?: boolean;
  /** Require admin role (default: false) */
  admin?: boolean;
}

type AuthenticatedHandler = (
  req: NextRequest,
  ctx: any,
  caller: Awaited<ReturnType<typeof requireWallet>>
) => Promise<NextResponse> | NextResponse;

export function withAuth(
  handler: AuthenticatedHandler,
  opts: AuthOptions = { wallet: true }
) {
  return async (req: NextRequest, ctx?: any): Promise<NextResponse> => {
    try {
      const caller = await requireWallet(req);

      if (opts.admin && !(caller as any).isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: admin access required' },
          { status: 403 }
        );
      }

      return await handler(req, ctx, caller);
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 401;
      return NextResponse.json(
        { error: e?.message || 'Unauthorized' },
        { status }
      );
    }
  };
}
