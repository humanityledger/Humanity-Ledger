import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';

/**
 * /api/zk/identity — Register and resolve zk.money identity records.
 * Backed by in-memory store (Redis in production).
 */

interface IdentityRecord {
  address: string;
  zkHandle: string;
  aztecAddress: string;
  ensName?: string;
  verifiedAt: number;
  reputationScore: number;
  totalTransactions: number;
}

// In-memory registry (use Redis / Postgres in production)
const registry = new Map<string, IdentityRecord>();
// Handle → address reverse index
const handleIndex = new Map<string, string>();

function deriveAztecAddress(address: string): string {
  const clean = address.toLowerCase().replace('0x', '');
  return `0xaztec${clean.slice(0, 8)}${clean.slice(-6)}`;
}

// GET /api/zk/identity?address=0x... | ?handle=zk:name
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const address = searchParams.get('address');
  const handle  = searchParams.get('handle');

  if (address) {
    const record = registry.get(address.toLowerCase());
    if (record) return NextResponse.json({ found: true, ...record });
    return NextResponse.json({ found: false, address: address.toLowerCase() });
  }

  if (handle) {
    const addr = handleIndex.get(handle.toLowerCase());
    if (addr) {
      const record = registry.get(addr);
      if (record) return NextResponse.json({ found: true, ...record });
    }
    return NextResponse.json({ found: false, handle });
  }

  // List all (paginated, max 50)
  const page  = parseInt(searchParams.get('page') || '0');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const all   = Array.from(registry.values());
  const slice = all.slice(page * limit, (page + 1) * limit);

  return NextResponse.json({
    records: slice,
    total: all.length,
    page,
    limit,
  });
}

// POST /api/zk/identity — Register new identity
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { address, zkHandle, ensName, displayName } = body;
  // The wallet used to be taken from the body as-is: anyone signed in could
  // change this for any other wallet. It must be the caller's own.
  const __auth = await requireWallet(req);
  if (__auth.errorResponse) return __auth.errorResponse;
  if (typeof address !== 'string' || address.toLowerCase() !== __auth.walletAddress) {
    return NextResponse.json({ error: 'You can only change this for your own wallet.' }, { status: 403 });
  }

  if (!address || !zkHandle) {
    return NextResponse.json({ error: 'address and zkHandle are required' }, { status: 400 });
  }

  // Validate handle format
  if (!/^zk:[a-z0-9_.-]{3,32}$/.test(zkHandle)) {
    return NextResponse.json({
      error: 'Invalid handle format. Must be zk:<handle> (3-32 lowercase alphanumeric/._-)',
    }, { status: 400 });
  }

  // Check handle uniqueness
  const existingOwner = handleIndex.get(zkHandle.toLowerCase());
  if (existingOwner && existingOwner !== address.toLowerCase()) {
    return NextResponse.json({ error: 'Handle already registered by another address' }, { status: 409 });
  }

  const addr = address.toLowerCase();
  const record: IdentityRecord = {
    address:    addr,
    zkHandle:   zkHandle.toLowerCase(),
    aztecAddress: deriveAztecAddress(addr),
    ensName,
    verifiedAt: Date.now(),
    reputationScore: 50,
    totalTransactions: registry.get(addr)?.totalTransactions || 0,
  };

  registry.set(addr, record);
  handleIndex.set(zkHandle.toLowerCase(), addr);

  return NextResponse.json({ success: true, ...record });
}

// PATCH /api/zk/identity — Update identity fields
export async function PATCH(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { address, ...updates } = body;
  // The wallet used to be taken from the body as-is: anyone signed in could
  // change this for any other wallet. It must be the caller's own.
  const __auth = await requireWallet(req);
  if (__auth.errorResponse) return __auth.errorResponse;
  if (typeof address !== 'string' || address.toLowerCase() !== __auth.walletAddress) {
    return NextResponse.json({ error: 'You can only change this for your own wallet.' }, { status: 403 });
  }
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const existing = registry.get(address.toLowerCase());
  if (!existing) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  const updated = { ...existing, ...updates, address: existing.address, aztecAddress: existing.aztecAddress };
  registry.set(address.toLowerCase(), updated);

  return NextResponse.json({ success: true, ...updated });
}
