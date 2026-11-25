/**
 * lib/auth/metamask-scope.ts: connect MetaMask for Ethereum only.
 *
 * Since MetaMask added Tron (2026), a plain `eth_requestAccounts` makes it pre-select every network
 * it knows, Tron included, and then reject its own approval:
 *
 *   Invalid approved permissions request: endowment:caip25 error: Received scopeString value(s):
 *   tron:728126428 for caveat of type "authorizedScopes" that are not supported by the wallet.
 *
 * (report of 24 Nov 2026 on /connect). Ledger Chat never asks for Tron. The fix asks MetaMask for
 * accounts with the EVM chains this app uses named explicitly (`wallet_requestPermissions` with an
 * `endowment:permitted-chains` caveat), so no other network is pre-selected; after that, wagmi's own
 * `eth_requestAccounts` finds the permission and does not prompt again. When a broken permission is
 * already stored, it is revoked and asked for once more.
 */

export interface Eip1193Like {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
}

/** The CAIP-25 approval error MetaMask raises for a scope it cannot hold (Tron and the like). */
export function isCaip25ScopeError(e: unknown): boolean {
  const err = e as { message?: unknown; cause?: { message?: unknown }; data?: { message?: unknown } } | null;
  const text = [err?.message, err?.cause?.message, err?.data?.message]
    .filter((x): x is string => typeof x === 'string')
    .join(' ');
  return /endowment:caip25|authorizedScopes/i.test(text);
}

function isUserRejection(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown } | null;
  return err?.code === 4001 || /rejected|denied/i.test(String(err?.message ?? ''));
}

export function toHexChainId(id: number): string {
  return '0x' + id.toString(16);
}

/** The permission request that names only these EVM chains. */
export function scopedPermissionRequest(chainIds: number[]) {
  const value = [...new Set(chainIds.filter((n) => Number.isInteger(n) && n > 0))].map(toHexChainId);
  return [{ eth_accounts: {}, 'endowment:permitted-chains': { caveats: [{ type: 'restrictNetworkSwitching', value }] } }];
}

export type ScopeResult = 'granted' | 'repaired' | 'rejected' | 'unsupported';

/**
 * Ask MetaMask for accounts on these EVM chains only, repairing a stored Tron-scoped permission once.
 * 'unsupported' means this provider does not take scoped permissions: connect the usual way.
 * 'rejected' means the person declined: do not continue.
 */
export async function requestEvmOnlyAccounts(provider: Eip1193Like, chainIds: number[]): Promise<ScopeResult> {
  const params = scopedPermissionRequest(chainIds.length ? chainIds : [1]);
  try {
    await provider.request({ method: 'wallet_requestPermissions', params });
    return 'granted';
  } catch (e) {
    if (isUserRejection(e)) return 'rejected';
    // Any other failure (an older MetaMask, another wallet behind the same id): connect the usual way.
    if (!isCaip25ScopeError(e)) return 'unsupported';
  }
  // A permission with an unsupported scope is stored: drop it and ask once more.
  try {
    await provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
  } catch {
    /* older MetaMask without revoke: the retry below still names only our chains */
  }
  try {
    await provider.request({ method: 'wallet_requestPermissions', params });
    return 'repaired';
  } catch (e) {
    return isUserRejection(e) ? 'rejected' : 'unsupported';
  }
}

export const CAIP25_HELP =
  'MetaMask asked for networks Ledger Chat does not use (Tron) and refused its own request. Tap MetaMask again: Ledger Chat now asks for Ethereum only.';
