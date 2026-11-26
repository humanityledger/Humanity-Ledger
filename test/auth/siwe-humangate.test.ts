/**
 * /api/siwe/verify with G8 HumanGate (lib/g8/humanGate.ts):
 * - off (default): sign-in works with no receipt, as test/auth/siwe-routes.test.ts expects;
 * - `humanGateRequired: true` in the body, or HUMAN_GATE_REQUIRED=1: no receipt → 403;
 * - a valid receipt signs in once, is cleared from the browser, and cannot be reused.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { SiweMessage } from 'siwe';
import { Wallet } from 'ethers';

vi.mock('@/lib/prisma', () => ({ prisma: { user: { upsert: vi.fn(async () => ({ tier: 'FREE' })) } } }));
vi.mock('@/lib/security/siweContractWallet', () => ({ verifyContractWalletSiwe: vi.fn(async () => false) }));

import { GET as nonceGET } from '../../app/api/siwe/nonce/route';
import { POST as verifyPOST } from '../../app/api/siwe/verify/route';
import { issueChallenge, verifyHumanGateSubmission } from '../../lib/g8/humanGate';
import { evalTargetAt, leadingZeroBits, pathParams, seededRandom } from '../../lib/g8/humanGateMath';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-for-humangate-0123456789';
const wallet = Wallet.createRandom();

async function signIn(body: (m: string, s: string) => object, cookies: string[] = []) {
  const n = await nonceGET(new NextRequest('https://ledgerchat.org/api/siwe/nonce', { headers: { 'x-forwarded-for': '203.0.113.9' } }));
  const nonce = (await n.text()).trim();
  const nc = n.cookies.get('siwe-nonce')!.value;
  const message = new SiweMessage({ domain: 'ledgerchat.org', address: wallet.address, statement: 'Sign in to Ledger Chat.', uri: 'https://ledgerchat.org', version: '1', chainId: 1, nonce, issuedAt: new Date().toISOString() }).prepareMessage();
  const signature = await wallet.signMessage(message);
  return verifyPOST(new NextRequest('https://ledgerchat.org/api/siwe/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'ledgerchat.org', cookie: [`siwe-nonce=${nc}`, ...cookies].join('; ') },
    body: JSON.stringify(body(message, signature)),
  }));
}

async function receipt(): Promise<string> {
  const t0 = Date.now();
  const c = issueChallenge('orbit', false, t0);
  const seed = c.payload.seedHex, p = pathParams(seed), r = seededRandom(seed.slice(2) + 'ff');
  let nonce = 0; while (leadingZeroBits(createHash('sha256').update(`${seed}:${nonce}`).digest()) < c.payload.difficulty) nonce++;
  const g = () => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
  const samples = [];
  for (let t = 900; t < 3200; t += 16.7 + g() * 1.5) { const q = evalTargetAt(p, t - 210); samples.push({ tMs: Math.round(t * 10) / 10, x: q.x + g() * 0.013, y: q.y + g() * 0.013 }); }
  const v = await verifyHumanGateSubmission({ challengeToken: c.token, mode: 'orbit', powNonce: String(nonce), samples, trustedRatio: 1 }, { now: t0 + 4000, redis: null });
  if (!v.ok) throw new Error('human gate attempt failed: ' + v.reason);
  return v.receipt;
}

describe('SIWE + G8 HumanGate', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://ledgerchat.org';
    delete process.env.NEXT_PUBLIC_DOMAIN;
    delete process.env.HUMAN_GATE_REQUIRED;
  });

  it('gate off: signs in without a receipt (existing behaviour)', async () => {
    const res = await signIn((message, signature) => ({ message, signature }));
    expect(res.status).toBe(200);
  });

  it('humanGateRequired without a receipt → 403 human_gate', async () => {
    const res = await signIn((message, signature) => ({ message, signature, humanGateRequired: true }));
    expect(res.status).toBe(403);
    expect((await res.json()).detail).toBe('human_gate');
  });

  it('HUMAN_GATE_REQUIRED=1 refuses a client that omits the flag', async () => {
    process.env.HUMAN_GATE_REQUIRED = '1';
    const res = await signIn((message, signature) => ({ message, signature }));
    expect(res.status).toBe(403);
  });

  it('a valid receipt signs in once, is cleared, and cannot be replayed', async () => {
    const rc = await receipt();
    const ok = await signIn((message, signature) => ({ message, signature, humanGateRequired: true }), [`hl_human_gate=${rc}`]);
    expect(ok.status).toBe(200);
    expect(ok.cookies.get('hl_human_gate')?.value).toBe('');
    const again = await signIn((message, signature) => ({ message, signature, humanGateRequired: true }), [`hl_human_gate=${rc}`]);
    expect(again.status).toBe(403);
  });

  it('a forged receipt is refused', async () => {
    const res = await signIn((message, signature) => ({ message, signature, humanGateRequired: true }), ['hl_human_gate=eyJpZCI6IjAwIn0.AAAA']);
    expect(res.status).toBe(403);
  });
});
