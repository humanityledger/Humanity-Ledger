#!/usr/bin/env node
/**
 * Generates the cUSDC beta invitation codes, run once by the operator with DATABASE_URL and
 * ALPHA_INVITE_PEPPER set (docs/beta/CUSDC_BETA.md):
 *
 *   node scripts/beta/generate-100-codes.mjs --by 0xOPERATOR [--count 100] [--days 30]
 *
 * Stores only the HMAC of each code (prisma.cusdcBetaInvite) and writes the codes in clear to
 * docs/beta/100_BETA_INVITE_CODES.md (gitignored, owner-only). It refuses to overwrite that file,
 * because the codes are shown only once, and refuses to go past 100 unrevoked codes.
 *
 * The codes start Unassigned: none can be redeemed until `cusdc-invites.mjs assign` records the
 * sanctions and age checks for the one person who receives it. Codes work only once
 * cusdcBeta.enabled is true in deployments/aztec-mainnet.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { CODES_FILE, MAX_BETA_CODES, betaCodeHash, newBetaCodes, renderCodesTable } from '../../lib/beta/invite-codes.mjs';

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : d; };
const pepper = process.env.ALPHA_INVITE_PEPPER || '';
const admins = new Set(String(process.env.ALPHA_ADMINS || '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean));
const by = String(arg('by', '')).toLowerCase();
const count = Number(arg('count', MAX_BETA_CODES));
const days = Number(arg('days', 0));
const out = path.resolve(arg('out', CODES_FILE));

if (pepper.length < 32) throw new Error('ALPHA_INVITE_PEPPER must be set (at least 32 characters).');
if (!admins.has(by)) throw new Error('--by must be one of ALPHA_ADMINS.');
if (!Number.isInteger(count) || count < 1 || count > MAX_BETA_CODES) throw new Error(`--count must be 1 to ${MAX_BETA_CODES}.`);
if (fs.existsSync(out)) throw new Error(`${out} already exists. Its codes are shown only once: move it somewhere safe first.`);

const prisma = new PrismaClient();
try {
  const open = await prisma.cusdcBetaInvite.count({ where: { revokedAt: null } });
  if (open + count > MAX_BETA_CODES) {
    throw new Error(`There are already ${open} unrevoked codes; at most ${MAX_BETA_CODES} can exist. Use --count ${MAX_BETA_CODES - open} or revoke codes first.`);
  }
  const at = new Date();
  const codes = newBetaCodes(count, randomBytes);
  // The file first (exclusive create), so no stored code exists without its clear copy.
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderCodesTable(codes.map((code) => ({ code, status: 'Unassigned' })), { generatedAt: at, by }), { flag: 'wx', mode: 0o600 });
  try {
    await prisma.cusdcBetaInvite.createMany({
      data: codes.map((code) => ({
        codeHash: betaCodeHash(code, pepper),
        createdBy: by,
        createdAt: at,
        expiresAt: days > 0 ? new Date(at.getTime() + days * 86400_000) : null,
      })),
    });
  } catch (e) {
    fs.rmSync(out, { force: true });
    throw e;
  }
  console.log(`${count} codes stored (HMAC only) and written to ${path.relative(process.cwd(), out)}.`);
  console.log('They are Unassigned: record each person\'s checks with `cusdc-invites.mjs assign <#>` before giving them a code.');
} finally {
  await prisma.$disconnect();
}
