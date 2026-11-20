/**
 * Railway pre-deploy: applies Prisma migrations and recovers a failed one from the real schema.
 *
 * A failed migration is resolved only when the database proves its state (lib/db/migration-inspect.js):
 * fully in place → marked applied; fully absent → marked rolled back and applied again; anything else
 * stops the deploy with the list of missing objects and changes nothing. The script exits non-zero on
 * failure and start.sh does not boot, so a broken schema never serves traffic.
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { normalizeDatabaseUrl, describeDatabaseUrl, isPoolerUrl, directUrlFor } = require('../lib/db/url.js');

// Paste errors in the Railway variables are repaired before Prisma reads them (the CLI below
// inherits this environment); anything else is said in words, without the password.
for (const key of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED']) {
  const raw = process.env[key];
  if (!raw) continue;
  const d = describeDatabaseUrl(raw);
  if (d.ok && d.repaired) {
    process.env[key] = normalizeDatabaseUrl(raw);
    console.warn(`[pre-deploy] ${key} had quotes, spaces or its own name in the value; repaired for this run (host ${d.host}). Fix the Railway variable.`);
  } else if (!d.ok) {
    console.error(`[pre-deploy] ${key} is unusable: ${d.problem}. In Railway set DATABASE_URL to \${{PgBouncer.DATABASE_URL}} and DATABASE_URL_UNPOOLED to \${{Postgres.DATABASE_URL}}.`);
  } else {
    console.info(`[pre-deploy] ${key} ok (host ${d.host}).`);
  }
}

const { extractObjects, decide } = require('../lib/db/migration-inspect.js');
const { isLeakedLock, budgetLeft, isLockTimeout, lockRetryDelay } = require('../lib/db/migrate-lock.js');

// The app must listen before Railway's healthcheck window closes, so the pre-deploy has a budget
// (PREDEPLOY_BUDGET_S, default 150 s). When it runs out the script stops waiting and start.sh boots
// the app; /api/health reports the schema state (19/11/2026: the lock wait outlasted the window).
const STARTED_AT = new Date();

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const SUPERSEDED = path.join(__dirname, '..', 'prisma', 'superseded-migrations.json');
// npx prints an "update available" banner on stderr: noise in the deploy logs, never a problem.
const CLI_ENV = { ...process.env, NPM_CONFIG_UPDATE_NOTIFIER: 'false', NO_UPDATE_NOTIFIER: '1' };

function sslFor(databaseUrl) {
  const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  if (isLocalhost) return false;
  const sslStrict = process.env.DATABASE_SSL_STRICT === 'true' || Boolean(process.env.PGSSLROOTCERT);
  let privateNetwork = false;
  try {
    privateNetwork = new URL(databaseUrl.replace(/^postgres(ql)?:/, 'http:')).hostname.endsWith('.railway.internal');
  } catch {}
  if (!sslStrict && !privateNetwork) {
    console.warn('[pre-deploy] Security notice: DATABASE_SSL_STRICT is not enabled for a public database host; TLS is not verified. Set DATABASE_SSL_STRICT=true and PGSSLROOTCERT.');
  }
  return {
    rejectUnauthorized: sslStrict,
    ...(process.env.PGSSLROOTCERT ? { ca: fs.readFileSync(process.env.PGSSLROOTCERT).toString() } : {}),
  };
}

async function withClient(databaseUrl, fn) {
  const client = new Client({ connectionString: databaseUrl, ssl: sslFor(databaseUrl), connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

async function failedMigrations(client) {
  const t = await client.query(`SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS ok`);
  if (!t.rows[0] || !t.rows[0].ok) return [];
  const r = await client.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at`);
  return r.rows.map((x) => x.migration_name);
}

/**
 * What the public schema has, by name and case-sensitive (tables like "User" are quoted).
 * One query at a time: a pg Client has one socket, and concurrent client.query() calls on it are
 * deprecated in node-postgres (DeprecationWarning in the deploy log of 14 Nov 2026).
 */
