import { NextResponse } from 'next/server';
import { deriveAztecAddress } from '@/lib/aztec/zk-identity';

export const dynamic = 'force-dynamic';

/**
 * POST /api/aztec/derive-address
 *
 * Derives a deterministic Aztec-format address from a seed phrase or EVM address.
 * Accepts either { seed: string } or { evmAddress: string } for backwards compatibility.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Accept both { seed } and { evmAddress } — evmAddress is used by Ledger Chat
    const raw = body.seed || body.evmAddress || body.address || '';

    if (!raw || typeof raw !== 'string' || raw.trim().length < 3) {
      return NextResponse.json(
        { error: 'seed/evmAddress must be a non-empty string of at least 3 characters' },
        { status: 400 }
      );
    }

    const normalized = raw.trim().toLowerCase();
    const aztecAddress = deriveAztecAddress(normalized);

    return NextResponse.json({
      success: true,
      aztecAddress,
      derivationMethod: 'SHA-256 + Keccak256 (aztec-schnorr domain separation)',
      network: 'aztec-mainnet',
    });

  } catch (err: any) {
    console.error('[Aztec Derive Address Error]', err.message);
    return NextResponse.json(
      { error: 'Derivation failed' },
      { status: 500 }
    );
  }
}

