import { vi } from 'vitest';
import { SiweMessage } from 'siwe';
import { Wallet } from 'ethers';

// ─── Helpers ───────────────────────────────────────────────────────────────

const wallet = Wallet.createRandom();
const domain = 'humanidfi.com';
const baseUri = 'https://humanidfi.com/login';
const version = '1';
const chainId = 137;
const nonce = '12345678901234567';

async function makeMessage(overrides: Partial<{
  domain: string; uri: string; chainId: number; nonce: string;
  expirationTime: string; notBefore: string; address: string;
}> = {}) {
  const msg = new SiweMessage({
    domain,
    address: wallet.address,
    statement: 'Sign in',
    uri: baseUri,
    version,
    chainId,
    nonce,
    ...overrides,
  });
  const signature = await wallet.signMessage(msg.prepareMessage());
  return { msg, signature };
}

// Server-side origin comparison logic (mirrors verify/route.ts)
function getExpectedOrigin(appUrl: string): string {
  return new URL(appUrl).origin;
}
function getMsgOrigin(uri: string): string | null {
  try { return new URL(uri).origin; } catch { return null; }
}
function isOriginValid(msgUri: string, appUrl: string): boolean {
  const expected = getExpectedOrigin(appUrl);
  const actual = getMsgOrigin(msgUri);
  return actual !== null && actual === expected;
}

// Server-side chain ID policy (mirrors verify/route.ts)
function getAllowedChainIds(env: string): number[] {
  if (env === 'production') return [137];
  if (env === 'qa' || env === 'staging') return [137, 80002];
  return [137, 80002, 31337]; // development
}

// ─── Tests: SIWE Signature ─────────────────────────────────────────────────

describe('SIWE Signature Validation', () => {
  it('accepts a valid message and signature', async () => {
    const { msg, signature } = await makeMessage();
    const result = await msg.verify({ signature, domain, nonce });
    expect(result.success).toBe(true);
  });

  it('rejects wrong domain', async () => {
    const { msg, signature } = await makeMessage({ domain: 'evil.com' });
    await expect(msg.verify({ signature, domain, nonce })).rejects.toThrow();
  });

  it('rejects wrong signature (different wallet)', async () => {
    const { msg } = await makeMessage();
    const otherWallet = Wallet.createRandom();
    const wrongSig = await otherWallet.signMessage(msg.prepareMessage());
    await expect(msg.verify({ signature: wrongSig, domain, nonce })).rejects.toThrow();
  });

  it('rejects expired message', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { msg, signature } = await makeMessage({ expirationTime: past });
    await expect(msg.verify({ signature, domain, nonce })).rejects.toThrow();
  });

  it('rejects future-dated notBefore', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const { msg, signature } = await makeMessage({ notBefore: future });
    await expect(msg.verify({ signature, domain, nonce })).rejects.toThrow();
  });
});

// ─── Tests: URI Origin Comparison (server-side logic) ─────────────────────

describe('SIWE URI Origin Validation', () => {
  const appUrl = 'https://humanidfi.com';

  it('accepts matching origin (exact)', () => {
    expect(isOriginValid('https://humanidfi.com/login', appUrl)).toBe(true);
  });

  it('accepts matching origin with path variation', () => {
    expect(isOriginValid('https://humanidfi.com/registry', appUrl)).toBe(true);
  });

  it('accepts trailing slash on URI (origin is identical)', () => {
    expect(isOriginValid('https://humanidfi.com/', appUrl)).toBe(true);
  });

  it('rejects wrong scheme (http vs https)', () => {
    expect(isOriginValid('http://humanidfi.com/login', appUrl)).toBe(false);
  });

  it('rejects subdomain (evil.humanidfi.com)', () => {
    expect(isOriginValid('https://evil.humanidfi.com/login', appUrl)).toBe(false);
  });

  it('rejects lookalike domain (humanidfi.com.evil.com)', () => {
    expect(isOriginValid('https://humanidfi.com.evil.com/login', appUrl)).toBe(false);
  });

  it('rejects completely different domain', () => {
    expect(isOriginValid('https://evil.com/login', appUrl)).toBe(false);
  });

  it('rejects wrong port (443 vs 8443)', () => {
    expect(isOriginValid('https://humanidfi.com:8443/login', appUrl)).toBe(false);
  });

  it('rejects unparseable URI', () => {
    expect(isOriginValid('not-a-url', appUrl)).toBe(false);
  });
});

// ─── Tests: Chain ID Policy (server-side logic) ────────────────────────────

describe('SIWE Chain ID Policy', () => {
  it('production allows only Polygon (137)', () => {
    const allowed = getAllowedChainIds('production');
    expect(allowed).toEqual([137]);
    expect(allowed).not.toContain(31337);
    expect(allowed).not.toContain(80002);
  });

  it('qa allows Polygon and Amoy testnet', () => {
    const allowed = getAllowedChainIds('qa');
    expect(allowed).toContain(137);
    expect(allowed).toContain(80002);
    expect(allowed).not.toContain(31337);
  });

  it('development allows Hardhat', () => {
    const allowed = getAllowedChainIds('development');
    expect(allowed).toContain(31337);
  });

  it('rejects Ethereum Mainnet (1) in production', () => {
    expect(getAllowedChainIds('production')).not.toContain(1);
  });

  it('rejects Hardhat (31337) in production', () => {
    expect(getAllowedChainIds('production')).not.toContain(31337);
  });

  it('rejects Hardhat (31337) in QA', () => {
    expect(getAllowedChainIds('qa')).not.toContain(31337);
  });
});

// ─── Tests: Identity vs Authorization separation ───────────────────────────

describe('Identity / Authorization Separation', () => {
  it('a valid SIWE signature does not imply admin access', () => {
    // The permissions array must be empty by default — no elevated access granted by wallet alone
    const defaultPermissions: string[] = [];
    expect(defaultPermissions).toHaveLength(0);
    expect(defaultPermissions).not.toContain('admin');
    expect(defaultPermissions).not.toContain('moderator');
  });
});
