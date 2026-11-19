/** Package 1: /api/health says which commit runs and whether the database has every shipped migration. */
import fs from 'node:fs';
import { healthVerdict, latestMigrationName, migrationProgress } from '@/lib/health';

const ok = { ok: true, status: 'OK' as const, latencyMs: 1 };

describe('/api/health version and migrations', () => {
  it('the newest shipped migration is read from the folder names', () => {
    expect(latestMigrationName(['20261118170000_visitor_tally', '20261119150000_fee_juice_grants', 'migration_lock.toml', '20261119140000_alpha_admission'])).toBe('20261119150000_fee_juice_grants');
    expect(latestMigrationName([])).toBeNull();
    expect(latestMigrationName(fs.readdirSync('prisma/migrations'))).toMatch(/^\d{14}_/);
  });
  it('a database behind the build is degraded', () => {
    expect(migrationProgress('20261118170000_visitor_tally', '20261119150000_fee_juice_grants')).toBe('BEHIND');
    expect(migrationProgress('20261119150000_fee_juice_grants', '20261119150000_fee_juice_grants')).toBe('OK');
    expect(migrationProgress(null, '20261119150000_fee_juice_grants')).toBe('UNKNOWN');
    expect(healthVerdict(ok, ok, { ok: false, status: 'BEHIND', failed: [] }).degraded).toEqual(['migrations']);
  });
  it('the route reports the commit and the migration names, nothing sensitive', () => {
    const src = fs.readFileSync('app/api/health/route.ts', 'utf8');
    expect(src).toMatch(/version: \{ commit: \(process\.env\.RAILWAY_GIT_COMMIT_SHA/);
    expect(src).toMatch(/latestApplied, expectedLatest: expected/);
  });
});
