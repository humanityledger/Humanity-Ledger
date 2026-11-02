const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const msg = await prisma.directMessage.create({
    data: {
      sender: '0x0fe5267dbdfa61b28e103db99a5cf7b57555c894',
      recipient: '0x2eeb630dc3e350b0e664151c928da732f12e70ad',
      content: 'This is a test message to guarantee DB works'
    }
  });
  console.log('Created msg:', msg);
  
  const getMsgs = await prisma.directMessage.findMany({
    where: { recipient: '0x2eeb630dc3e350b0e664151c928da732f12e70ad' }
  });
  console.log('Found msgs:', getMsgs.length);
}
test().catch(console.error).finally(() => prisma.$disconnect());
