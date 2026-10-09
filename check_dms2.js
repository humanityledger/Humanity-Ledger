const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.humanityIdentity.findMany({ take: 2, orderBy: { createdAt: 'desc' } });
  console.log("Identities:", users.map(u => u.walletAddress));
  
  const dms = await prisma.directMessage.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  console.log("DMs found:", dms.length);
  dms.forEach(d => console.log(`DM: from ${d.sender} to ${d.recipient} | ${d.content}`));
}
check().catch(e => console.error(e)).finally(() => prisma.$disconnect());
