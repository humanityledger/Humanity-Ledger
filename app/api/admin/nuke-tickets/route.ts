import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

// DESTRUCTIVE ENDPOINT  requires X-Admin-Secret header + explicit confirmation body.
// Changed from GET to POST: destructive operations must never be idempotent GET requests
// (browser prefetch, CDN crawlers, health checks could accidentally trigger a full wipe).
export async function POST(req: Request) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const body = await req.json().catch(() => ({}));

    // Double-confirmation guard: the caller must explicitly pass { confirm: "NUKE_ALL" }
    if (body?.confirm !== 'NUKE_ALL') {
      return NextResponse.json(
        { error: 'Missing confirmation. Pass { "confirm": "NUKE_ALL" } in the request body.' },
        { status: 400 }
      );
    }

    const deletedTickets = await (prisma as any).goldenTicket.deleteMany({});
    const deletedUsers = await (prisma as any).user.deleteMany({});

    console.warn(`[AdminNuke] ️  FULL WIPE EXECUTED  tickets: ${deletedTickets.count}, users: ${deletedUsers.count}`);

    return NextResponse.json({
      success: true,
      message: 'All Golden Tickets and Users have been deleted.',
      deletedTicketsCount: deletedTickets.count,
      deletedUsersCount: deletedUsers.count,
    });
  } catch (error: any) {
    console.error('[AdminNuke] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

