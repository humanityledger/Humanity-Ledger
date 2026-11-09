import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

// Known historical "sleeping giant" BTC wallets for demonstration + real monitoring
// These are famous wallets well documented on-chain
const KNOWN_DORMANT_WALLETS = [
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divfna', // Genesis block (Satoshi)
  '12cbQLTFMXRnSzktFkuoG3eHoMeFtpTu3S', // Ancient BTC wallet, 2009-era
  '1LdRcdxfbSnmCYYNdeYpUnztiLst6Si81b', // Large early miner
  '1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF', // Silkroad 1 seized wallet
  '1Dh7cLJHpkDFMX9SHmKBnNJkCCGPMsKSAt', // Top 10 richest BTC wallet 
];

const SATOSHI_BIRTH_DATE = new Date('2009-01-03').getTime();
const YEARS_8_MS = 8 * 365.25 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const mode = searchParams.get('mode') || 'single';

  // Batch mode: scan all known dormant wallets
  if (mode === 'batch') {
    const results = [];
    for (const addr of KNOWN_DORMANT_WALLETS) {
      try {
        const data = await analyzeAddress(addr);
        if (data) results.push(data);
      } catch { /* continue */ }
    }
    return NextResponse.json({ results, source: 'known_historical_wallets' });
  }

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const data = await analyzeAddress(address);
    if (!data) return NextResponse.json({ error: 'Analysis failed' }, { status: 200 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[SatoshiDetector]', err);
    return NextResponse.json({ error: 'Failed to analyze address' }, { status: 200 });
  }
}

async function analyzeAddress(address: string) {
  const res = await fetch(`https://blockchain.info/rawaddr/${address}?limit=5`, {
    headers: { 'User-Agent': 'HumanityLedger/1.0' },
    signal: AbortSignal.timeout(5000),
    next: { revalidate: 300 }
  });

  if (!res.ok) return null;
  const data = await res.json();

  const now = Date.now();
  const firstTx = data.txs?.length > 0 ? data.txs[data.txs.length - 1] : null;
  const lastTx = data.txs?.length > 0 ? data.txs[0] : null;
  const firstTxTime = firstTx?.time ? firstTx.time * 1000 : now;
  const lastTxTime = lastTx?.time ? lastTx.time * 1000 : now;

  const inactiveSince = now - lastTxTime;
  const isSatoshiEra = firstTxTime <= (SATOSHI_BIRTH_DATE + YEARS_8_MS);
  const isSleepingGiant = inactiveSince >= YEARS_8_MS && data.final_balance > 0;

  const btcBalance = data.final_balance / 1e8;
  const yearsInactive = inactiveSince / (365.25 * 24 * 60 * 60 * 1000);

  return {
    address,
    btcBalance,
    totalReceived: data.total_received / 1e8,
    totalSent: data.total_sent / 1e8,
    txCount: data.n_tx,
    firstSeenDate: new Date(firstTxTime).toISOString(),
    lastActiveDate: new Date(lastTxTime).toISOString(),
    yearsInactive: parseFloat(yearsInactive.toFixed(1)),
    isSatoshiEra,
    isSleepingGiant,
    alertLevel: isSleepingGiant && isSatoshiEra ? 'CRITICAL'
              : isSleepingGiant ? 'HIGH'
              : btcBalance > 100 ? 'WATCH'
              : 'NORMAL',
  };
}


