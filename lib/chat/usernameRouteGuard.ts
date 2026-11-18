/**
 * lib/chat/usernameRouteGuard.ts — a clear answer when the username store cannot be used.
 *
 * On 18 Nov 2026 the ChatUsername migration had not run (the deploy could not take Prisma's
 * migrate lock), every call failed with P2021 and the app answered a bare 500: the profile showed
 * no QR code and Save did nothing visible. Store errors now answer 503 with a sentence the screen
 * shows, and the detail goes to the server log.
 */
import { NextResponse } from 'next/server';

/** Prisma codes that mean "the store is not there or not reachable", not "your request is wrong". */
const STORE_DOWN = new Set(['P2021', 'P2022', 'P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

export const USERNAME_STORE_DOWN = 'Usernames are not available right now. Try again in a minute.';

export function isStoreDown(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code;
  if (typeof code === 'string' && STORE_DOWN.has(code)) return true;
  const name = (e as { name?: unknown })?.name;
  return name === 'PrismaClientInitializationError';
}

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

export function guardUsernameStore<A extends unknown[]>(route: string, handler: Handler<A>): Handler<A> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      const code = (e as { code?: unknown })?.code;
      console.error(`[${route}] ${isStoreDown(e) ? 'store unavailable' : 'failed'}${typeof code === 'string' ? ` (${code})` : ''}:`, (e as Error)?.message ?? e);
      if (isStoreDown(e)) {
        return NextResponse.json({ error: USERNAME_STORE_DOWN, problem: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } });
      }
      return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
