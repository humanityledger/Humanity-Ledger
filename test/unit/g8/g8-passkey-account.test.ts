import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { verifyMessage } from 'viem';
import { deriveAccountKeys, accountFromPrf, siweWithAccount, xmtpSignerFor, passkeyAccountsEnabled, isPasskeySession, markPasskeySession, prfSalt } from '@/lib/g8/passkeyAccount';
import { FR_MODULUS } from '@/lib/g8/constants';

const prfA = new Uint8Array(32).fill(7), prfB = new Uint8Array(32).fill(8);
const read = (p: string) => readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');
class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }

describe('G8 passkey account', () => {
  it('same passkey → same account; different passkey → different account; secrets in range', async () => {
    const a1 = await deriveAccountKeys(prfA), a2 = await deriveAccountKeys(prfA), b = await deriveAccountKeys(prfB);
    expect(a1).toEqual(a2);
    expect(a1.evmKey === b.evmKey).toBe(false);
    expect(a1.evmKey === a1.aztecSecret).toBe(false);
    expect(a1.sHuman < FR_MODULUS && BigInt(a1.aztecSecret) < FR_MODULUS).toBe(true);
    expect((await prfSalt()).length).toBe(32);
    await expect(deriveAccountKeys(new Uint8Array(16))).rejects.toThrow(/NO_PRF/);
  });
  it('signs SIWE through the unchanged routes; the server-side viem check accepts it', async () => {
    const acct = await accountFromPrf(prfA);
    const calls: string[] = []; let posted: any = null;
    const fake = (async (url: string, init?: any) => {
      calls.push(url);
      if (url === '/api/siwe/nonce') return new Response('abc123nonce');
      posted = JSON.parse(init.body);
      const ok = await verifyMessage({ address: acct.address, message: posted.message, signature: posted.signature });
      return new Response(JSON.stringify(ok ? { ok } : { error: 'bad' }), { status: ok ? 200 : 401 });
    }) as unknown as typeof fetch;
    const r = await siweWithAccount(acct, { fetch: fake, domain: 'ledgerchat.org', origin: 'https://ledgerchat.org', buildMessage: f => `${f.domain} wants you to sign in with your Ethereum account:\n${f.address}\n\nNonce: ${f.nonce}\nIssued At: ${f.issuedAt}` });
    expect(r).toEqual({ ok: true, address: acct.address.toLowerCase() });
    expect(calls).toEqual(['/api/siwe/nonce', '/api/siwe/verify']);
    expect(posted.message).toMatch(/Nonce: abc123nonce/);
  });
  it('XMTP signer is the same EOA and returns 65 raw bytes', async () => {
    const acct = await accountFromPrf(prfA);
    const s = xmtpSignerFor(acct);
    expect((await s.getIdentifier()).identifier).toBe(acct.address);
    expect((await s.signMessage('XMTP : Authenticate to inbox')).length).toBe(65);
  });
  it('flag off by default; session marker stores only an address', () => {
    expect(passkeyAccountsEnabled(undefined)).toBe(false);
    expect(passkeyAccountsEnabled('1')).toBe(true);
    const s = new Mem() as unknown as Storage;
    markPasskeySession('0x' + 'A'.repeat(40), s);
    expect(isPasskeySession('0x' + 'a'.repeat(40), s)).toBe(true);
    expect(JSON.stringify([...(s as any).m.values()])).toMatch(/^\["0x[a]{40}"\]$/);
  });
  it('/connect keeps the wallet path and offers the passkey only behind the flag', () => {
    const page = read('components/landing/ConnectPage.tsx');
    expect(page).toMatch(/onPasskey=\{passkeyAccountsEnabled\(\) \?/);
    expect(page).toMatch(/fetch\("\/api\/siwe\/verify"/);
    expect(read('components/terminal/LedgerChatV2.tsx')).toMatch(/isPasskeySession\(address\)\) \{/);
  });
});
