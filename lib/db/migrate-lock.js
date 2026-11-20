/**
 * lib/db/migrate-lock.js: when the holder of Prisma's migrate lock (pg_advisory_lock 72707369) is
 * a leak, not a migration, and how long the pre-deploy may wait before the app must start.
 * Pure functions, used by scripts/railway-pre-deploy.js and tested in test/unit/db/migrate-lock.test.ts.
 *
 * Why (19/11/2026): with DATABASE_URL_UNPOOLED pointing at PgBouncer, a server connection kept by
 * PgBouncer held the lock while PgBouncer reused it for app queries. Its idle time never reached
 * the 120 s threshold, the pre-deploy waited 12 × 20 s plus each attempt, and the 5 minute
 * healthcheck window ran out before the app listened.
 */

/** Idle this long while holding the lock: a leak (Prisma runs its statements back to back). */
const LEAKED_IDLE_S = 120;

/**
 * @param {{ pid: number, state?: string, idle_s?: number, backend_start?: Date | string } | null} holder  now
 * @param {{ pid: number, state?: string } | null} previous  the holder seen at the last check, ~20 s earlier
 * @param {Date} startedAt  when this pre-deploy started
 * @returns {boolean} true when the session can be ended safely
 */
function isLeakedLock(holder, previous, startedAt) {
  if (!holder || holder.state === 'active') return false;
  // Idle for minutes while holding the lock.
  if (holder.state === 'idle' && Number(holder.idle_s) >= LEAKED_IDLE_S) return true;
  // The same session, not running anything at two checks in a row, connected before this
  // pre-deploy began: no migration is in progress there (only one pre-deploy runs at a time).
  const before = holder.backend_start ? new Date(holder.backend_start).getTime() < startedAt.getTime() : false;
  return Boolean(previous && previous.pid === holder.pid && previous.state !== 'active' && before);
}

/** Milliseconds left of the pre-deploy budget (PREDEPLOY_BUDGET_S, default 150 s), never below 0. */
function budgetLeft(startedAt, budgetS, now = Date.now()) {
  const b = Number(budgetS) > 0 ? Number(budgetS) : 150;
  return Math.max(0, startedAt.getTime() + b * 1000 - now);
}

/**
 * Prisma's P1002 ("timed out trying to acquire a postgres advisory lock") with no holder visible
 * by the time we look: the lock was released between the attempt and the check (another
 * pre-deploy finishing, or a leaked session PgBouncer just recycled). Worth a short retry,
 * unlike other failures with no failed migration (production log, 20/11/2026).
 */
function isLockTimeout(text) {
  return /\bP1002\b/.test(String(text || '')) || /advisory lock/i.test(String(text || ''));
}

/** Backoff for those retries: 5 s, 10 s, 15 s, never past the budget's last 10 s. */
function lockRetryDelay(n, left) {
  return Math.max(0, Math.min(5000 * n, left - 10000));
}

module.exports = { LEAKED_IDLE_S, isLeakedLock, budgetLeft, isLockTimeout, lockRetryDelay };
