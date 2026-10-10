const fs = require('fs');
const file = 'd:/Projects/Wallet Human Polymarket ID/components/terminal/LedgerChatV2.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add bundlePolicy + iceCandidatePoolSize after iceTransportPolicy line
const SEARCH = "iceTransportPolicy: 'all' as RTCIceTransportPolicy,\r\n        },";
const REPLACE = "iceTransportPolicy: 'all' as RTCIceTransportPolicy,\r\n          // [4G/5G] Pre-gather 10 ICE candidates, bundle all media on one port, require RTCP mux\r\n          bundlePolicy: 'max-bundle',\r\n          rtcpMuxPolicy: 'require',\r\n          iceCandidatePoolSize: 10,\r\n        },";

if (content.includes(SEARCH)) {
  content = content.replace(SEARCH, REPLACE);
  fs.writeFileSync(file, content);
  console.log('ICE 4G/5G config applied');
} else {
  // Try with LF only
  const SEARCH2 = "iceTransportPolicy: 'all' as RTCIceTransportPolicy,\n        },";
  const REPLACE2 = "iceTransportPolicy: 'all' as RTCIceTransportPolicy,\n          // [4G/5G] Pre-gather 10 ICE candidates, bundle all media on one port, require RTCP mux\n          bundlePolicy: 'max-bundle',\n          rtcpMuxPolicy: 'require',\n          iceCandidatePoolSize: 10,\n        },";
  if (content.includes(SEARCH2)) {
    content = content.replace(SEARCH2, REPLACE2);
    fs.writeFileSync(file, content);
    console.log('ICE 4G/5G config applied (LF variant)');
  } else {
    console.log('ICE pattern not found - checking file...');
    const idx = content.indexOf('iceTransportPolicy');
    console.log('iceTransportPolicy found at:', idx);
    if (idx > 0) console.log('Context:', content.slice(idx, idx + 80));
  }
}
