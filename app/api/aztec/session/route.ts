import { NextRequest, NextResponse } from 'next/server';
import { verifyTypedData, type Address } from 'viem';
import { EIP712_STATEMENT, AZTEC_DOMAIN, deriveAztecSecretKey } from '@/lib/aztec/keys/derive';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const { signature, evmAddress } = await req.json();
    if (!signature || !evmAddress) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const valid = await verifyTypedData({
      address: evmAddress as Address,
      domain: AZTEC_DOMAIN,
      types: EIP712_STATEMENT,
      primaryType: 'DeriveAccount',
      message: { action: 'Connect to Humanity Ledger', warning: 'Do not sign on unknown sites!', nonce: 1n },
      signature,
    });

    if (!valid) return NextResponse.json({ error: 'Invalid EIP-712 signature' }, { status: 401 });

    // Derive the sovereign secret key (never stored in db/logs)
    const secretKeyHex = deriveAztecSecretKey(signature);

    // In real env, we dispatch this key to the isolated PXE sidecar here and get a PXE session token.
    // For this frontend flow, we issue a session JWT that represents this binding.
    const pxeToken = jwt.sign({ evmAddress, pxeActive: true }, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });

    return NextResponse.json({ success: true, pxeToken });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