async function existingObjects(client) {
  const names = async (sql) => new Set((await client.query(sql)).rows.map((x) => x.n));
  const tables = await names(`SELECT tablename AS n FROM pg_tables WHERE schemaname = 'public'`);
  const indexes = await names(`SELECT indexname AS n FROM pg_indexes WHERE schemaname = 'public'`);
  const columns = await names(`SELECT table_name || '.' || column_name AS n FROM information_schema.columns WHERE table_schema = 'public'`);
  const constraints = await names(`SELECT c.conname AS n FROM pg_constraint c JOIN pg_namespace ns ON ns.oid = c.connamespace WHERE ns.nspname = 'public'`);
  const types = await names(`SELECT t.typname AS n FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE ns.nspname = 'public'`);
  return { tables, indexes, columns, constraints, types };
}

function cli(args) {
  const left = budgetLeft(STARTED_AT, process.env.PREDEPLOY_BUDGET_S);
  if (left < 5000) throw new Error('pre-deploy budget exhausted');
  // Output is shown as before and also kept, so a P1002 can be told apart from other failures.
  const r = spawnSync('npx', ['prisma', ...args.split(' ')], { encoding: 'utf8', timeout: Math.min(120000, left), env: CLI_ENV });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    const err = new Error(`prisma ${args} failed (${r.status ?? r.signal ?? r.error?.message})`);
    err.output = `${r.stdout || ''}\n${r.stderr || ''}\n${r.error?.message || ''}`;
    throw err;
  }
}

function sha256File(file) {
  return require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * Marks reviewed, superseded migrations as applied without running them (prisma/superseded-migrations.json).
 * Only when the superseding baseline is applied and the file still has the reviewed sha256.
 */
async function settleSupersededMigrations(databaseUrl) {
  if (!fs.existsSync(SUPERSEDED)) return [];
  const list = JSON.parse(fs.readFileSync(SUPERSEDED, 'utf8')).migrations || [];
  const settled = [];
  await withClient(databaseUrl, async (client) => {
    const t = await client.query(`SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS ok`);
    if (!t.rows[0] || !t.rows[0].ok) return;
    const r = await client.query(`SELECT migration_name, finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied FROM "_prisma_migrations"`);
    const applied = new Set(r.rows.filter((x) => x.applied).map((x) => x.migration_name));
    for (const m of list) {
      if (applied.has(m.name) || !applied.has(m.supersededBy)) continue;
      const file = path.join(MIGRATIONS_DIR, m.name, 'migration.sql');
      if (!fs.existsSync(file)) continue;
      const hash = sha256File(file);
      if (hash !== m.sha256) {
        throw new Error(`superseded migration ${m.name} changed (sha256 ${hash}, reviewed ${m.sha256}); review it again before deploying.`);
      }
      cli(`migrate resolve --applied ${m.name}`);
      console.log(`[pre-deploy] ${m.name} marked as applied without running it: superseded by ${m.supersededBy}.`);
      settled.push(m.name);
    }
  });
  return settled;
}

/**
 * Resolves every failed migration from what the database really has, or stops (fail closed).
 * Returns the names it resolved. `seen` stops a migration from being handled twice in one run.
 */
async function resolveFailedMigrations(databaseUrl, seen) {
  const resolved = [];
  await withClient(databaseUrl, async (client) => {
    const failed = await failedMigrations(client);
    if (failed.length === 0) return;
    const existing = await existingObjects(client);
    for (const name of failed) {
      const file = path.join(MIGRATIONS_DIR, name, 'migration.sql');
      if (seen.has(name)) {
        throw new Error(`migration ${name} failed again after being resolved in this run; resolve it by hand (npx prisma migrate resolve).`);
      }
      seen.add(name);
      if (!fs.existsSync(file)) {
        throw new Error(`migration ${name} is recorded as failed but prisma/migrations/${name} does not exist in this build.`);
      }
      const verdict = decide(extractObjects(fs.readFileSync(file, 'utf8')), existing);
      console.log(`[pre-deploy] Failed migration ${name}: ${verdict.reason}.`);
      if (verdict.action === 'applied') {
        cli(`migrate resolve --applied ${name}`);
        console.log(`[pre-deploy] ${name} marked as applied (its schema is already in place).`);
      } else if (verdict.action === 'rolled-back') {
        cli(`migrate resolve --rolled-back ${name}`);
        console.log(`[pre-deploy] ${name} marked as rolled back; it will be applied again.`);
      } else {
        const missing = verdict.missing.slice(0, 10).join(', ');
        throw new Error(`migration ${name} needs a person: ${verdict.reason}${missing ? `; missing: ${missing}` : ''}. Nothing was changed.`);
      }
      resolved.push(name);
    }
  });
  return resolved;
}

/**
 * prisma migrate holds a session advisory lock (pg_advisory_lock). Through PgBouncer in transaction
 * mode that lock can never be taken, so every deploy failed with P1002 after 10 s and no migration
 * ran (12 Nov 2026, DATABASE_URL_UNPOOLED pointed at pgbouncer.railway.internal). When the migration
 * URL is a pooler: use the direct Postgres host with the same credentials if it answers; otherwise run
 * without the advisory lock, which is safe here because one pre-deploy runs at a time.
 */
async function pickMigrationConnection() {
  const raw = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!raw || !isPoolerUrl(raw)) return;
  const hosts = (process.env.DATABASE_DIRECT_HOSTS || 'postgres.railway.internal').split(',').map((h) => h.trim()).filter(Boolean);
  for (const host of hosts) {
    const url = directUrlFor(raw, host);
    for (const ssl of [{ rejectUnauthorized: false }, false]) {
      const c = new Client({ connectionString: url, ssl, connectionTimeoutMillis: 5000 });
      try {
        await c.connect();
        await c.query('SELECT 1');
        await c.end().catch(() => {});
        process.env.DATABASE_URL_UNPOOLED = url;
        console.info(`[pre-deploy] Migrations use the database directly (${host}), not PgBouncer.`);
        return;
      } catch {
        await c.end().catch(() => {});
      }
    }
  }
  process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = '1';
  console.warn('[pre-deploy] The migration URL is PgBouncer and no direct host answered; migrating without the advisory lock (one pre-deploy at a time). Set DATABASE_URL_UNPOOLED to ${{Postgres.DATABASE_URL}} in Railway.');
}

