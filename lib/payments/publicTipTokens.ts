/**
 * Public tip tokens: the Ethereum mainnet coins the public payment sheet
 * (components/chat/NativeCryptoSendModal.tsx) can send, in display order.
 * Settings → Payments lists exactly these, and the sheet opens on the one
 * saved in the `default_token` setting. One list, so the two cannot drift.
 */
export type PublicTipSymbol = 'ETH' | 'USDC' | 'USDT' | 'DAI';

export interface PublicTipToken {
  symbol: PublicTipSymbol;
  name: string;
  decimals: number;
  /** ERC-20 contract on Ethereum mainnet; null for native ETH. */
  address: `0x${string}` | null;
  color: string;
  /** Short glyph for compact rows. */
  glyph: string;
}

export const PUBLIC_TIP_CHAIN_ID = 1;

export const PUBLIC_TIP_TOKENS: readonly PublicTipToken[] = [
  { symbol: 'ETH',  name: 'Ethereum',   decimals: 18, address: null, color: '#627EEA', glyph: 'Ξ' },
  { symbol: 'USDC', name: 'USD Coin',   decimals: 6,  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', color: '#2775CA', glyph: '$' },
  { symbol: 'USDT', name: 'Tether USD', decimals: 6,  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', color: '#26A17B', glyph: '₮' },
  { symbol: 'DAI',  name: 'Dai',        decimals: 18, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', color: '#F5AC37', glyph: 'D' },
];

/** The saved default, or ETH when it is missing or no longer offered. */
export function resolveTipToken(saved: unknown): PublicTipToken {
  return PUBLIC_TIP_TOKENS.find(t => t.symbol === saved) ?? PUBLIC_TIP_TOKENS[0];
}
