import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto';

/**
 * Secure password hashing using scrypt (Node.js built-in alternative to Argon2).
 * Recommended by OWASP over SHA-256 for passwords.
 */
export function hashRoomPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  // scrypt cost parameters: N=16384, r=8, p=1, keylen=64
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyRoomPassword(password: string, hash: string): boolean {
  if (!hash || !hash.includes(':')) return false;
  const [salt, keyHex] = hash.split(':');
  try {
    const derivedKey = scryptSync(password, salt, 64);
    const targetKey = Buffer.from(keyHex, 'hex');
    if (derivedKey.length !== targetKey.length) return false;
    return timingSafeEqual(derivedKey, targetKey);
  } catch {
    return false;
  }
}

/**
 * Generate an ambiguous-free, Crockford Base32-like room ID
 * Better UX than base64/hex. Avoids 0, O, I, 1.
 */
export function generateCrockfordRoomId(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

/**
 * Generates an HMAC token bound to a specific roomId, wallet address, and optional peerId.
 * Token expires locally but is also verified against DB.
 */
export function generateJoinToken(roomId: string, address: string, secret: string, peerId?: string): string {
  const ts = Date.now();
  const payload = `${roomId}:${address}:${peerId || 'none'}:${ts}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyJoinToken(token: string, secret: string, maxAgeMs = 4 * 60 * 60 * 1000): { roomId: string; address: string; peerId: string; ts: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [roomId, address, peerId, tsStr, sig] = parts;
    const payload = `${roomId}:${address}:${peerId}:${tsStr}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (sig !== expected) return null;
    const ts = parseInt(tsStr, 10);
    if (Date.now() - ts > maxAgeMs) return null;
    return { roomId, address, peerId: peerId === 'none' ? '' : peerId, ts };
  } catch {
    return null;
  }
}
