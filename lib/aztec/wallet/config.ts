/**
 * lib/aztec/wallet/config.ts
 *
 * Public configuration of the private payments wallet. Every value comes from
 * NEXT_PUBLIC_* variables written by `scripts/aztec/setup-testnet.mjs`; none of
 * them is secret except the faucet key, which is published on purpose (see
 * that script).
 *
 * By default the wallet only talks to the Aztec TEST network, and
 * `assertNetworkAllowed` refuses a node that settles on Ethereum mainnet, so a
 * mistyped variable cannot point real users at a network with real value.
 *
 * Aztec Alpha (mainnet) needs BOTH variables, set on purpose by the operator:
 *   NEXT_PUBLIC_AZTEC_NETWORK=alpha
 *   NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true
 * On Alpha there is no sponsor and no faucet: fees are paid in Fee Juice
 * bridged from L1 (lib/aztec/fee-juice.ts), and only tokens listed in
 * NEXT_PUBLIC_AZTEC_TOKENS that pass lib/aztec/token-check.ts are used.
 */
import { AZTEC_NETWORKS } from '../sequencer/networks';
import { WALLET_TYPED_DATA, WALLET_TYPED_DATA_ALPHA, type WalletTypedData } from './keys';

export type WalletNetwork = 'testnet' | 'mainnet';

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
const NETWORK: WalletNetwork = process.env.NEXT_PUBLIC_AZTEC_NETWORK === 'alpha' ? 'mainnet' : 'testnet';
const ALPHA_ENABLED = process.env.NEXT_PUBLIC_AZTEC_ALPHA_ENABLED === 'true';
const NODE_URL = process.env.NEXT_PUBLIC_AZTEC_NODE_URL || AZTEC_NETWORKS[NETWORK].publicNodeRpc;
const L1_CHAIN_ID = Number(process.env.NEXT_PUBLIC_AZTEC_L1_CHAIN_ID || AZTEC_NETWORKS[NETWORK].l1ChainId);
/** L1 block from which to look for this site's Fee Juice deposits when recovering claims. */
const L1_FROM_BLOCK = BigInt(process.env.NEXT_PUBLIC_AZTEC_L1_FROM_BLOCK || '0');
const EXPLORER = process.env.NEXT_PUBLIC_AZTEC_EXPLORER || (NETWORK === 'testnet' ? 'https://testnet.aztecscan.xyz' : '');
const SPONSORED_FPC = process.env.NEXT_PUBLIC_AZTEC_SPONSORED_FPC || '';
const TOKENS_RAW = parseJson<Partial<Record<TokenKey, Omit<TokenConfig, 'key'>>>>(process.env.NEXT_PUBLIC_AZTEC_TOKENS);
const FAUCET_RAW = parseJson<FaucetConfig>(process.env.NEXT_PUBLIC_AZTEC_FAUCET);
const CAPS_RAW = parseJson<Record<string, unknown>>(process.env.NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS);

/** Per-token agreement caps in base units, keyed by lowercase Aztec address. Malformed entries are dropped (fail-closed: no cap = refused). */
export function parseAgreementCaps(raw: Record<string, unknown> | null): Readonly<Record<string, bigint>> {
  const out: Record<string, bigint> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Object.freeze(out);
  let dropped = 0;
  for (const [addr, v] of Object.entries(raw)) {
    // Decimal strings only: no sign, no hex, no exponent; 0 is not a cap.
    if (!/^0x[0-9a-fA-F]{64}$/.test(addr) || typeof v !== 'string' || !/^[0-9]{1,39}$/.test(v) || BigInt(v) <= 0n) {
      dropped++;
      continue;
    }
    out[addr.toLowerCase()] = BigInt(v);
  }
  if (dropped) console.warn(`NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: ${dropped} malformed entr${dropped === 1 ? 'y' : 'ies'} ignored`);
  return Object.freeze(out);
}

