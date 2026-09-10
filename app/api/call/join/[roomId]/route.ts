import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/call/join/[roomId]
 * Deep link landing page redirect.
 * Redirects the user to /chat?joinRoom=ROOMID so they can authenticate first,
 * then see the JoinCallModal pre-filled with the room ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const roomId = (params.roomId || '').toUpperCase().slice(0, 8);
  
  // Sanitize: only alphanumeric chars allowed in room IDs
  if (!/^[A-Z0-9]{6,8}$/.test(roomId)) {
    return NextResponse.redirect(new URL('/chat', req.url));
  }

  return NextResponse.redirect(new URL(`/chat?joinRoom=${roomId}`, req.url));
}
