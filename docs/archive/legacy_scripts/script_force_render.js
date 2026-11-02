const fs = require('fs');
let code = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

const target = `window.addEventListener('ledger_offline_msg', handleOfflineMsg);`;
const replacement = `window.addEventListener('ledger_offline_msg', handleOfflineMsg);
      const handleForceMsg = (e: any) => {
         setMessages(prev => {
           if (prev.find(m => m.id === e.detail.id)) return prev;
           return [...prev, e.detail].sort((a,b) => a.sentAtNs - b.sentAtNs);
         });
      };
      window.addEventListener('ledger_force_msg_render', handleForceMsg);`;
      
const cleanupTarget = `window.removeEventListener('ledger_offline_msg', handleOfflineMsg);`;
const cleanupReplacement = `window.removeEventListener('ledger_offline_msg', handleOfflineMsg);
        window.removeEventListener('ledger_force_msg_render', handleForceMsg);`;

code = code.replace(target, replacement);
code = code.replace(cleanupTarget, cleanupReplacement);
fs.writeFileSync('components/terminal/LedgerChatV2.tsx', code);
console.log('Added force render listener');
