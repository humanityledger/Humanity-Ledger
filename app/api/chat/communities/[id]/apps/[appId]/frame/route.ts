import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { resolveCommunityAccess, appVisibleTo } from '@/lib/community-apps/access';
import { buildAppDocument } from '@/lib/community-apps/sdk';
import { APP_FRAME_CSP } from '@/lib/community-apps/framePolicy';

export const dynamic = 'force-dynamic';

/**
 * The app as a document of its own, loaded by AppFrame into a sandboxed
 * iframe. The middleware replaces the site CSP with APP_FRAME_CSP for this
 * path; the header is repeated here so the policy holds even if that match
 * ever changes. The ?v= query only defeats caches between versions.
 */
function page(status: number, text: string) {
  return new NextResponse(
    buildAppDocument(`<div class="app"><div class="empty">${text}</div></div>`, 'App'),
    { status, headers: headers() },
  );
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': APP_FRAME_CSP,
    'X-Frame-Options': 'SAMEORIGIN',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; appId: string }> }) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return page(401, 'Sign in to Ledger Chat to open this app.');
  const { id, appId } = await params;
  const access = await resolveCommunityAccess(id, auth.walletAddress);
  if (!access || !access.canView) return page(404, 'This app does not exist or is not shared with you.');
  const app = await (prisma as any).communityApp.findFirst({
    where: { id: appId, communityId: id },
    select: { html: true, title: true, status: true, creatorAddress: true },
  });
  if (!app || !appVisibleTo(app, access)) return page(404, 'This app does not exist or is not shared with you.');

  return new NextResponse(buildAppDocument(app.html, app.title), { status: 200, headers: headers() });
}
