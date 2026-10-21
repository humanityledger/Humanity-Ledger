/**
 * Railway Pre-Deploy Database Synchronization & Resilience Engine
 * Automatically resolves stuck/failed migrations (e.g. P3009) before deploying migrations.
 */

const { execSync } = require('child_process');
const { Client } = require('pg');

async function resolveStuckMigrations(databaseUrl) {
  let client;
  try {
    const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    client = new Client({
      connectionString: databaseUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
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

async function runCliMigrations() {
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
  if (!databaseUrl) {
    console.warn('[pre-deploy] DATABASE_URL is not set. Skipping DB migration.');
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
