import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWallet } from "@/lib/security/requireWallet";

export const dynamic = 'force-dynamic';

/**
 * GET /api/registry/real-users — the registry of accounts, for signed-in members.
 *
 * [SECURITY 2026-10-28] This path is public in middleware.ts (/api/registry/),
 * so it answered anyone: the full list of wallet addresses with the exact
 * time each one was last active, which tells a watcher when every member is
 * online. It now needs a session (the /registry page already does), and the
 * activity time is given to the day only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const users = await prisma.user.findMany({
      where: { createdAt: { gte: new Date("2024-02-01T00:00:00Z") } },
      select: { walletAddress: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });

    const seen = new Set<string>();
    const combinedUsers: { walletAddress: string; updatedAt: string }[] = [];
    for (const u of users) {
      if (!u.walletAddress) continue;
      const key = u.walletAddress.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Day precision: enough to show who is around, not when they are online.
      combinedUsers.push({ walletAddress: u.walletAddress, updatedAt: u.updatedAt.toISOString().slice(0, 10) + "T00:00:00.000Z" });
    }

    return NextResponse.json(
      { users: combinedUsers, total: combinedUsers.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err: any) {
    console.error("[registry-real-users] Error:", err?.message);
    return NextResponse.json({ users: [], total: 0 }, { status: 503 });
  }
}
