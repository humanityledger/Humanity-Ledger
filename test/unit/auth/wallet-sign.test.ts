import { describe, expect, it } from 'vitest';
import { failedBeforeWallet, isSignature, personalSign, utf8ToHex } from '@/lib/auth/wallet-sign';
import fs from 'node:fs';
import path from 'node:path';

const SIG = '0x' + 'ab'.repeat(65);

describe('sign-in signature', () => {
  it('sends the message as hex of its UTF-8 bytes, with the address as given', async () => {
    const calls: unknown[] = [];
    const provider = { request: async (a: { method: string; params?: unknown[] }) => { calls.push(a); return SIG; } };
    const sig = await personalSign(provider, '0xAbC0000000000000000000000000000000000001', 'Sign in to Ledger Chat. ñ');
    expect(sig).toBe(SIG);
    expect(calls).toEqual([{ method: 'personal_sign', params: [utf8ToHex('Sign in to Ledger Chat. ñ'), '0xAbC0000000000000000000000000000000000001'] }]);
    expect(utf8ToHex('ñ')).toBe('0xc3b1');
  });

  it('refuses an answer that is not a signature', async () => {
    for (const bad of [null, '', '0x', '0x1234', 'ab'.repeat(65), {}]) {
      await expect(personalSign({ request: async () => bad }, '0x1', 'm')).rejects.toThrow(/valid signature/);
    }
    expect(isSignature('0x' + 'ab'.repeat(200))).toBe(true); // contract wallet signature
    expect(isSignature('0x' + 'a'.repeat(131))).toBe(false); // odd length
  });

  it('retries only what never reached the wallet', () => {
    expect(failedBeforeWallet({ code: 4100 })).toBe(true);
    expect(failedBeforeWallet({ code: 4900 })).toBe(true);
    expect(failedBeforeWallet(new Error('Connector not connected.'))).toBe(true);
    expect(failedBeforeWallet({ code: 4001, message: 'User rejected the request.' })).toBe(false);
    expect(failedBeforeWallet({ code: -32002, message: 'Request of type personal_sign already pending' })).toBe(false);
    expect(failedBeforeWallet(new Error('signature request expired'))).toBe(false);
  });
});

describe('/connect on phones', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'components/landing/ConnectPage.tsx'), 'utf8');
  const view = fs.readFileSync(path.join(process.cwd(), 'components/connect/ConnectView.tsx'), 'utf8');
  it('connects through the AppKit wallet list, which opens the wallet from the tap', () => {
    // iPhone, 14 Nov 2026: the page's own pairing (universal link opened outside the tap) failed in
    // Safari; the list signed. A stored link, when there is one, is still a plain link in the view.
    expect(page).not.toMatch(/display_uri/);
    expect(page).toMatch(/const handleMobileWallet[\s\S]{0,1500}openAppKitSafe\(\);/);
    expect(view).toMatch(/<a href=\{safeWalletHref\(p\.mobileDeepLink\)!\}/);
  });
  it('never sends a second signature request while the first may be open in the wallet', () => {
    expect(page).toMatch(/!failedBeforeWallet\(e\)/);
    expect(page).not.toMatch(/errMsg\.includes\("pending"\)/);
  });
  it('signs in inside a wallet browser through the same list, where the wallet shows as installed', () => {
    // Connecting MetaMask's injected provider straight from the page did not bring a working signature
    // in MetaMask's browser on iPhone; choosing MetaMask in the list did.
    expect(page).toMatch(/Continue with \$\{name\}/);
    expect(page).not.toMatch(/injected\(\{ shimDisconnect: true \}\)/);
  });
});
