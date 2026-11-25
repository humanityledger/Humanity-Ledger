#!/usr/bin/env node
/**
 * scripts/db-maintenance.mjs — batched retention & TTL purge for high-volume PostgreSQL tables.
 * Deletes expired rows in bounded chunks (LIMIT $batch) with brief pauses between chunks so
 * tables never lock or spike vacuum I/O under 3M+ users.
 *
 * Usage:
 *   node scripts/db-maintenance.mjs
 *   node scripts/db-maintenance.mjs --dry-run --batch=1000 --max-batches=25
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const { normalizeDatabaseUrl } = require('../lib/db/url.js');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const numArg = (prefix, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  const v = hit ? Number(hit.slice(prefix.length)) : NaN;
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};
const batchSize = numArg('--batch=', 1000);
const maxBatches = numArg('--max-batches=', 50);

const TASKS = [
  { name: 'SiweNonce (expired)', table: '"SiweNonce"', cond: `"expiresAt" < NOW()` },
  { name: 'PendingChatMessage (>7d)', table: '"PendingChatMessage"', cond: `"createdAt" < NOW() - INTERVAL '7 days'` },
  { name: 'Story (expired)', table: '"Story"', cond: `"expiresAt" < NOW()` },
  { name: 'StatusMedia (expired)', table: '"StatusMedia"', cond: `"expiresAt" < NOW()` },
  { name: 'StatusUpdate (expired)', table: '"StatusUpdate"', cond: `"expiresAt" < NOW()` },
  { name: 'LoginGeoEvent (>90d)', table: '"LoginGeoEvent"', cond: `"createdAt" < NOW() - INTERVAL '90 days'` },
];

export async function purgeExpiredBatches(client, { dry = dryRun, batch = batchSize, limitBatches = maxBatches } = {}) {
  const summary = {};
  for (const task of TASKS) {
    const tableCheck = await client.query(`SELECT to_regclass('public.${task.table.replace(/"/g, '')}') IS NOT NULL AS ok`).catch(() => ({ rows: [{ ok: false }] }));
    if (!tableCheck.rows[0]?.ok) {
      summary[task.name] = { deleted: 0, skipped: true };
      continue;
    }
    if (dry) {
      const c = await client.query(`SELECT COUNT(*)::int AS cnt FROM ${task.table} WHERE ${task.cond}`);
      summary[task.name] = { wouldDelete: c.rows[0]?.cnt ?? 0, dryRun: true };
      continue;
    }
    let total = 0;
    for (let i = 0; i < limitBatches; i++) {
      const res = await client.query(
        `DELETE FROM ${task.table} WHERE id IN (SELECT id FROM ${task.table} WHERE ${task.cond} LIMIT $1)`,
        [batch],
      );
      const count = res.rowCount ?? 0;
      total += count;
      if (count < batch) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    summary[task.name] = { deleted: total };
  }
  return summary;
}

const isMain = process.argv[1] && process.argv[1].endsWith('db-maintenance.mjs');
if (isMain) {
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
  if (!url) {
    console.error('[db-maintenance] Missing DATABASE_URL_UNPOOLED / DATABASE_URL');
    process.exit(1);
  }
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const client = new Client({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: process.env.DATABASE_SSL_STRICT === 'true' },
  });
  await client.connect();
  try {
    const out = await purgeExpiredBatches(client);
    console.log('[db-maintenance] Summary:', JSON.stringify(out));
  } finally {
    await client.end().catch(() => {});
  }
}
