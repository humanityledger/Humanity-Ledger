/**
 * lib/portal/config.ts — where the portal is, per build. Nothing is deployed on any network yet
 * (docs/PORTAL.md §7): every value is unset by default, and the wallet then says so instead of
 * offering receiver addresses, deposits or withdrawals.
 *
 * NEXT_PUBLIC_HL_PORTAL                    HLPortal on Ethereum
 * NEXT_PUBLIC_HL_RECEIVER_FACTORY          HLReceiverFactory
 * NEXT_PUBLIC_HL_RECEIVER_IMPLEMENTATION   its implementation (factory.implementation())
 * NEXT_PUBLIC_HL_PORTAL_L1_CHAIN_ID        1 (Ethereum) or 11155111 (Sepolia)
 * NEXT_PUBLIC_HL_PORTAL_ASSETS             JSON: [{ "symbol", "l1", "l2", "decimals" }]
 * NEXT_PUBLIC_HL_PORTAL_TOKEN_ARTIFACT     URL of the compiled PortalToken artifact (served by the app)
 * NEXT_PUBLIC_HL_PORTAL_DEPLOY_BLOCK       first L1 block to scan for deposits
 */
export interface PortalAsset {
  symbol: string;
  /** ERC-20 on L1 (WETH for ETH). */
  l1: string;
  /** PortalToken instance on Aztec. */
  l2: string;
  decimals: number;
  /** ETH is deposited by value and wrapped by the portal. */
  native?: boolean;
}

export interface PortalConfig {
  portal: string;
  factory: string;
  implementation: string;
  l1ChainId: number;
  assets: PortalAsset[];
  artifactUrl: string;
  deployBlock: bigint;
}

const EVM = /^0x[0-9a-fA-F]{40}$/;
const AZTEC = /^0x[0-9a-fA-F]{64}$/;

/** A non-negative block number; anything else scans from block 0 (slower, never wrong). */
function parseBlock(v: string | undefined): bigint {
  if (!v || !/^\d{1,15}$/.test(v.trim())) return 0n;
  return BigInt(v.trim());
}

/**
 * Ethereum mainnet: the only L1 contract each symbol may name. A build whose asset list points a
 * symbol anywhere else (a typo, a look-alike token, a tampered build environment) gets no portal
 * at all rather than a "USDC" that is not USDC.
 */
export const MAINNET_CANONICAL_L1: Readonly<Record<string, string>> = {
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  ETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH9
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
};
const MAINNET_DECIMALS: Readonly<Record<string, number>> = { DAI: 18, USDC: 6, USDT: 6, ETH: 18, WETH: 18 };

/**
 * `aztecNetwork` is the wallet's network (NEXT_PUBLIC_AZTEC_NETWORK): the Aztec test network pairs
 * only with Sepolia and Aztec Alpha only with Ethereum, so a build can never send test-network
 * claims to mainnet funds or the reverse. Omitted (tests, tools), either chain is accepted.
 */
export function parsePortalConfig(env: Record<string, string | undefined>, aztecNetwork?: 'testnet' | 'mainnet'): PortalConfig | null {
  const portal = env.NEXT_PUBLIC_HL_PORTAL ?? '';
  const factory = env.NEXT_PUBLIC_HL_RECEIVER_FACTORY ?? '';
  const implementation = env.NEXT_PUBLIC_HL_RECEIVER_IMPLEMENTATION ?? '';
  const l1ChainId = Number(env.NEXT_PUBLIC_HL_PORTAL_L1_CHAIN_ID ?? '');
  if (!EVM.test(portal) || !EVM.test(factory) || !EVM.test(implementation)) return null;
  if (l1ChainId !== 1 && l1ChainId !== 11155111) return null;
  if (aztecNetwork === 'mainnet' && l1ChainId !== 1) return null;
  if (aztecNetwork === 'testnet' && l1ChainId !== 11155111) return null;
  if (new Set([portal.toLowerCase(), factory.toLowerCase(), implementation.toLowerCase()]).size !== 3) return null;
  let assets: PortalAsset[] = [];
  try {
    const raw = JSON.parse(env.NEXT_PUBLIC_HL_PORTAL_ASSETS ?? '[]');
    assets = (Array.isArray(raw) ? raw : []).filter(
      (a: any) =>
        a &&
        typeof a.symbol === 'string' &&
        /^[A-Z0-9]{2,8}$/.test(a.symbol) &&
        EVM.test(a.l1) &&
        AZTEC.test(a.l2) &&
        Number.isInteger(a.decimals) &&
        a.decimals >= 0 &&
        a.decimals <= 18,
    );
  } catch {
    assets = [];
  }
  if (l1ChainId === 1) {
    // Any mismatch disables the whole portal: a partial list would hide that the build is wrong.
    const wrong = assets.some((a) => MAINNET_CANONICAL_L1[a.symbol] !== a.l1.toLowerCase() || MAINNET_DECIMALS[a.symbol] !== a.decimals);
    if (wrong) return null;
  }
  if (new Set(assets.map((a) => a.symbol)).size !== assets.length) return null;
  if (new Set(assets.map((a) => a.l2.toLowerCase())).size !== assets.length) return null;
  if (!assets.length) return null;
  const artifactUrl = env.NEXT_PUBLIC_HL_PORTAL_TOKEN_ARTIFACT ?? '';
  if (!/^\/[A-Za-z0-9/_.-]+\.json$/.test(artifactUrl)) return null;
  const deployBlock = parseBlock(env.NEXT_PUBLIC_HL_PORTAL_DEPLOY_BLOCK);
  return {
    portal: portal.toLowerCase(),
    factory: factory.toLowerCase(),
    implementation: implementation.toLowerCase(),
    l1ChainId,
    assets: assets.map((a) => ({ ...a, l1: a.l1.toLowerCase(), l2: a.l2.toLowerCase(), native: a.symbol === 'ETH' })),
    artifactUrl,
    deployBlock,
  };
}

/** This build's portal, or null when it is not deployed for this build (the default). */
export const PORTAL_CONFIG: PortalConfig | null = parsePortalConfig({
  NEXT_PUBLIC_HL_PORTAL: process.env.NEXT_PUBLIC_HL_PORTAL,
  NEXT_PUBLIC_HL_RECEIVER_FACTORY: process.env.NEXT_PUBLIC_HL_RECEIVER_FACTORY,
  NEXT_PUBLIC_HL_RECEIVER_IMPLEMENTATION: process.env.NEXT_PUBLIC_HL_RECEIVER_IMPLEMENTATION,
  NEXT_PUBLIC_HL_PORTAL_L1_CHAIN_ID: process.env.NEXT_PUBLIC_HL_PORTAL_L1_CHAIN_ID,
  NEXT_PUBLIC_HL_PORTAL_ASSETS: process.env.NEXT_PUBLIC_HL_PORTAL_ASSETS,
  NEXT_PUBLIC_HL_PORTAL_TOKEN_ARTIFACT: process.env.NEXT_PUBLIC_HL_PORTAL_TOKEN_ARTIFACT,
  NEXT_PUBLIC_HL_PORTAL_DEPLOY_BLOCK: process.env.NEXT_PUBLIC_HL_PORTAL_DEPLOY_BLOCK,
}, process.env.NEXT_PUBLIC_AZTEC_NETWORK === 'alpha' ? 'mainnet' : 'testnet');
