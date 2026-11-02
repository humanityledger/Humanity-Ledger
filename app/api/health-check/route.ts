/**
 * Private SYSTEM HEALTH ENDPOINT
 *
 * Exposes real-time metrics for:
 *   - Circuit breaker states (RPC providers + Neo4j)
 *   - WebSocket singleton status
 *   - Audit trail integrity
 *   - Database connectivity
 *
 * Authentication: requires valid internal secret header for deep checks
 * Rate: exempt from rate limiting (registered in middleware BYPASS list)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  baseCircuitBreaker,
  ethereumCircuitBreaker,
  bscCircuitBreaker,
  neo4jCircuitBreaker,
} from '@/lib/resilience/circuit-breaker';
import { verifyAuditTrailIntegrity } from '@/lib/audit/audit-trail';
import { prisma } from '@/lib/prisma';

const INTERNAL_SECRET = process.env.HEALTH_CHECK_SECRET;

export async function GET(request: NextRequest) {
  // Allow unauthenticated basic health check from Railway/K8s probes
  const url = new URL(request.url);
  const isDeepCheck = url.searchParams.get('deep') === '1';

  // Deep checks require authentication
  if (isDeepCheck) {
    const authHeader = request.headers.get('x-health-secret');
    if (!INTERNAL_SECRET || authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  const ts = Date.now();

  // --- Basic health (always public) ---
  const basic = {
    status: 'ok',
    timestamp: new Date(ts).toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? 'unknown',
    environment: process.env.NODE_ENV ?? 'unknown',
  };

  if (!isDeepCheck) {
    return NextResponse.json(basic, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // --- Deep health (authenticated) ---
  const circuitBreakers = {
    'rpc-base': baseCircuitBreaker.getMetrics(),
    'rpc-ethereum': ethereumCircuitBreaker.getMetrics(),
    'rpc-bsc': bscCircuitBreaker.getMetrics(),
    neo4j: neo4jCircuitBreaker.getMetrics(),
  };

  // DB connectivity
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbLatencyMs: number | null = null;
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbStatus = 'error';
  }

  // Audit trail integrity (last 100 entries only for speed)
  let auditIntegrity: { valid: boolean; count?: number; error?: string } = { valid: false };
  try {
    const result = await verifyAuditTrailIntegrity();
    auditIntegrity = result.valid
      ? { valid: true, count: (result as any).count }
      : { valid: false, error: (result as any).reason };
  } catch (err: any) {
    auditIntegrity = { valid: false, error: 'Internal error' };
  }

  // Determine overall system status
  const anyCircuitOpen = Object.values(circuitBreakers).some(cb => cb.state === 'OPEN');
  const overallStatus =
    dbStatus === 'error' ? 'degraded' :
    anyCircuitOpen ? 'degraded' :
    !auditIntegrity.valid ? 'warning' :
    'healthy';

  return NextResponse.json(
    {
      ...basic,
      status: overallStatus,
      checks: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        circuitBreakers,
        auditTrail: auditIntegrity,
      },
    },
    {
      status: overallStatus === 'healthy' ? 200 : 207,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
