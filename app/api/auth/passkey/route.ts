import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'passkeys_supported',
    features: ['webauthn', 'platform_authenticator', 'resident_key'],
    rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
  });
}
