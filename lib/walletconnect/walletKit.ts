// NOTE: This module is deliberately NOT 'use client'  it runs in a browser
// context only because WalletConnectProvider.tsx (which calls createWeb3Wallet)
// is loaded with dynamic({ ssr: false }).
import { Core } from '@walletconnect/core';
import { Web3Wallet, IWeb3Wallet } from '@walletconnect/web3wallet';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import { useWalletConnectStore } from '@/lib/store/wallet-connect-store';

let web3wallet: IWeb3Wallet | null = null;

// In HMR/dev we need to reset the singleton so listeners are never duplicated
if (typeof window !== 'undefined' && (module as any).hot) {
  (module as any).hot.dispose(() => { web3wallet = null; });
}

export async function createWeb3Wallet() {
    if (web3wallet) return web3wallet;

    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID 
      || process.env.NEXT_PUBLIC_WC_PROJECT_ID 
      || '47cce4049225582027fdeeecb2868ead';

    const core = new Core({
        projectId,
        customStoragePrefix: 'wc-wallet-system',
    });

    web3wallet = await Web3Wallet.init({
        core: core as any, // pino Logger types diverge between nested @walletconnect package versions
        metadata: {
            name: 'Ledger Portfolio',
            description: 'Sovereign System Wallet',
            url: process.env.NEXT_PUBLIC_APP_URL || 'https://www.humanidfi.com',
            icons: ['https://www.humanidfi.com/logo-mark.png'],
        },
    });

    // Event Listeners  explicit `any` satisfies noImplicitAny until types are resolved by npm install
    web3wallet.on('session_proposal', (proposal: any) => {
        useWalletConnectStore.getState().addProposal(proposal);
    });

    web3wallet.on('session_request', (request: any) => {
        useWalletConnectStore.getState().addRequest(request);
    });

    web3wallet.on('session_delete', () => {
        if (web3wallet) {
            useWalletConnectStore.getState().setSessions(web3wallet.getActiveSessions());
        }
    });

    // Populate active sessions into store
    useWalletConnectStore.getState().setSessions(web3wallet.getActiveSessions());
    useWalletConnectStore.getState().setInitialized(true);

    return web3wallet;
}

export function getWeb3Wallet() {
    return web3wallet;
}

export async function approveSession(proposal: any, currentAddress: string) {
    if (!web3wallet) throw new Error('Web3Wallet not initialized');
    
    // We strictly support EVM chains (EIP155)
    const { id, params } = proposal;
    
    try {
        const approvedNamespaces = buildApprovedNamespaces({
            proposal: params,
            supportedNamespaces: {
                eip155: {
                    chains: ['eip155:1', 'eip155:137', 'eip155:8453', 'eip155:42161', 'eip155:10', 'eip155:43114'],
                    methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4'],
                    events: ['accountsChanged', 'chainChanged'],
                    accounts: [
                        `eip155:1:${currentAddress}`,
                        `eip155:137:${currentAddress}`,
                        `eip155:8453:${currentAddress}`,
                        `eip155:42161:${currentAddress}`,
                        `eip155:10:${currentAddress}`,
                        `eip155:43114:${currentAddress}`,
                    ]
                }
            }
        });

        const session = await web3wallet.approveSession({
            id,
            namespaces: approvedNamespaces
        });

        useWalletConnectStore.getState().setSessions(web3wallet.getActiveSessions());
        return session;
    } catch (e) {
        // Best-effort rejection  if the proposal is already expired this may throw, suppress it
        try {
            await web3wallet.rejectSession({
                id,
                reason: getSdkError('USER_REJECTED')
            });
        } catch (_err) {}
        throw e;
    }
}

export async function rejectSession(proposal: any) {
    if (!web3wallet) return;
    await web3wallet.rejectSession({
        id: proposal.id,
        reason: getSdkError('USER_REJECTED')
    });
}
