/** The wallet side of the closed cUSDC beta: fail-closed visibility and a fresh check before every send. */
import fs from 'node:fs';
import { BETA_TOKENS, getCusdcBetaVisibility, setCusdcBetaVisibility, tokensFor, type TokenConfig } from '@/lib/aztec/wallet/config';
import {
  BETA_SEND_REFUSED, __resetCusdcBetaClient, assertCusdcBetaAllows, parseVisibility, refreshCusdcBeta, visibilityAfter,
} from '@/lib/beta/cusdc-beta-client';

const tok = (key: TokenConfig['key'], symbol: string): TokenConfig => ({ key, address: '0x' + 'ab'.repeat(32), symbol, decimals: 6 });
const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const broken = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;

describe('token list', () => {
  const pub = [tok('USDC', 'HLC')];
  const withBeta = [...pub, tok('CUSDC', 'cUSDC')];
  it('lists cUSDC only for send or exits', () => {
    expect(tokensFor('hidden', { public: pub, withBeta })).toBe(pub);
    expect(tokensFor('send', { public: pub, withBeta })).toBe(withBeta);
    expect(tokensFor('exits', { public: pub, withBeta })).toBe(withBeta);
  });
  it('off the Alpha network nothing can be unlocked', () => {
    expect(BETA_TOKENS).toEqual([]);
    expect(setCusdcBetaVisibility('send')).toBe('hidden');
    expect(getCusdcBetaVisibility()).toBe('hidden');
  });
  it('the config builds the public list through withoutGatedTokens and the beta list from the cUSDC slot only', () => {
    const src = fs.readFileSync('lib/aztec/wallet/config.ts', 'utf8');
    expect(src).toMatch(/const PUBLIC_TOKENS: readonly TokenConfig\[\] = Object\.freeze\(CUSDC_PUBLIC \? CONFIGURED_TOKENS\.filter\(\(t\) => !isTestToken\(t\.symbol\)\) : withoutGatedTokens\(CONFIGURED_TOKENS\)\);/);
    expect(src).toMatch(/CONFIGURED_TOKENS\.filter\(\(t\) => t\.key === 'CUSDC' && !PUBLIC_TOKENS\.includes\(t\)\)/);
    expect(src).toMatch(/NETWORK === 'mainnet' && !CUSDC_PUBLIC \? CONFIGURED_TOKENS/);
  });
});

describe('server answers', () => {
  it('reads only the three known values', () => {
    expect(parseVisibility({ visibility: 'send' })).toBe('send');
    expect(parseVisibility({ visibility: 'exits' })).toBe('exits');
    expect(parseVisibility({ visibility: 'hidden' })).toBe('hidden');
    expect(parseVisibility({ visibility: 'yes' })).toBeNull();
    expect(parseVisibility(null)).toBeNull();
  });
  it('no answer never grants send, and never hides a balance already shown', () => {
    expect(visibilityAfter('send', null)).toBe('exits');
    expect(visibilityAfter('exits', null)).toBe('exits');
    expect(visibilityAfter('hidden', null)).toBe('hidden');
    expect(visibilityAfter('send', 'hidden')).toBe('hidden');
  });
});

describe('before a payment', () => {
  beforeEach(() => __resetCusdcBetaClient());
  const on = () => true;
  it('other tokens and builds without the beta are never asked', async () => {
    await assertCusdcBetaAllows('USDC', broken, on);
    await assertCusdcBetaAllows('CUSDC', broken, () => false);
  });
  it('a cUSDC payment goes ahead only on a fresh send', async () => {
    await assertCusdcBetaAllows('CUSDC', reply({ visibility: 'send' }), on);
    await expect(assertCusdcBetaAllows('CUSDC', reply({ visibility: 'exits' }), on)).rejects.toThrow(/closed beta/);
    await expect(assertCusdcBetaAllows('CUSDC', reply({ visibility: 'hidden' }), on)).rejects.toThrow(/closed beta/);
    await expect(assertCusdcBetaAllows('CUSDC', reply({ error: 'x' }, 503), on)).rejects.toThrow(/closed beta/);
    await expect(assertCusdcBetaAllows('CUSDC', broken, on)).rejects.toThrow(/closed beta/);
    expect(BETA_SEND_REFUSED).toMatch(/Nothing was sent/);
  });
  it('refresh is hidden whenever the beta does not apply', async () => {
    expect(await refreshCusdcBeta(reply({ visibility: 'send' }), 0, () => false)).toBe('hidden');
  });
});

describe('wiring in the wallet', () => {
  const src = fs.readFileSync('lib/aztec/wallet/client.ts', 'utf8');
  it('shield, send and a payment out to someone else ask the beta first', () => {
    expect(src).toMatch(/async shield\(key: TokenKey, amount: string\) \{\n    await assertNewValueAllowed\(\);\n    await assertCusdcBetaAllows\(key\);/);
    expect(src).toMatch(/async send\(key: TokenKey, amount: string, to: string\) \{\n    await assertNewValueAllowed\(\);\n    await assertCusdcBetaAllows\(key\);/);
    expect(src).toMatch(/if \(!\(target\.equals\?\.\(this\.me\) \?\? target === this\.me\)\) \{ await assertNewValueAllowed\(\); await assertCusdcBetaAllows\(key\); \}/);
  });
  it('every refresh reads the beta before loading tokens', () => {
    expect(src).toMatch(/await refreshCusdcBeta\(\)\.catch\(\(\) => 'hidden'\);/);
  });
});
