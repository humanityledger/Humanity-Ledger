import { NextRequest, NextResponse } from 'next/server';
import { walletAnalyticsService } from '@/lib/wallet/WalletAnalyticsService';
export const dynamic = 'force-dynamic';


interface NexusNode {
  id: string;
  label: string;
  type: 'ledger' | 'exchange' | 'unknown' | 'miner' | 'dapp';
  btcFlow: number;
  usdValue?: number;
  isCenter: boolean;
}

interface NexusLink {
  source: string;
  target: string;
  value: number; // BTC or Normalized Value
  txid: string;
  time: number;
}

const KNOWN_LABELS: Record<string, string> = {
  '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo': 'Binance Hot',
  '3E5oK3MVNgbmkKCjMCnBJcqhRHWm3gJxrQ': 'Coinbase Custody',
  'bc1qazcm763858nkj2dj986etajv6wquslv8uxjjt': 'Binance Cold',
  '1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s': 'Binance Exchange',
  '3HjQLF9uVsZqXBQjMbMNwp3GS3eUPXfRqG': 'Kraken',
};

const EXCHANGE_ADDRESSES = new Set(Object.keys(KNOWN_LABELS));

function classifyAddress(addr: string): 'exchange' | 'miner' | 'ledger' | 'unknown' | 'dapp' {
  if (EXCHANGE_ADDRESSES.has(addr)) return 'exchange';
  if (addr.startsWith('0x')) {
      // Basic heuristic for EVM routers/contracts will be handled by detail labels later
      return 'unknown';
  }
  if (addr.startsWith('1') && addr.length === 34) return 'ledger';
  return 'unknown';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  const isEVM = /^0x[a-fA-F0-9]{40}$/.test(address);

  try {
    if (isEVM) {
      console.log(`[EntityNexus] Building EVM graph for ${address}`);
      const intel = await walletAnalyticsService.getFullAnalytics(address, false, true);
      
      const nodes: NexusNode[] = [];
      const links: NexusLink[] = [];

      // Center Node
      nodes.push({
        id: address,
        label: intel.entityInfo?.name || `${address.slice(0, 6)}...${address.slice(-4)}`,
        type: intel.entityInfo?.type === 'EXCHANGE' ? 'exchange' : 'ledger',
        btcFlow: 0,
        usdValue: intel.totalValue,
        isCenter: true
      });

      // Counterparty Nodes & Links
      (intel.topCounterparties || []).forEach(cp => {
          nodes.push({
              id: cp.address,
              label: cp.label || `${cp.address.slice(0, 6)}...${cp.address.slice(-4)}`,
              type: cp.label ? 'exchange' : 'unknown',
              btcFlow: 0,
              usdValue: cp.totalVolume,
              isCenter: false
          });

          links.push({
              source: address,
              target: cp.address,
              value: cp.totalVolume,
              txid: 'N/A',
              time: Date.now()
          });
      });

      return NextResponse.json({
          nodes: nodes.slice(0, 30),
          links: links.slice(0, 50),
          centerAddress: address,
          totalBtcFlow: 0,
          totalUsdFlow: intel.totalFlow30d,
          txCount: intel.txCount
      });
    }

    // --- LEGACY BITCOIN PATH ---
    const res = await fetch(`https://blockchain.info/rawaddr/${address}?limit=10`, {
      headers: { 'User-Agent': 'HumanityLedger/1.0' },
      next: { revalidate: 60 }
    });

    if (!res.ok) throw new Error(`blockchain.info error: ${res.status}`);
    const data = await res.json();

    const nodes: Map<string, NexusNode> = new Map();
    const links: NexusLink[] = [];

    // Add center node
    nodes.set(address, {
      id: address,
      label: KNOWN_LABELS[address] || `${address.slice(0, 6)}...${address.slice(-4)}`,
      type: classifyAddress(address),
      btcFlow: data.final_balance / 1e8,
      isCenter: true,
    });

    // Process transactions to build graph
    for (const tx of (data.txs || []).slice(0, 10)) {
      // Process outputs (where BTC went)
      for (const out of (tx.out || [])) {
        const targetAddr = out.addr;
        if (!targetAddr || targetAddr === address) continue;

        const btcValue = out.value / 1e8;
        if (btcValue < 0.001) continue; // Skip dust

        if (!nodes.has(targetAddr)) {
          nodes.set(targetAddr, {
            id: targetAddr,
            label: KNOWN_LABELS[targetAddr] || `${targetAddr.slice(0, 6)}...${targetAddr.slice(-4)}`,
            type: classifyAddress(targetAddr),
            btcFlow: btcValue,
            isCenter: false,
          });
        } else {
          const existing = nodes.get(targetAddr)!;
          existing.btcFlow += btcValue;
        }

        links.push({
          source: address,
          target: targetAddr,
          value: btcValue,
          txid: tx.hash,
          time: tx.time * 1000,
        });
      }

      // Process inputs (where BTC came from)
      for (const inp of (tx.inputs || []).slice(0, 10)) {
        const sourceAddr = inp.prev_out?.addr;
        if (!sourceAddr || sourceAddr === address) continue;

        const btcValue = (inp.prev_out?.value || 0) / 1e8;
        if (btcValue < 0.001) continue;

        if (!nodes.has(sourceAddr)) {
          nodes.set(sourceAddr, {
            id: sourceAddr,
            label: KNOWN_LABELS[sourceAddr] || `${sourceAddr.slice(0, 6)}...${sourceAddr.slice(-4)}`,
            type: classifyAddress(sourceAddr),
            btcFlow: btcValue,
            isCenter: false,
          });
        }

        links.push({
          source: sourceAddr,
          target: address,
          value: btcValue,
          txid: tx.hash,
          time: tx.time * 1000,
        });
      }
    }

    return NextResponse.json({
      nodes: Array.from(nodes.values()).slice(0, 30),
      links: links.slice(0, 50),
      centerAddress: address,
      totalBtcFlow: data.total_received / 1e8,
      txCount: data.n_tx,
    });

  } catch (err) {
    console.error('[EntityNexus]', err);
    return NextResponse.json({ error: 'Failed to build entity graph', nodes: [], links: [] }, { status: 200 });
  }
}


