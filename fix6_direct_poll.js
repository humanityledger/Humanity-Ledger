const fs = require('fs');

// Fix LedgerChatV2: Add direct message polling loop that runs every 5 seconds
// This is the RELIABLE delivery mechanism when XMTP stream fails
let chatComponent = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

// Add direct message polling after the offline queue sync in syncGlobal
const oldSyncGlobal = `const syncGlobal = async () => {
      try {
        // Fetch offline queue (Aztec users / fallback)
        if (address) await syncOfflineQueue(client, address);
        
        // Discover new peers from the XMTP network
        const newPeerAddrs = await discoverNewPeers(client, address, knownPeersRef.current);`;

const newSyncGlobal = `// Track last direct message poll time to avoid re-delivering
      const directMsgSinceRef = { current: Date.now() - 30000 }; // Check last 30s on first load
      
      const syncGlobal = async () => {
      try {
        // Fetch offline queue (Aztec users / fallback)
        if (address) await syncOfflineQueue(client, address);
        
        // RELIABLE DIRECT MESSAGE POLLING
        // This is the safety net when XMTP stream drops messages.
        // Checks every 15s (global poll interval) for any direct messages the DB has for us.
        try {
          const directRes = await fetch(\`/api/chat/direct?since=\${directMsgSinceRef.current}\`, {
            credentials: 'include',
            headers: { 'x-web3-address': address }
          });
          if (directRes.ok) {
            const { messages: directMsgs } = await directRes.json();
            directMsgSinceRef.current = Date.now() - 5000; // overlap window
            if (directMsgs && directMsgs.length > 0) {
              for (const dm of directMsgs) {
                // Skip if already in confirmedMsgIds (message came via XMTP stream too)
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
                  status: 'delivered' as const,
                };
                
                // Update conversation sidebar
                setConversations(prev => {
                  const existing = prev.find(c => c.peerAddress.toLowerCase() === senderLower);
                  const newEntry = { peerAddress: dm.sender, lastMessage: dm.content, lastAt: new Date(dm.createdAt) };
                  if (existing) {
                    return [newEntry, ...prev.filter(c => c.peerAddress.toLowerCase() !== senderLower)];
                  }
                  return [newEntry, ...prev];
                });
                
                // If this is from the active peer, show in chat immediately
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
          console.warn('[LedgerChat] Direct message poll error:', directErr);
        }
        
        // Discover new peers from the XMTP network
        const newPeerAddrs = await discoverNewPeers(client, address, knownPeersRef.current);`;

chatComponent = chatComponent.replace(oldSyncGlobal, newSyncGlobal);
fs.writeFileSync('components/terminal/LedgerChatV2.tsx', chatComponent);
console.log('Added direct message polling to syncGlobal');
