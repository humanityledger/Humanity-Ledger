const fs = require('fs');

// The REAL fix: Add a DirectMessage model for persistent, reliable messaging
// that works independently of XMTP
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

if (!schema.includes('model DirectMessage')) {
  schema += `
model DirectMessage {
  id          String   @id @default(uuid())
  sender      String
  recipient   String
  content     String   @db.Text
  delivered   Boolean  @default(false)
  createdAt   DateTime @default(now())
  deliveredAt DateTime?

  @@index([recipient, delivered])
  @@index([sender])
}
`;
  fs.writeFileSync('prisma/schema.prisma', schema);
  console.log('Added DirectMessage model to schema');
} else {
  console.log('DirectMessage model already exists');
}
