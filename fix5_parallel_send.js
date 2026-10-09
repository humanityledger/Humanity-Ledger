const fs = require('fs');

// Fix the XMTP sendMessage to also send via /api/chat/direct as a reliable parallel track
let clientTs = fs.readFileSync('lib/xmtp/client.ts', 'utf8');

// Find the "return; // SUCCESS" line and add parallel direct message send
const oldSuccess = `          await Promise.race([dm.send(content), sendTimeout]);
          // Sync after send to confirm delivery - ignore sync errors, message is already sent
          try { await dm.sync(); } catch {}
          return; // SUCCESS - do not fall through to offline queue`;

const newSuccess = `          await Promise.race([dm.send(content), sendTimeout]);
          // Sync after send to confirm delivery - ignore sync errors, message is already sent
          try { await dm.sync(); } catch {}
          
          // PARALLEL DIRECT SEND: Also send via DB as reliable delivery guarantee
          // If the recipient's XMTP stream is down, they'll get it via polling.
          // Fire-and-forget - do NOT await so we don't slow down the UI.
          if (typeof window !== 'undefined' && senderEthAddress) {
            fetch('/api/chat/direct', {
              method: 'POST',
              credentials: 'include',
              headers: { 
                'Content-Type': 'application/json',
                'x-web3-address': senderEthAddress,
              },
              body: JSON.stringify({ recipient: toAddress, content }),
            }).catch(() => {}); // Fire and forget
          }
          
          return; // SUCCESS - do not fall through to offline queue`;

clientTs = clientTs.replace(oldSuccess, newSuccess);
fs.writeFileSync('lib/xmtp/client.ts', clientTs);
console.log('Added parallel direct message send for delivery guarantee');
