const fs = require('fs');
let file = fs.readFileSync('components/chat/GroupCallRoom.tsx', 'utf8');

file = file.replace(/bg-\[#1a1a1a\]/g, 'bg-white');
file = file.replace(/bg-\[#111\]/g, 'bg-[#f5f5f7]');
file = file.replace(/bg-\[#222\]/g, 'bg-[#e5e5ea]');
file = file.replace(/bg-\[#333\]/g, 'bg-[#d1d1d6]');

file = file.replace(/bg-black(?=[\s"'}])/g, 'bg-[#f5f5f7]');
file = file.replace(/border-white\/10/g, 'border-black/[0.08]');
file = file.replace(/border-white\/20/g, 'border-black/[0.08]');
file = file.replace(/border-\[#333\]/g, 'border-black/[0.08]');

// Fix text colors, but careful not to ruin buttons that are colored (like red or green)
file = file.replace(/text-white(?=[\s"'}])/g, 'text-[#1c1c1e]');
file = file.replace(/text-white\/60/g, 'text-black/60');
file = file.replace(/text-white\/50/g, 'text-black/50');
file = file.replace(/text-white\/40/g, 'text-black/40');
file = file.replace(/text-white\/30/g, 'text-black/30');

// Fix the 'Me' or 'Peer' text for the fallback avatar to be black
file = file.replace(/text-[#1c1c1e] text-3xl/g, 'text-black text-3xl');

// Fix translucent overlays
file = file.replace(/bg-black\/60/g, 'bg-white/80 text-black');
file = file.replace(/bg-\[#f5f5f7\]\/80/g, 'bg-white/90');

// Fix controls icons
file = file.replace(/bg-white\/10 text-[#1c1c1e] hover:bg-white\/20/g, 'bg-black/5 text-black hover:bg-black/10');
file = file.replace(/bg-[#1c1c1e]\/10 text-black hover:bg-[#1c1c1e]\/20/g, 'bg-black/5 text-black hover:bg-black/10');

// Specifically for primary buttons that NEED white text (green, red, etc)
file = file.replace(/bg-\[#34C759\] text-\[#1c1c1e\]/g, 'bg-[#34C759] text-white');
file = file.replace(/bg-red-500 hover:bg-red-600 text-\[#1c1c1e\]/g, 'bg-red-500 hover:bg-red-600 text-white');
file = file.replace(/bg-\[#ff3b30\] text-\[#1c1c1e\]/g, 'bg-[#ff3b30] text-white');
file = file.replace(/bg-\[#ff9500\] hover:bg-\[#ffaa22\] text-\[#1c1c1e\]/g, 'bg-[#ff9500] hover:bg-[#ffaa22] text-white');
file = file.replace(/bg-\[#ff3b30\] hover:bg-\[#ff4b40\] text-\[#1c1c1e\]/g, 'bg-[#ff3b30] hover:bg-[#ff4b40] text-white');
file = file.replace(/bg-green-500 text-\[#1c1c1e\]/g, 'bg-green-500 text-white');
file = file.replace(/text-red-400 bg-red-400\/10/g, 'text-red-500 bg-red-500/10');

// Chat panel fixes
file = file.replace(/bg-\[#e5e5ea\] text-\[#1c1c1e\] rounded-bl-sm/g, 'bg-[#f0f0f5] text-black rounded-bl-sm');
file = file.replace(/bg-\[#f5f5f7\] border-l border-black\/\[0.08\] flex/g, 'bg-white border-l border-black/10 flex');
file = file.replace(/bg-white border-t border-black\/\[0.08\]/g, 'bg-white border-t border-black/5');

// Update chat UI messages background
file = file.replace(/bg-white\/10 text-black\/60 rounded-full/g, 'bg-black/5 text-black/60 rounded-full');

fs.writeFileSync('components/chat/GroupCallRoom.tsx', file);
console.log('GroupCallRoom converted to Light Mode');
