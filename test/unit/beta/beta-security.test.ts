/**
 * Hardening of the cUSDC beta and payments: a chat message never marks a request paid by itself,
 * mutations take JSON only, real value never enters unaudited escrow or stream contracts, a hard
 * ceiling per payment on Alpha, and cUSDC for everyone only behind the operator's switch and the
 * technical checks, with CUSDC_GATES untouched.
 */
import fs from 'node:fs';
import { requestSettlement, rememberPaidRequest } from '@/lib/payments/paid-requests';
import { checkAgreementPolicy } from '@/lib/aztec/agreement-policy';
import { checkDirectPaymentPolicy } from '@/lib/payments/direct-private';
import { CUSDC_ADDRESS, PUBLIC_REASONS, cusdcPublicDecision, cusdcPublicEntry } from '@/lib/payments/cusdc-public';
import { CUSDC_GATES, cusdcReady } from '@/lib/payments/assets';
import { CUSDC_PUBLIC } from '@/lib/aztec/wallet/config';
import { PRIVATE_ASSET } from '@/lib/payments/private-asset';
import record from '../../../deployments/aztec-mainnet.json';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const req = { id: 'req_1', amount: '5000000', tokenKey: 'CUSDC' };

describe('a request is paid only on evidence from this wallet', () => {
  it('a payment message from the other person alone is only "announced"', () => {
    const st = mem();
    rememberPaidRequest('req_1', '0xAB', st, 'peer');
    expect(requestSettlement(req, [], st)).toBe('announced');
  });
  it('the requester sees paid only for a settled receive of that hash, token and at least the amount', () => {
    const st = mem();
    rememberPaidRequest('req_1', '0xab', st, 'peer');
    const recv = (x: object) => [{ kind: 'receive', txHash: '0xAB', status: 'settled', token: 'CUSDC', amount: '5000000', ...x }];
    expect(requestSettlement(req, recv({}), st)).toBe('paid');
    expect(requestSettlement(req, recv({ amount: '4999999' }), st)).toBe('announced');
    expect(requestSettlement(req, recv({ token: 'USDC' }), st)).toBe('announced');
    expect(requestSettlement(req, recv({ status: 'pending' }), st)).toBe('announced');
    expect(requestSettlement(req, recv({ txHash: '0xcd' }), st)).toBe('announced');
    expect(requestSettlement({ ...req, tokenKey: null }, recv({}), st)).toBe('announced');
  });
  it('the payer sees paid unless the payment failed, and can pay again', () => {
    const st = mem();
    rememberPaidRequest('req_1', '0x01', st);
    expect(requestSettlement(req, [], st)).toBe('paid');
    expect(requestSettlement(req, [{ kind: 'send', txHash: '0x01', status: 'failed' }], st)).toBe('failed');
    rememberPaidRequest('req_1', '0x02', st);
    expect(requestSettlement(req, [{ kind: 'send', txHash: '0x01', status: 'failed' }], st)).toBe('paid');
  });
  it('the payment card records who paid', () => {
    expect(fs.readFileSync('components/chat/PaymentCard.tsx', 'utf8')).toMatch(/rememberPaidRequest\(msg\.requestId, msg\.txHash, undefined, isMe \? 'me' : 'peer'\)/);
  });
});

