import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Built-in bots registry
const BUILTIN_BOTS = [
  {
    id: 'price-bot',
    name: 'PriceBot',
    address: null, // No wallet needed for built-in bots
    description: 'Real-time crypto prices. Send /price ETH',
    commands: ['/price <token>', '/mc <token>', '/gas'],
    type: 'builtin' as const,
  },
  {
    id: 'ens-bot',
    name: 'ENS Lookup',
    address: null,
    description: 'Resolve ENS names to addresses',
    commands: ['/ens <name>', '/addr <name>'],
    type: 'builtin' as const,
  }
];

export async function GET() {
  return NextResponse.json({ bots: BUILTIN_BOTS });
}
