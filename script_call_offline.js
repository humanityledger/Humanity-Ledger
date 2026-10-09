const fs = require('fs');
let code = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

const targetStr = `const targetPeer = targetPeerOverride || activePeer;
    if (!targetPeer) return;`;

const replacement = `const targetPeer = targetPeerOverride || activePeer;
    if (!targetPeer) return;
    
    // Prevent calling if the user is not registered on XMTP yet
    if (canReceiveCache.current.get(targetPeer.toLowerCase()) === false) {
      toast.error('Cannot call: This contact is not fully registered on Ledger Chat yet.');
      return;
    }`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('components/terminal/LedgerChatV2.tsx', code);
console.log('Added offline call prevention');
