// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRedisHealth } from '@/lib/redis/client';

export const dynamic = 'force-dynamic';

/** GET /api/admin/launch-checklist — Run all pre-launch checks */
export async function GET() {
  const checks = [];

  // 1. DB connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: 'Database PostgreSQL', status: 'PASS' });
  } catch {
    checks.push({ name: 'Database PostgreSQL', status: 'FAIL', critical: true });
  }

  // 2. Redis
  const redis = await checkRedisHealth();
  checks.push({
    name: 'Redis Cache',
    status: redis.ok ? 'PASS' : 'WARN',
    note: redis.mode === 'standalone' ? 'Running in standalone mode — add REDIS_URL env var for production' : undefined,
  });

  // 3. Aztec Node
  try {
    const res = await fetch(process.env.AZTEC_NODE_URL || 'https://node.aztec.network', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'node_getBlockNumber', params: [], id: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    checks.push({ name: 'Aztec Node RPC', status: data?.result ? 'PASS' : 'WARN', blockNumber: data?.result });
  } catch {
    checks.push({ name: 'Aztec Node RPC', status: 'WARN', note: 'Using Mode B (DB-only ledger)' });
  }

  // 4. Token contract
  const tokenAddr = process.env.AZTEC_TOKEN_CONTRACT_ADDRESS;
  checks.push({
    name: 'QDs Token Contract',
    status: tokenAddr && tokenAddr !== 'PENDING_DEPLOY' ? 'PASS' : 'WARN',
    note: !tokenAddr || tokenAddr === 'PENDING_DEPLOY' ? 'Deploy token contract before mainnet launch' : tokenAddr,
    critical: false,
  });

  // 5. Environment variables
  const requiredEnvVars = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXT_PUBLIC_APP_URL'];
  for (const v of requiredEnvVars) {
    checks.push({
      name: `ENV: ${v}`,
      status: process.env[v] ? 'PASS' : 'FAIL',
      critical: true,
    });
  }

  // 6. User count
  const userCount = await prisma.user.count().catch(() => 0);
  checks.push({ name: 'Registered Users', status: 'INFO', value: userCount });

  const failed = checks.filter(c => c.status === 'FAIL');
  const warnings = checks.filter(c => c.status === 'WARN');
  const launchReady = failed.length === 0;

  return NextResponse.json({
    launchReady,
    summary: launchReady
      ? warnings.length > 0 ? `READY WITH ${warnings.length} WARNINGS` : 'FULLY READY FOR MAINNET'
      : `NOT READY: ${failed.length} critical checks failed`,
    checks,
    timestamp: new Date().toISOString(),
  });
}

