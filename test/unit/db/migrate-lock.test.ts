/** The pre-deploy never outlasts the healthcheck window, and ends only a leaked migrate lock. */
import fs from 'node:fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isLeakedLock, budgetLeft } = require('../../../lib/db/migrate-lock.js');

const start = new Date('2026-11-19T13:00:00Z');
const old = '2026-11-19T12:00:00Z';

describe('migrate lock (19/11/2026 healthcheck failure)', () => {
  it('never ends a session that is running a query', () => {
    expect(isLeakedLock({ pid: 1, state: 'active', idle_s: 999, backend_start: old }, { pid: 1, state: 'active' }, start)).toBe(false);
  });
  it('a session idle for 120 s holding the lock is a leak', () => {
    expect(isLeakedLock({ pid: 1, state: 'idle', idle_s: 120 }, null, start)).toBe(true);
    expect(isLeakedLock({ pid: 1, state: 'idle', idle_s: 30 }, null, start)).toBe(false);
  });
  it('a PgBouncer server connection reused by the app (never idle 120 s) is a leak at the second check', () => {
    const h = { pid: 7, state: 'idle', idle_s: 2, backend_start: old };
    expect(isLeakedLock(h, null, start)).toBe(false);
    expect(isLeakedLock(h, { pid: 7, state: 'idle' }, start)).toBe(true);
    expect(isLeakedLock(h, { pid: 8, state: 'idle' }, start)).toBe(false);
    expect(isLeakedLock({ ...h, backend_start: '2026-11-19T13:00:05Z' }, { pid: 7, state: 'idle' }, start)).toBe(false);
  });
  it('the budget defaults to 150 s and never goes below 0', () => {
    expect(budgetLeft(start, undefined, start.getTime())).toBe(150_000);
    expect(budgetLeft(start, '60', start.getTime() + 10_000)).toBe(50_000);
    expect(budgetLeft(start, '60', start.getTime() + 999_000)).toBe(0);
  });
  it('the pre-deploy uses both, and start.sh still boots the app when it fails', () => {
    const s = fs.readFileSync('scripts/railway-pre-deploy.js', 'utf8');
    expect(s).toMatch(/isLeakedLock\(holder, previous, STARTED_AT\)/);
    expect(s).toMatch(/budgetLeft\(STARTED_AT, process\.env\.PREDEPLOY_BUDGET_S\)/);
    expect(fs.readFileSync('start.sh', 'utf8')).toMatch(/node scripts\/railway-pre-deploy\.js \|\| echo/);
  });
});