export const AZTEC_WALLET_CONFIG = {
  network: NETWORK,
  alphaEnabled: ALPHA_ENABLED,
  nodeUrl: NODE_URL,
  l1ChainId: L1_CHAIN_ID,
  l1FromBlock: L1_FROM_BLOCK,
  sponsoredFpc: NETWORK === 'testnet' ? SPONSORED_FPC : '',
  explorer: EXPLORER,
  rpcMaxBatch: Number(process.env.NEXT_PUBLIC_AZTEC_RPC_MAX_BATCH || 3),
  tokens: TOKEN_ORDER.flatMap((key) => {
    const t = TOKENS_RAW?.[key];
    return t?.address ? [{ key, address: t.address, symbol: t.symbol, decimals: Number(t.decimals) }] : [];
  }) as TokenConfig[],
  agreementCaps: parseAgreementCaps(CAPS_RAW),
  // Test tokens only: there is never a faucet on Alpha.
  faucet: NETWORK === 'testnet' && FAUCET_RAW?.address ? FAUCET_RAW : null,
} as const;

type WalletReadiness = Pick<typeof AZTEC_WALLET_CONFIG, 'network' | 'alphaEnabled' | 'tokens' | 'sponsoredFpc'>;

/**
 * True when the operator setup has been run and the wallet can work.
 *
 * On Alpha, enabling Alpha on purpose is enough: the wallet opens, creates the
 * account from bridged Fee Juice and pays fees with it, even before any private
 * token is configured. Token flows stay off until hasPrivateTokens() is true,
 * and every configured token still has to pass token-check.ts when the wallet
 * opens (fail-closed).
 */
export function isWalletConfigured(cfg: WalletReadiness = AZTEC_WALLET_CONFIG): boolean {
  if (cfg.network === 'mainnet') {
    return cfg.alphaEnabled;
  }
  return cfg.tokens.length === TOKEN_ORDER.length && !!cfg.sponsoredFpc;
}

/** True when at least one private token is configured (Shield, Unshield, Send, agreements). */
export function hasPrivateTokens(cfg: Pick<typeof AZTEC_WALLET_CONFIG, 'tokens'> = AZTEC_WALLET_CONFIG): boolean {
  return cfg.tokens.length > 0;
}

/** Shown wherever a token flow would be, while no private token is configured. */
export const NO_PRIVATE_TOKENS_MESSAGE =
  'Only Fee Juice is available for now. Private tokens will be switched on once they are configured.';

/** What the user signs to open the wallet; differs per network (keys.ts). */
export function walletTypedData(): WalletTypedData {
  return AZTEC_WALLET_CONFIG.network === 'mainnet' ? WALLET_TYPED_DATA_ALPHA : WALLET_TYPED_DATA;
}

/** Words for the interface. */
export function networkLabel(): string {
  return AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'Aztec Alpha' : 'Aztec test network';
}

export function tokenConfig(key: TokenKey): TokenConfig {
  const t = AZTEC_WALLET_CONFIG.tokens.find((x) => x.key === key);
  if (!t) {
    throw new Error(
      AZTEC_WALLET_CONFIG.network === 'mainnet'
        ? `Token ${key} is not configured on ${networkLabel()} (NEXT_PUBLIC_AZTEC_TOKENS).`
        : `Token ${key} is not configured. Run scripts/aztec/setup-testnet.mjs.`,
    );
  }
  return t;
}

export function assertTestNetwork(l1ChainId: number) {
  if (l1ChainId === 1) {
    throw new Error('This wallet only runs on the Aztec test network. The configured node settles on Ethereum mainnet.');
  }
}

/**
 * The node must settle where this build was configured to run, and Alpha
 * must have been enabled on purpose. Replaces assertTestNetwork in the wallet.
 */
export function assertNetworkAllowed(l1ChainId: number, cfg: Pick<typeof AZTEC_WALLET_CONFIG, 'network' | 'alphaEnabled'> = AZTEC_WALLET_CONFIG) {
  const mainnetNode = l1ChainId === AZTEC_NETWORKS.mainnet.l1ChainId;
  if (cfg.network === 'testnet') {
    if (mainnetNode) assertTestNetwork(l1ChainId);
    return;
  }
  if (!cfg.alphaEnabled) {
    throw new Error('Aztec Alpha is not enabled on this server (NEXT_PUBLIC_AZTEC_ALPHA_ENABLED).');
  }
  if (!mainnetNode) {
    throw new Error('This wallet is configured for Aztec Alpha, but the node does not settle on Ethereum mainnet.');
  }
}

export function explorerTxUrl(txHash: string) {
  return AZTEC_WALLET_CONFIG.explorer ? `${AZTEC_WALLET_CONFIG.explorer}/tx-effect/${txHash}` : '';
}
