// Diagnóstico de un código de la beta: no muestra ningún secreto.
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const raw = process.argv[2] || '';
const code = raw.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
const pepper = process.env.ALPHA_INVITE_PEPPER || '';
if (pepper.length < 32) { console.log('Falta ALPHA_INVITE_PEPPER'); process.exit(1); }
if (code.length !== 16) { console.log('El código debe tener 16 caracteres'); process.exit(1); }
const p = new PrismaClient();
const hash = createHmac('sha256', pepper).update(code).digest('hex');
const total = await p.cusdcBetaInvite.count();
const unrevoked = await p.cusdcBetaInvite.count({ where: { revokedAt: null } });
const x = await p.cusdcBetaInvite.findUnique({ where: { codeHash: hash } });
console.log({
  total,
  unrevoked,
  found: Boolean(x),
  assigned: Boolean(x && x.sanctionsResult === 'clear'),
  redeemed: Boolean(x && x.redeemedBy),
  revoked: Boolean(x && x.revokedAt),
  pepperLength: pepper.length,
});
await p.$disconnect();