describe('server and contract limits', () => {
  it('beta mutations accept JSON only', () => {
    for (const f of ['app/api/beta/cusdc/redeem/route.ts', 'app/api/beta/cusdc/status/route.ts']) {
      expect(fs.readFileSync(f, 'utf8'), f).toMatch(/startsWith\('application\/json'\)\) \{\n    return NextResponse\.json\(\{ error: 'Send JSON\.' \}, \{ status: 415/);
    }
  });
  const rec = { contracts: [{ classId: '0xc', tracksCurrentArtifact: true, status: 'current' }], audit: null };
  const base = {
    network: 'mainnet' as const, mainnetRecord: rec as never, classId: '0xc', token: '0x' + '1'.repeat(64), amount: 1_000_000n,
    caps: { ['0x' + '1'.repeat(64)]: 10_000_000n, [CUSDC_ADDRESS]: 10_000_000n }, acknowledgedUnaudited: true, acknowledgedPublicFeePayer: true, peerVerified: true,
  };
  it('real value never goes into an escrow or stream without an external audit', () => {
    expect(checkAgreementPolicy(base as never).ok).toBe(true);
    const r = checkAgreementPolicy({ ...base, token: CUSDC_ADDRESS } as never);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toMatch(/external audit/);
    expect(checkAgreementPolicy({ ...base, token: CUSDC_ADDRESS, mainnetRecord: { ...rec, audit: { by: 'x' } } } as never).ok).toBe(true);
    expect(fs.readFileSync('components/chat/AgreementComposer.tsx', 'utf8')).toMatch(/AGREEMENT_TOKENS\.map\(\(t\) =>/);
  });
  it('a direct payment on Alpha never exceeds 100 tokens, whatever the cap', () => {
    const p = { network: 'mainnet' as const, token: '0xt', caps: { '0xt': 10n ** 30n }, peerVerified: true, acknowledgedUnaudited: true, acknowledgedPublicFeePayer: true };
    expect(checkDirectPaymentPolicy({ ...p, amount: 100_000_000n }).ok).toBe(true);
    expect(checkDirectPaymentPolicy({ ...p, amount: 100_000_001n }).ok).toBe(false);
  });
});

describe('cUSDC for everyone', () => {
  const ok = {
    entry: { enabled: true },
    planned: { address: CUSDC_ADDRESS, decimals: 6, verifiedOnChain: true },
    configured: { address: CUSDC_ADDRESS, symbol: 'cUSDC', decimals: 6 },
    cap: 5_000_000n,
  };
  it('needs the switch and every technical check', () => {
    expect(cusdcPublicDecision(ok)).toEqual({ ok: true });
    expect(cusdcPublicDecision({ ...ok, entry: { enabled: false } })).toEqual({ ok: false, reasons: [PUBLIC_REASONS.off] });
    expect(cusdcPublicDecision({ ...ok, entry: null })).toEqual({ ok: false, reasons: [PUBLIC_REASONS.off] });
    expect(cusdcPublicDecision({ ...ok, planned: { ...ok.planned, verifiedOnChain: false } })).toEqual({ ok: false, reasons: [PUBLIC_REASONS.notVerified] });
    expect(cusdcPublicDecision({ ...ok, configured: { ...ok.configured, address: '0x' + '2'.repeat(64) } })).toEqual({ ok: false, reasons: [PUBLIC_REASONS.notConfigured] });
    expect(cusdcPublicDecision({ ...ok, configured: { ...ok.configured, decimals: 18 } })).toEqual({ ok: false, reasons: [PUBLIC_REASONS.notConfigured] });
    expect(cusdcPublicDecision({ ...ok, configured: null })).toEqual({ ok: false, reasons: [PUBLIC_REASONS.notConfigured] });
    expect(cusdcPublicDecision({ ...ok, cap: null })).toEqual({ ok: false, reasons: [PUBLIC_REASONS.noCap] });
    expect(cusdcPublicDecision({ ...ok, cap: 0n })).toEqual({ ok: false, reasons: [PUBLIC_REASONS.noCap] });
  });
  it('is off in the record, and never marks a gate as met', () => {
    expect(cusdcPublicEntry(record)).toEqual({ enabled: false });
    expect(CUSDC_PUBLIC).toBe(false);
    expect(PRIVATE_ASSET.symbol).toBe('HLC');
    expect(CUSDC_GATES.every((g) => g.met === false)).toBe(true);
    expect(cusdcReady()).toBe(false);
    expect((record as { cusdcBeta: { enabled: boolean } }).cusdcBeta.enabled).toBe(false);
  });
  it('replaces HLC in the token list and turns the closed beta off', () => {
    const cfg = fs.readFileSync('lib/aztec/wallet/config.ts', 'utf8');
    expect(cfg).toMatch(/CUSDC_PUBLIC \? CONFIGURED_TOKENS\.filter\(\(t\) => !isTestToken\(t\.symbol\)\)/);
    expect(cfg).toMatch(/NETWORK === 'mainnet' && !CUSDC_PUBLIC \? CONFIGURED_TOKENS\.filter/);
    expect(fs.readFileSync('lib/landing/claims.ts', 'utf8')).toMatch(/label: CUSDC_PUBLIC \? 'Live' : 'Not enabled yet'/);
  });
});

describe('the private wallet texts', () => {
  it('have no dashes between words', () => {
    for (const f of ['components/zk/AlphaNetworkBanner.tsx', 'components/zk/WalletCreation.tsx', 'components/zk/ZkWalletPanel.tsx', 'components/zk/PaymentProgress.tsx', 'components/zk/ZkPrivacyScore.tsx', 'components/zk/ZkSettingsPanel.tsx']) {
      const code = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
      expect(code, f).not.toMatch(/[—–]/);
    }
  });
});
