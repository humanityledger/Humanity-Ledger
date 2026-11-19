#!/usr/bin/env node
/**
 * Closed alpha invitations, run by the operator with DATABASE_URL and ALPHA_INVITE_PEPPER set.
 *
 *   node scripts/alpha/invites.mjs create --by 0xSTEFAN --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked [--days 14]
 *   node scripts/alpha/invites.mjs list
 *   node scripts/alpha/invites.mjs revoke-member 0xWALLET      (keeps exits only)
 *   node scripts/alpha/invites.mjs revoke-invite <id>
 *
 * `create` prints each code ONCE; only its HMAC is stored. --by must be in ALPHA_ADMINS (OD-4).
 * One code per tester, after the operator's two checks (package 4): the EU consolidated sanctions
 * list (its date and the result; a match gets no code) and that the tester is 18 or older. Only
 * the result is stored, never an identity document.
 * At most 50 members (OD-4, amended 19/11/2026), enforced again by /api/alpha/redeem.
 */
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { distributorProblem, inviteChecksProblem, retainUntil } from '../../lib/alpha/rules.mjs';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function code() {
  let bits = 0n;
  for (const b of randomBytes(10)) bits = (bits << 8n) | BigInt(b);
  let s = '';
  for (let i = 15; i >= 0; i--) s += CROCKFORD[Number((bits >> BigInt(i * 5)) & 31n)];
  return s;
}
const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : d; };
const [cmd, target] = process.argv.slice(2);
const pepper = process.env.ALPHA_INVITE_PEPPER || '';
const admins = new Set(String(process.env.ALPHA_ADMINS || '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean));
const prisma = new PrismaClient();

try {
  if (cmd === 'create') {
    // Package 3: no code while nobody is recorded as the distributor of HLC.
    const record = JSON.parse(readFileSync(new URL('../../deployments/aztec-mainnet.json', import.meta.url), 'utf8'));
    const problem = distributorProblem(record?.closedAlpha?.distributor ?? null);
    if (problem) throw new Error(problem);
    if (pepper.length < 32) throw new Error('ALPHA_INVITE_PEPPER must be set (at least 32 characters).');
    const by = String(arg('by', '')).toLowerCase();
    if (!admins.has(by)) throw new Error('--by must be one of ALPHA_ADMINS.');
    if (Number(arg('count', 1)) !== 1) throw new Error('One code per tester: the checks are per person (--count 1).');
    const checks = { sanctionsListDate: arg('sanctions-list-date', ''), sanctionsResult: arg('sanctions', ''), adultChecked: process.argv.includes('--adult-checked') };
    const notChecked = inviteChecksProblem(checks);
    if (notChecked) throw new Error(notChecked);
    const days = Number(arg('days', 0));
    const at = new Date();
    const c = code();
    await prisma.alphaInvite.create({
      data: {
        codeHash: createHmac('sha256', pepper).update(c).digest('hex'),
        createdBy: by,
        expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null,
        sanctionsCheckedAt: at,
        sanctionsListDate: checks.sanctionsListDate,
        sanctionsResult: 'clear',
        adultCheckedAt: at,
        retainUntil: retainUntil(record?.closedAlpha?.until ?? null),
      },
    });
    console.log(c.match(/.{4}/g).join('-'));
    console.error('1 code created. It is shown only now.');
  } else if (cmd === 'list') {
    const invites = await prisma.alphaInvite.findMany({ orderBy: { createdAt: 'asc' } });
    const members = await prisma.alphaMember.findMany({ orderBy: { joinedAt: 'asc' } });
    console.table(invites.map((x) => ({ id: x.id, createdAt: x.createdAt.toISOString(), sanctions: x.sanctionsResult ? `${x.sanctionsResult} (list ${x.sanctionsListDate})` : 'NOT CHECKED', adult: x.adultCheckedAt ? 'checked' : 'NOT CHECKED', redeemed: !!x.redeemedBy, revoked: !!x.revokedAt, expires: x.expiresAt?.toISOString() ?? '' })));
    console.table(members.map((m) => ({ wallet: m.walletAddress, joined: m.joinedAt.toISOString(), terms: !!m.termsAcceptedAt, risks: !!m.risksAcceptedAt, adult18: !!m.eligibilityAcceptedAt, riskAck: !!m.riskAckAt, revoked: !!m.revokedAt })));
    console.error(`${members.length} of 50 testers.`);
  } else if (cmd === 'revoke-member') {
    const w = String(target || '').toLowerCase();
    await prisma.alphaMember.update({ where: { walletAddress: w }, data: { revokedAt: new Date() } });
    console.error(`Revoked ${w}: no new agreements; claim, refund, withdraw and cancel still work.`);
  } else if (cmd === 'revoke-invite') {
    await prisma.alphaInvite.update({ where: { id: String(target) }, data: { revokedAt: new Date() } });
    console.error(`Invitation ${target} revoked.`);
  } else {
    console.error('usage: create --by 0x… --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked [--days d] | list | revoke-member 0x… | revoke-invite <id>');
    process.exitCode = 2;
  }
} finally {
  await prisma.$disconnect();
}
