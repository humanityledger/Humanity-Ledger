/**
 * lib/health.ts — the verdict of GET /api/health (F-10), kept out of the route file because a
 * Next.js route may only export its handlers and config.
 */
export type HealthCheck = { ok: boolean; status: 'OK' | 'SLOW' | 'UNAVAILABLE' | 'NOT_CONFIGURED'; latencyMs: number | null };

/** ok only when the database AND Redis answered; `degraded` names what did not. */
export function healthVerdict(db: HealthCheck, redis: HealthCheck): { ok: boolean; degraded: string[] } {
  const degraded: string[] = [];
  if (!db.ok) degraded.push('db');
  if (!redis.ok) degraded.push('redis');
  return { ok: degraded.length === 0, degraded };
}
