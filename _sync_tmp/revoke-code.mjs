// Anula un código de la beta que no se ha canjeado. No muestra ningún secreto.
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const code = (process.argv[2] || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
const pepper = process.env.ALPHA_INVITE_PEPPER || '';
if (pepper.length < 32 || code.length !== 16) { console.log('Falta el pepper o el código no tiene 16 caracteres'); process.exit(1); }
const p = new PrismaClient();
const r = await p.cusdcBetaInvite.updateMany({
  where: { codeHash: createHmac('sha256', pepper).update(code).digest('hex'), redeemedBy: null, revokedAt: null },
  data: { revokedAt: new Date() },
});
console.log(r.count === 1 ? 'Código anulado. Ya no se puede canjear.' : 'No se anuló: no existe, ya se canjeó o ya estaba anulado.');
await p.$disconnect();
