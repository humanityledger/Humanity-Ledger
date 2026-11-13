import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRedisHealth } from '@/lib/redis/client';
import { healthVerdict, type HealthCheck as Check } from '@/lib/health';

export const dynamic = 'force-dynamic';

// GET /api/health
//
// Liveness for the hosting platform and an honest readiness report for monitoring.
//
//   - The HTTP status is always 200 while the process answers, so Railway does not restart a
//     healthy web process because a dependency is down.
//   - The body says what is really up. `ok` is true only when the database AND Redis answered;
//     `degraded` lists what did not. Until 13 Nov 2026 a missing Redis was reported as
//     `{ ok: true, mode: 'mock' }` and a failed database as "STANDALONE_FALLBACK" with ok true,
//     so a monitor saw "healthy" while rate limits and sign-in were failing (finding F-10).
//   - No static claims (RPC pool sizes, route counts, "zero mock" badges): only measured values.


const DB_SLOW_MS = 1_000;
const CHECK_TIMEOUT_MS = 3_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

async function checkDatabase(): Promise<Check> {
  if (!process.env.DATABASE_URL) return { ok: false, status: 'NOT_CONFIGURED', latencyMs: null };
  const start = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
    const latencyMs = Date.now() - start;
    return { ok: true, status: latencyMs < DB_SLOW_MS ? 'OK' : 'SLOW', latencyMs };
  } catch {
    return { ok: false, status: 'UNAVAILABLE', latencyMs: null };
  }
}

async function checkRedis(): Promise<Check> {
  if (!process.env.REDIS_URL) return { ok: false, status: 'NOT_CONFIGURED', latencyMs: null };
  try {
    const r = await withTimeout(checkRedisHealth(), CHECK_TIMEOUT_MS);
    if (r.mode !== 'real' || !r.ok) return { ok: false, status: 'UNAVAILABLE', latencyMs: r.latencyMs ?? null };
    return { ok: true, status: 'OK', latencyMs: r.latencyMs ?? null };
  } catch {
    return { ok: false, status: 'UNAVAILABLE', latencyMs: null };
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const { ok, degraded } = healthVerdict(database, redis);

  return NextResponse.json(
    {
      ok,
      degraded,
      status: ok ? 'operational' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
      replicaId: process.env.RAILWAY_REPLICA_ID || 'local',
      uptimeSeconds: Math.round(process.uptime()),
      services: { web: { ok: true, status: 'OK' }, database, redis },
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-System-Status': ok ? 'operational' : 'degraded' },
    },
  );
}
