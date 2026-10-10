const fs = require('fs');

let chatComponent = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

const oldStr = `    const syncGlobal = async () => {
      try {
        // Discover new peers from the XMTP network`;

const newStr = `    // Track last direct message poll time to avoid re-delivering
    const directMsgSinceRef = useRef(Date.now() - 30000); // Check last 30s on first load
    
    const syncGlobal = async () => {
      try {
        // Fetch offline queue (Aztec users / fallback)
        if (address) await syncOfflineQueue(client, address);
        
        // RELIABLE DIRECT MESSAGE POLLING (Safety net when XMTP fails)
        try {
          const directRes = await fetch(\`/api/chat/direct?since=\${directMsgSinceRef.current}\`, {
            credentials: 'include',
            headers: { 'x-web3-address': address || '' }
          });
          if (directRes.ok) {
            const { messages: directMsgs } = await directRes.json();
            directMsgSinceRef.current = Date.now() - 5000; // overlap window
            if (directMsgs && directMsgs.length > 0) {
              for (const dm of directMsgs) {
                const dmId = \`direct-\${dm.id}\`;
                if (confirmedMsgIds.current.has(dmId)) continue;
                confirmedMsgIds.current.add(dmId);
                
                const senderLower = dm.sender?.toLowerCase() ?? '';
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
                
                setConversations(prev => {
                  const existing = prev.find(c => c.peerAddress.toLowerCase() === senderLower);
                  const newEntry = { peerAddress: dm.sender, lastMessage: dm.content, lastAt: new Date(dm.createdAt) };
                  if (existing) {
                    return [newEntry, ...prev.filter(c => c.peerAddress.toLowerCase() !== senderLower)];
                  }
                  return [newEntry, ...prev];
                });
                
                if (isFromActivePeer) {
                  setMessages(prev => {
                    if (prev.some(m => m.id === dmId)) return prev;
                    return [...prev, msgObj].sort((a, b) => (a.sentAtNs ?? 0) - (b.sentAtNs ?? 0));
                  });
                }
              }
            }
          }
        } catch (directErr) {
          console.warn('[LedgerChat] Direct poll error:', directErr);
        }
        
        // Discover new peers from the XMTP network`;

if (chatComponent.includes('const syncGlobal = async () => {')) {
  chatComponent = chatComponent.replace(oldStr, newStr);
  fs.writeFileSync('components/terminal/LedgerChatV2.tsx', chatComponent);
  console.log('Successfully injected direct messaging fallback into LedgerChatV2.tsx');
} else {
  console.log('Pattern not found!');
}
