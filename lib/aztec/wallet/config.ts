/**
 * lib/aztec/wallet/config.ts
 *
 * Public configuration of the private payments wallet. Every value comes from
 * NEXT_PUBLIC_* variables written by `scripts/aztec/setup-testnet.mjs`; none of
 * them is secret except the faucet key, which is published on purpose (see
 * that script).
 *
 * The wallet only ever talks to the Aztec TEST network. `assertTestNetwork`
 * refuses to start against a node that settles on Ethereum mainnet, so a
 * mistyped variable cannot point real users at a network with real value.
 */

export type TokenKey = 'USDC' | 'DAI' | 'ETH';

export interface TokenConfig {
  key: TokenKey;
  address: string;
  symbol: string;
  decimals: number;
}

export interface FaucetConfig {
  address: string;
  secret: string;
  salt: string;
  signingKey: string;
}

/** Sepolia. The Aztec test network settles here. */
export const TESTNET_L1_CHAIN_ID = 11155111;

/** Display order in the wallet. */
export const TOKEN_ORDER: TokenKey[] = ['USDC', 'DAI', 'ETH'];

/** The amount the faucet mints per request, in whole tokens. */
export const FAUCET_AMOUNT: Record<TokenKey, string> = { USDC: '100', DAI: '100', ETH: '0.05' };

function parseJson<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Each variable is read literally so that Next.js inlines it at build time.
const NODE_URL = process.env.NEXT_PUBLIC_AZTEC_NODE_URL || 'https://aztec-testnet.drpc.org';
const L1_CHAIN_ID = Number(process.env.NEXT_PUBLIC_AZTEC_L1_CHAIN_ID || TESTNET_L1_CHAIN_ID);
const SPONSORED_FPC = process.env.NEXT_PUBLIC_AZTEC_SPONSORED_FPC || '';
const TOKENS_RAW = parseJson<Partial<Record<TokenKey, Omit<TokenConfig, 'key'>>>>(process.env.NEXT_PUBLIC_AZTEC_TOKENS);
const FAUCET_RAW = parseJson<FaucetConfig>(process.env.NEXT_PUBLIC_AZTEC_FAUCET);

export const AZTEC_WALLET_CONFIG = {
  nodeUrl: NODE_URL,
  l1ChainId: L1_CHAIN_ID,
  sponsoredFpc: SPONSORED_FPC,
  explorer: 'https://testnet.aztecscan.xyz',
  rpcMaxBatch: Number(process.env.NEXT_PUBLIC_AZTEC_RPC_MAX_BATCH || 3),
  tokens: TOKEN_ORDER.flatMap((key) => {
    const t = TOKENS_RAW?.[key];
    return t?.address ? [{ key, address: t.address, symbol: t.symbol, decimals: Number(t.decimals) }] : [];
  }) as TokenConfig[],
  faucet: FAUCET_RAW?.address ? FAUCET_RAW : null,
} as const;

/** True when the operator setup has been run and the wallet can work. */
export function isWalletConfigured(): boolean {
  return AZTEC_WALLET_CONFIG.tokens.length === TOKEN_ORDER.length && !!AZTEC_WALLET_CONFIG.sponsoredFpc;
}

export function tokenConfig(key: TokenKey): TokenConfig {
  const t = AZTEC_WALLET_CONFIG.tokens.find((x) => x.key === key);
  if (!t) throw new Error(`Token ${key} is not configured. Run scripts/aztec/setup-testnet.mjs.`);
  return t;
}

export function assertTestNetwork(l1ChainId: number) {
  if (l1ChainId === 1) {
    throw new Error('This wallet only runs on the Aztec test network. The configured node settles on Ethereum mainnet.');
  }
}

export function explorerTxUrl(txHash: string) {
  return `${AZTEC_WALLET_CONFIG.explorer}/tx-effect/${txHash}`;
}
