const fs = require('fs');
let code = fs.readFileSync('lib/xmtp/client.ts', 'utf8');

// 1. Add client to extractPeerAddress signature
code = code.replace(
  `export async function extractPeerAddress(dm: any, selfInboxId: string, selfEthAddress?: string): Promise<string | null> {`,
  `export async function extractPeerAddress(dm: any, selfInboxId: string, selfEthAddress?: string, client?: Client): Promise<string | null> {`
);

// 2. Pass client to resolveInboxIdToAddress inside extractPeerAddress
code = code.replace(
  `const resolved = await resolveInboxIdToAddress(peerInboxId);`,
  `const resolved = await resolveInboxIdToAddress(peerInboxId, client);`
);

// 3. Fix all callers of extractPeerAddress to pass client
code = code.replace(
  `const peerAddr = await extractPeerAddress(d, selfInboxId, (client as any).accountAddress).catch(() => null);`,
  `const peerAddr = await extractPeerAddress(d, selfInboxId, (client as any).accountAddress, client).catch(() => null);`
);

code = code.replace(
  `const peerAddr = await extractPeerAddress(dm, selfInboxId, (client as any).accountAddress);`,
  `const peerAddr = await extractPeerAddress(dm, selfInboxId, (client as any).accountAddress, client);`
);

// 4. Update resolveInboxIdToAddress to safely use instance method
const resolveInboxReplace = `try {
      let states: any = null;
      try {
        if (client && typeof (client as any).inboxStateFromInboxIds === 'function') {
           states = await (client as any).inboxStateFromInboxIds([inboxId]);
        } else {
           states = await (Client as any).inboxStateFromInboxIds?.([inboxId], XMTP_ENV);
        }
      } catch (e) {`;

code = code.replace(
  `try {
      let states: any = null;
      try {
        states = await (Client as any).inboxStateFromInboxIds?.([inboxId], XMTP_ENV);
      } catch (e) {`,
  resolveInboxReplace
);

fs.writeFileSync('lib/xmtp/client.ts', code);
console.log('Fixed client.ts extractPeerAddress');
