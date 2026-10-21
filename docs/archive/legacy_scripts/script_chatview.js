const fs = require('fs');
let code = fs.readFileSync('components/chat/CommunityChatView.tsx', 'utf8');

if (!code.includes('usePushNotifications')) {
  code = code.replace(`import { AnimatePresence, motion } from 'framer-motion';`, `import { AnimatePresence, motion } from 'framer-motion';\nimport { usePushNotifications } from '@/lib/push/usePushNotifications';`);
}

code = code.replace(
  /export function CommunityChatView\(\{ communityId, myAddress \}: \{ communityId: string; myAddress: string \}\) \{/,
  `export function CommunityChatView({ communityId, channelId, myAddress }: { communityId: string; channelId?: string; myAddress: string }) {\n  const push = usePushNotifications(myAddress);`
);

const oldFetch = /const fetchMessages = async \(\) => \{[\s\S]*?\} catch \(e\) \{[\s\S]*?\}\n  \};/;
const newFetch = `const fetchMessages = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (myAddress) headers['x-web3-address'] = myAddress;
      const url = \`/api/chat/communities/posts?communityId=\${communityId}\${channelId ? \`&channelId=\${channelId}\` : ''}&limit=50\`;
      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const data = await res.json();
      
      const chatMsgs = (data.posts || []).filter((p: any) => !p.title && !p.contentJson);
      const filtered = channelId ? chatMsgs.filter((m: any) => m.channelId === channelId || !m.channelId) : chatMsgs;
      const ordered = [...filtered].reverse();
      
      ordered.forEach((m: any) => {
        const addr = (m.authorAddress || '').toLowerCase();
        if (addr && !seenAddresses.current.has(addr)) {
          seenAddresses.current.add(addr);
          if (seenAddresses.current.size > 1) {
            setSystemEvents(prev => [...prev, { id: \`join-\${addr}\`, text: \`\${addr.slice(0, 6)}...\${addr.slice(-4)} joined\` }]);
          }
        }
      });
      
      setMessages(prev => {
        const prevIds = new Set(prev.map(m => m.id));
        let hasNew = false;
        ordered.forEach(m => {
          if (!prevIds.has(m.id)) {
            hasNew = true;
            if (m.authorAddress && m.authorAddress.toLowerCase() !== myAddress.toLowerCase()) {
              push.notifyIfHidden(m.authorAddress, m.content);
            }
          }
        });
        if (hasNew) {
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
        return ordered;
      });
    } catch (e) {
      console.error('[CommunityChatView] fetch error', e);
    }
  };`;

code = code.replace(oldFetch, newFetch);

code = code.replace(
  `body: JSON.stringify({ communityId, authorAddress: myAddress.toLowerCase(), content: txt, plainText: txt }),`,
  `body: JSON.stringify({ communityId, channelId, authorAddress: myAddress.toLowerCase(), content: txt, plainText: txt }),`
);

code = code.replace(
  `}, [communityId]);`,
  `}, [communityId, channelId]);`
);

fs.writeFileSync('components/chat/CommunityChatView.tsx', code);
console.log('CommunityChatView updated successfully');
