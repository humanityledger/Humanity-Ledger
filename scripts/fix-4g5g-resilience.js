const fs = require('fs');
const file = 'd:/Projects/Wallet Human Polymarket ID/components/terminal/LedgerChatV2.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix 1: Add bundlePolicy, rtcpMuxPolicy, iceCandidatePoolSize to PeerJS config for 4G/5G
const OLD_ICE = `            sdpSemantics: 'unified-plan',
            iceTransportPolicy: 'all' as RTCIceTransportPolicy,`;
const NEW_ICE = `            sdpSemantics: 'unified-plan',
            iceTransportPolicy: 'all' as RTCIceTransportPolicy,
            bundlePolicy: 'max-bundle' as RTCBundlePolicy,
            rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
            iceCandidatePoolSize: 10,`;

if (content.includes(OLD_ICE) && !content.includes('iceCandidatePoolSize')) {
  content = content.replace(OLD_ICE, NEW_ICE);
  console.log('ICE config upgraded for 4G/5G');
} else if (content.includes('iceCandidatePoolSize')) {
  console.log('ICE config already upgraded');
} else {
  console.log('ICE OLD pattern not found');
}

// Fix 2: Handle 'voice' type alias -> 'audio' everywhere
const voiceCount = (content.match(/handleStartCall\('voice'/g) || []).length;
if (voiceCount > 0) {
  content = content.replaceAll("handleStartCall('voice'", "handleStartCall('audio'");
  console.log(`Fixed ${voiceCount} 'voice' -> 'audio' typos`);
}

// Fix 3: XMTP send - add timeout wrapper to prevent hanging sends on mobile
const OLD_SEND = `        const dm = await client.conversations.newDmWithIdentifier(identifier);
        
        // [CRITICAL FIX] Must sync the DM before sending, or messages get lost 
        // in local MLS state desync on XMTP v3+
        try { await dm.sync(); } catch {}
        
        await dm.send(content);`;
const NEW_SEND = `        const dm = await client.conversations.newDmWithIdentifier(identifier);
        
        // [CRITICAL FIX] Must sync the DM before sending, or messages get lost 
        // in local MLS state desync on XMTP v3+
        try {
          const syncTimeout = new Promise<void>((_, r) => setTimeout(() => r(new Error('sync timeout')), 5000));
          await Promise.race([dm.sync(), syncTimeout]);
        } catch {}
        
        // [4G/5G FIX] Wrap send in 15s timeout to prevent hanging on poor connections
        const sendTimeout = new Promise<void>((_, r) => setTimeout(() => r(new Error('send timeout')), 15000));
        await Promise.race([dm.send(content), sendTimeout]);`;

const libFile = 'd:/Projects/Wallet Human Polymarket ID/lib/xmtp/client.ts';
let libContent = fs.readFileSync(libFile, 'utf8');
if (libContent.includes(OLD_SEND) && !libContent.includes('sendTimeout')) {
  libContent = libContent.replace(OLD_SEND, NEW_SEND);
  fs.writeFileSync(libFile, libContent);
  console.log('XMTP send timeout added for 4G/5G resilience');
} else {
  console.log('Send timeout already applied or pattern changed');
}

fs.writeFileSync(file, content);
console.log('All fixes applied');
