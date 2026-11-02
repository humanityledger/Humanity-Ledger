import { NextRequest, NextResponse } from "next/server";
import { expireSessionCookies, revokeRequestSessions } from "@/lib/security/sessionCookies";

/**
 * POST /api/auth/logout
 *
 * Called by the Disconnect button (hooks/useSystemSignOut.ts).
 *
 * 1. Revokes every session token the browser holds, server-side (Redis,
 *    shared by all instances), so a copy taken earlier stops working.
 * 2. Expires every session cookie, including hl_session, the primary one,
 *    which this endpoint used to leave behind (lib/security/sessionCookies.ts).
 */
export async function POST(request: NextRequest) {
  await revokeRequestSessions(request).catch(() => 0);
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  expireSessionCookies(response, request.headers.get("host"));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
