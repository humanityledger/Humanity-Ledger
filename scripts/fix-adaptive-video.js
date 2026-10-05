const fs = require('fs');
const file = 'd:/Projects/Wallet Human Polymarket ID/components/terminal/LedgerChatV2.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix adaptive video constraints in startCall for 4G/5G
const OLD = `        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video' ? { facingMode: 'user' } : false,
        });`;

const NEW = `        // [4G/5G] Adaptive video quality based on network type
        const _netConn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        const _effectiveType = _netConn?.effectiveType || '4g';
        const _isSlowNet = _effectiveType === 'slow-2g' || _effectiveType === '2g' || _effectiveType === '3g';
        const _videoConstraints = type === 'video'
          ? (_isSlowNet
            ? { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { max: 15 } }
            : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } })
          : false as const;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: _videoConstraints,
        });`;

if (content.includes(OLD)) {
  content = content.replace(OLD, NEW);
  fs.writeFileSync(file, content);
  console.log('Adaptive video constraints applied');
} else {
  console.log('Pattern not found - may already be patched');
}
