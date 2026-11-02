import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    return NextResponse.json({ error: '410 Gone: Server-side transaction signing is decommissioned. All transactions must be signed locally via WebCrypto/Enclave on the client.' }, { status: 410 });
}
