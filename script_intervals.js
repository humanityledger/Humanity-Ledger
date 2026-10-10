const fs = require('fs');
let code = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

code = code.replace(`const globalPoll = setInterval(syncGlobal, 2000);`, `const globalPoll = setInterval(syncGlobal, 15000);`);
code = code.replace(`const pollId = setInterval(() => fetchHistorical(false), 5000);`, `const pollId = setInterval(() => fetchHistorical(false), 12000);`);

fs.writeFileSync('components/terminal/LedgerChatV2.tsx', code);
console.log('Fixed polling intervals');
