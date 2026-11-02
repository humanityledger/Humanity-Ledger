const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const msgs = await prisma.pendingChatMessage.findMany();
  console.log("Offline messages in DB:", msgs.length);
}
test().catch(console.error).finally(() => prisma.$disconnect());
