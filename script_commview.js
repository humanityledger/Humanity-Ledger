const fs = require('fs');
let code = fs.readFileSync('components/chat/CommunityView.tsx', 'utf8');

// Add activeChannelId state
code = code.replace(
  `const [activeTab, setActiveTab] = useState<'posts' | 'chat' | 'settings'>('posts');`,
  `const [activeTab, setActiveTab] = useState<'posts' | 'chat' | 'settings'>('posts');\n  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);`
);

// Pass channelId to CommunityChatView
code = code.replace(
  `{activeTab === 'chat' && ( <CommunityChatView communityId={communityId} myAddress={myAddress} /> )}`,
  `{activeTab === 'chat' && ( <CommunityChatView communityId={communityId} channelId={activeChannelId || undefined} myAddress={myAddress} /> )}`
);

// Make free channels clickable
code = code.replace(
  /\{freeChannels\.map\(c => \(\s*<div key=\{c\.id\} className="flex items-center justify-between p-4 bg-\[#F2F2F7\] rounded-\[16px\]">/,
  `{freeChannels.map((c: any) => (\n                      <div key={c.id} onClick={() => { setActiveChannelId(c.id); setShowChannelsModal(false); setActiveTab('chat'); }} className="flex items-center justify-between p-4 bg-[#F2F2F7] rounded-[16px] cursor-pointer hover:bg-[#e5e5ea] transition-colors">`
);

// Make paid channels clickable
code = code.replace(
  /\{paidChannels\.map\(c => \(\s*<div key=\{c\.id\} className="flex items-center justify-between p-4 bg-\[#F2F2F7\] rounded-\[16px\]">/,
  `{paidChannels.map((c: any) => (\n                      <div key={c.id} onClick={() => { setActiveChannelId(c.id); setShowChannelsModal(false); setActiveTab('chat'); }} className="flex items-center justify-between p-4 bg-[#F2F2F7] rounded-[16px] cursor-pointer hover:bg-[#e5e5ea] transition-colors">`
);

fs.writeFileSync('components/chat/CommunityView.tsx', code);
console.log('CommunityView updated successfully');
