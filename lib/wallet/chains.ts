/**
 * Multi-Chain Support
 * Support for Ethereum, Polygon, Base, Arbitrum, Optimism, and more
 */
import { providerKey } from '@/lib/server/provider-keys';

import { Chain } from 'wagmi/chains';
import { mainnet, polygon, base, arbitrum, optimism, polygonZkEvm, avalanche, bsc } from 'wagmi/chains';

export interface ChainConfig {
  id: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrl: string;
  logo: string;
  color: string;
}

/**
 * Supported blockchain networks
 */
export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      `https://eth-mainnet.g.alchemy.com/v2/${providerKey('ALCHEMY_API_KEY')}`,
      'https://eth.llamarpc.com',
    ],
    blockExplorerUrl: 'https://etherscan.io',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_ethereum',
    color: '#627EEA',
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrls: [
      `https://polygon-mainnet.g.alchemy.com/v2/${providerKey('ALCHEMY_API_KEY')}`,
      'https://polygon-rpc.com',
    ],
    blockExplorerUrl: 'https://polygonscan.com',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_polygon',
    color: '#8247E5',
  },
  base: {
    id: 8453,
    name: 'Base',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
    ],
    blockExplorerUrl: 'https://basescan.org',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_base',
    color: '#0052FF',
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum One',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      `https://arb-mainnet.g.alchemy.com/v2/${providerKey('ALCHEMY_API_KEY')}`,
      'https://arb1.arbitrum.io/rpc',
    ],
    blockExplorerUrl: 'https://arbiscan.io',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum',
    color: '#28A0F0',
  },
  optimism: {
    id: 10,
    name: 'Optimism',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      `https://opt-mainnet.g.alchemy.com/v2/${providerKey('ALCHEMY_API_KEY')}`,
      'https://mainnet.optimism.io',
    ],
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_optimism',
    color: '#FF0420',
  },
  avalanche: {
    id: 43114,
    name: 'Avalanche C-Chain',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18,
    },
    rpcUrls: [
      'https://api.avax.network/ext/bc/C/rpc',
    ],
    blockExplorerUrl: 'https://snowtrace.io',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_avalanche',
    color: '#E84142',
  },
  bsc: {
    id: 56,
    name: 'BNB Smart Chain',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: [
      'https://bsc-dataseed1.binance.org',
    ],
    blockExplorerUrl: 'https://bscscan.com',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_binance',
    color: '#F3BA2F',
  },
  bitcoin: {
    id: 0,
    name: 'Bitcoin',
    nativeCurrency: {
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8,
    },
    rpcUrls: [],
    blockExplorerUrl: 'https://mempool.space',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_bitcoin',
    color: '#F7931A',
  },
};

/**
 * Get Wagmi chain object by chain ID
 */
export function getWagmiChain(chainId: number): Chain | undefined {
  const chainMap: Record<number, Chain> = {
    [mainnet.id]: mainnet,
    [polygon.id]: polygon,
    [base.id]: base,
    [arbitrum.id]: arbitrum,
    [optimism.id]: optimism,
    [avalanche.id]: avalanche,
    [bsc.id]: bsc,
  };
  
  return chainMap[chainId];
}

/**
 * Get chain config by ID
 */
export function getChainById(chainId: number): ChainConfig | undefined {
  return Object.values(SUPPORTED_CHAINS).find(chain => chain.id === chainId);
}

/**
 * Get chain name by ID
 */
export function getChainName(chainId: number): string {
  const chain = getChainById(chainId);
  return chain?.name || 'Unknown Chain';
}

export const CHAIN_LOGOS: Record<number, string> = {
  1: '/system-shots/logostoken/ethereum-eth-logo-colored.svg',
  137: '/system-shots/logostoken/polygon-matic-logo.png',
  10: '/system-shots/logostoken/optimism-ethereum-op-logo.png',
  42161: '/system-shots/logostoken/arbitrum-arb-logo.png',
  8453: '/system-shots/logostoken/base-base-logo.jpeg',
  84532: '/system-shots/logostoken/base-base-logo.jpeg',
  43114: '/system-shots/logostoken/avalanche-avax-logo.png',
  56: '/system-shots/logostoken/bnb-bnb-logo.png',
  42220: '/system-shots/logostoken/celo-celo-logo.png',
  250: '/system-shots/logostoken/fantom-ftm-logo.png',
  324: 'https://icons.llamao.fi/icons/chains/rsz_zksync',
  300: 'https://icons.llamao.fi/icons/chains/rsz_zksync',
  100: '/system-shots/logostoken/xdai-stake-logo.png',
  1101: '/system-shots/logostoken/polygon-matic-logo.png',
  5000: '/system-shots/logostoken/mantle-mnt-logo.png',
  81457: 'https://icons.llamao.fi/icons/chains/rsz_blast',
  34443: 'https://icons.llamao.fi/icons/chains/rsz_mode',
  169: 'https://icons.llamao.fi/icons/chains/rsz_manta',
  167000: 'https://icons.llamao.fi/icons/chains/rsz_taiko',
  2020: '/system-shots/logostoken/ronin-ron-logo.png',
  2222: '/system-shots/logostoken/kava-kava-logo.png',
  1313161554: '/system-shots/logostoken/aurora-aoa-logo.png',
  1088: '/system-shots/logostoken/metisdao-metis-logo.png',
  7777777: 'https://icons.llamao.fi/icons/chains/rsz_zora',
  1329: '/system-shots/logostoken/sei-sei-logo.png',
  30: '/system-shots/logostoken/rsk-infrastructure-framework-rif-logo.png',
  59144: 'https://icons.llamao.fi/icons/chains/rsz_linea',
  534352: 'https://icons.llamao.fi/icons/chains/rsz_scroll',
  480: '/system-shots/logostoken/worldcoin-org-wld-logo.png',
  0: '/system-shots/logostoken/bitcoin-btc-logo.png'
};

/**
 * Get chain logo by ID
 */
export function getChainLogo(chainId: number): string {
  if (CHAIN_LOGOS[chainId]) return CHAIN_LOGOS[chainId];
  const chain = getChainById(chainId);
  return chain?.logo || 'https://icons.llamao.fi/icons/chains/rsz_ethereum';
}

/**
 * Get chain color by ID
 */
export function getChainColor(chainId: number): string {
  const chain = getChainById(chainId);
  return chain?.color || '#1F1F1F';
}

/**
 * Get block explorer URL for address
 */
export function getExplorerAddressUrl(chainId: number, address: string): string {
  const chain = getChainById(chainId);
  return chain ? `${chain.blockExplorerUrl}/address/${address}` : '';
}

/**
 * Get block explorer URL for transaction
 */
export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const chain = getChainById(chainId);
  return chain ? `${chain.blockExplorerUrl}/tx/${txHash}` : '';
}

/**
 * Check if chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return Object.values(SUPPORTED_CHAINS).some(chain => chain.id === chainId);
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.values(SUPPORTED_CHAINS).map(chain => chain.id);
}

/**
 * Get native currency symbol for chain
 */
export function getNativeCurrencySymbol(chainId: number): string {
  const chain = getChainById(chainId);
  return chain?.nativeCurrency.symbol || 'ETH';
}

