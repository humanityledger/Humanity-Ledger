import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRedisHealth, isRedisRequiredInCluster } from '@/lib/redis/client';
import { isR2Enabled } from '@/lib/storage/chat-attachment-store';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { healthVerdict, latestMigrationName, migrationProgress, type HealthCheck as Check, type MigrationCheck } from '@/lib/health';

/** The newest migration shipped in this build, read once per process. */
let shipped: string | null | undefined;
function expectedLatest(): string | null {
  if (shipped !== undefined) return shipped;
  try {
    shipped = latestMigrationName(readdirSync(join(process.cwd(), 'prisma', 'migrations')));
  } catch {
    shipped = null;
  }
  return shipped;
}

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

async function checkRedis(): Promise<Check & { mode?: 'real' | 'mock' }> {
  if (!process.env.REDIS_URL) return { ok: false, status: 'NOT_CONFIGURED', latencyMs: null, mode: 'mock' };
  try {
    const r = await withTimeout(checkRedisHealth(), CHECK_TIMEOUT_MS);
    if (r.mode !== 'real' || !r.ok) return { ok: false, status: 'UNAVAILABLE', latencyMs: r.latencyMs ?? null, mode: r.mode };
    return { ok: true, status: 'OK', latencyMs: r.latencyMs ?? null, mode: 'real' };
  } catch {
    return { ok: false, status: 'UNAVAILABLE', latencyMs: null, mode: 'real' };
  }
}

// Failed Prisma migrations (finished_at and rolled_back_at both null). Names only: no SQL, no data.
// The operator resolves them with `npx prisma migrate resolve` (docs/runbooks/MIGRATIONS.md).
async function checkMigrations(): Promise<MigrationCheck> {
  if (!process.env.DATABASE_URL) return { ok: false, status: 'UNKNOWN', failed: [] };
  try {
    const rows = await withTimeout<{ migration_name: string }[]>(
      prisma.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at`,
      CHECK_TIMEOUT_MS,
    );
    const failed = rows.map((r: { migration_name: string }) => r.migration_name);
    const last = await withTimeout<{ migration_name: string }[]>(
      prisma.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1`,
      CHECK_TIMEOUT_MS,
    ).catch(() => []);
    const latestApplied = last[0]?.migration_name ?? null;
    const expected = expectedLatest();
    if (failed.length) return { ok: false, status: 'NEEDS_ATTENTION', failed, latestApplied, expectedLatest: expected };
    const progress = migrationProgress(latestApplied, expected);
    return { ok: progress !== 'BEHIND', status: progress === 'BEHIND' ? 'BEHIND' : 'OK', failed, latestApplied, expectedLatest: expected };
  } catch {
    return { ok: false, status: 'UNKNOWN', failed: [] };
  }
}

const HEALTH_CACHE_TTL_MS = 2_000;
let cachedHealth: { expiresAt: number; payload: any } | null = null;
let inFlightHealth: Promise<any> | null = null;

async function computeHealthPayload() {
  const [database, redis, migrations] = await Promise.all([checkDatabase(), checkRedis(), checkMigrations()]);
  const redisRequired = isRedisRequiredInCluster();
  const { ok, degraded } = healthVerdict(database, redis, migrations, { requireRedis: redisRequired });
  const r2Configured = isR2Enabled();

  return {
    ok,
    degraded,
    status: ok ? 'operational' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
    replicaId: process.env.RAILWAY_REPLICA_ID || 'local',
    uptimeSeconds: Math.round(process.uptime()),
    cluster: {
      redisRequired,
      multiReplicaWarning: redisRequired && !redis.ok,
    },
    // The commit this replica runs (Railway sets it on Git deploys): which code answers.
    version: { commit: (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 12) || null },
    services: {
      web: { ok: true, status: 'OK' },
      database,
      redis,
      migrations,
      storage: { ok: true, status: 'OK', mode: r2Configured ? 'r2' : 'local' },
    },
  };
}

export async function GET() {
  const bypassCache = process.env.NODE_ENV === 'test';
  const now = Date.now();
  let body: any;

  if (!bypassCache && cachedHealth && now < cachedHealth.expiresAt) {
    body = { ...cachedHealth.payload, timestamp: new Date(now).toISOString(), uptimeSeconds: Math.round(process.uptime()) };
  } else {
    if (!inFlightHealth || bypassCache) {
      inFlightHealth = computeHealthPayload().then((res) => {
        if (!bypassCache) cachedHealth = { expiresAt: Date.now() + HEALTH_CACHE_TTL_MS, payload: res };
        return res;
      }).finally(() => {
        inFlightHealth = null;
      });
    }
    body = await inFlightHealth;
  }

  return NextResponse.json(
    body,
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-System-Status': body.ok ? 'operational' : 'degraded' },
    },
  );
}
