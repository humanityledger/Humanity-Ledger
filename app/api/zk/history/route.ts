import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/zk/history — Query shielded transaction history from Aztec PXE.
 * Falls back to simulated schema when node is unreachable.
 */

const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL ?? 'https://api.aztec.network/aztec-mainnet/api/v1';
const AZTEC_EXPLORER = 'https://aztecscan.xyz';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const address = searchParams.get('address');
  const limit   = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const page    = parseInt(searchParams.get('page') || '0');
  const token   = searchParams.get('token');  // optional filter
  const status  = searchParams.get('status'); // optional filter

  if (!address) {
    return NextResponse.json({ error: 'address parameter required' }, { status: 400 });
  }

  // Attempt real Aztec PXE history
  try {
    const resp = await fetch(
      `${AZTEC_NODE_URL}/pxe/get-notes?owner=${encodeURIComponent(address)}&limit=${limit}&page=${page}`,
      { headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(4000) }
    );

    if (resp.ok) {
      const data = await resp.json();
      return NextResponse.json({
        source:       'aztec-node',
        address:      address.toLowerCase(),
        transactions: data?.notes ?? [],
        total:        data?.total ?? 0,
        page,
        limit,
        aztecNode:    AZTEC_NODE_URL,
      });
    }
  } catch {}

  // Return structured empty response with full schema documentation
  return NextResponse.json({
    source:  'offline',
    address: address.toLowerCase(),
    transactions: [],
    filters: { token: token ?? null, status: status ?? null, limit, page },
    schema: {
      txHash:          'string — 0x-prefixed 64-char hex',
      status:          'shielded | settled | failed',
      direction:       'sent | received',
      amount:          'string — numeric with locale formatting',
      token:           'DAI | USDC | ETH',
      recipientTag:    'string — zk:<handle>',
      senderTag:       'string — zk:<handle>',
      timestamp:       'number — Unix milliseconds',
      confirmations:   'number',
      blockHeight:     'number',
      privacyScore:    'number 0–100',
      anonymitySetSize:'number — wallets in anonymity set',
      nullifierHash:   'string — 0x-prefixed 32-char hex',
      aztecExplorerUrl:`string — ${AZTEC_EXPLORER}/tx-effect/<hash>`,
      fee:             'string — e.g. "$0.02"',
      memo:            'string | undefined — encrypted confidential note',
    },
    aztecNode: AZTEC_NODE_URL,
    note: 'Connect to Aztec mainnet PXE for live transaction history',
    docsUrl: 'https://docs.aztec.network/developers/contracts/references/client_library',
  });
}
