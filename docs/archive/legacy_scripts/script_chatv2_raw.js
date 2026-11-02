const fs = require('fs');
let code = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

// We need to filter raw messages in `rawMsgs` fetch and `getMessages` fetch where it does mapping.
// Looking for `const rawMsgs = await getMessages(client, activePeerRef.current);` block:
code = code.replace(
  `const newRaw = rawMsgs.filter(m => m.id && !existingIds.has(m.id));`,
  `const newRaw = rawMsgs.filter(m => {
                        if (!m.id || existingIds.has(m.id)) return false;
                        const cStr = typeof m.content === 'string' ? m.content : (m.content ? JSON.stringify(m.content) : '');
                        return !cStr.includes('initiatedByInboxId') && !cStr.includes('addedInboxes') && !cStr.includes('group is inactive');
                      });`
);

// Looking for `let raw = await getMessages(client, activePeer);` block:
code = code.replace(
  `const rawMappedMsgs = raw.map((m: any) => {`,
  `const rawFiltered = raw.filter((m: any) => {
            const cStr = typeof m.content === 'string' ? m.content : (m.content ? JSON.stringify(m.content) : '');
            return !cStr.includes('initiatedByInboxId') && !cStr.includes('addedInboxes') && !cStr.includes('group is inactive');
          });
          const rawMappedMsgs = rawFiltered.map((m: any) => {`
);

fs.writeFileSync('components/terminal/LedgerChatV2.tsx', code);
console.log('Filtered raw object messages in LedgerChatV2');
