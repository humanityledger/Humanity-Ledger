const fs = require('fs');
let v2 = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

// Pattern
v2 = v2.replace(
  /backgroundColor:\s*bgStyle\?\.backgroundImage\s*\?\s*undefined\s*:\s*'#EBE5DC'/g,
  "backgroundColor: '#EBE5DC', backgroundImage: \"url('data:image/svg+xml,%3Csvg width=\\'100\\' height=\\'100\\' viewBox=\\'0 0 100 100\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cpath d=\\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\\' fill=\\'%2325D366\\' fill-opacity=\\'0.07\\' fill-rule=\\'evenodd\\'/%3E%3C/svg%3E')\", backgroundAttachment: 'fixed'"
);

// Glassmorphism Header
v2 = v2.replace(
  'h-[68px] px-4 border-b border-black/[0.08] flex items-center justify-between bg-white shrink-0 z-10 shadow-[0_1px_8px_rgba(0,0,0,0.05)]',
  'h-[68px] px-4 border-b border-black/[0.05] flex items-center justify-between bg-white/80 backdrop-blur-xl shrink-0 z-10 shadow-[0_4px_30px_rgba(0,0,0,0.03)]'
);

// Sidebar
v2 = v2.replace(
  'pb-0 px-4 border-b border-black/[0.06] bg-white',
  'pb-0 px-4 border-b border-black/[0.05] bg-[#F9F9F9]'
);

fs.writeFileSync('components/terminal/LedgerChatV2.tsx', v2);
console.log('Done');
