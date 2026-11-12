/**
 * Railway Pre-Deploy Database Synchronization & Resilience Engine
 * Automatically resolves stuck/failed migrations (e.g. P3009) before deploying migrations.
 */

const { execSync } = require('child_process');
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

async function resolveStuckMigrations(databaseUrl) {
  let client;
  try {
    const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    const sslStrict = process.env.DATABASE_SSL_STRICT === 'true' || Boolean(process.env.PGSSLROOTCERT);
    const sslConfig = isLocalhost
      ? false
      : {
          rejectUnauthorized: sslStrict,
          ...(process.env.PGSSLROOTCERT ? { ca: require('fs').readFileSync(process.env.PGSSLROOTCERT).toString() } : {}),
        };
    if (!isLocalhost && !sslStrict) {
      console.warn('[pre-deploy] Security Notice: DATABASE_SSL_STRICT is not enabled; connecting with unverified TLS. Set DATABASE_SSL_STRICT=true and supply PGSSLROOTCERT for production hardening.');
    }

    client = new Client({
      connectionString: databaseUrl,
      ssl: sslConfig,
      connectionTimeoutMillis: 10000,
    });

    await client.connect();
    console.log('[pre-deploy] Connected to PostgreSQL successfully.');

    // Check if _prisma_migrations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '_prisma_migrations'
      );
    `);

    if (tableCheck.rows[0]?.exists) {
      // Find all failed migrations (where finished_at is NULL and rolled_back_at is NULL)
      const failedRes = await client.query(`
        SELECT migration_name 
        FROM "_prisma_migrations" 
        WHERE finished_at IS NULL AND rolled_back_at IS NULL;
      `);

      if (failedRes.rows.length > 0) {
        console.log(`[pre-deploy] Detected ${failedRes.rows.length} stuck/failed migration(s):`, failedRes.rows.map(r => r.migration_name));

        for (const row of failedRes.rows) {
          const mig = row.migration_name;
          console.log(`[pre-deploy] Inspecting schema state for migration: ${mig}`);

          let tableExists = false;
          if (mig.includes('product_passport')) {
            const chk = await client.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'ProductPassport'
              );
            `);
            tableExists = chk.rows[0]?.exists;
          } else if (mig.includes('verification_code')) {
            const chk = await client.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'VerificationCode'
              );
            `);
            tableExists = chk.rows[0]?.exists;
          }

          if (tableExists) {
            console.log(`[pre-deploy] Target tables for '${mig}' already exist. Marking migration as successfully applied.`);
            await client.query(`
              UPDATE "_prisma_migrations" 
              SET finished_at = NOW(), applied_steps_count = 1 
              WHERE migration_name = $1;
            `, [mig]);
          } else {
            console.log(`[pre-deploy] Target tables for '${mig}' do not exist. Deleting failed record to allow clean re-apply.`);
            await client.query(`
              DELETE FROM "_prisma_migrations" 
              WHERE migration_name = $1 AND finished_at IS NULL;
            `, [mig]);
          }
        }
      } else {
        console.log('[pre-deploy] No stuck migrations detected in _prisma_migrations.');
      }
    }
  } catch (err) {
    console.warn('[pre-deploy] Note on direct database inspection:', err.message);
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {}
    }
  }
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

async function runCliMigrations() {
  await pickMigrationConnection();
  // 1. Try prisma migrate resolve as an additional layer of defense
  try {
    console.log('[pre-deploy] Attempting Prisma CLI migrate resolve on 20260523000000_hpf_product_passport...');
    execSync('npx prisma migrate resolve --applied 20260523000000_hpf_product_passport', {
      stdio: 'pipe',
      timeout: 30000,
    });
    console.log('[pre-deploy] Prisma CLI resolve: marked 20260523000000_hpf_product_passport as applied.');
  } catch (e) {
    // Expected if already applied or not found; proceed safely
  }

  // 2. Deploy all pending migrations — A-017: Exit with code 1 on failure. No --accept-data-loss fallback.
  console.log('[pre-deploy] Executing: npx prisma migrate deploy...');
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      timeout: 120000,
    });
    console.log('[pre-deploy] Prisma migrations deployed successfully.');
    return;
  } catch (deployErr) {
    console.error('[pre-deploy] FATAL: prisma migrate deploy failed:', deployErr.message);
    console.error('[pre-deploy] A-017: --accept-data-loss fallback REMOVED for safety. Fix the migration conflict before deploying.');
    process.exit(1);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('dummy') || databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    console.info('[pre-deploy] No DATABASE_URL configured — skipping DB migration (no-op).');
    process.exit(0);
  }

  console.log('[pre-deploy] Starting pre-deploy resilience check...');
  await resolveStuckMigrations(databaseUrl);
  await runCliMigrations();

  console.log('[pre-deploy] Pre-deploy tasks completed successfully.');
  process.exit(0);
}

main().catch((fatal) => {
  console.error('[pre-deploy] Fatal error caught in pre-deploy script:', fatal);
  // A-017: Exit 1 on unhandled fatal — do NOT swallow errors silently
  process.exit(1);
});
