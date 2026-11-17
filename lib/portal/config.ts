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

export function parsePortalConfig(env: Record<string, string | undefined>): PortalConfig | null {
  const portal = env.NEXT_PUBLIC_HL_PORTAL ?? '';
  const factory = env.NEXT_PUBLIC_HL_RECEIVER_FACTORY ?? '';
  const implementation = env.NEXT_PUBLIC_HL_RECEIVER_IMPLEMENTATION ?? '';
  const l1ChainId = Number(env.NEXT_PUBLIC_HL_PORTAL_L1_CHAIN_ID ?? '');
  if (!EVM.test(portal) || !EVM.test(factory) || !EVM.test(implementation)) return null;
  if (l1ChainId !== 1 && l1ChainId !== 11155111) return null;
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
  if (!assets.length) return null;
  const artifactUrl = env.NEXT_PUBLIC_HL_PORTAL_TOKEN_ARTIFACT ?? '';
  if (!/^\/[A-Za-z0-9/_.-]+\.json$/.test(artifactUrl)) return null;
  let deployBlock = 0n;
  try {
    deployBlock = BigInt(env.NEXT_PUBLIC_HL_PORTAL_DEPLOY_BLOCK ?? '0');
  } catch {
    deployBlock = 0n;
  }
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
});
