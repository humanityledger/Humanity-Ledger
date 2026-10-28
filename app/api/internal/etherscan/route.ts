import { NextResponse } from 'next/server';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/internal/etherscan — the transaction list for one address.
 *
 * Used by the portfolio's transaction history. It used to forward ANY query
 * string to Etherscan with the server's API key appended, so every signed-in
 * account could spend that key on whatever it liked. Now only the account
 * transaction list is forwarded, with validated parameters, and per caller
 * rate limits.
 */
const ACTIONS = new Set(['txlist', 'tokentx', 'txlistinternal']);
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const INT_RE = /^\d{1,10}$/;

export async function GET(req: Request) {
  const caller = await getVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await checkRateLimit(caller, { max: 60, windowSec: 60, prefix: 'rl:etherscan' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const apiKey = process.env.ETHERSCAN_API_KEY || '';
  if (!apiKey) return NextResponse.json({ error: 'Etherscan API key not configured' }, { status: 503 });

  const sp = new URL(req.url).searchParams;
  const action = sp.get('action') ?? 'txlist';
  const address = sp.get('address') ?? '';
  if (sp.get('module') !== 'account' || !ACTIONS.has(action) || !ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: 'Unsupported query' }, { status: 400 });
  }
  const num = (k: string, d: string, max: number) => {
    const v = sp.get(k) ?? d;
    return INT_RE.test(v) ? String(Math.min(Number(v), max)) : d;
  };
  const q = new URLSearchParams({
    module: 'account',
    action,
    address,
    startblock: num('startblock', '0', 999_999_999),
    endblock: num('endblock', '99999999', 999_999_999),
    page: num('page', '1', 100),
    offset: num('offset', '25', 100),
    sort: sp.get('sort') === 'asc' ? 'asc' : 'desc',
    apikey: apiKey,
  });

  try {
    const res = await fetch(`https://api.etherscan.io/api?${q}`, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}