/**
 * Prisma's migrate lock is pg_advisory_lock(72707369). When another session holds it, migrate
 * deploy times out after 10 s with P1002 and nothing is applied: on 17 and 18 Nov 2026 the app
 * then started without the ChatUsername table (P2021 on every /api/chat/username call).
 * Returns who holds the lock, with how long that session has been idle, or null when nobody does.
 */
async function migrateLockHolder(databaseUrl) {
  try {
    return await withClient(databaseUrl, async (c) => {
      const { rows } = await c.query(
        `SELECT l.pid, a.application_name, a.state, a.backend_start, a.state_change,
                EXTRACT(EPOCH FROM (now() - a.state_change))::int AS idle_s
           FROM pg_locks l LEFT JOIN pg_stat_activity a ON a.pid = l.pid
          WHERE l.locktype = 'advisory' AND l.granted AND l.classid = 0 AND l.objid = 72707369 AND l.objsubid = 1`,
      );
      return rows[0] || null;
    });
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A session that holds the migrate lock while idle for minutes is not migrating: Prisma runs its
 * statements back to back and releases the lock when it finishes. It is a leaked lock, typically a
 * server connection kept open by PgBouncer after a migrate that went through it in transaction
 * mode (12 Nov 2026), which keeps every later deploy from migrating until PgBouncer recycles it.
 * Only that session is ended (pg_terminate_backend; PgBouncer opens a new one on demand), and only
 * when lib/db/migrate-lock.js says it is a leak: idle for LEAKED_IDLE_S, or the same session not
 * running anything at two checks in a row and connected before this pre-deploy began.
 */
async function releaseLeakedLock(databaseUrl, holder, previous) {
  if (!isLeakedLock(holder, previous, STARTED_AT)) return false;
  try {
    return await withClient(databaseUrl, async (c) => {
      // Re-checked in the same statement: never end a session that is running a query now.
      const { rows } = await c.query(
        `SELECT pg_terminate_backend(a.pid) AS ended
           FROM pg_stat_activity a
          WHERE a.pid = $1 AND a.state <> 'active'
            AND EXISTS (SELECT 1 FROM pg_locks l WHERE l.pid = a.pid AND l.locktype = 'advisory' AND l.granted AND l.classid = 0 AND l.objid = 72707369 AND l.objsubid = 1)`,
        [holder.pid],
      );
      return Boolean(rows[0] && rows[0].ended);
    });
  } catch (e) {
    console.warn(`[pre-deploy] Could not end the session holding the migrate lock: ${e && e.message ? e.message : e}`);
    return false;
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('dummy') || databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    console.info('[pre-deploy] No DATABASE_URL configured — skipping DB migration (no-op).');
    process.exit(0);
  }

  console.log('[pre-deploy] Starting migrations.');
  await pickMigrationConnection();
  const seen = new Set();
  let lockWaits = 0;
  let lockWaited = false;
  let lockTimeouts = 0;
  let previousHolder = null;
  // Each round: resolve what failed from the real schema, then deploy. A migration that fails is
  // inspected in the next round; one that fails twice, or is partly applied, stops the deploy.
  for (let round = 1; round <= 30; round++) {
    if (budgetLeft(STARTED_AT, process.env.PREDEPLOY_BUDGET_S) < 5000) {
      console.error('[pre-deploy] FATAL: the pre-deploy budget ran out before migrations finished; the app starts on the current schema so the healthcheck can pass. Set DATABASE_URL_UNPOOLED to ${{Postgres.DATABASE_URL}} in Railway and redeploy.');
      process.exit(1);
    }
    const url = process.env.DATABASE_URL_UNPOOLED || databaseUrl;
    const settled = await settleSupersededMigrations(url);
    const resolved = await resolveFailedMigrations(url, seen);
    if (round > 1 && settled.length + resolved.length === 0 && !lockWaited) {
      // deploy failed but recorded no failed migration (connection, permissions, P1xxx): retrying would only repeat it.
      console.error('[pre-deploy] FATAL: migrate deploy failed without a failed migration to recover; see the Prisma error above.');
      process.exit(1);
    }
    try {
      cli('migrate deploy');
      console.log('[pre-deploy] Prisma migrations deployed successfully.');
      process.exit(0);
    } catch (deployErr) {
      // Another session holds Prisma's migrate lock. A leaked one (idle for minutes) is released;
      // a live one is waited for (up to ~4 min) instead of starting the app on an old schema.
      const holder = await migrateLockHolder(url);
      lockWaited = false;
      if (holder && lockWaits < 12) {
        lockWaits += 1;
        lockWaited = true;
        const who = `pid ${holder.pid} (${holder.application_name || 'no application name'}, ${holder.state || 'unknown state'}, idle ${holder.idle_s ?? '?'} s)`;
        if (await releaseLeakedLock(url, holder, previousHolder)) {
          console.warn(`[pre-deploy] The migrate lock was leaked by ${who}; that session was ended. Retrying now.`);
          previousHolder = null;
          await sleep(1000);
        } else {
          const wait = Math.min(20000, Math.max(0, budgetLeft(STARTED_AT, process.env.PREDEPLOY_BUDGET_S) - 10000));
          console.warn(`[pre-deploy] The migrate lock is held by ${who}; waiting ${Math.round(wait / 1000)} s (${lockWaits}/12).`);
          previousHolder = holder;
          await sleep(wait);
        }
        continue;
      }
      // P1002 with nobody holding the lock any more: it was released in between. Retry a few
      // times with backoff instead of stopping the deploy on a race.
      if (!holder && isLockTimeout(deployErr && deployErr.output) && lockTimeouts < 3) {
        lockTimeouts += 1;
        lockWaited = true;
        const wait = lockRetryDelay(lockTimeouts, budgetLeft(STARTED_AT, process.env.PREDEPLOY_BUDGET_S));
        console.warn(`[pre-deploy] P1002: the migrate lock timed out but nobody holds it now; retrying in ${Math.round(wait / 1000)} s (${lockTimeouts}/3).`);
        await sleep(wait);
        continue;
      }
      // A-017: never --accept-data-loss. The failed migration is inspected in the next round.
      console.warn(`[pre-deploy] migrate deploy failed (round ${round}); inspecting the failed migration.`);
    }
  }
  console.error('[pre-deploy] FATAL: migrations did not converge after 30 rounds.');
  process.exit(1);
}

main().catch((fatal) => {
  console.error('[pre-deploy] FATAL:', fatal && fatal.message ? fatal.message : fatal);
  // A-017: Exit 1 on unhandled fatal — do NOT swallow errors silently
  process.exit(1);
});
