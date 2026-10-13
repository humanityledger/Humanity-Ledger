const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:ulPcqhptKuQiFkxRQfcabCKdJwDRsOQm@nozomi.proxy.rlwy.net:38927/railway' } }
});
async function check() {
  const locked = await prisma.user.count({ where: { enclaveOtpAttempts: { gt: 0 } } }).catch(() => -1);
  const withPin = await prisma.user.count({ where: { enclavePinHash: { not: null } } }).catch(() => -1);
  const total = await prisma.user.count().catch(() => -1);
  console.log('=== LIVE DB STATE ===');
  console.log('Total users:', total);
  console.log('Currently locked (attempts>0):', locked);
  console.log('Users with PIN set:', withPin);
  console.log('Users without PIN (will see setup on next visit):', total - withPin);
  if (locked === 0) console.log('OK: No users currently locked');
  if (withPin === 0) console.log('OK: All PIN hashes cleared - users will re-enroll');
  await prisma.$disconnect();
}
check().catch(e => { console.error(e.message); process.exit(1); });
