const fs = require('fs');
let code = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
code = code.replace(`const currentActivePeer = (window as any)._active_ledger_peer;`, `const currentActivePeer = (window as any).__xmtp_peer;`);
fs.writeFileSync('components/terminal/LedgerChatV2.tsx', code);
console.log('Fixed window.__xmtp_peer');
