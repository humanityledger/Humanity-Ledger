import { readFileSync } from 'node:fs';
import { healthVerdict, type HealthCheck } from '@/lib/health';

const up: HealthCheck = { ok: true, status: 'OK', latencyMs: 4 };
const down: HealthCheck = { ok: false, status: 'UNAVAILABLE', latencyMs: null };
const missing: HealthCheck = { ok: false, status: 'NOT_CONFIGURED', latencyMs: null };

describe('GET /api/health is honest (F-10)', () => {
  it('ok only when the database and Redis both answered', () => {
    expect(healthVerdict(up, up)).toEqual({ ok: true, degraded: [] });
    expect(healthVerdict(up, down)).toEqual({ ok: false, degraded: ['redis'] });
    expect(healthVerdict(up, missing)).toEqual({ ok: false, degraded: ['redis'] });
    expect(healthVerdict(down, down)).toEqual({ ok: false, degraded: ['db', 'redis'] });
  });

  it('the route no longer reports a missing Redis or a failed database as healthy', () => {
    const src = readFileSync('app/api/health/route.ts', 'utf8');
    expect(src).not.toMatch(/ok: true, status: 'STANDALONE', mode: 'mock'/);
    expect(src).not.toMatch(/dbOk = true/);
    expect(src).not.toMatch(/zeroMockCompliant/);
    expect(src).toMatch(/degraded/);
    // Liveness stays 200 so the platform does not restart a healthy process.
    expect(src).toMatch(/status: 200/);
  });
});
