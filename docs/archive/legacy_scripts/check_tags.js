
const fs = require('fs');
const code = fs.readFileSync('components/chat/LedgerSettingsFull.tsx', 'utf8');
const lines = code.split('\n');
let groups = 0, rows = 0;
lines.forEach((l, i) => {
  if (l.includes('<Group')) groups++;
  if (l.includes('</Group>')) groups--;
  if (l.includes('<Row')) rows++;
  if (l.includes('/>') && l.includes('Row')) rows--;
});
console.log({groups, rows});

