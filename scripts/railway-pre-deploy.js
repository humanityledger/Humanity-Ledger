/**
 * Railway pre-deploy: applies Prisma migrations and recovers a failed one from the real schema.
 *
 * A failed migration is resolved only when the database proves its state (lib/db/migration-inspect.js):
 * fully in place → marked applied; fully absent → marked rolled back and applied again; anything else
 * stops the deploy with the list of missing objects and changes nothing. The script exits non-zero on
 * failure and start.sh does not boot, so a broken schema never serves traffic.
 */

const { execSync } = require('child_process');
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

/** What the public schema has, by name and case-sensitive (tables like "User" are quoted). */
async function existingObjects(client) {
  const [tables, indexes, columns, constraints, types] = await Promise.all([
    client.query(`SELECT tablename AS n FROM pg_tables WHERE schemaname = 'public'`),
    client.query(`SELECT indexname AS n FROM pg_indexes WHERE schemaname = 'public'`),
    client.query(`SELECT table_name || '.' || column_name AS n FROM information_schema.columns WHERE table_schema = 'public'`),
    client.query(`SELECT c.conname AS n FROM pg_constraint c JOIN pg_namespace ns ON ns.oid = c.connamespace WHERE ns.nspname = 'public'`),
    client.query(`SELECT t.typname AS n FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE ns.nspname = 'public'`),
  ]);
  const set = (r) => new Set(r.rows.map((x) => x.n));
  return { tables: set(tables), indexes: set(indexes), columns: set(columns), constraints: set(constraints), types: set(types) };
}

function cli(args) {
  execSync(`npx prisma ${args}`, { stdio: 'inherit', timeout: 120000, env: CLI_ENV });
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

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('dummy') || databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    console.info('[pre-deploy] No DATABASE_URL configured — skipping DB migration (no-op).');
    process.exit(0);
  }

  console.log('[pre-deploy] Starting migrations.');
  await pickMigrationConnection();
  const seen = new Set();
  // Each round: resolve what failed from the real schema, then deploy. A migration that fails is
  // inspected in the next round; one that fails twice, or is partly applied, stops the deploy.
  for (let round = 1; round <= 30; round++) {
    const url = process.env.DATABASE_URL_UNPOOLED || databaseUrl;
    const settled = await settleSupersededMigrations(url);
    const resolved = await resolveFailedMigrations(url, seen);
    if (round > 1 && settled.length + resolved.length === 0) {
      // deploy failed but recorded no failed migration (connection, permissions, P1xxx): retrying would only repeat it.
      console.error('[pre-deploy] FATAL: migrate deploy failed without a failed migration to recover; see the Prisma error above.');
      process.exit(1);
    }
    try {
      cli('migrate deploy');
      console.log('[pre-deploy] Prisma migrations deployed successfully.');
      process.exit(0);
    } catch (deployErr) {
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
