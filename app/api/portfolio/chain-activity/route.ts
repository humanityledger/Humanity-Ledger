import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
};

export async function GET(req: NextRequest) {
  // [SECURITY HARDENING] Require session and enforce that the queried address
  // matches the authenticated user. Previously fully open — any anonymous caller
  // could pull full transaction history and balances for any wallet on the platform.
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const address = searchParams.get('address');
  const chain   = searchParams.get('chain') ?? 'ethereum';
  const type    = searchParams.get('type') ?? 'txlist';

  if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });

  // Enforce that users can only query their own address
  if (address.toLowerCase() !== session.userId.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden: You may only query your own wallet activity.' }, { status: 403 });
  }

  if (!ETHERSCAN_KEY) return NextResponse.json({ error: 'Chain data service not configured' }, { status: 503 });

  const chainId = chain === 'humanity' ? 8453 : (CHAIN_IDS[chain] ?? 1);
  const base_url = `https://api.etherscan.io/v2/api?chainid=${chainId}&apikey=${ETHERSCAN_KEY}`;

  let url = '';
  if (chain === 'humanity') {
      const qdContract = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || '0x';
      if (type === 'balance') {
          url = `${base_url}&module=account&action=tokenbalance&contractaddress=${qdContract}&address=${address}&tag=latest`;
      } else {
          url = `${base_url}&module=account&action=tokentx&contractaddress=${qdContract}&address=${address}&page=1&offset=50&sort=desc`;
      }
  } else {
      if (type === 'balance') {
        url = `${base_url}&module=account&action=balance&address=${address}&tag=latest`;
      } else {
        url = `${base_url}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=15&sort=desc`;
      }
  }

  try {
    const res = await fetch(url, { next: { revalidate: 30 } });
    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 502 });
  }
}
