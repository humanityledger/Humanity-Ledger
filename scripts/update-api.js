const fs = require('fs');
const file = 'd:/Projects/Wallet Human Polymarket ID/app/api/chat/communities/route.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Update GET to include channels and permissions
const GET_SEARCH = `            _count: { select: { members: true } }`;
const GET_REPLACE = `            _count: { select: { members: true } },
            channels: { orderBy: { position: 'asc' } },
            permissions: true`;
content = content.replace(GET_SEARCH, GET_REPLACE);

// 2. Update POST to create default channels and permissions
const POST_SEARCH = `        members: {
          create: {
            walletAddress: caller,
            role: 'ADMIN'
          }
        }`;
const POST_REPLACE = `        members: {
          create: {
            walletAddress: caller,
            role: 'ADMIN'
          }
        },
        channels: {
          create: [
            { name: 'general', description: 'General discussion', isPaid: false, position: 0 },
            { name: 'announcements', description: 'Server announcements', isPaid: false, position: 1 }
          ]
        },
        permissions: {
          create: {}
        }`;
content = content.replace(POST_SEARCH, POST_REPLACE);

// 3. Add PATCH handlers for channels and permissions
const PATCH_SEARCH = `    if (action === 'UPDATE_PRIVACY') {`;
const PATCH_REPLACE = `    if (action === 'CREATE_CHANNEL') {
      const { name, description, isPaid, price, currency } = body;
      const count = await (prisma as any).communityChannel.count({ where: { communityId } });
      const channel = await (prisma as any).communityChannel.create({
        data: {
          communityId,
          name,
          description: description || '',
          isPaid: Boolean(isPaid),
          price: price ? parseFloat(price) : null,
          currency: currency || null,
          position: count
        }
      });
      return NextResponse.json({ ok: true, channel });
    }

    if (action === 'UPDATE_CHANNEL') {
      const { channelId, name, description, isPaid, price, currency, position } = body;
      const channel = await (prisma as any).communityChannel.update({
        where: { id: channelId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(isPaid !== undefined && { isPaid }),
          ...(price !== undefined && { price: price === null ? null : parseFloat(price) }),
          ...(currency !== undefined && { currency }),
          ...(position !== undefined && { position })
        }
      });
      return NextResponse.json({ ok: true, channel });
    }
    
    if (action === 'DELETE_CHANNEL') {
      const { channelId } = body;
      await (prisma as any).communityChannel.delete({ where: { id: channelId } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'UPDATE_PERMISSIONS') {
      const { permissions } = body;
      const updated = await (prisma as any).communityPermission.upsert({
        where: { communityId },
        create: { communityId, ...permissions },
        update: { ...permissions }
      });
      return NextResponse.json({ ok: true, permissions: updated });
    }

    if (action === 'UPDATE_PRIVACY') {`;
content = content.replace(PATCH_SEARCH, PATCH_REPLACE);

fs.writeFileSync(file, content);
console.log('API route updated successfully');
