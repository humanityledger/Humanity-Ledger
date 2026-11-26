/**
 * Public L2 rails (Titan V4 §4): Ethereum, Base, Arbitrum One, OP Mainnet.
 * Catalogue + fail-closed checks only; no UI sends on L2 until
 * NEXT_PUBLIC_L2_RAILS is on (default off). An unknown chain id, or a wallet on
 * a different chain than the rail, is refused — funds are never sent where the
 * recipient's app would not look. Native USDC (Circle) addresses only, never bridged variants.
 */
import type { RailCheck } from '@/lib/payments/rails';

export interface L2Rail { chainId: number; name: string; native: 'ETH'; usdc: `0x${string}`; explorer: string }

export const L2_RAILS: Readonly<Record<number, L2Rail>> = Object.freeze({
  1: { chainId: 1, name: 'Ethereum', native: 'ETH', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', explorer: 'https://etherscan.io' },
  8453: { chainId: 8453, name: 'Base', native: 'ETH', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', explorer: 'https://basescan.org' },
  42161: { chainId: 42161, name: 'Arbitrum One', native: 'ETH', usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', explorer: 'https://arbiscan.io' },
  10: { chainId: 10, name: 'OP Mainnet', native: 'ETH', usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', explorer: 'https://optimistic.etherscan.io' },
});

export function l2RailsEnabled(v: string | undefined = process.env.NEXT_PUBLIC_L2_RAILS): boolean {
  return v === '1' || v === 'true';
}

/** The rail for a chain id, or null (fail-closed) for anything not in the catalogue. */
export function railFor(chainId: unknown): L2Rail | null {
  const id = typeof chainId === 'string' && /^(0x[0-9a-f]+|\d+)$/i.test(chainId) ? Number(chainId) : chainId;
  return typeof id === 'number' && Number.isSafeInteger(id) && Object.prototype.hasOwnProperty.call(L2_RAILS, id) ? L2_RAILS[id] : null;
}

/** May a transfer on `railChainId` be signed by a wallet currently on `walletChainId`? */
export function checkL2Send(walletChainId: unknown, railChainId: unknown, enabled = l2RailsEnabled()): RailCheck {
  const rail = railFor(railChainId);
  if (!rail) return { ok: false, reason: 'This network is not supported.' };
  if (rail.chainId !== 1 && !enabled) return { ok: false, reason: 'Payments on this network are not available yet.' };
  const w = railFor(walletChainId);
  if (!w || w.chainId !== rail.chainId) return { ok: false, reason: `Switch your wallet to ${rail.name} to send this payment.` };
  return { ok: true };
}

/** Explorer link for a transaction hash on a known rail, or null. */
export function txLink(chainId: unknown, hash: string): string | null {
  const r = railFor(chainId);
  return r && /^0x[0-9a-f]{64}$/i.test(hash) ? `${r.explorer}/tx/${hash}` : null;
}
