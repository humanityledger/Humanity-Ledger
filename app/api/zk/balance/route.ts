import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/**
 * /api/zk/balance — Query the caller's own shielded Aztec balance.
 *
 * H4 (full fix): the caller's address comes from the authenticated session and
 * from nowhere else. A previous revision allowed `?address=` as a fallback when
 * no session was present, which let any unauthenticated client read the shielded
 * balance of an arbitrary address — the exact confidentiality property this
 * endpoint exists to protect. There is no legitimate caller for another user's
 * shielded balance, so there is no fallback: no session means 401.
 */

const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL ?? 'https://api.aztec.network/aztec-mainnet/api/v1';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// In-memory balance override store (set by shield/unshield ops).
// NOTE: per-process and non-durable — see I-block ("cero simulaciones").
const balanceOverrides = new Map<string, { DAI: string; USDC: string; ETH: string; updatedAt: number }>();

type Source = 'server-cache' | 'aztec-pxe' | 'simulated';

/**
 * Resolve the caller's shielded address from the session alone.
 * Returns a NextResponse to short-circuit on failure, or the lowercased address.
 */
async function resolveCallerAddress(): Promise<{ error: NextResponse } | { address: string }> {
  const session = await getSession();
  const userId = session?.userId;

  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required.', code: 'NO_SESSION' },
        { status: 401 },
      ),
    };
  }

  // Email-backed sessions carry a UUID rather than a wallet address. Such a
  // session has no shielded balance to report, and silently coercing it would
  // produce a lookup against a key that can never match.
  if (!ADDRESS_RE.test(userId)) {
    return {
      error: NextResponse.json(
        {
          error: 'This session is not bound to a wallet address.',
          code: 'NO_WALLET_BOUND',
          hint: 'Link a wallet to this account before querying shielded balances.',
        },
        { status: 409 },
      ),
    };
  }

  return { address: userId.toLowerCase() };
}

function balancePayload(addr: string, source: Source) {
  const current = balanceOverrides.get(addr);
  return NextResponse.json(
    {
      source: current ? 'server-cache' : source,
      address: addr,
      balances: {
        DAI: current?.DAI ?? '0.00',
        USDC: current?.USDC ?? '0.00',
        ETH: current?.ETH ?? '0.000',
      },
      lastUpdated: current?.updatedAt ?? Date.now(),
      aztecNode: AZTEC_NODE_URL,
      // Honest about provenance: this value is only "shielded" once it comes
      // from a real PXE. Claiming authenticity for a simulated figure is what
      // the zero-mock pillar exists to stop.
      simulated: source === 'simulated',
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, private' } },
  );
}

export async function GET(_req: NextRequest) {
  const resolved = await resolveCallerAddress();
  if ('error' in resolved) return resolved.error;
  const addr = resolved.address;

  if (balanceOverrides.has(addr)) {
    return balancePayload(addr, 'server-cache');
  }

  // Try the real Aztec node PXE endpoint.
  try {
    const resp = await fetch(`${AZTEC_NODE_URL}/pxe/sync-state`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (resp.ok) {
      // TODO(H-block): parse real note values from the PXE response.
      // Until that lands, the figures below are simulated and labelled as such.
      return balancePayload(addr, 'simulated');
    }
  } catch {
    // Node unreachable — fall through to the simulated figure.
  }

  return balancePayload(addr, 'simulated');
}

export async function POST(_req: NextRequest) {
  const resolved = await resolveCallerAddress();
  if ('error' in resolved) return resolved.error;
  return balancePayload(resolved.address, 'simulated');
}
