const fs = require('fs');
let content = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

const oldCode = `    // Seed the persistent ref with already-known conversations
    conversations.forEach(c => knownPeersRef.current.add(c.peerAddress.toLowerCase()));

    // Track last direct message poll time to avoid re-delivering
    const directMsgSinceRef = useRef(Date.now() - 7 * 24 * 60 * 60 * 1000); // Check last 7 days on first load to restore full history
    
    const syncGlobal = async () => {`;

const newCode = `    // Seed the persistent ref with already-known conversations
    conversations.forEach(c => knownPeersRef.current.add(c.peerAddress.toLowerCase()));

    const syncGlobal = async () => {`;

content = content.replace(oldCode, newCode);

const hookDef = `  //  Global XMTP Stream 
  useEffect(() => {`;

const newHookDef = `  // Track last direct message poll time to avoid re-delivering
  const directMsgSinceRef = useRef(Date.now() - 7 * 24 * 60 * 60 * 1000); // Check last 7 days on first load to restore full history

  //  Global XMTP Stream 
  useEffect(() => {`;

content = content.replace(hookDef, newHookDef);

fs.writeFileSync('components/terminal/LedgerChatV2.tsx', content);
console.log('Fixed React hook violation');
