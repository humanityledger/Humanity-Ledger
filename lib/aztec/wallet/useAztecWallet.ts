'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { getPrivateWallet, type WalletSnapshot } from './client';
import type { WalletTypedData } from './keys';
import { useWalletStore } from '@/lib/store/wallet-store';
import { getSelfLink, remoteSign } from '@/lib/link/channel';

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

  const linkedComputer = typeof window !== 'undefined' && !connected && !!sessionAddress && !!getSelfLink(sessionAddress);
  const sameAccount =
    (!!sessionAddress && !!connected && connected.toLowerCase() === sessionAddress.toLowerCase()) || isLocalConnected || linkedComputer;

  const open = useCallback(async () => {
    let activeAddress: string | null = null;
    let signFn: (td: WalletTypedData) => Promise<string>;

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

    // Priority 3: a computer linked by QR asks its phone, which shows the request and signs on approval.
    // The signed message is the same one a wallet would sign here (key derivation is unchanged).
    if (!activeAddress && !isConnected && sessionAddress && getSelfLink(sessionAddress)) {
      activeAddress = sessionAddress;
      signFn = async (td) => remoteSign({ kind: 'aztec', typedData: td as any }, { wallet: sessionAddress });
    }

    if (!activeAddress || !signFn!) {
      if (!isConnected && !isLocalConnected) {
        throw new Error('Connect the wallet you signed in with to open your private wallet.');
      }
      throw new Error('The connected wallet is not the account you are signed in with. Switch accounts in your wallet and try again.');
    }

    await getPrivateWallet().connect(activeAddress, async (td: WalletTypedData) => {
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
    walletConnected: isConnected || isLocalConnected || linkedComputer,
    sameAccount,
  };
}
