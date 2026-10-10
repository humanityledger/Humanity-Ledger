const fs = require('fs');
let code = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

const target = `const syncGlobal = async () => {
      try {
        // Discover new peers from the XMTP network
        const newPeerAddrs = await discoverNewPeers(client, address, knownPeersRef.current);`;

const replacement = `const syncGlobal = async () => {
      try {
        // Fetch offline queue (Aztec users / fallback)
        if (address) await syncOfflineQueue(client, address);
        
        // Discover new peers from the XMTP network
        const newPeerAddrs = await discoverNewPeers(client, address, knownPeersRef.current);`;

code = code.replace(target, replacement);
fs.writeFileSync('components/terminal/LedgerChatV2.tsx', code);
console.log('Added offline queue sync to global poll');
