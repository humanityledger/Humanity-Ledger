/**
 * lib/security/siweContractWallet.ts
 *
 * SIWE signatures from smart-contract wallets (Safe, Coinbase Smart Wallet,
 * Argent, Ambire...). They sign with ERC-1271 (deployed account) or ERC-6492
 * (account not deployed yet), which an ecrecover-based check rejects as
 * "Invalid signature". viem's verifyMessage asks the wallet's own chain and
 * handles both. Used by /api/siwe/verify only after every other field of the
 * message has already matched.
 *
 * Read-only: one eth_call to a public RPC of the chain named in the message,
 * with a timeout. Unknown chain, timeout or RPC failure -> false (fail closed).
 */
import { createPublicClient, http, getAddress, isAddress, isHex, type Chain } from 'viem';
import { mainnet, base, optimism, arbitrum, polygon, bsc, linea, avalanche, zksync, worldchain, sepolia, baseSepolia } from 'viem/chains';

const CHAINS: Readonly<Record<number, Chain>> = Object.freeze(
  Object.fromEntries([mainnet, base, optimism, arbitrum, polygon, bsc, linea, avalanche, zksync, worldchain, sepolia, baseSepolia].map((c) => [c.id, c])),
);

/** Server-side RPC override per chain, e.g. SIWE_RPC_URL_8453=https://... */
function rpcFor(chainId: number): string | undefined {
  return process.env[`SIWE_RPC_URL_${chainId}`] || undefined;
}

export interface ContractWalletSiweInput {
  chainId: number;
  address: string;
  message: string;
  signature: string;
}

export async function verifyContractWalletSiwe(
  { chainId, address, message, signature }: ContractWalletSiweInput,
  timeoutMs = 8_000,
): Promise<boolean> {
  const chain = CHAINS[chainId];
  if (!chain || !isAddress(address) || !isHex(signature)) return false;
  try {
    const client = createPublicClient({ chain, transport: http(rpcFor(chainId), { timeout: timeoutMs, retryCount: 0 }) });
    return await client.verifyMessage({ address: getAddress(address), message, signature });
  } catch {
    return false;
  }
}

export const CONTRACT_WALLET_CHAIN_IDS = Object.freeze(Object.keys(CHAINS).map(Number));
