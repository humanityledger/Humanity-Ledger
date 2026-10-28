import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { isSessionPayload } from '@/lib/security/sessionClaims';
import { safeReturnPath } from '@/lib/security/safeRedirect';
import { escapeHtml } from '@/lib/security/escapeHtml';
import { isRetiredApiRoute } from '@/lib/security/retiredRoutes';
import { buildCsp, isPublicPath } from '../../../middleware';

/**
 * Second pass of the 2026-10-28 audit: session token kinds, return-path
 * redirects, HTML escaping, newly retired routes and the page CSP.
 */

const WALLET = '0x00000000000000000000000000000000000b1c71';

describe('session token kinds (lib/security/sessionClaims)', () => {
  it('accepts the tokens a sign-in produces', () => {
    expect(isSessionPayload({ sub: WALLET, address: WALLET, walletAddress: WALLET })).toBe(true); // SIWE
    expect(isSessionPayload({ walletAddress: WALLET, tier: 'FREE', authTime: 1 })).toBe(true); // session-heal
    expect(isSessionPayload({ sub: WALLET, address: WALLET, source: 'qr-mobile-handshake' })).toBe(true); // QR
    expect(isSessionPayload({ userId: 'f3c1d2e4-0000-4000-8000-000000000000', email: 'a@b.co', type: 'access' })).toBe(true); // email
  });

  it('refuses tokens from the retired webauthn route (account takeover)', () => {
    expect(isSessionPayload({ sub: WALLET, authMethod: 'webauthn', credentialId: 'passkey' })).toBe(false);
  });

  it('refuses refresh tokens as sessions', () => {
    expect(isSessionPayload({ userId: 'u', email: 'a@b.co', type: 'refresh', familyId: 'f' })).toBe(false);
  });

  it('refuses non-wallet subjects and malformed addresses', () => {
    expect(isSessionPayload({ sub: 'eyJhbGciOi.not.an.address' })).toBe(false);
    expect(isSessionPayload({ address: '0x123' })).toBe(false);
    expect(isSessionPayload({ walletAddress: 42 })).toBe(false);
    expect(isSessionPayload(null)).toBe(false);
  });

  it('verifyJWT rejects a validly signed webauthn token', async () => {
    process.env.JWT_SECRET = 'test-secret-for-session-claims-0123456789';
    delete process.env.JWT_EDDSA_PRIVATE_JWK;
    delete process.env.JWT_EDDSA_PUBLIC_JWK;
    const { verifyJWT, mintJWT } = await import('@/lib/jwt');
    const key = new TextEncoder().encode(process.env.JWT_SECRET);
    const forged = await new SignJWT({ sub: WALLET, authMethod: 'webauthn' })
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(key);
    await expect(verifyJWT(forged)).rejects.toThrow();
    const real = await mintJWT({ sub: WALLET, address: WALLET, walletAddress: WALLET });
    await expect(verifyJWT(real)).resolves.toMatchObject({ address: WALLET });
  });
});

describe('return paths after sign-in (lib/security/safeRedirect)', () => {
  it('keeps same-site paths with their query and hash', () => {
    expect(safeReturnPath('/chat')).toBe('/chat');
    expect(safeReturnPath('/studio?tab=code#x')).toBe('/studio?tab=code#x');
  });

  it.each([
    'https://evil.example/login',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'javascript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    ' /chat',
    '',
  ])('refuses %j', (raw) => {
    expect(safeReturnPath(raw, '/fallback')).toBe('/fallback');
  });

  it('refuses null, undefined and very long input', () => {
    expect(safeReturnPath(null)).toBe('/chat');
    expect(safeReturnPath(undefined, '')).toBe('');
    expect(safeReturnPath('/' + 'a'.repeat(3000))).toBe('/chat');
  });
});

describe('escapeHtml', () => {
  it('neutralises markup from form fields', () => {
    expect(escapeHtml('<a href="https://evil.example">Reset</a>')).toBe('&lt;a href=&quot;https://evil.example&quot;&gt;Reset&lt;/a&gt;');
    expect(escapeHtml("it's & <b>")).toBe('it&#39;s &amp; &lt;b&gt;');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('routes retired in the second pass', () => {
  it.each(['/api/premium/webauthn', '/api/geo/login-event', '/api/security/audit-log'])('%s answers 410 at the edge', (p) => {
    expect(isRetiredApiRoute(p)).toBe(true);
    expect(isRetiredApiRoute(p + '/')).toBe(true);
  });
});

describe('perimeter', () => {
  it('user search and the activity feed need a session', () => {
    expect(isPublicPath('/api/chat/users/search')).toBe(false);
    expect(isPublicPath('/api/humanidfi/activity')).toBe(false);
  });

  it('the page CSP is strict in production and only relaxed in development', () => {
    const prod = buildCsp('abc', false);
    expect(prod).toContain("script-src 'self' 'nonce-abc' 'wasm-unsafe-eval' https://js.stripe.com;");
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).not.toContain("'unsafe-inline' https://js");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("frame-ancestors 'self'");
    expect(buildCsp('abc', true)).toContain("'unsafe-eval'");
  });
});
