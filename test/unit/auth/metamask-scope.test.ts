import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { isCaip25ScopeError, requestEvmOnlyAccounts, scopedPermissionRequest } from '@/lib/auth/metamask-scope';

const TRON_ERROR = new Error(
  'Invalid approved permissions request: endowment:caip25 error: Received scopeString value(s): tron:728126428 for caveat of type "authorizedScopes" that are not supported by the wallet.',
);

function wallet(plan: Array<'ok' | 'tron' | 'reject' | 'other'>) {
  const calls: Array<{ method: string; params?: unknown }> = [];
  let i = 0;
  return {
    calls,
    async request(args: { method: string; params?: unknown }) {
      calls.push(args);
      if (args.method === 'wallet_revokePermissions') return null;
      const step = plan[Math.min(i++, plan.length - 1)];
      if (step === 'tron') throw TRON_ERROR;
      if (step === 'reject') throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
      if (step === 'other') throw Object.assign(new Error('Method not supported'), { code: -32601 });
      return [{ parentCapability: 'eth_accounts' }];
    },
  };
}

describe('MetaMask, Ethereum only', () => {
  it('recognises the Tron CAIP-25 refusal, wherever the wallet puts the text', () => {
    expect(isCaip25ScopeError(TRON_ERROR)).toBe(true);
    expect(isCaip25ScopeError({ cause: { message: 'endowment:caip25 ...' } })).toBe(true);
    expect(isCaip25ScopeError({ data: { message: 'caveat of type "authorizedScopes"' } })).toBe(true);
    expect(isCaip25ScopeError(new Error('User rejected the request.'))).toBe(false);
    expect(isCaip25ScopeError(null)).toBe(false);
  });

  it('names only the EVM chains of the app, in hex, without Tron', () => {
    const [p] = scopedPermissionRequest([1, 8453, 1, 0, -2]);
    expect(p.eth_accounts).toEqual({});
    expect(p['endowment:permitted-chains'].caveats[0]).toEqual({ type: 'restrictNetworkSwitching', value: ['0x1', '0x2105'] });
    expect(JSON.stringify(p)).not.toMatch(/tron/i);
  });

  it('asks once when MetaMask accepts', async () => {
    const w = wallet(['ok']);
    expect(await requestEvmOnlyAccounts(w, [1])).toBe('granted');
    expect(w.calls.map((c) => c.method)).toEqual(['wallet_requestPermissions']);
  });

  it('after the Tron refusal, revokes the stored permission and asks for Ethereum once more', async () => {
    const w = wallet(['tron', 'ok']);
    expect(await requestEvmOnlyAccounts(w, [1])).toBe('repaired');
    expect(w.calls.map((c) => c.method)).toEqual(['wallet_requestPermissions', 'wallet_revokePermissions', 'wallet_requestPermissions']);
    expect(w.calls[1].params).toEqual([{ eth_accounts: {} }]);
  });

  it('stops when the person declines, and lets the usual connect run on anything else', async () => {
    expect(await requestEvmOnlyAccounts(wallet(['reject']), [1])).toBe('rejected');
    expect(await requestEvmOnlyAccounts(wallet(['tron', 'reject']), [1])).toBe('rejected');
    expect(await requestEvmOnlyAccounts(wallet(['other']), [1])).toBe('unsupported');
    expect(await requestEvmOnlyAccounts(wallet(['tron', 'tron']), [1])).toBe('unsupported');
  });

  it('is used by /connect before MetaMask connects, and explains the refusal', () => {
    const page = fs.readFileSync('components/landing/ConnectPage.tsx', 'utf8');
    expect(page).toMatch(/if \(w\.id === "metamask"\) \{/);
    expect(page).toMatch(/requestEvmOnlyAccounts\(provider, wagmiConfig\.chains\.map\(\(c\) => c\.id\)\)/);
    expect(page).toMatch(/if \(isCaip25ScopeError\(error\)\) \{/);
  });
});
