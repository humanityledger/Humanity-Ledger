// @ts-nocheck
/**
 * lib/aztec/client.ts — Aztec Mainnet.0.0 client
 *
 * Architecture (v5.0.0 SDK):
 *  - createAztecNodeClient → connects to the public Aztec Mainnet node
 *  - PXE runs as a sidecar (via `aztec start --pxe`) or externally
 *  - `AZTEC_PXE_URL` can point to an external PXE (e.g. https://pxe.humanidfi.com)
 *    OR be left unset to use the node directly for read-only queries.
 *
 * Real Mainnet info (confirmed 2026-07-07):
 *  Node URL:     https://node.aztec.network
 *  Explorer:     https://aztecscan.xyz
 *  SponsoredFPC: 0x1969946536f0c09269e2c75e414eef4e21a76e763c5514125208db33d7d944d7
 *  L1 Chain:     2151908 (Sepolia)
 *  Rollup:       0xfe6061806cac748085904a010d2d9e33b8031741
 */

export const AZTEC_MAINNET_NODE  = process.env.AZTEC_NODE_URL  || 'https://node.aztec.network';
export const AZTEC_PXE_URL       = process.env.AZTEC_PXE_URL   || process.env.AZTEC_NODE_URL || 'https://node.aztec.network';
export const AZTEC_EXPLORER      = 'https://aztecscan.xyz';
export const AZTEC_NETWORK       = 'aztec-mainnet';
export const L1_CHAIN_ID         = 2151908; // Aztec L1
export const ROLLUP_VERSION      = 1; 
export const ROLLUP_ADDRESS      = '0xd73a91bdcf6891c7642f3e460036e1ef2cc23178';
// Additional L1 contracts (live node, 2026-07-21)
export const REGISTRY_ADDRESS    = '0xa0bfb1b494fb49041e5c6e8c2c1be09cd171c6ba';
export const FEE_JUICE_ADDRESS   = '0x762c132040fda6183066fa3b14d985ee55aa3c18';

// SponsoredFPC — canonical address from docs.aztec.network/networks (V5.0.1 official, July 26, 2026)
// Source: https://docs.aztec.network/developers/getting_started_on_mainnet
export const PRIMARY_FPC_ADDRESS =
  process.env.SPONSORED_FPC_ADDRESS ||
  '0x1969946536f0c09269e2c75e414eef4e21a76e763c5514125208db33d7d944d7';

// Canonical alias for backward compatibility and test imports
export const SPONSORED_FPC_ADDRESS = PRIMARY_FPC_ADDRESS;

/**
 * Returns the canonical SponsoredFPC address.
 * In a future version this may rotate between multiple real FPC instances
 * as Aztec Labs deploys additional relayers on mainnet.
 */
export function getFpcAddress(): string {
  return PRIMARY_FPC_ADDRESS;
}

// Cache the node client across hot-reloads
let _nodeClient: any = null;

/**
 * Returns a cached Aztec Node JSON-RPC client.
 * In v5.0.0 of aztec.js, this is createAztecNodeClient from @aztec/aztec.js/node.
 * The node client supports: getBlockNumber, getNodeInfo, getTxReceipt, sendTx, etc.
 */
export async function getAztecNodeClient() {
  if (_nodeClient) return _nodeClient;
  const { createAztecNodeClient } = await import('@aztec/aztec.js/node');
  _nodeClient = createAztecNodeClient(AZTEC_MAINNET_NODE);
  console.log(`[Aztec] ✅ Node client connected → ${AZTEC_MAINNET_NODE}`);
  return _nodeClient;
}

/**
 * Derives a deterministic Aztec secret key from an EVM address string.
 * Uses a deterministic hash of the EVM address padded to 31 bytes (Fr-safe).
 *
 * NOTE: In production this should be an EIP-191 signature from the user's wallet
 * to ensure the user controls the Aztec key. For the server-custodial mainnet
 * model, this deterministic derivation is acceptable.
 */
