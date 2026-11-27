/**
 * lib/aztec/wallet/external-sdk.ts
 *
 * Discovery of Aztec wallets that speak @aztec-labs/wallet-sdk (browser extensions such as Azguard,
 * and web wallets), next to the wallet built into Ledger Chat (useAztecWallet.ts, which stays the
 * default and needs no extension).
 *
 * Discovery only lists what answers; it connects nothing. Connecting is the wallet's own flow
 * (establishSecureChannel → the person confirms the verification hash in their wallet). The SDK is
 * loaded only when discovery runs, so pages that never ask pay nothing for it.
 */

import type { ChainInfo } from '@aztec-labs/aztec.js/account';

export interface ExternalAztecWallet {
  id: string;
  name: string;
  type: 'extension' | 'web';
  icon?: string;
}

export interface DiscoverOptions {
  chainInfo: ChainInfo;
  /** Identifies Ledger Chat to the wallet. */
  appId?: string;
  timeoutMs?: number;
  /** Web wallets to ask besides browser extensions (their https URLs). */
  webWallets?: string[];
}

/**
 * Lists the wallet-sdk wallets that answer within `timeoutMs`. Never throws: no SDK, no extension
 * or no answer is an empty list.
 */
export async function discoverExternalAztecWallets(opts: DiscoverOptions): Promise<ExternalAztecWallet[]> {
  if (typeof window === 'undefined') return [];
  try {
    const { WalletManager } = await import('@aztec-labs/wallet-sdk/manager');
    const manager = WalletManager.configure({
      extensions: { enabled: true },
      ...(opts.webWallets?.length ? { webWallets: { urls: opts.webWallets } } : {}),
    });
    const found: ExternalAztecWallet[] = [];
    const session = manager.getAvailableWallets({
      chainInfo: opts.chainInfo,
      appId: opts.appId ?? 'ledger-chat',
      timeout: opts.timeoutMs ?? 2_500,
      onWalletDiscovered: (p) => {
        if (!found.some((w) => w.id === p.id)) found.push({ id: p.id, name: p.name, type: p.type, icon: p.icon });
      },
    });
    await session.done;
    return found;
  } catch {
    return [];
  }
}

/** ChainInfo for a known network (lib/aztec/sequencer/networks.ts): the values the node must report too. */
export async function chainInfoForNetwork(network: 'mainnet' | 'testnet'): Promise<ChainInfo> {
  const [{ Fr }, { AZTEC_NETWORKS }] = await Promise.all([import('@aztec-labs/aztec.js/fields'), import('@/lib/aztec/sequencer/networks')]);
  const net = AZTEC_NETWORKS[network];
  return { chainId: new Fr(BigInt(net.l1ChainId)), version: new Fr(BigInt(net.rollupVersion)) } as ChainInfo;
}
