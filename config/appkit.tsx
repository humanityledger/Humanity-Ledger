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
    || '47cce4049225582027fdeeecb2868ead'; // Master WalletConnect ID (Synced from next.config.js)

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

// 3. World Chain definition
const worldchain: AppKitNetwork = {
    id: 480,
    name: 'World Chain',
    caipNetworkId: 'eip155:480',
    chainNamespace: 'eip155',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: [process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://worldchain-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "https://worldchain-mainnet.g.alchemy.com/public"] }
    },
    blockExplorers: {
        default: { name: 'Worldscan', url: 'https://worldscan.org' }
    }
} as any;

const dedicatedMonadMainnet: AppKitNetwork = {
    id: 10143, // Placeholder ID for Monad
    name: 'Monad Mainnet',
    caipNetworkId: 'eip155:10143',
    chainNamespace: 'eip155',
    nativeCurrency: { name: 'Monad', symbol: 'MONAD', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.monad.xyz'] }
    },
    blockExplorers: {
        default: { name: 'Monad Explorer', url: 'https://explorer.monad.xyz' }
    }
} as any;

const galactica: AppKitNetwork = {
    id: 613419,
    name: 'Galactica Mainnet',
    caipNetworkId: 'eip155:613419',
    chainNamespace: 'eip155',
    nativeCurrency: { name: 'GNET', symbol: 'GNET', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://galactica-mainnet.g.alchemy.com/public'] }
    },
    blockExplorers: {
        default: { name: 'Galactica Explorer', url: 'https://explorer.galactica.com/' }
    }
} as any;

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

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [dedicatedMainnet, dedicatedBase, dedicatedBsc, dedicatedPolygon, dedicatedArbitrum, dedicatedOptimism, worldchain, linea, avalanche, zksync, dedicatedMonadMainnet, galactica];

export const wagmiAdapter = new WagmiAdapter({
    ssr: true,
    // Explicit cookieStorage: guarantees wagmi state is available synchronously
    // on SSR and survives Android Chrome tab destruction after deep-link redirects.
    // Per Reown official docs (2025-2026), this must be set explicitly alongside ssr:true.
    // @ts-ignore: Wagmi v2 type mismatch between AppKit and Wagmi core
    storage: createStorage({ storage: cookieStorage as any }),
    projectId,
    networks,
    // [MOBILE STABILITY] Re-enabled multiInjectedProviderDiscovery so AppKit
    // constructs proper WalletConnect deep-links on iOS/Android Safari instead
    // of erroneously intercepting clicks looking for a non-existent window.ethereum.
    multiInjectedProviderDiscovery: true,
})

export const config = wagmiAdapter.wagmiConfig

const queryClient = new QueryClient()

// [FIX] CANONICAL_APP_URL must ALWAYS be the registered WalletConnect Cloud domain.
// NEVER override with window.location.origin — on Railway preview environments,
// this returns a .up.railway.app URL which is NOT in the WalletConnect allowlist.
// A mismatched URL causes the relay to SILENTLY REJECT all mobile sessions,
// producing exactly the "handshake failed" and "timeout" errors users report.
// The CANONICAL_APP_URL is pinned unconditionally to the registered production domain.
const CANONICAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://humanidfi.com';

const metadata = {
    name: 'Humanity Ledger',
    description: 'Zero-Knowledge Identity Infrastructure',
    url: CANONICAL_APP_URL,
    icons: [`${CANONICAL_APP_URL}/logo-mark.png`],
}

//  1-Click Auth (SIWE) Configuration 
// Natively integrated with WalletConnect to bundle connection and signature
// in a single wallet prompt. Crucial for bypassing Android tab-discard loops.
const siweConfig = createSIWEConfig({
  getMessageParams: async () => ({
    domain: typeof window !== 'undefined' ? window.location.host : 'humanidfi.com',
    uri: typeof window !== 'undefined' ? window.location.origin : 'https://humanidfi.com',
    chains: [1, 10, 56, 137, 8453, 42161, 480],
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

//  CRITICAL: createAppKit must be called at module level (not inside window check).
// Reown AppKit hooks (useAppKit, useAppKitAccount, etc.) are used during SSR in
// Next.js server components. The hooks throw "Please call createAppKit before
// using useAppKit hook" when this function hasn't been called before the hook runs.
// Solution: Call createAppKit unconditionally at module import time with a singleton
// guard. The WagmiAdapter's ssr:true handles the server-side hydration safely.
let appKitInitialized = false;

try {
    if (!appKitInitialized) {
        appKitInitialized = true;
        createAppKit({
            adapters: [wagmiAdapter],
            networks,
            projectId,
            metadata,
            // siweConfig, // [CRITICAL MOBILE FIX] Disabled automatic SIWE. AppKit CAIP-122 blocks MetaMask mobile. We handle signature manually.
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
            enableInjected: true,
            enableEIP6963: true, // MUST BE TRUE for wagmi 2.x to detect injected wallets like MetaMask properly
            enableWalletConnect: true,
            enableCoinbase: true,
            customWallets: [
                {
                    id: 'azguard-aztec-wallet',
                    name: 'Azguard Wallet',
                    homepage: 'https://aztec.network',
                    image_url: 'https://pbs.twimg.com/profile_images/1798363363365945344/v3F962Fk_400x400.jpg',
                    mobile_link: 'azguard://',
                    desktop_link: 'azguard://',
                    webapp_link: 'https://azguard.app',
                }
            ]
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


