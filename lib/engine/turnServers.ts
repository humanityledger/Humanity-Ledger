/**
 * getTurnServers — returns ICE server configuration.
 *
 * In production, set TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL env vars.
 * These must point to your own TURN server (Coturn, Cloudflare Calls TURN, etc.)
 * with HMAC-temporal credentials.
 *
 * DO NOT use openrelayproject — credentials are public and relay is untrusted.
 */
export function getTurnServers(): RTCIceServer[] {
  const turnUrls = process.env.NEXT_PUBLIC_TURN_URLS;
  
  if (turnUrls) {
    return [{
      urls: turnUrls.split(',').map(u => u.trim()),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
    }];
  }

  // Fallback: STUN only (no TURN relay). Connections may fail behind symmetric NAT.
  // Configure TURN_URLS in production for reliable connectivity.
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
}
