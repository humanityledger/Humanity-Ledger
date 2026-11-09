"use client";

import { CreateConnectorFn, WagmiProvider } from 'wagmi';
import { AppKitNetwork, mainnet, base, arbitrum, polygon, optimism, bsc, linea, avalanche, zksync } from "@reown/appkit/networks";
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { cookieToInitialState, createStorage, cookieStorage } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { createSIWEConfig, formatMessage } from '@reown/appkit-siwe';
import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { metaMask, injected, walletConnect, safe } from 'wagmi/connectors';
// SIWE Config will be defined below

// 1. Get projectId  Falls back to real project ID so the app renders even without the env var.
// Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in Railway for clean env separation.
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    || process.env.NEXT_PUBLIC_WC_PROJECT_ID
    || 'c78f6e1e-1169-4640-8626-d9de982fa0ea';

if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID && typeof window !== 'undefined') {
    console.warn('[WalletConnect] Using hardcoded project ID. Ensure NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set in production.');
}

// 2. Interstellar Node Override
// NOTE: These env vars intentionally have no NEXT_PUBLIC_ prefix.
// In the client bundle they resolve to undefined (safe), falling back to the
// public RPC URLs listed below. Premium RPC keys are only used server-side.
const dedicatedBase = {
    ...base,
    rpcUrls: {
        ...base.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_GETBLOCK_BASE_RPC || 'https://base.drpc.org'] },
        public: { http: [process.env.NEXT_PUBLIC_GETBLOCK_BASE_RPC || 'https://base.drpc.org'] }
    }
};

const dedicatedMainnet = {
    ...mainnet,
    rpcUrls: {
        ...mainnet.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_ETH_RPC_URL || 'https://cloudflare-eth.com'] },
        public: { http: [process.env.NEXT_PUBLIC_ETH_RPC_URL || 'https://cloudflare-eth.com'] }
    }
};

const dedicatedBsc = {
    ...bsc,
    rpcUrls: {
        ...bsc.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_BNB_RPC_URL || 'https://bsc.publicnode.com'] },
        public: { http: [process.env.NEXT_PUBLIC_BNB_RPC_URL || 'https://bsc.publicnode.com'] }
    }
};

const dedicatedPolygon = {
    ...polygon,
    rpcUrls: {
        ...polygon.rpcUrls,
        default: { http: ['https://polygon.drpc.org'] },
        public: { http: ['https://polygon.drpc.org'] }
    }
};

const dedicatedArbitrum = {
    ...arbitrum,
    rpcUrls: {
        ...arbitrum.rpcUrls,
        default: { http: ['https://arbitrum.drpc.org'] },
        public: { http: ['https://arbitrum.drpc.org'] }
    }
};

const dedicatedOptimism = {
    ...optimism,
    rpcUrls: {
        ...optimism.rpcUrls,
        default: { http: ['https://optimism.drpc.org'] },
        public: { http: ['https://optimism.drpc.org'] }
    }
};

// Clean standard EVM production networks only.
// Non-standard chains (Monad placeholder, Galactica) cause MetaMask Mobile
// and WalletConnect v2 relayer to reject session proposals with "Failed to publish custom payload".
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
    dedicatedMainnet, 
    dedicatedBase, 
    dedicatedArbitrum, 
    dedicatedOptimism, 
    dedicatedPolygon, 
    dedicatedBsc,
    linea,
    avalanche,
    zksync
];

// Dynamically resolve application origin.
// In WalletConnect v2, metadata.url MUST match the actual WebSocket origin (e.g. https://ledgerchat.org).
// Any domain mismatch between the origin header and metadata.url triggers relayer rejection ("Failed to publish payload").
const appOrigin = typeof window !== 'undefined' && window.location.origin 
    ? window.location.origin 
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://ledgerchat.org');

const metadata = {
    name: 'Ledger Chat',
    description: 'Decentralized Encrypted Messenger on Humanity Ledger',
    url: appOrigin,
    icons: [`${appOrigin}/logo-mark.png`],
    redirect: {
        native: 'ledgerchat://',
        universal: typeof window !== 'undefined' ? window.location.origin : 'https://ledgerchat.org',
    },
}

