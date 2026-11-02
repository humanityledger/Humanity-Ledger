import crypto from 'crypto';

export interface CryptographicInvitePayload {
  communityId: string;
  role: 'MEMBER' | 'VIP' | 'CONTRIBUTOR' | 'MODERATOR' | 'ADMIN';
  expiresAt: number; // Unix timestamp ms
  maxUses: number;   // 1 for single-use, 0 for infinite
  nonce: string;     // Unique cryptographic salt / tracking ID
  creatorAddress: string;
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
  payload?: CryptographicInvitePayload;
}

// In-memory nonce store for one-time use tokens (can be backed by Redis / DB in production)
const usedInviteNonces = new Set<string>();

function getSecretKey(): string {
  return process.env.INVITE_SECRET_KEY || (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('INVITE_SECRET_KEY or JWT_SECRET must be set.'); return s; })();
}

/**
 * Generates an HMAC-SHA256 cryptographically signed community invite token.
 */
export function generateCryptographicInvite(
  params: Omit<CryptographicInvitePayload, 'nonce'> & { nonce?: string }
): { token: string; inviteUrl: string; qrData: string } {
  const nonce = params.nonce || crypto.randomBytes(16).toString('hex');
  const payload: CryptographicInvitePayload = {
    communityId: params.communityId,
    role: params.role || 'MEMBER',
    expiresAt: params.expiresAt,
    maxUses: params.maxUses ?? 0,
    nonce,
    creatorAddress: params.creatorAddress.toLowerCase(),
  };

  const jsonStr = JSON.stringify(payload);
  const encodedPayload = Buffer.from(jsonStr, 'utf-8').toString('base64url');

  const hmac = crypto.createHmac('sha256', getSecretKey());
  hmac.update(encodedPayload);
  const signature = hmac.digest('base64url');

  const token = `inv_${encodedPayload}.${signature}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://humanidfi.com';
  const inviteUrl = `${baseUrl}/join?token=${token}`;
  const qrData = `hl:join:${token}`;

  return { token, inviteUrl, qrData };
}

/**
 * Validates a cryptographic invite token with constant-time signature verification,
 * expiration check, and single-use replay protection.
 */
export function verifyCryptographicInvite(token: string): VerificationResult {
  if (!token || !token.startsWith('inv_')) {
    return { valid: false, error: 'Invalid invite token prefix' };
  }

  const raw = token.slice(4);
  const parts = raw.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed invite token structure' };
  }

  const [encodedPayload, clientSig] = parts;

  // 1. Verify HMAC signature in constant time
  const hmac = crypto.createHmac('sha256', getSecretKey());
  hmac.update(encodedPayload);
  const expectedSig = hmac.digest('base64url');

  const clientSigBuf = Buffer.from(clientSig, 'utf-8');
  const expectedSigBuf = Buffer.from(expectedSig, 'utf-8');

  if (clientSigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(clientSigBuf, expectedSigBuf)) {
    return { valid: false, error: 'Cryptographic signature verification failed' };
  }

  // 2. Decode payload
  let payload: CryptographicInvitePayload;
  try {
    const jsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    payload = JSON.parse(jsonStr);
  } catch {
    return { valid: false, error: 'Failed to decode invite payload' };
  }

  // 3. Expiration check
  if (payload.expiresAt && Date.now() > payload.expiresAt) {
    return { valid: false, error: 'Invite link has expired', payload };
  }

  // 4. One-time use check
  if (payload.maxUses === 1) {
    if (usedInviteNonces.has(payload.nonce)) {
      return { valid: false, error: 'This one-time invite code has already been consumed', payload };
    }
  }

  return { valid: true, payload };
}

/**
 * Marks a single-use token as consumed to prevent replay attacks.
 */
export function consumeCryptographicInvite(nonce: string): void {
  usedInviteNonces.add(nonce);
}
