/**
 * Aztec node health check with fallback RPC.
 * Used by /api/health and monitoring.
 */

const PRIMARY_NODE = process.env.AZTEC_NODE_URL ?? 'http://localhost:8080';
const FALLBACK_NODE = process.env.AZTEC_NODE_FALLBACK_URL ?? '';

export interface NodeStatus {
  healthy: boolean;
  url: string;
  blockNumber?: number;
  latencyMs?: number;
  error?: string;
}

async function checkNode(url: string, timeoutMs = 5000): Promise<NodeStatus> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(`${url}/node-info`, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) {
      return { healthy: false, url, error: `HTTP ${res.status}`, latencyMs: Date.now() - start };
    }
    
    const data = await res.json();
    return {
      healthy: true,
      url,
      blockNumber: data.blockNumber ?? data.chainId,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      healthy: false,
      url,
      error: err.name === 'AbortError' ? 'timeout' : err.message,
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Returns the best available Aztec node URL.
 * Falls back to secondary if primary is unhealthy.
 */
export async function getHealthyNodeUrl(): Promise<string> {
  const primary = await checkNode(PRIMARY_NODE);
  if (primary.healthy) return PRIMARY_NODE;

  if (FALLBACK_NODE) {
    const fallback = await checkNode(FALLBACK_NODE);
    if (fallback.healthy) return FALLBACK_NODE;
  }

  throw new Error(`Aztec node unavailable. Primary: ${primary.error}`);
}

/**
 * Full node health status for monitoring.
 */
export async function getAztecNodeStatus(): Promise<NodeStatus> {
  const primary = await checkNode(PRIMARY_NODE);
  if (primary.healthy) return primary;

  if (FALLBACK_NODE) {
    const fallback = await checkNode(FALLBACK_NODE);
    if (fallback.healthy) return { ...fallback, error: `Primary failed: ${primary.error}` };
  }

  return primary;
}
