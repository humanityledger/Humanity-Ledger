#!/usr/bin/env node
/**
 * Rehearsal of the invitation scripts against a throwaway Postgres (package 3), run by
 * .github/workflows/alpha-invites-rehearsal.yml. It refuses to run unless ALPHA_REHEARSAL=1 and
 * DATABASE_URL points at localhost, so it can never touch the production database.
 *
 * The workflow records a placeholder distributor in the runner's copy of
 * deployments/aztec-mainnet.json only after the first check below has seen the real record refuse;
 * nothing is committed. The placeholder is not a distributor and never leaves the runner.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL || '';
if (process.env.ALPHA_REHEARSAL !== '1' || !/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error('Refusing: this rehearsal runs only with ALPHA_REHEARSAL=1 against a local database.');
  process.exit(2);
}
const ADMIN = '0x00000000000000000000000000000000000000a1';
const env = { ...process.env, ALPHA_ADMINS: ADMIN, ALPHA_INVITE_PEPPER: 'ci-rehearsal-pepper-'.padEnd(40, 'x') };
const run = (...args) => {
  try {
    return { ok: true, out: execFileSync('node', ['scripts/alpha/invites.mjs', ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: String(e.stdout || ''), err: String(e.stderr || e.message) };
  }
};
const steps = [];
const check = (name, cond) => { steps.push({ name, ok: !!cond }); if (!cond) console.error(`FAIL ${name}`); };
const good = ['create', '--by', ADMIN, '--sanctions-list-date', '2026-11-19', '--sanctions', 'clear', '--adult-checked'];

// 1. The committed record has no distributor: no code.
const r0 = run(...good);
check('no distributor in the committed record: refused', !r0.ok && /No distributor of HLC/.test(r0.err));

// 2. Runner-only placeholder, then every other refusal.
const manifest = 'deployments/aztec-mainnet.json';
const rec = JSON.parse(readFileSync(manifest, 'utf8'));
rec.closedAlpha.distributor = { kind: 'company', legalName: 'CI rehearsal placeholder, not a distributor', taxId: 'none', registry: 'none' };
rec.closedAlpha.until = '2026-01-01T00:00:00Z';
writeFileSync(manifest, JSON.stringify(rec, null, 2));
check('sanctions match: refused', !run('create', '--by', ADMIN, '--sanctions-list-date', '2026-11-19', '--sanctions', 'match', '--adult-checked').ok);
check('adult not checked: refused', !run('create', '--by', ADMIN, '--sanctions-list-date', '2026-11-19', '--sanctions', 'clear').ok);
check('no list date: refused', !run('create', '--by', ADMIN, '--sanctions', 'clear', '--adult-checked').ok);
check('two codes at once: refused', !run(...good, '--count', '2').ok);
check('--by not an admin: refused', !run('create', '--by', '0x00000000000000000000000000000000000000b2', '--sanctions-list-date', '2026-11-19', '--sanctions', 'clear', '--adult-checked').ok);

// 3. One code; only its HMAC is stored, with the checks and the retention date.
const r1 = run(...good);
const code = r1.out.trim();
check('one code created', r1.ok && /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/.test(code));
const prisma = new PrismaClient();
try {
  const rows = await prisma.alphaInvite.findMany();
  const row = rows[0];
  check('exactly one invitation row', rows.length === 1);
  check('the code is stored only as its HMAC', row && row.codeHash === createHmac('sha256', env.ALPHA_INVITE_PEPPER).update(code.replace(/-/g, '')).digest('hex') && !JSON.stringify(rows).includes(code.replace(/-/g, '')));
  check('sanctions date, result and age check recorded', row && row.sanctionsListDate === '2026-11-19' && row.sanctionsResult === 'clear' && row.adultCheckedAt);
  check('retention ends 6 months after the alpha', row && row.retainUntil && row.retainUntil.toISOString().startsWith('2026-07-01'));
  check('list works', run('list').ok);
  check('revoke-invite works', run('revoke-invite', row?.id ?? '').ok && (await prisma.alphaInvite.findUnique({ where: { id: row.id } }))?.revokedAt);
  // 4. Purge: due rows lose their personal fields; a second run finds nothing.
  execFileSync('node', ['scripts/alpha/purge.mjs'], { env, stdio: 'inherit' });
  const after = await prisma.alphaInvite.findUnique({ where: { id: row.id } });
  check('purge cleared the admission fields', after && after.sanctionsListDate === null && after.sanctionsResult === null && after.adultCheckedAt === null && after.retainUntil === null);
  const dry = spawnSync('node', ['scripts/alpha/purge.mjs', '--dry-run'], { env, encoding: 'utf8' });
  check('purge is idempotent: nothing due after it ran', dry.status === 0 && /Due: 0 invitation/.test(dry.stderr));
} finally {
  await prisma.$disconnect();
}
for (const s of steps) console.log(`${s.ok ? 'ok  ' : 'FAIL'} ${s.name}`);
if (steps.some((s) => !s.ok)) process.exit(1);
