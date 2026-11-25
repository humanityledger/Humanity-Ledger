/**
 * lib/xmtp/wallet-kind.ts — is this Ethereum account a plain key (EOA) or a smart contract wallet?
 *
 * XMTP checks the signature that registers a person's inbox. A plain key signs with ECDSA (65
 * bytes); a smart contract wallet (Coinbase Smart Wallet, Safe, Argent, Ambire, passkey wallets…)
 * signs through its contract (ERC-1271, or ERC-6492 before it is deployed), which XMTP accepts
 * only from a signer of type "SCW" that names the chain the contract lives on. Ledger Chat used
 * to register every account as "EOA": for smart contract wallets the registration failed, so
 * those people had no inbox and messages to them never arrived (25/11/2026).
 *
 * Detection, in order:
 *   1. contract code at the address on the wallet's current chain, then on the main chains the
 *      app knows (EIP-7702 delegated accounts keep their key and sign as EOA);
 *   2. a signature that is not 65 bytes (ERC-6492 for a wallet not deployed yet): retried as SCW.
 */
export type WalletKind = { type: 'EOA' } | { type: 'SCW'; chainId: number };

/** Chains where the app has an RPC (config/appkit.tsx) and XMTP verifies smart contract wallets. */
export const SCW_CHAINS = [1, 8453, 10, 42161, 137, 59144, 324] as const;
/** Coinbase Smart Wallet, the most common wallet that signs before it is deployed, lives on Base. */
export const COUNTERFACTUAL_DEFAULT_CHAIN = 8453;

/** EIP-7702: an EOA delegating to code keeps its key and signs ECDSA. */
export function isDelegatedEoa(code: string | undefined | null): boolean {
  return !!code && /^0xef0100[0-9a-f]{40}$/i.test(code);
}

export function kindFromCode(code: string | undefined | null, chainId: number): WalletKind | null {
  if (!code || code === '0x' || /^0x0*$/.test(code)) return null;
  if (isDelegatedEoa(code)) return { type: 'EOA' };
  return { type: 'SCW', chainId };
}

/** A plain ECDSA signature is 65 bytes (130 hex characters after 0x). */
export function isPlainEcdsa(hexSignature: string): boolean {
  return /^0x[0-9a-f]{130}$/i.test(hexSignature.trim());
}

/** Chains to look at: the wallet's own first, then the others, without repeats. */
export function chainsToCheck(preferred?: number | null): number[] {
  const list: number[] = [];
  if (preferred && Number.isInteger(preferred) && preferred > 0) list.push(preferred);
  for (const c of SCW_CHAINS) if (!list.includes(c)) list.push(c);
  return list;
}

/** Reads the code at `address` on each chain (wagmi's transports, so the CSP allows them); first hit wins. */
export async function detectWalletKind(address: string, preferredChainId?: number | null, getCode?: (chainId: number) => Promise<string | undefined>): Promise<WalletKind> {
  const read =
    getCode ??
    (async (chainId: number) => {
      const [{ getPublicClient }, { config }] = await Promise.all([import('@wagmi/core'), import('@/config/appkit')]);
      const client: any = getPublicClient(config as any, { chainId } as any);
      if (!client) return undefined;
      return client.getCode({ address: address as `0x${string}` });
    });
  const chains = chainsToCheck(preferredChainId);
  const results = await Promise.allSettled(
    chains.map((c) => Promise.race([read(c), new Promise<undefined>((r) => setTimeout(() => r(undefined), 4000))])),
  );
  for (let i = 0; i < chains.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled') continue;
    const k = kindFromCode(r.value, chains[i]);
    if (k) return k;
  }
  return { type: 'EOA' };
}
