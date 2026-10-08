import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { network = 'eth' } = body;
    
    const rpcUrl = network === 'polygon'
      ? process.env.ALCHEMY_POLY_RPC_URL
      : process.env.ALCHEMY_RPC_URL;
      
    if (!rpcUrl) return NextResponse.json({ error: 'RPC not configured' }, { status: 500 });
    
    const { network: _n, ...rpcBody } = body;
    
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcBody),
    });
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
