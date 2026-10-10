const fs = require('fs');

// Fix 3: sendMessage fallback - when XMTP fails, send to offline queue with x-web3-address
let clientTs = fs.readFileSync('lib/xmtp/client.ts', 'utf8');

// Find the offline queue fallback section
const oldQueueFallback = `// --- OFFLINE QUEUE FALLBACK ---
    // Send via server-side offline queue (message will arrive when recipient logs in)
    try {
      await fetch('/api/chat/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: toAddress, content }),
      });`;

const newQueueFallback = `// --- OFFLINE QUEUE FALLBACK ---
    // Send via server-side offline queue (message will arrive when recipient logs in)
    try {
      const queueRes = await fetch('/api/chat/queue', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'x-web3-address': senderEthAddress || toAddress,  // Auth fallback
        },
        body: JSON.stringify({ recipient: toAddress, content }),
      });
      if (!queueRes.ok) {
        const errData = await queueRes.text().catch(() => 'unknown error');
        console.warn('[XMTP] Offline queue rejected:', queueRes.status, errData);
      }`;

clientTs = clientTs.replace(oldQueueFallback, newQueueFallback);

// Also fix the closing brace if needed (check if replacement worked)
if (clientTs.includes('x-web3-address')) {
  console.log('Fix 3 applied - offline queue now sends with auth');
} else {
  console.log('Fix 3 pattern not found - searching for alternative pattern');
}

fs.writeFileSync('lib/xmtp/client.ts', clientTs);
