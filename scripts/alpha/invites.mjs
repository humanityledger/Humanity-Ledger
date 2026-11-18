#!/usr/bin/env node
/**
 * Closed alpha invitations, run by the operator with DATABASE_URL and ALPHA_INVITE_PEPPER set.
 *
 *   node scripts/alpha/invites.mjs create --by 0xSTEFAN [--count 1] [--days 14]
 *   node scripts/alpha/invites.mjs list
 *   node scripts/alpha/invites.mjs revoke-member 0xWALLET      (keeps exits only)
 *   node scripts/alpha/invites.mjs revoke-invite <id>
 *
 * `create` prints each code ONCE; only its HMAC is stored. --by must be in ALPHA_ADMINS (OD-4).
 * At most 20 members (OD-4), enforced again by /api/alpha/redeem.
 */
import { randomBytes, createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

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
    if (pepper.length < 32) throw new Error('ALPHA_INVITE_PEPPER must be set (at least 32 characters).');
    const by = String(arg('by', '')).toLowerCase();
    if (!admins.has(by)) throw new Error('--by must be one of ALPHA_ADMINS.');
    const n = Math.min(20, Math.max(1, Number(arg('count', 1))));
    const days = Number(arg('days', 0));
    for (let i = 0; i < n; i++) {
      const c = code();
      await prisma.alphaInvite.create({ data: { codeHash: createHmac('sha256', pepper).update(c).digest('hex'), createdBy: by, expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null } });
      console.log(c.match(/.{4}/g).join('-'));
    }
    console.error(`${n} code(s) created. They are shown only now.`);
  } else if (cmd === 'list') {
    const invites = await prisma.alphaInvite.findMany({ orderBy: { createdAt: 'asc' } });
    const members = await prisma.alphaMember.findMany({ orderBy: { joinedAt: 'asc' } });
    console.table(invites.map((x) => ({ id: x.id, createdAt: x.createdAt.toISOString(), redeemed: !!x.redeemedBy, revoked: !!x.revokedAt, expires: x.expiresAt?.toISOString() ?? '' })));
    console.table(members.map((m) => ({ wallet: m.walletAddress, joined: m.joinedAt.toISOString(), riskAck: !!m.riskAckAt, revoked: !!m.revokedAt })));
    console.error(`${members.length} of 20 testers.`);
  } else if (cmd === 'revoke-member') {
    const w = String(target || '').toLowerCase();
    await prisma.alphaMember.update({ where: { walletAddress: w }, data: { revokedAt: new Date() } });
    console.error(`Revoked ${w}: no new agreements; claim, refund, withdraw and cancel still work.`);
  } else if (cmd === 'revoke-invite') {
    await prisma.alphaInvite.update({ where: { id: String(target) }, data: { revokedAt: new Date() } });
    console.error(`Invitation ${target} revoked.`);
  } else {
    console.error('usage: create --by 0x… [--count n] [--days d] | list | revoke-member 0x… | revoke-invite <id>');
    process.exitCode = 2;
  }
} finally {
  await prisma.$disconnect();
}
