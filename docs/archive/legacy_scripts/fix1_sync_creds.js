const fs = require('fs');

// Fix 1: syncOfflineQueue must pass credentials (cookie) so getSession() works
let clientTs = fs.readFileSync('lib/xmtp/client.ts', 'utf8');

const oldSync = `export async function syncOfflineQueue(client: Client, myEthAddress: string): Promise<void> {
    try {
      const res = await fetch('/api/chat/queue', {
        headers: { 'x-web3-address': myEthAddress }
      });`;

const newSync = `export async function syncOfflineQueue(client: Client, myEthAddress: string): Promise<void> {
    try {
      // CRITICAL: Must pass credentials so cookie-based getSession() works server-side
      const res = await fetch('/api/chat/queue', {
        credentials: 'include',
        headers: { 
          'x-web3-address': myEthAddress,
          'Content-Type': 'application/json'
        }
      });`;

clientTs = clientTs.replace(oldSync, newSync);
fs.writeFileSync('lib/xmtp/client.ts', clientTs);
console.log('Fixed syncOfflineQueue credentials');
