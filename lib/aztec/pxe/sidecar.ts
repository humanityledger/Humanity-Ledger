import { createPXEClient, type PXE } from '@aztec/aztec.js';

const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL || 'https://v5.testnet.rpc.aztec-labs.com';

/**
 * Initializes a connection to the dedicated PXE Sidecar.
 * In v5, PXE runs entirely separated from the client to isolate keys.
 * A unique PXE instance is spawned per user session in the real environment.
 */
export function getIsolatedPXE(sessionJwt: string): PXE {
  if (!sessionJwt) throw new Error('Cannot connect to PXE sidecar without valid Session JWT');
  // In a real deployed environment, this connects to the secure sidecar container
  // e.g., https://pxe.sidecar.humanidfi.com/?token=...
  // For this sandbox, we connect to the node's public PXE (read-only / test mode)
  return createPXEClient(AZTEC_NODE_URL);
}

