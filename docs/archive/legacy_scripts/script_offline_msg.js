const fs = require('fs');
let code = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

const targetStr = `const msgData = {
           id,
           senderAddress: sender,
           content,
           sent: new Date(createdAt),
           status: 'delivered' as const,
           isMe: false,
        };
        if (typeof window !== 'undefined' && (window as any)._active_ledger_client) {
           import('@/lib/chat/indexeddb').then(async ({ chatDB }) => {
               const myAddress = (window as any)._active_ledger_client.address || address;
               if (myAddress) {
                   await chatDB.saveMessage(myAddress, sender, msgData).catch(() => {});
                   // Force UI to update with new messages
                   loadConversations();
               }
           });
        }`;

const replacementStr = `const msgData = {
           id,
           senderAddress: sender,
           content,
           sentAtNs: new Date(createdAt).getTime(),
           status: 'delivered' as const,
           conversationId: \`dm-\${sender.toLowerCase()}\`,
        };
        if (typeof window !== 'undefined' && (window as any)._active_ledger_client) {
           import('@/lib/chat/indexeddb').then(async ({ chatDB }) => {
               const myAddress = (window as any)._active_ledger_client.address || address;
               if (myAddress) {
                   await chatDB.saveMessages([msgData]).catch(() => {});
                   // Force UI to update with new messages
                   loadConversations();
                   
                   // Push directly to active view if it's the current peer
                   const currentActivePeer = (window as any)._active_ledger_peer;
                   if (currentActivePeer && currentActivePeer.toLowerCase() === sender.toLowerCase()) {
                       const evt = new CustomEvent('ledger_force_msg_render', { detail: msgData });
                       window.dispatchEvent(evt);
                   }
               }
           });
        }`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('components/terminal/LedgerChatV2.tsx', code);
console.log('Fixed offline message saving');
