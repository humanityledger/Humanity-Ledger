const fs = require('fs');
const file = 'd:/Projects/Wallet Human Polymarket ID/prisma/schema.prisma';
let content = fs.readFileSync(file, 'utf8');

const additionalSchema = `
model CommunityChannel {
  id          String   @id @default(cuid())
  communityId String
  name        String
  description String?
  isPaid      Boolean  @default(false)
  price       Float?
  currency    String?  // 'ETH', 'USDC'
  position    Int      @default(0)
  createdAt   DateTime @default(now())

  community   Community @relation(fields: [communityId], references: [id], onDelete: Cascade)

  @@index([communityId])
}

model CommunityPermission {
  id              String   @id @default(cuid())
  communityId     String   @unique
  sendMessages    Boolean  @default(true)
  sendMedia       Boolean  @default(true)
  sendStickers    Boolean  @default(true)
  sendPolls       Boolean  @default(true)
  embedLinks      Boolean  @default(true)
  addUsers        Boolean  @default(false)
  pinMessages     Boolean  @default(false)
  changeInfo      Boolean  @default(false)
  slowModeSeconds Int      @default(0)
  antiSpam        Boolean  @default(false)

  community       Community @relation(fields: [communityId], references: [id], onDelete: Cascade)
}
`;

if (!content.includes('model CommunityChannel')) {
  content = content.replace(
    'members     CommunityMember[]',
    'members     CommunityMember[]\n  channels    CommunityChannel[]\n  permissions CommunityPermission?'
  );
  content += '\n' + additionalSchema;
  fs.writeFileSync(file, content);
  console.log('Schema updated successfully');
} else {
  console.log('Schema already updated');
}
