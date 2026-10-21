import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAccessToken,
  createRefreshToken,
  verifyToken,
  generateFingerprint,
  validateFingerprint,
} from '@/lib/session';

describe('lib/session', () => {
  const userId = '0x1234567890abcdef1234567890abcdef12345678';
  const email = 'user@example.com';
  const fingerprint = generateFingerprint('Mozilla/5.0', '127.0.0.1');

  it('generates consistent device fingerprints', () => {
    const fp1 = generateFingerprint('Mozilla/5.0', '127.0.0.1');
    const fp2 = generateFingerprint('Mozilla/5.0', '127.0.0.1');
    const fp3 = generateFingerprint('Safari/5.0', '127.0.0.1');
    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(validateFingerprint(fp1, fp2)).toBe(true);
    expect(validateFingerprint(fp1, fp3)).toBe(false);
  });

  it('creates and verifies a valid access token', async () => {
    const token = await createAccessToken(userId, email, fingerprint);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(userId);
    expect(payload?.email).toBe(email);
    expect(payload?.type).toBe('access');
    expect(payload?.fingerprint).toBe(fingerprint);
  });

  it('creates and verifies a valid refresh token', async () => {
    const token = await createRefreshToken(userId, email, fingerprint);
    expect(typeof token).toBe('string');

    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(userId);
    expect(payload?.type).toBe('refresh');
  });

  it('rejects tampered tokens', async () => {
    const token = await createAccessToken(userId, email, fingerprint);
    const parts = token.split('.');
    // Tamper with payload
    const tampered = `${parts[0]}.eyAidXNlcklkIjogIjB4ZXZpbCIgfQ.${parts[2]}`;
    const payload = await verifyToken(tampered);
    expect(payload).toBeNull();
  });

  it('rejects completely invalid strings', async () => {
    expect(await verifyToken('not-a-jwt')).toBeNull();
    expect(await verifyToken('')).toBeNull();
  });
});
