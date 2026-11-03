/**
 * lib/community-apps/routeErrors.ts
 *
 * Every community-apps route used to let a database error escape, so Next
 * answered with an empty 500 and the Apps tab showed "Request failed (500)".
 * The usual cause is not a bug in the route: the CommunityApp and
 * CommunityAppEntry tables exist in one database (they were added to Neon
 * with SQL on 23 Oct) and not in the one DATABASE_URL points at, or the
 * Prisma client was generated before those models existed.
 *
 * appsRoute() wraps a handler, names the cause, logs it once with an id the
 * user can copy, and answers with { error, code, errorId }. It never puts the
 * raw error message in the response.
 */

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export type AppsErrorCode =
  | 'APPS_NOT_PROVISIONED'
  | 'APPS_CLIENT_OUTDATED'
  | 'DATABASE_UNAVAILABLE'
  | 'INTERNAL';

export interface AppsErrorInfo {
  status: number;
  code: AppsErrorCode;
  error: string;
}

/** Prisma: "table does not exist" (P2021) and "column does not exist" (P2022). */
const MISSING_SCHEMA = new Set(['P2021', 'P2022']);
/** Prisma: cannot reach / authenticate to / time out on the database. */
const UNREACHABLE = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

export function classifyAppsError(err: unknown): AppsErrorInfo {
  const e = (err ?? {}) as { code?: unknown; name?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : '';

  if (MISSING_SCHEMA.has(code)) {
    return {
      status: 503,
      code: 'APPS_NOT_PROVISIONED',
      error: 'Community apps are not set up on this server yet.',
    };
  }
  // `prisma.communityApp` is undefined when the client predates the model.
  if (name === 'TypeError' && /of undefined \(reading '(findMany|findFirst|findUnique|count|create|update|updateMany|upsert|delete|deleteMany)'\)/.test(message)) {
    return {
      status: 503,
      code: 'APPS_CLIENT_OUTDATED',
      error: 'Community apps are not set up on this server yet.',
    };
  }
  if (UNREACHABLE.has(code) || name === 'PrismaClientInitializationError') {
    return {
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      error: 'The server could not reach its database. Try again in a moment.',
    };
  }
  return { status: 500, code: 'INTERNAL', error: 'Something went wrong on the server.' };
}

export function newErrorId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 10);
}

/** Wrap a route handler so a thrown error becomes a named, logged JSON answer. */
export function appsRoute<A extends unknown[]>(
  label: string,
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      const info = classifyAppsError(err);
      const errorId = newErrorId();
      // One line the operator can grep for; the stack goes with it.
      console.error(`[community-apps] ${label} ${info.code} errorId=${errorId}`, err);
      return NextResponse.json(
        { error: info.error, code: info.code, errorId },
        { status: info.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  };
}
