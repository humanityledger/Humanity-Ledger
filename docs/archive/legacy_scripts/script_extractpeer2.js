const fs = require('fs');
let code = fs.readFileSync('lib/xmtp/client.ts', 'utf8');

code = code.replace(
  `const peerAddr = await extractPeerAddress(d, selfInboxId, (client as any).accountAddress).catch(() => null);`,
  `const peerAddr = await extractPeerAddress(d, selfInboxId, (client as any).accountAddress, client).catch(() => null);`
);

fs.writeFileSync('lib/xmtp/client.ts', code);
console.log('Fixed missed extractPeerAddress');
