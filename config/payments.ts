/**
 * config/payments.ts
 *
 * Configuration for direct cryptocurrency payments on Ethereum Mainnet.
 *
 * SAFETY FEATURE FLAG:
 * All mainnet value transfers are protected by a feature flag until external security
 * audits complete. Set NEXT_PUBLIC_MAINNET_PAYMENTS_ENABLED="true" to enable.
 */

import { type Address } from "viem";

export const PAYMENTS_CONFIG = {
  /** Master switch: must be explicitly 'true' to allow real mainnet value transfers */
  mainnetEnabled: process.env.NEXT_PUBLIC_MAINNET_PAYMENTS_ENABLED === "true",

  defaultNetwork: "ethereum-mainnet",
  chainId: 1,

  tokens: {
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    USDT: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
    },
    ETH: {
      address: null, // Native ETH
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
    },
  },
} as const;

export type SupportedMainnetToken = keyof typeof PAYMENTS_CONFIG.tokens;
