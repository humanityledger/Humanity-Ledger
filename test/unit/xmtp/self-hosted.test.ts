import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { exportJWK, generateKeyPair, jwtVerify, createLocalJWKSet, decodeJwt } from 'jose';
import { parseBackendUrl, xmtpNetwork, XmtpBackendConfigError } from '@/lib/xmtp/backend';
import {
  backendTokenKeys, issueBackendCredential, publicJwks, subjectFor,
  TOKEN_AUDIENCE, TOKEN_ISSUER, TOKEN_SCOPE, TOKEN_TTL_S,
} from '@/lib/xmtp/backend-token';

const WALLET = '0x' + 'ab'.repeat(20);
const PEPPER = 'p'.repeat(40);

async function keys() {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  const jwk = { ...(await exportJWK(privateKey)), kid: 'hl-test' };
  return backendTokenKeys({ XMTP_BACKEND_JWT_PRIVATE_JWK: JSON.stringify(jwk), XMTP_BACKEND_SUB_PEPPER: PEPPER })!;
}

describe('which XMTP network', () => {
  it('stays on the Labs network unless the operator turns the self-hosted one on with a URL', () => {
    expect(xmtpNetwork({})).toEqual({ kind: 'labs', env: 'production' });
    expect(xmtpNetwork({ NEXT_PUBLIC_XMTP_ENV: 'dev' })).toEqual({ kind: 'labs', env: 'dev' });
    expect(xmtpNetwork({ NEXT_PUBLIC_XMTP_BACKEND_URL: 'https://xmtp.ledgerchat.org' })).toEqual({ kind: 'labs', env: 'production' });
    expect(xmtpNetwork({ NEXT_PUBLIC_XMTP_SELF_HOSTED: 'true', NEXT_PUBLIC_XMTP_BACKEND_URL: 'https://xmtp.ledgerchat.org/' }))
      .toEqual({ kind: 'self-hosted', url: 'https://xmtp.ledgerchat.org' });
    expect(() => xmtpNetwork({ NEXT_PUBLIC_XMTP_SELF_HOSTED: 'true' })).toThrow(XmtpBackendConfigError);
  });

  it('accepts only an https origin, or http on this machine', () => {
    expect(parseBackendUrl('http://localhost:5050')).toBe('http://localhost:5050');
    for (const bad of ['http://xmtp.example.com', 'https://u:p@xmtp.example.com', 'https://xmtp.example.com/api', 'https://x.example.com/?a=1', 'ftp://x', 'nope']) {
      expect(() => parseBackendUrl(bad), bad).toThrow(XmtpBackendConfigError);
    }
  });
});

describe('credentials for our own XMTP backend', () => {
  it('are off without a well-formed ES256 key and a long pepper', async () => {
    expect(backendTokenKeys({})).toBeNull();
    expect(backendTokenKeys({ XMTP_BACKEND_JWT_PRIVATE_JWK: '{', XMTP_BACKEND_SUB_PEPPER: PEPPER })).toBeNull();
    const k = await keys();
    expect(backendTokenKeys({ XMTP_BACKEND_JWT_PRIVATE_JWK: JSON.stringify(k.privateJwk), XMTP_BACKEND_SUB_PEPPER: 'short' })).toBeNull();
    const { kid: _kid, ...noKid } = k.privateJwk;
    expect(backendTokenKeys({ XMTP_BACKEND_JWT_PRIVATE_JWK: JSON.stringify(noKid), XMTP_BACKEND_SUB_PEPPER: PEPPER })).toBeNull();
  });

  it('verify against the published JWKS with the issuer, audience and scope the backend requires', async () => {
    const k = await keys();
    const now = Date.now();
    const c = await issueBackendCredential(WALLET, k, now);
    expect(c.headerValue).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    expect(c.expiresAt).toBe(Math.floor(now / 1000) + TOKEN_TTL_S);
    const { payload, protectedHeader } = await jwtVerify(c.headerValue.slice(7), createLocalJWKSet(publicJwks(k) as any), { issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE });
    expect(protectedHeader).toMatchObject({ alg: 'ES256', kid: 'hl-test' });
    expect(payload.scope).toBe(TOKEN_SCOPE);
  });

  it('never carry the wallet, and the JWKS never carries the private key', async () => {
    const k = await keys();
    const c = await issueBackendCredential(WALLET, k);
    const claims = decodeJwt(c.headerValue.slice(7));
    expect(JSON.stringify(claims).toLowerCase()).not.toContain(WALLET.slice(2));
    expect(claims.sub).toBe(await subjectFor(WALLET.toUpperCase().replace('0X', '0x'), PEPPER));
    expect(claims.sub).not.toBe(await subjectFor(WALLET, PEPPER + 'x'));
    expect(JSON.stringify(publicJwks(k))).not.toMatch(/"d"/);
  });

  it('the routes are off until configured; only the public key set is public', () => {
    const token = fs.readFileSync('app/api/xmtp/token/route.ts', 'utf8');
    expect(token).toMatch(/if \(!keys\) return NextResponse\.json\(\{ error: 'NOT_CONFIGURED' \}, \{ status: 503/);
    expect(token).toMatch(/const auth = await requireWallet\(req\);/);
    const mw = fs.readFileSync('middleware.ts', 'utf8');
    expect(mw).toContain("'/api/xmtp/jwks',");
    expect(mw).not.toContain("'/api/xmtp/token'");
    expect(mw).not.toMatch(/'\/api\/xmtp\/',/);
  });

  it('the backend config asks for exactly these tokens', () => {
    const cfg = fs.readFileSync('infra/xmtp-backend/config.toml', 'utf8');
    expect(cfg).toMatch(/\[auth\]\nenabled = true/);
    expect(cfg).toContain(`audiences = ["${TOKEN_AUDIENCE}"]`);
    expect(cfg).toContain(`issuers = ["${TOKEN_ISSUER}"]`);
    expect(cfg).toContain(`required_scopes = ["${TOKEN_SCOPE}"]`);
    expect(cfg).toMatch(/identifier = "org\.ledgerchat\.xmtp"/);
  });
});
