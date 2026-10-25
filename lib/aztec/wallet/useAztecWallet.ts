'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { getPrivateWallet, type WalletSnapshot } from './client';
import type { WALLET_TYPED_DATA } from './keys';
import { useWalletStore } from '@/lib/store/wallet-store';

/**
 * React binding for the private payments wallet.
 *
 * `sessionAddress` is the Ethereum address the person is signed in with. The
 * wallet keys are derived from a signature by that same address.
 * Supports both Wagmi-connected wallets (MetaMask / WalletConnect) and native
 * sovereign in-memory local wallets (useWalletStore).
 */
export function useAztecWallet(sessionAddress: string) {
  const [state, setState] = useState<WalletSnapshot>(() =>
    typeof window === 'undefined'
      ? { phase: 'idle', balances: [], activity: [], busy: false }
      : getPrivateWallet().state,
  );
  const { address: connected, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  useEffect(() => getPrivateWallet().subscribe(setState), []);

  const localStoreAddr = useWalletStore(s => s.address);
  const isLocalConnected = !!localStoreAddr && !!sessionAddress && localStoreAddr.toLowerCase() === sessionAddress.toLowerCase();

  const sameAccount =
    (!!sessionAddress && !!connected && connected.toLowerCase() === sessionAddress.toLowerCase()) || isLocalConnected;

  const open = useCallback(async () => {
    let activeAddress: string | null = null;
    let signFn: (td: typeof WALLET_TYPED_DATA) => Promise<string>;

    // Priority 1: External Wagmi wallet
    if (isConnected && connected && connected.toLowerCase() === sessionAddress.toLowerCase()) {
      activeAddress = connected;
      signFn = async (td) => {
        return await signTypedDataAsync({
          domain: td.domain,
          types: td.types as unknown as Record<string, { name: string; type: string }[]>,
          primaryType: td.primaryType,
          message: td.message as unknown as Record<string, unknown>,
        });
      };
    } else {
      // Priority 2: Sovereign in-memory local wallet
      const localWallet = await useWalletStore.getState().getConnectedWallet();
      if (localWallet && localWallet.address.toLowerCase() === sessionAddress.toLowerCase()) {
        activeAddress = localWallet.address;
        signFn = async (td) => {
          return await (localWallet as any).signTypedData(td.domain, td.types, td.message);
        };
      }
    }

    if (!activeAddress || !signFn!) {
      if (!isConnected && !isLocalConnected) {
        throw new Error('Connect the wallet you signed in with to open your private wallet.');
      }
      throw new Error('The connected wallet is not the account you are signed in with. Switch accounts in your wallet and try again.');
    }

    await getPrivateWallet().connect(activeAddress, async (td: typeof WALLET_TYPED_DATA) => {
      try {
        return await signFn(td);
      } catch (err: any) {
        const msg = String(err?.shortMessage || err?.message || err || '');
        if (/user (rejected|denied)|rejected the request|denied message signature/i.test(msg)) throw err;
        console.error('[ZkWallet] signTypedData failed:', err);
        throw new Error(
          `Your wallet could not sign the request${msg ? `: ${msg}` : '.'} Unlock it, update it if it is old, and try again. Hardware wallets need typed-data signing enabled.`,
        );
      }
    });
  }, [connected, isConnected, sessionAddress, isLocalConnected, signTypedDataAsync]);

  return {
    state,
    wallet: typeof window === 'undefined' ? null : getPrivateWallet(),
    open,
    walletConnected: isConnected || isLocalConnected,
    sameAccount,
  };
}