export const wagmiAdapter = new WagmiAdapter({
    ssr: true,
    storage: createStorage({ storage: cookieStorage as any }),
    projectId,
    networks,
    connectors: [
        injected({ shimDisconnect: true }),
        walletConnect({ 
            projectId, 
            showQrModal: false,
            metadata,
        }),
    ],
    // EIP-6963 multi-injected provider discovery MUST be disabled on mobile.
    // iOS Safari has no injected window.ethereum, so enabling this causes wagmi
    // to race against an empty provider set and prevents WalletConnect from being
    // selected as the default connector. This breaks MetaMask and all other
    // wallet apps on iPhone / iPad / Android Chrome.
    multiInjectedProviderDiscovery: false,
})

export const config = wagmiAdapter.wagmiConfig

const queryClient = new QueryClient()

//  1-Click Auth (SIWE) Configuration 
const siweConfig = createSIWEConfig({
  getMessageParams: async () => ({
    domain: typeof window !== 'undefined' ? window.location.host : 'ledgerchat.org',
    uri: typeof window !== 'undefined' ? window.location.origin : 'https://ledgerchat.org',
    chains: [1, 10, 56, 137, 8453, 42161],
    statement: 'Authenticate to Humanity Ledger'
  }),
  createMessage: ({ address, ...args }) => formatMessage(args, address),
  getNonce: async () => {
    const res = await fetch('/api/siwe/nonce', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch nonce');
    return await res.text();
  },
  getSession: async () => {
    try {
      const res = await fetch('/api/siwe/session', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      return { address: data.address, chainId: data.chainId };
    } catch {
      return null;
    }
  },
  verifyMessage: async ({ message, signature }) => {
    try {
      const res = await fetch('/api/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature })
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  signOut: async () => {
    try {
      await fetch('/api/siwe/logout');
    } catch {}
    return true;
  }
});

let appKitInitialized = false;

try {
    if (!appKitInitialized) {
        appKitInitialized = true;
        createAppKit({
            adapters: [wagmiAdapter],
            networks,
            defaultNetwork: dedicatedMainnet,
            projectId,
            metadata,
            enableWalletConnect: true,
            enableInjected: true,
            allowUnsupportedChain: true,
            featuredWalletIds: [
                'c57ca95b47569778a828d19178114f4d', // MetaMask
                '4622a2b2d6af1c9844944291e5e7351a', // Trust Wallet
                'fd20dc426fb37566d803205b19bbc1d4', // Coinbase
                '1ae92b26df02f0abca6304df07debccd', // Rainbow
                '38f5d18bd8522c244bdd70cb4a68e0e7', // Bitget Wallet
                '971e689d0a5be527bac79629b4ee9b92', // OKX Wallet
                '8a0ee50d1f22f6651afcae7eb4253e52', // Binance Web3
                'c03dfee351b6fcc421b4494ea33b9d4b', // Uniswap Wallet
            ],
            features: {
                analytics: false, //  INSTANT BOOT: Disable telemetry to avoid blocking network requests
                email: false, // Strictly Web3 - No Web2 Email logins
                socials: false, // Strictly Web3 - No Google/Apple/X logins
                emailShowWallets: false,
                swaps: true,
                onramp: true,
                send: true,
                receive: true,
            },
            themeMode: 'light',
            themeVariables: {
                '--w3m-accent': '#5200FF',                    // Aztec purple
                '--w3m-border-radius-master': '1.5rem',       // slightly less extreme for mobile hit areas
                '--w3m-font-family': 'Inter, sans-serif',
                '--w3m-z-index': 99999,  // must be above our fixed inset-0 container                    
            },
            enableEIP6963: true, // MUST BE TRUE for wagmi 2.x to detect injected wallets like MetaMask properly
            enableCoinbase: true,
        });
    }
} catch (e) {
    console.warn('[AppKit] Initialization skipped (already initialized):', e);
}


export function Web3ModalProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
    let initialState;
    try {
        initialState = cookieToInitialState(wagmiAdapter.wagmiConfig, cookies);
    } catch (error: any) {
        console.log('[AppKit] Wagmi cookie state fallback active (Client-side state will be used)');
        initialState = undefined;
    }

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig as any} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}


