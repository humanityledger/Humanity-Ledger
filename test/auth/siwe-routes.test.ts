/**
 * test/auth/siwe-routes.test.ts
 *
 * Sign-in at /connect, end to end on the server: the real /api/siwe/nonce and
 * /api/siwe/verify handlers, a real secp256k1 signature, and the message built
 * exactly as components/landing/ConnectPage.tsx builds it.
 *
 * Regressions covered (4 Nov 2026):
 * - wallets on chains the wallet modal offers (BNB 56, Linea, zkSync...) were
 *   rejected with "Unsupported chain";
 * - visitors on www.<domain> were rejected with "Sign-in domain is not
 *   authorized";
 * - verify required the nonce to have been stored in Redis when it was
 *   issued, so a failed write made every sign-in fail; single use is now a
 *   SET NX marker written when the nonce is used.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SiweMessage } from 'siwe';
import { Wallet } from 'ethers';

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { upsert: vi.fn(async () => ({ tier: 'FREE' })) } },
}));
const contractWallet = vi.hoisted(() => ({ ok: false, calls: 0 }));
vi.mock('@/lib/security/siweContractWallet', () => ({
  verifyContractWalletSiwe: vi.fn(async () => {
    contractWallet.calls++;
    return contractWallet.ok;
  }),
}));

import { GET as nonceGET } from '../../app/api/siwe/nonce/route';
import { POST as verifyPOST } from '../../app/api/siwe/verify/route';
import { getRedisClient } from '../../lib/redis';

const wallet = Wallet.createRandom();

async function issueNonce(host = 'humanidfi.com') {
  const res = await nonceGET(new NextRequest(`https://${host}/api/siwe/nonce`, { headers: { 'x-forwarded-for': '203.0.113.7' } }));
  expect(res.status).toBe(200);
  const nonce = (await res.text()).trim();
  const cookie = res.cookies.get('siwe-nonce')?.value;
  expect(cookie).toBeTruthy();
  return { nonce, cookie: cookie! };
}

/** Same fields as ConnectPage.tsx. */
async function signConnectMessage(opts: { nonce: string; domain?: string; chainId?: number; signer?: Wallet }) {
  const domain = opts.domain ?? 'humanidfi.com';
  const message = new SiweMessage({
    domain,
    address: wallet.address,
    statement: 'Sign in to Humanity Ledger.',
    uri: `https://${domain}`,
    version: '1',
    chainId: opts.chainId ?? 1,
    nonce: opts.nonce,
    issuedAt: new Date().toISOString(),
  }).prepareMessage();
  const signature = await (opts.signer ?? wallet).signMessage(message);
  return { message, signature };
}

function verify(body: object, cookie: string, host = 'humanidfi.com') {
  return verifyPOST(
    new NextRequest(`https://${host}/api/siwe/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `siwe-nonce=${cookie}`, host },
      body: JSON.stringify(body),
    }),
  );
}

describe('SIWE sign-in routes (/connect)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://humanidfi.com';
    delete process.env.NEXT_PUBLIC_DOMAIN;
    delete process.env.SIWE_ALLOWED_DOMAINS;
    contractWallet.ok = false;
    contractWallet.calls = 0;
  });

  it('signs in with the message /connect builds and sets the session cookies', async () => {
    const { nonce, cookie } = await issueNonce();
    const res = await verify(await signConnectMessage({ nonce }), cookie);
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.address).toBe(wallet.address);
    expect(res.cookies.get('hl_session')?.value).toBeTruthy();
  });

  it.each([56, 59144, 324, 43114, 480])('accepts a wallet on chain %i offered by the wallet modal', async (chainId) => {
    const { nonce, cookie } = await issueNonce();
    const res = await verify(await signConnectMessage({ nonce, chainId }), cookie);
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
  });

  it('accepts the www variant of the configured domain', async () => {
    const { nonce, cookie } = await issueNonce('www.humanidfi.com');
    const res = await verify(await signConnectMessage({ nonce, domain: 'www.humanidfi.com' }), cookie, 'www.humanidfi.com');
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
  });

  it('in production, rejects a message signed for another domain even if the Host header matches it', async () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const { nonce, cookie } = await issueNonce();
      const res = await verify(await signConnectMessage({ nonce, domain: 'evil.example' }), cookie, 'evil.example');
      expect(res.status).toBe(401);
      expect((await res.json()).error).toMatch(/domain/i);
    } finally {
      env.NODE_ENV = previous;
    }
  });

  it('works when the nonce was never written to Redis, and still refuses a replay', async () => {
    const { nonce, cookie } = await issueNonce();
    const signed = await signConnectMessage({ nonce });
    expect((await verify(signed, cookie)).status).toBe(200);
    const again = await verify(signed, cookie);
    expect(again.status).toBe(401);
    expect((await again.json()).error).toMatch(/already used/);
  });

  it('refuses a nonce another replica already marked as used in Redis', async () => {
    const { nonce, cookie } = await issueNonce();
    const redis = await getRedisClient();
    await redis.set(`siwe:used:${nonce}`, '1', 'EX', 600, 'NX');
    const res = await verify(await signConnectMessage({ nonce }), cookie);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/already used/);
  });

  it('rejects a forged nonce cookie', async () => {
    const { nonce } = await issueNonce();
    const res = await verify(await signConnectMessage({ nonce }), `${nonce}.${Date.now()}.forged`);
    expect(res.status).toBe(400);
  });

  it('rejects a signature from another key unless the address is a contract wallet that accepts it', async () => {
    const other = Wallet.createRandom();
    let { nonce, cookie } = await issueNonce();
    let res = await verify(await signConnectMessage({ nonce, signer: other }), cookie);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid signature.');
    expect(contractWallet.calls).toBe(1);

    // ERC-1271 / ERC-6492 wallets: the on-chain check decides.
    contractWallet.ok = true;
    ({ nonce, cookie } = await issueNonce());
    res = await verify(await signConnectMessage({ nonce, signer: other }), cookie);
    expect(res.status).toBe(200);
  });
});
