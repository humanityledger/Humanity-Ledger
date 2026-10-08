import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.toString();
  const apiKey = process.env.ETHERSCAN_API_KEY || '';
  if (!apiKey) return NextResponse.json({ error: 'Etherscan API key not configured' }, { status: 500 });
  try {
    const res = await fetch(`https://api.etherscan.io/api?${query}&apikey=${apiKey}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