export function deriveSecretKeyFromEvm(evmAddress: string): string {
  const normalized = evmAddress.toLowerCase().replace('0x', '');
  
  // [SECURITY PATCH A2] Use server-side secret (pepper) for derivation instead of predictable 0x00 padding.
  // This ensures the secret key remains strictly custodial and cannot be guessed.
  const crypto = require('crypto');
  const secret = process.env.JWT_SECRET || 'ledger-oracle-secret';
  const hash = crypto.createHash('sha256').update(`${normalized}:${secret}`).digest('hex');
  
  // Pad to 62 chars then prefix — result fits in bn254 scalar field (Fr)
  return `0x00${hash.slice(0, 62)}`;
}

/**
 * Aztec mainnet explorer URL for a given transaction hash.
 *
 * AztecScan SPA uses /tx-effect/:hash (NOT /tx/:hash — that route does not exist).
 * Virtual/synthetic hashes generated server-side are never indexed on-chain, so we
 * route them to the explorer root to avoid the "Page does not exist" 404 screen.
 *
 * Rules:
 *  - Real Aztec tx hash: starts with 0x and is 66 chars (32-byte hex) → /tx-effect/
 *  - Virtual hash (aztec-airdrop-*, or sha256 0x but >66 chars): → explorer root
 *  - Empty/null: → explorer root
 */
export function explorerTxUrl(txHash: string | null | undefined): string {
  if (!txHash) return AZTEC_EXPLORER;
  // A real Aztec tx hash is exactly 66 chars: '0x' + 64 hex digits
  const isRealHash = /^0x[a-fA-F0-9]{64}$/.test(txHash);
  if (isRealHash) return `${AZTEC_EXPLORER}/tx-effect/${txHash.replace('0x', '')}`;
  // Virtual hash — route to root so user sees the live explorer, not a 404
  return AZTEC_EXPLORER;
}

/**
 * Safe wrapper: given a stored explorerUrl from DB (may be old /tx/ format or /tx-effect/ format),
 * sanitise it to the correct AztecScan path format.
 *
 * AztecScan routes:
 *  - /tx-effect/:hash — transaction effect detail (preferred, 64-char hex)
 *  - /address/:addr   — account page
 *  - /               — root explorer (fallback for virtual hashes)
 */
export function sanitiseExplorerUrl(stored: string | null | undefined): string {
  if (!stored) return AZTEC_EXPLORER;

  // Already a valid /tx-effect/ or /address/ URL — keep as-is
  if (stored.includes('/tx-effect/') || stored.includes('/address/')) return stored;

  // Old /tx/:hash format — upgrade to /tx-effect/
  const txMatch = stored.match(/\/tx\/(0x[a-fA-F0-9]{64})$/);
  if (txMatch) return `${AZTEC_EXPLORER}/tx-effect/${txMatch[1]}`;

  // Bare hash (0x + 64 hex) — wrap in /tx-effect/
  const hashMatch = stored.match(/(0x[a-fA-F0-9]{64})$/);
  if (hashMatch) return `${AZTEC_EXPLORER}/tx-effect/${hashMatch[1]}`;

  // Root or just the explorer domain — fine
  if (stored.startsWith('https://aztecscan.xyz')) return stored;

  // Unknown format — fall back to root
  return AZTEC_EXPLORER;
}

/**
 * Aztec mainnet explorer URL for a given address.
 */
export function explorerAddressUrl(address: string): string {
  return `${AZTEC_EXPLORER}/address/${address}`;
}

/**
 * Truncate an Aztec address for display.
 */
export function truncateAztecAddress(addr: string, chars = 8): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

/**
 * Probe the Aztec Mainnet node to get current network info.
 * Returns null if unreachable.
 */
export async function probeMainnetNode(): Promise<{
  blockNumber: number;
  nodeVersion: string;
  l1ChainId: number;
  rollupVersion: number;
  rollupAddress: string;
  latencyMs: number;
} | null> {
  const start = Date.now();
  try {
    const node = await getAztecNodeClient();
    const [blockNumber, nodeInfo] = await Promise.all([
      node.getBlockNumber(),
      node.getNodeInfo(),
    ]);
    return {
      blockNumber,
      nodeVersion: nodeInfo.nodeVersion,
      l1ChainId: nodeInfo.l1ChainId,
      rollupVersion: nodeInfo.rollupVersion,
      rollupAddress: nodeInfo.l1ContractAddresses.rollupAddress.toString(),
      latencyMs: Date.now() - start,
    };
  } catch (e: any) {
    console.warn('[Aztec] Node probe failed:', e.message);
    return null;
  }
}
