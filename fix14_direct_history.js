const fs = require('fs');
let chatComponent = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

// Fix 1: Change directMsgSinceRef default to 7 days to fetch full fallback history on load
const oldRef = `const directMsgSinceRef = useRef(Date.now() - 30000);`;
const newRef = `const directMsgSinceRef = useRef(Date.now() - 7 * 24 * 60 * 60 * 1000); // Check last 7 days on first load to restore full history`;
chatComponent = chatComponent.replace(oldRef, newRef);

// Fix 2: Save to IndexedDB
const oldSave = `const msgObj = {
                  id: dmId,
                  content: dm.content,
                  senderAddress: dm.sender,
                  sentAtNs: dm.createdAt,
                  conversationId: \`dm-\${senderLower}\`,
                  isMe: false,
                  status: 'delivered'
                };
                
                setConversations(prev => {`;
                
const newSave = `const msgObj = {
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
                
                setConversations(prev => {`;
chatComponent = chatComponent.replace(oldSave, newSave);

fs.writeFileSync('components/terminal/LedgerChatV2.tsx', chatComponent);
console.log('Fixed historical restore of direct messages and IndexedDB persistence');
