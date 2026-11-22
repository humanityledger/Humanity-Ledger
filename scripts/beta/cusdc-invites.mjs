#!/usr/bin/env node
/**
 * Closed cUSDC beta invitations, run by the operator with DATABASE_URL and ALPHA_INVITE_PEPPER set.
 *
 *   node scripts/beta/cusdc-invites.mjs create --by 0xOPERATOR --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked [--days 14]
 *   node scripts/beta/cusdc-invites.mjs assign <#|CODE> --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked
 *   node scripts/beta/cusdc-invites.mjs export-table
 *   node scripts/beta/cusdc-invites.mjs list
 *   node scripts/beta/cusdc-invites.mjs revoke-member 0xWALLET
 *   node scripts/beta/cusdc-invites.mjs revoke-invite <id>
 *
 * `create` prints each code ONCE; only its HMAC is stored (same format and pepper as the closed
 * alpha, lib/alpha/invites.ts). --by must be in ALPHA_ADMINS. One code per person, after the same two
 * operator checks as the alpha (lib/alpha/rules.mjs inviteChecksProblem): the EU consolidated
 * sanctions list (its date and the result; a match gets no code) and that the person is 18 or older.
 * Only the result is stored, never an identity document. At most 100 members, enforced again by
 * /api/beta/cusdc/redeem. Codes can be created before the beta opens; they work only once
 * cusdcBeta.enabled is true (docs/beta/CUSDC_BETA.md).
 *
 * `assign` records the same two checks on a code from scripts/beta/generate-100-codes.mjs, given by
 * its number in docs/beta/100_BETA_INVITE_CODES.md or in full; an unassigned code cannot be
 * redeemed. `export-table` refreshes that file's Status, Redeemed By and Redeemed At columns from
 * the database and prints "X / 100 redeemed".
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { inviteChecksProblem } from '../../lib/alpha/rules.mjs';
import {
  CODES_FILE, MAX_BETA_CODES as MAX, betaCodeHash, inviteStatus, newBetaCode, parseCodesTable, redeemedLine, renderCodesTable, resolveCodeArg, tableMeta,
} from '../../lib/beta/invite-codes.mjs';

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : d; };
const [cmd, target] = process.argv.slice(2);
const pepper = process.env.ALPHA_INVITE_PEPPER || '';
const admins = new Set(String(process.env.ALPHA_ADMINS || '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean));
const file = path.resolve(arg('file', CODES_FILE));
const readTable = () => {
  if (!fs.existsSync(file)) throw new Error(`${file} not found. Generate the codes with scripts/beta/generate-100-codes.mjs.`);
  return fs.readFileSync(file, 'utf8');
};
const checksFromArgs = () => ({ sanctionsListDate: arg('sanctions-list-date', ''), sanctionsResult: arg('sanctions', ''), adultChecked: process.argv.includes('--adult-checked') });
const prisma = new PrismaClient();

try {
  if (cmd === 'create') {
    if (pepper.length < 32) throw new Error('ALPHA_INVITE_PEPPER must be set (at least 32 characters).');
    const by = String(arg('by', '')).toLowerCase();
    if (!admins.has(by)) throw new Error('--by must be one of ALPHA_ADMINS.');
    if (Number(arg('count', 1)) !== 1) throw new Error('One code per person: the checks are per person (--count 1).');
    const checks = checksFromArgs();
    const notChecked = inviteChecksProblem(checks);
    if (notChecked) throw new Error(notChecked);
    const open = await prisma.cusdcBetaInvite.count({ where: { revokedAt: null } });
    if (open >= MAX) throw new Error(`There are already ${open} unrevoked codes; the beta has at most ${MAX} members.`);
    const days = Number(arg('days', 0));
    const at = new Date();
    const c = newBetaCode(randomBytes);
    await prisma.cusdcBetaInvite.create({
      data: {
        codeHash: betaCodeHash(c, pepper),
        createdBy: by,
        expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null,
        sanctionsCheckedAt: at,
        sanctionsListDate: checks.sanctionsListDate,
        sanctionsResult: 'clear',
        adultCheckedAt: at,
      },
    });
    console.log(c);
    console.error('1 code created. It is shown only now.');
  } else if (cmd === 'assign') {
    if (pepper.length < 32) throw new Error('ALPHA_INVITE_PEPPER must be set (at least 32 characters).');
    const checks = checksFromArgs();
    const notChecked = inviteChecksProblem(checks);
    if (notChecked) throw new Error(notChecked);
    const c = resolveCodeArg(target, /^#?\d+$/.test(String(target)) ? parseCodesTable(readTable()) : []);
    const at = new Date();
    const r = await prisma.cusdcBetaInvite.updateMany({
      where: { codeHash: betaCodeHash(c, pepper), redeemedBy: null, revokedAt: null, sanctionsResult: null },
      data: { sanctionsCheckedAt: at, sanctionsListDate: checks.sanctionsListDate, sanctionsResult: 'clear', adultCheckedAt: at },
    });
    if (r.count !== 1) throw new Error('That code is unknown, already assigned, redeemed or revoked. Pick another one.');
    console.error(`${target} is assigned. Give it to that one person only.`);
  } else if (cmd === 'export-table') {
    if (pepper.length < 32) throw new Error('ALPHA_INVITE_PEPPER must be set (at least 32 characters).');
    const md = readTable();
    const table = parseCodesTable(md);
    const hashes = table.map((r) => betaCodeHash(r.code, pepper));
    const rows = await prisma.cusdcBetaInvite.findMany({ where: { codeHash: { in: hashes } } });
    const byHash = new Map(rows.map((x) => [x.codeHash, x]));
    const redeemed = await prisma.cusdcBetaMember.count();
    const now = new Date();
    fs.writeFileSync(
      file,
      renderCodesTable(
        table.map((r, i) => {
          const x = byHash.get(hashes[i]);
          return { code: r.code, status: inviteStatus(x, now), redeemedBy: x?.redeemedBy ?? null, redeemedAt: x?.redeemedAt ?? null };
        }),
        { ...tableMeta(md), redeemed, capacity: MAX },
      ),
      { mode: 0o600 },
    );
    console.log(redeemedLine(redeemed, MAX));
  } else if (cmd === 'list') {
    const invites = await prisma.cusdcBetaInvite.findMany({ orderBy: { createdAt: 'asc' } });
    const members = await prisma.cusdcBetaMember.findMany({ orderBy: { joinedAt: 'asc' } });
    console.table(invites.map((x) => ({ id: x.id, createdAt: x.createdAt.toISOString(), sanctions: x.sanctionsResult ? `${x.sanctionsResult} (list ${x.sanctionsListDate})` : 'NOT CHECKED', adult: x.adultCheckedAt ? 'checked' : 'NOT CHECKED', redeemed: !!x.redeemedBy, revoked: !!x.revokedAt, expires: x.expiresAt?.toISOString() ?? '' })));
    console.table(members.map((m) => ({ wallet: m.walletAddress, joined: m.joinedAt.toISOString(), notice: m.noticeVersion ?? '', revoked: !!m.revokedAt })));
    console.error(`${members.length} of ${MAX} members.`);
  } else if (cmd === 'revoke-member') {
    const w = String(target || '').toLowerCase();
    await prisma.cusdcBetaMember.update({ where: { walletAddress: w }, data: { revokedAt: new Date() } });
    console.error(`Revoked ${w}: new cUSDC payments are refused; the balance stays visible and their own funds can still be moved (exits).`);
  } else if (cmd === 'revoke-invite') {
    await prisma.cusdcBetaInvite.update({ where: { id: String(target) }, data: { revokedAt: new Date() } });
    console.error(`Invitation ${target} revoked.`);
  } else {
    console.error('usage: create --by 0x… --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked [--days d] | assign <#|CODE> --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked | export-table | list | revoke-member 0x… | revoke-invite <id>');
    process.exitCode = 2;
  }
} finally {
  await prisma.$disconnect();
}
