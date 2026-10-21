// lib/chat/safetyNumbers.ts
import crypto from 'crypto';

export function generateSafetyNumber(myFingerprint: string, peerFingerprint: string): string {
  const combined = [myFingerprint, peerFingerprint].sort().join(':');
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  return hash.slice(0, 30).match(/.{1,5}/g)?.join(' ') || hash;
}
