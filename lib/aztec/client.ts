// @ts-nocheck


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


export function deriveSecretKeyFromEvm(evmAddress: string): string {
  throw new Error('CUSTODIAL_DERIVE_RETIRED');
}

