const fs = require('fs');

// 1. Update API route to return sent messages
let apiRoute = fs.readFileSync('app/api/chat/direct/route.ts', 'utf8');

const oldWhere = `      // Fetch both undelivered AND recent delivered (last 7 days) for reconnect sync
      const messages = await prisma.directMessage.findMany({
        where: {
          recipient: address,
          createdAt: { gte: since },
        },`;
const newWhere = `      // Fetch both undelivered AND recent delivered (last 7 days) for reconnect sync
      const messages = await prisma.directMessage.findMany({
        where: {
          OR: [
            { recipient: address },
            { sender: address }
          ],
          createdAt: { gte: since },
        },`;
apiRoute = apiRoute.replace(oldWhere, newWhere);

const oldUpdate = `      if (undeliveredIds.length > 0) {
        await prisma.directMessage.updateMany({
          where: { id: { in: undeliveredIds } },
          data: { delivered: true, deliveredAt: new Date() },
        });
      }`;
const newUpdate = `      if (undeliveredIds.length > 0) {
        // Only mark as delivered if WE are the recipient
        const toMark = messages.filter(m => m.recipient === address && !m.delivered).map(m => m.id);
        if (toMark.length > 0) {
          await prisma.directMessage.updateMany({
            where: { id: { in: toMark } },
            data: { delivered: true, deliveredAt: new Date() },
          });
        }
      }`;
apiRoute = apiRoute.replace(oldUpdate, newUpdate);
fs.writeFileSync('app/api/chat/direct/route.ts', apiRoute);

// 2. Update LedgerChatV2.tsx to handle sent messages
let chatTsx = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

const oldLoop = `                const senderLower = dm.sender?.toLowerCase() ?? '';
                const activePeerLower = activePeerRef.current?.toLowerCase() ?? '';
                const isFromActivePeer = senderLower === activePeerLower;
                
                const msgObj = {
                  id: dmId,
                  content: dm.content,
                  senderAddress: dm.sender,
                  sentAtNs: dm.createdAt,
                  conversationId: \`dm-\${senderLower}\`,
                  isMe: false,
                  status: 'delivered'
                };
                
                // CRITICAL FIX: Persist fallback DB message to IndexedDB so it survives reloads
                if (typeof chatDB !== 'undefined' && chatDB.saveMessages) {
                  chatDB.saveMessages([msgObj]).catch(() => {});
                  chatDB.saveConversation({ peerAddress: dm.sender, lastAt: dm.createdAt }).catch(() => {});
                }
                
                setConversations(prev => {
                  const existing = prev.find(c => c.peerAddress.toLowerCase() === senderLower);
                  const newEntry = { peerAddress: dm.sender, lastMessage: dm.content, lastAt: new Date(dm.createdAt) };
                  if (existing) {
                    return [newEntry, ...prev.filter(c => c.peerAddress.toLowerCase() !== senderLower)];
                  }
                  return [newEntry, ...prev];
                });`;

const newLoop = `                const isMeMsg = dm.sender?.toLowerCase() === address?.toLowerCase();
                const peerAddress = isMeMsg ? dm.recipient : dm.sender;
                const peerLower = peerAddress?.toLowerCase() ?? '';
                const activePeerLower = activePeerRef.current?.toLowerCase() ?? '';
                const isFromActivePeer = peerLower === activePeerLower;
                
                const msgObj = {
                  id: dmId,
                  content: dm.content,
                  senderAddress: dm.sender,
                  sentAtNs: dm.createdAt,
                  conversationId: \`dm-\${peerLower}\`,
                  isMe: isMeMsg,
                  status: 'delivered'
                };
                
                // CRITICAL FIX: Persist fallback DB message to IndexedDB so it survives reloads
                if (typeof chatDB !== 'undefined' && chatDB.saveMessages) {
                  chatDB.saveMessages([msgObj]).catch(() => {});
                  chatDB.saveConversation({ peerAddress: peerAddress, lastAt: dm.createdAt }).catch(() => {});
                }
                
                setConversations(prev => {
                  const existing = prev.find(c => c.peerAddress.toLowerCase() === peerLower);
                  const newEntry = { peerAddress: peerAddress, lastMessage: dm.content, lastAt: new Date(dm.createdAt) };
                  if (existing) {
                    return [newEntry, ...prev.filter(c => c.peerAddress.toLowerCase() !== peerLower)];
                  }
                  return [newEntry, ...prev];
                });`;

chatTsx = chatTsx.replace(oldLoop, newLoop);
fs.writeFileSync('components/terminal/LedgerChatV2.tsx', chatTsx);
console.log('Fixed DirectMessage split-brain sender sync');
