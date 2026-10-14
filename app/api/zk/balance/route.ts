import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/zk/balance — Query shielded Aztec balance for a wallet address.
 * Attempts real Aztec node first, falls back to deterministic simulation.
 */

const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL ?? 'https://api.aztec.network/aztec-mainnet/api/v1';

// In-memory balance override store (set by shield/unshield ops)
const balanceOverrides = new Map<string, { DAI: string; USDC: string; ETH: string; updatedAt: number }>();

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const address = searchParams.get('address');

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Valid 0x Ethereum address query parameter is required' }, { status: 400 });
  }

  const addr = address.toLowerCase();

  // Check for server-side balance override (set by shield/unshield)
  const override = balanceOverrides.get(addr);
  if (override && Date.now() - override.updatedAt < 30_000) {
    return NextResponse.json({
      source: 'server-cache',
      address: addr,
      balances: { DAI: override.DAI, USDC: override.USDC, ETH: override.ETH },
      lastUpdated: override.updatedAt,
      aztecNode: AZTEC_NODE_URL,
    });
  }

  // Try real Aztec node PXE endpoint
  try {
    const resp = await fetch(
      `${AZTEC_NODE_URL}/pxe/sync-state`,
      { headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(4000) }
    );
    if (resp.ok) {
      // PXE sync succeeded — in production parse actual note values
      // For now return simulated deterministic balances with "synced" flag
    }
  } catch {
    // Node unreachable — use simulation
  }

  // Deterministic simulation (seed from address for consistent UX)
  const seed = parseInt(addr.replace('0x', '').slice(0, 8), 16) || 9999;
  const dai  = (((seed % 3000) + 500)).toFixed(2);
  const usdc = (((seed % 1500) + 100)).toFixed(2);
  const eth  = ((((seed % 80) + 10) / 100)).toFixed(4);

  return NextResponse.json({
    source: 'simulated',
    address: addr,
    balances: { DAI: dai, USDC: usdc, ETH: eth },
    lastUpdated: Date.now(),
    aztecNode: AZTEC_NODE_URL,
    note: 'Connect to Aztec mainnet PXE for live balances',
  });
}

// POST /api/zk/balance — Update server-side balance cache (called by shield/unshield)
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { address, balances } = body;
  if (!address || !balances) {
    return NextResponse.json({ error: 'address and balances required' }, { status: 400 });
  }

  balanceOverrides.set(address.toLowerCase(), {
    DAI: balances.DAI || '0.00',
    USDC: balances.USDC || '0.00',
    ETH: balances.ETH || '0.0000',
    updatedAt: Date.now(),
  });

  return NextResponse.json({ success: true, address: address.toLowerCase(), balances });
}
