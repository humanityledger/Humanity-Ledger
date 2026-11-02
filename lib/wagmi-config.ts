import { http, createConfig } from 'wagmi'
import { 
    mainnet, polygon, optimism, arbitrum, base, baseSepolia, 
    avalanche, bsc, celo, fantom, zksync, zksyncSepoliaTestnet, 
    gnosis, polygonZkEvm, mantle, blast, mode, manta, 
    taiko, ronin, kava, aurora, metis, zora, sei, 
    rootstock, linea, scroll 
} from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'

// Project ID for WalletConnect
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'bf1083a298e7222c838266166b12b2ba';

export const AUTH_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_AUTH_TOKEN_ADDRESS || '0xdc6f18f83959cd25095c2453192f16d08b496666') as `0x${string}`;

//  SOVEREIGN CHAIN SET 
// These chains MUST match what the EVM workers actually monitor (evm-worker.ts):
// ETHEREUM Mainnet, BASE Mainnet, BSC Mainnet.
// Using testnets here would cause SystemVault to lock funds on testnets
// while the analytics layer watches Mainnet  a catastrophic mismatch.
export const config = createConfig({
    chains: [
        mainnet, polygon, optimism, arbitrum, base, baseSepolia,
        avalanche, bsc, celo, fantom, zksync, zksyncSepoliaTestnet,
        gnosis, polygonZkEvm, mantle, blast, mode, manta,
        taiko, ronin, kava, aurora, metis, zora, sei,
        rootstock, linea, scroll
    ],
    multiInjectedProviderDiscovery: false,  //  EIP-6963 disabled: stabilizes WalletConnect and AppKit on iOS/Android
    connectors: [
        // CRITICAL: injected must be listed FIRST so MetaMask/Rabby are
        // the default connector and contract writes get proper RPC params.
        // Only one injected() instance  having two causes 'Connector already connected' errors.
        injected({ target: 'metaMask' }),
        walletConnect({
            projectId,
            metadata: {
                name: 'Humanity Ledger',
                description: 'The System Identity & Prediction Market Suite',
                url: 'https://humanidfi.com',
                icons: ['https://humanidfi.com/logo-mark.png'],
            }
        }),
        coinbaseWallet({ 
            appName: 'Humanity Ledger',
            // 'smartWalletOnly' requires passkeys  unavailable on iOS < 16.
            // 'all' shows both classic and smart wallet  safe for all devices.
            preference: 'all'
        }),
    ],
    transports: {
        [mainnet.id]:  http(process.env.NEXT_PUBLIC_ETHEREUM_RPC  || 'https://eth.llamarpc.com'),
        [base.id]:     http(process.env.NEXT_PUBLIC_BASE_RPC       || 'https://mainnet.base.org'),
        [bsc.id]:      http(process.env.NEXT_PUBLIC_BSC_RPC        || 'https://bsc-dataseed.binance.org'),
        [optimism.id]: http(process.env.NEXT_PUBLIC_OPTIMISM_RPC   || 'https://mainnet.optimism.io'),
        [polygon.id]: http(),
        [arbitrum.id]: http(),
        [baseSepolia.id]: http(),
        [avalanche.id]: http(),
        [celo.id]: http(),
        [fantom.id]: http(),
        [zksync.id]: http(),
        [zksyncSepoliaTestnet.id]: http(),
        [gnosis.id]: http(),
        [polygonZkEvm.id]: http(),
        [mantle.id]: http(),
        [blast.id]: http(),
        [mode.id]: http(),
        [manta.id]: http(),
        [taiko.id]: http(),
        [ronin.id]: http(),
        [kava.id]: http(),
        [aurora.id]: http(),
        [metis.id]: http(),
        [zora.id]: http(),
        [sei.id]: http(),
        [rootstock.id]: http(),
        [linea.id]: http(),
        [scroll.id]: http(),
    },
})


