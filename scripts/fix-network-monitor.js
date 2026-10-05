const fs = require('fs');
const file = 'd:/Projects/Wallet Human Polymarket ID/components/terminal/LedgerChatV2.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add network change monitor (4G/5G resilience)
const networkMonitor = `
  // [4G/5G RESILIENCE] Network change handler - re-sync XMTP when connection changes
  useEffect(() => {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!conn) return;
    const handleNetworkChange = () => {
      console.log('[Network] Type changed to:', conn.effectiveType, '| downlink:', conn.downlink, 'Mbps');
      if (client && address) {
        try { (client as any).conversations?.sync?.().catch(() => {}); } catch {}
      }
    };
    conn.addEventListener('change', handleNetworkChange);
    return () => conn.removeEventListener('change', handleNetworkChange);
  }, [client, address]);
`;

if (!content.includes('[4G/5G RESILIENCE] Network change handler')) {
  content = content.replace(
    '// Extreme Security: Draft Persistence',
    networkMonitor + '\n  // Extreme Security: Draft Persistence'
  );
  fs.writeFileSync(file, content);
  console.log('Network monitor injected OK');
} else {
  console.log('Network monitor already present');
}
