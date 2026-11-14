/**
 * lib/health.ts — the verdict of GET /api/health (F-10), kept out of the route file because a
 * Next.js route may only export its handlers and config.
 */
export type HealthCheck = { ok: boolean; status: 'OK' | 'SLOW' | 'UNAVAILABLE' | 'NOT_CONFIGURED'; latencyMs: number | null };

/** Prisma migrations recorded as failed (started, never finished, never rolled back). */
export type MigrationCheck = { ok: boolean; status: 'OK' | 'NEEDS_ATTENTION' | 'UNKNOWN'; failed: string[] };

/**
 * ok only when the database AND Redis answered and no migration is left failed; `degraded` names
 * what did not. Since #88 the server starts even when the pre-deploy could not resolve a migration,
 * so a failed migration must be visible here instead of only in one deploy log.
 */
export function healthVerdict(db: HealthCheck, redis: HealthCheck, migrations?: MigrationCheck): { ok: boolean; degraded: string[] } {
  const degraded: string[] = [];
  if (!db.ok) degraded.push('db');
  if (!redis.ok) degraded.push('redis');
  if (migrations && migrations.status === 'NEEDS_ATTENTION') degraded.push('migrations');
  return { ok: degraded.length === 0, degraded };
}
