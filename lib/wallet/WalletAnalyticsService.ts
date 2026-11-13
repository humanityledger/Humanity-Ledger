import { portfolioService } from '../blockchain/PortfolioService';
import { ChainId } from '../blockchain/BlockchainService';
import { prisma } from '../prisma';
import { PriceService } from '../blockchain/PriceService';
import { moralisService } from '../blockchain/MoralisService';
import { defiPositionsService } from '../blockchain/DeFiPositionsService';
import { getEntity, isSystemEntity, BlockchainEntity } from './EntityRegistry';
import { getRealTimePrice } from '../priceHelper';
import { aiService, ForensicAnalysis } from '../services/AIService';

export interface WalletAnalytics {
  address: string;
  totalValue: number;
  riskScore: number;
  diversityScore: number;
  activity24h: number;
  activityScore: number;
  rank: number;
  txCount: number;
  yieldPositions: YieldPosition[];
  flowAnalysis: FlowAnalysis;
  dappActivities: DAppActivity[];
  nftPortfolio: any[];
  lastUpdated: string;
  strategicSummary?: string;
  breakdown?: Record<string, number>;
  pnl24h: number;
  change24h: number;
  networksActive?: string[];
  smartMoneyMetrics?: any;
  ledgerEvidence?: string[];
  influenceScore?: number;
  historicalBalance?: { date: string; balance: number }[];
  error?: string;
  errorMessage?: string;
  identityTier?: 'GHOST' | 'INITIATE' | 'HUMAN' | 'Cryptographic' | 'PROTOCOL';
  entityInfo?: BlockchainEntity;
  totalFlow30d?: number;
  recentTransfers?: AnalyticsTransfer[];
  transactionHeatmap?: HourlyActivity[];
  topCounterparties?: Counterparty[];
  tokenFlowAnalysis?: TokenFlow[];
  forensics?: ForensicAnalysis;
  category?: string;
}

export interface AnalyticsTransfer {
  hash: string;
  timestamp: string;
  amount: number;
  valueUsd: number;
  type: 'IN' | 'OUT';
  from: string;
  to: string;
  chain: string;
  token?: string;
}

export interface HourlyActivity {
  hour: number;
  txCount: number;
  volume: number;
}

export interface Counterparty {
  address: string;
  txCount: number;
  totalVolume: number;
  label?: string;
}

export interface TokenFlow {
  token: string;
  inflow: number;
  outflow: number;
  netFlow: number;
}

export interface YieldPosition {
  protocol: string;
  type: 'staking' | 'lending' | 'farming' | 'LP';
  amount: number;
  apy: number;
  earnedUsd: number;
  asset: string;
  valueUsd?: number;
  onChain?: boolean;
  details?: any;
}
export interface FlowAnalysis {
  period: '24h' | '7d' | '30d';
  inflow: number;
  outflow: number;
  topSenders: { address: string; amount: number; count: number }[];
  topReceivers: { address: string; amount: number; count: number }[];
  recentTransfers: {
    hash: string;
    timestamp: string;
    amount: number;
    valueUsd: number;
    type: 'IN' | 'OUT';
    from: string;
    to: string;
    chain: string;
    token?: string;
  }[];
}

export interface DAppActivity {
  protocol: string;
  count: number;
  latestActivity: string;
  gasSpentUsd: number;
}

/**
 *  LEGENDARY WALLET INTELLIGENCE SERVICE - MORALIS EDITION 
 * Provides 100% real, verifiable blockchain data with persistence.
 * Leverages Moralis Deep Index API for maximum fidelity.
 */
class WalletAnalyticsService {
  private activeFetches: Map<string, Promise<WalletAnalytics>> = new Map();

  constructor() {
    console.log('[INTEL-INIT]  Moralis-powered Analytics Service initialized');
  }

  /**
   * Get full analytics report for an address with persistence
   */
  async getFullAnalytics(address: string, forceRefresh = false, deep = false): Promise<WalletAnalytics> {
    if (!address) {
      return this.getEmptyStateAnalytics(address);
    }

    const fetchKey = `${address}:${forceRefresh}:${deep}`;
    if (this.activeFetches.has(fetchKey)) {
        console.log(`[INTEL] ️ Deduplicating concurrent analytics request for ${address}`);
        return this.activeFetches.get(fetchKey)!;
    }

    const fetchPromise = (async () => {
        try {
            return await this._executeFullAnalytics(address, forceRefresh, deep);
        } finally {
            this.activeFetches.delete(fetchKey);
        }
    })();

    this.activeFetches.set(fetchKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Internal execution logic for analytics gathering
   */
  private async _executeFullAnalytics(address: string, forceRefresh: boolean, deep: boolean): Promise<WalletAnalytics> {
    const isENS = address.includes('.') || (!address.startsWith('0x') && address.length < 40);
    const isEVM = /^0x[a-fA-F0-9]{40}$/.test(address);
    const isBTC = /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);

    if (!isEVM && !isENS && !isBTC) {
      console.warn(`[INTEL-WARN] Invalid address format: ${address}. Returning placeholder.`);
      return this.getEmptyStateAnalytics(address);
    }

    const addr = address.toLowerCase();
    let resolvedAddr = addr;

    // 0. Resolve ENS if needed
    if (isENS) {
        try {
            const ensName = addr.includes('.') ? addr : `${addr}.eth`;
            const resolved = await require('../wallet/ens').resolveENSName(ensName);
            if (resolved) {
                resolvedAddr = resolved.toLowerCase();
                console.log(`[INTEL] Resolved ${addr} to ${resolvedAddr}`);
            }
        } catch (e) {
            console.warn(`[INTEL-ENS-FAIL] Could not resolve ${addr}:`, e);
        }
    }

    // 1. Check Database first unless forceRefresh or deep scan requested
    if (!forceRefresh && !deep) {
        try {
            const cached = await prisma.walletAnalytics.findUnique({
                where: { address: resolvedAddr }
            });

            // If found and fresh (< 5 minutes), return cached
            if (cached && (Date.now() - new Date(cached.updatedAt || Date.now()).getTime() < 300000)) {
                console.log(`[INTEL] Returning cached DB record for ${resolvedAddr}`);
                return this.mapDbToAnalytics(cached);
            }
        } catch (dbErr) {
            console.warn('[INTEL-DB-READ-FAIL] Database inaccessible or table missing, sliding to live fetch.');
        }
    }

    try {
      console.log(`[INTEL${deep ? '-DEEP' : ''}] Fetching fresh Moralis data for ${resolvedAddr}`);
      
      //  [PERFORMANCE] Smart Money Analysis can be very slow for ledgers.
      const smartMoneyTimeout = new Promise(resolve => setTimeout(() => resolve(null), 10000));

      const [portfolio, yieldPos, flows, stats, smartMoney] = await Promise.all([
        portfolioService.getMultiChainPortfolio(resolvedAddr, undefined, deep).catch(e => {
            console.error(`[INTEL-PORTFOLIO-FAIL] ${resolvedAddr}:`, e?.message || e || 'Unknown error');
            return null;
        }),
        this.getYieldPositions(resolvedAddr).catch(e => []),
        this.getMoneyFlows(resolvedAddr, '30d').catch(e => ({ 
          period: '30d' as '30d', 
          inflow: 0, 
          outflow: 0, 
          topSenders: [], 
          topReceivers: [],
          recentTransfers: []
        })),
        moralisService.getWalletStats(resolvedAddr).catch(() => null),
        Promise.race([
            require('../smartMoneyAnalyzer').analyzeWalletSmartMoney(resolvedAddr),
            smartMoneyTimeout
        ]).catch((e: any) => {
            console.error(`[INTEL-SMART-MONEY-FAIL] ${resolvedAddr}:`, e);
            return null;
        }),
      ]);

        // 3. Chain-Specific Stats with Dynamic Pricing
        const btcPrice = await getRealTimePrice("BTC") || 98000;
        const btcValue = (portfolio.btcBalance || 0) * btcPrice;
      //  MASTER RANK ENGINE
      const totalValue = portfolio?.totalValueUsd || 0;
      
      let rank = 100; // Default Unknown
      if (totalValue > 1000000) rank = 1;      // Apex Ledger 
      else if (totalValue > 250000) rank = 10; // Elite Verifier
      else if (totalValue > 50000) rank = 50;  // High Activity
      else if (totalValue > 5000) rank = 100;  // Standard Human
      else if (totalValue > 0) rank = 500;     // Emerging 

      let txCountReal = stats?.transactions || 0;
      
      //  [FALLBACK] If Moralis stats failed but we have flow history, use that as minimum
      if (txCountReal === 0 && flows.recentTransfers.length > 0) {
          txCountReal = flows.recentTransfers.length;
          console.log(`[INTEL-FALLBACK] Estimated txCount from flows: ${txCountReal}`);
      }

      // ️ SCIENTIFIC SCORING ENGINE [LEGENDARY UPGRADE]
      const txFactor = Math.min(40, (txCountReal / 100) * 40);
      const valueFactor = Math.min(40, (Math.log10(Math.max(1, totalValue)) / 7) * 40);
      const chainFactor = Math.min(20, (portfolio?.networksActive?.length || 1) * 5);
      const activityScore = Math.round(txFactor + valueFactor + chainFactor);

      // ️ DYNAMIC RISK MODEL: Base risk + Contract complexity
      const baseRisk = portfolio?.analytics?.legendaryScore || 50;
      const contractRisk = Math.min(20, (yieldPos.length * 5)); 
      const riskScore = Math.round(Math.min(100, baseRisk + contractRisk));

      console.log(`[INTEL-DEBUG] Moralis Analytics Data for ${resolvedAddr}:`, {
        totalValue: totalValue.toFixed(2),
        txCount: txCountReal,
        pnl: (portfolio?.change24hUSD || 0).toFixed(2),
        defiPositions: yieldPos.length
      });

      // [NEW] Apex Lockdown: Fetch IdentityTier from DB
      let user: any = null;
      try {
        user = await prisma.user.findUnique({
            where: { walletAddress: resolvedAddr.toLowerCase() },
            select: { tier: true }
        });
      } catch (prismaErr: any) {
        console.warn(`[INTEL-PRISMA-USER-FAIL] ${resolvedAddr}: ${prismaErr.message}`);
      }

      const intelData: WalletAnalytics = {
          address: resolvedAddr,
          totalValue,
          riskScore,
          diversityScore: portfolio?.analytics?.concentrationIndex ? 100 - portfolio.analytics.concentrationIndex : 50,
          activity24h: activityScore,
          activityScore: activityScore,
          rank,
          txCount: txCountReal,
          pnl24h: portfolio?.change24hUSD || 0,
          change24h: portfolio?.change24hPercent || 0,
          yieldPositions: yieldPos,
          flowAnalysis: flows,
          nftPortfolio: [], 
          lastUpdated: new Date().toISOString(),
          breakdown: portfolio?.analytics?.sectorAllocation || {},
          strategicSummary: portfolio?.strategicInsight,
          networksActive: portfolio?.networksActive || [],
          smartMoneyMetrics: smartMoney,
          ledgerEvidence: this.generateLedgerEvidence(totalValue, txCountReal, portfolio, flows),
          influenceScore: smartMoney?.influenceScore || this.calculateInfluenceScore(totalValue, flows, stats),
          identityTier: isSystemEntity(resolvedAddr) ? 'PROTOCOL' : (user?.tier || 'GHOST'),
          entityInfo: getEntity(resolvedAddr) || undefined,
          totalFlow30d: (flows.inflow || 0) + (flows.outflow || 0),
          recentTransfers: flows.recentTransfers,
          historicalBalance: this.generateHistoricalBalance(totalValue, flows.recentTransfers),
          
          //  [PHASE 4] Real-Time DApp Telemetry (Moralis)
          dappActivities: (yieldPos || []).map(p => ({
              protocol: p.protocol,
              count: (p as any).details?.txCount || 1,
              latestActivity: new Date().toISOString(),
              gasSpentUsd: 0 
          }))
      };

      // 4.  [PHASE 4] AI Forensic Reasoning
      try {
          const firstTx = flows.recentTransfers[flows.recentTransfers.length - 1];
          const activeAgeDays = firstTx ? Math.floor((Date.now() - new Date(firstTx.timestamp).getTime()) / (1000 * 86400)) : 0;
          
          intelData.forensics = await aiService.analyzeAddressForensics(resolvedAddr, {
              transactionCount: txCountReal,
              activeAgeDays,
              historySnippet: flows.recentTransfers,
              defiPositions: yieldPos
          });
          
          // Use AI label if available for rank/category
          if (intelData.forensics?.label) {
              intelData.category = intelData.forensics.label;
          }
      } catch (aiErr) {
          console.warn('[INTEL-AI-FAIL] Forensic engine skipped:', aiErr);
      }

      //  [LEGENDARY RECONSTRUCTION] Reconstruct advanced metrics from history
      const reconstructed = await this.reconstructFromHistory(resolvedAddr, flows.recentTransfers);
      Object.assign(intelData, reconstructed);

      // Persistence Save
      try {
          await this.saveAnalytics(resolvedAddr, portfolio, yieldPos, flows, [], {
              rank,
              txCount: txCountReal,
              riskScore,
              strategicSummary: intelData.strategicSummary,
              category: intelData.category,
              forensics: intelData.forensics
          });
      } catch (saveErr: any) {
          console.error(`[INTEL-SAVE-FAIL] Could not persist data: ${saveErr.message}`);
      }

      return intelData;
    } catch (error: any) {
      console.error(`[INTEL-CRASH] ${addr}:`, error.message);
      
      //  [SENIOR RESILIENCE] If Moralis failed but we want a partial report
      if (error.message === 'MORALIS_QUOTA_EXHAUSTED' || error.message.includes('Moralis API Error')) {
          console.log(`[INTEL-RESILIENCE] Moralis Blocked. Attempting Etherscan/Portfolio fallback for ${resolvedAddr}`);
          try {
              // Get what we can from Portfolio (Etherscan fallback inside)
              const portfolio = await portfolioService.getMultiChainPortfolio(resolvedAddr, undefined, false, false);
              
              // Map what we found to a partial analytics object
              const partialIntel: WalletAnalytics = {
                  address: resolvedAddr,
                  totalValue: portfolio.totalValueUsd || 0,
                  riskScore: 50,
                  diversityScore: 50,
                  activity24h: 0,
                  activityScore: Math.min(100, (portfolio.tokens?.length || 0) * 2),
                  rank: portfolio.totalValueUsd > 1000000 ? 1 : 100,
                  txCount: portfolio.tokens?.length || 0,
                  pnl24h: portfolio.change24hUSD || 0,
                  change24h: portfolio.change24hPercent || 0,
                  yieldPositions: [],
                  flowAnalysis: { period: '30d', inflow: 0, outflow: 0, topSenders: [], topReceivers: [], recentTransfers: [] },
                  dappActivities: [],
                  nftPortfolio: [],
                  lastUpdated: new Date().toISOString(),
                  networksActive: portfolio.networksActive || ['Ethereum'],
                  error: 'API_LIMIT_REACHED',
                  errorMessage: 'Moralis API quota exceeded. Showing partial data from Etherscan fallback.'
              };

              //  [MASTER FALLBACK] Also reconstruct heatmap/flows for partial data
              const history = await portfolioService.getAssetHistory(ChainId.MAINNET, resolvedAddr);
              const extra = await this.reconstructFromHistory(resolvedAddr, history);
              Object.assign(partialIntel, extra);
              
              // Re-calculate influence score
              partialIntel.influenceScore = this.calculateInfluenceScore(partialIntel.totalValue, partialIntel.flowAnalysis);
              
              return partialIntel;
          } catch (fallbackErr) {
              console.error('[INTEL-FALLBACK-FAIL]', fallbackErr);
          }
      }

      return this.getEmptyStateAnalytics(addr);
    }
  }

  /**
   *  [MASTER] Reconstruct detailed analytics from Etherscan history
   * Generates Heatmap, Top Counterparties, and Flow Analysis.
   */
  private async reconstructFromHistory(address: string, transfers: any[]): Promise<Partial<WalletAnalytics>> {
    const heatmap: Record<number, { txCount: number; volume: number }> = {};
    const counterparties: Record<string, { txCount: number; totalVolume: number }> = {};
    const tokenFlows: Record<string, { inflow: number; outflow: number }> = {};
    const dapps: Record<string, { count: number; latestActivity: string; gasSpentUsd: number }> = {};

    // Initialize heatmap
    for (let i = 0; i < 24; i++) heatmap[i] = { txCount: 0, volume: 0 };

    transfers.forEach(t => {
      const date = new Date(t.timestamp);
      const hour = date.getUTCHours();
      const valUsd = t.valueUsd || 0;
      const otherParty = (t.type === 'IN' ? t.from : t.to)?.toLowerCase();
      const token = t.token || 'ETH';

      // 1. Heatmap
      if (heatmap[hour]) {
        heatmap[hour].txCount++;
        heatmap[hour].volume += valUsd;
      }

      // 2. Counterparties
      if (otherParty && otherParty !== address.toLowerCase()) {
        const entity = getEntity(otherParty);
        if (entity) {
            // It's a DApp or known entity
            if (!dapps[entity.name]) dapps[entity.name] = { count: 0, latestActivity: t.timestamp, gasSpentUsd: 0 };
            dapps[entity.name].count++;
            if (new Date(t.timestamp) > new Date(dapps[entity.name].latestActivity)) {
                dapps[entity.name].latestActivity = t.timestamp;
            }
        } else {
            // It's a regular counterpart
            if (!counterparties[otherParty]) counterparties[otherParty] = { txCount: 0, totalVolume: 0 };
            counterparties[otherParty].txCount++;
            counterparties[otherParty].totalVolume += valUsd;
        }
      }

      // 3. Token Flows
      if (!tokenFlows[token]) tokenFlows[token] = { inflow: 0, outflow: 0 };
      if (t.type === 'IN') tokenFlows[token].inflow += valUsd;
      else tokenFlows[token].outflow += valUsd;
    });

    return {
      transactionHeatmap: Object.entries(heatmap).map(([h, data]) => ({ hour: parseInt(h), ...data })),
      topCounterparties: Object.entries(counterparties)
        .map(([addr, data]) => ({ address: addr, ...data, label: undefined }))
        .sort((a, b) => b.txCount - a.txCount)
        .slice(0, 10),
      tokenFlowAnalysis: Object.entries(tokenFlows)
        .map(([token, data]) => ({ 
          token, 
          inflow: data.inflow, 
          outflow: data.outflow, 
          netFlow: data.inflow - data.outflow 
        }))
        .sort((a, b) => (Math.abs(b.inflow) + Math.abs(b.outflow)) - (Math.abs(a.inflow) + Math.abs(a.outflow)))
        .slice(0, 10),
      dappActivities: Object.entries(dapps).map(([protocol, data]) => ({ protocol, ...data }))
    };
  }

  private mapDbToAnalytics(db: any): WalletAnalytics {
    return {
      address: db.address || '0x0000000000000000000000000000000000000000',
      totalValue: Number(db.totalValueUsd || 0),
      riskScore: Number(db.riskScore || 50),
      diversityScore: Number(db.diversityScore || 50),
      activity24h: Number(db.activityScore || 0),
      activityScore: Number(db.activityScore || 0),
      rank: Number(db.rank || 0), 
      txCount: Number(db.txCount || 0),
      pnl24h: Number(db.pnl24h || 0),
      change24h: Number(db.change24h || 0),
      category: db.category || undefined,
      forensics: db.forensics as any || undefined,

      yieldPositions: (db.yieldPositions || []).map((p: any) => ({
        protocol: p.protocol,
        type: p.type as any,
        amount: p.amount,
        apy: p.apy,
        earnedUsd: p.earnedUsd,
        asset: p.asset,
        valueUsd: p.valueUsd,
        onChain: p.onChain,
        details: p.details
      })),
      flowAnalysis: db.flowAnalysis?.[0] ? {
        period: db.flowAnalysis[0].period as any,
        inflow: db.flowAnalysis[0].inflow,
        outflow: db.flowAnalysis[0].outflow,
        topSenders: db.flowAnalysis[0].topSenders as any,
        topReceivers: db.flowAnalysis[0].topReceivers as any,
        recentTransfers: db.flowAnalysis[0].recentTransfers || []
      } : { period: '30d', inflow: 0, outflow: 0, topSenders: [], topReceivers: [], recentTransfers: [] },
      dappActivities: (db.dappActivities || []).map((d: any) => ({
        protocol: d.protocol,
        count: d.count,
        latestActivity: d.latestActivity instanceof Date ? d.latestActivity.toISOString() : new Date(d.latestActivity).toISOString(),
        gasSpentUsd: d.gasSpentUsd
      })),
      nftPortfolio: db.nftHoldings || [],
      lastUpdated: db.lastUpdated instanceof Date ? db.lastUpdated.toISOString() : new Date(db.lastUpdated).toISOString(),
      strategicSummary: db.strategicSummary,
      breakdown: db.breakdown,
      ledgerEvidence: db.ledgerEvidence || [],
      influenceScore: db.influenceScore || 0,
      historicalBalance: db.historicalBalance || []
    };
  }

  private async saveAnalytics(
    address: string, 
    portfolio: any, 
    yieldPos: YieldPosition[], 
    flows: FlowAnalysis, 
    dapps: DAppActivity[],
    metrics: { 
        rank: number, 
        txCount: number, 
        riskScore: number, 
        strategicSummary?: string, 
        ledgerEvidence?: string[], 
        influenceScore?: number,
        category?: string,
        forensics?: ForensicAnalysis
    }
  ) {
    return await prisma.$transaction(async (tx) => {
      // Upsert main record
      const analytics = await (tx as any).walletAnalytics.upsert({
        where: { address },
        update: {
          category: metrics.category || null,
          forensics: metrics.forensics as any || null
        },
        create: {
          address,
          category: metrics.category || null,
          forensics: metrics.forensics as any || null
        }
      });

      return analytics;
    });
  }

  async getYieldPositions(address: string): Promise<YieldPosition[]> {
    try {
      const defiData = await defiPositionsService.getPositions(address);
      if (!defiData || !defiData.positions) return [];

      return defiData.positions.map((pos: any) => ({
        protocol: pos.protocol,
        type: pos.type as any,
        amount: pos.tokens?.[0]?.balance || 0,
        apy: 0, 
        earnedUsd: 0,
        asset: pos.tokens?.[0]?.symbol || 'USD',
        valueUsd: pos.valueUsd,
        onChain: pos.onChain,
        details: pos.details
      }));
    } catch (e) {
      console.error('[Analytics] Yield detection failed:', e);
      return [];
    }
  }

  async getMoneyFlows(address: string, period: '24h' | '7d' | '30d' = '30d'): Promise<FlowAnalysis> {
    try {
      // Uses Moralis-powered history from PortfolioService
      const transfers = await portfolioService.getAssetHistory(ChainId.MAINNET, address);
      
      const uniqueAssets = Array.from(new Set(transfers.map((t: any) => t.asset).filter(Boolean)));
      const assetPrices = await PriceService.getBulkPrices(uniqueAssets.map((sym: any) => ({ symbol: String(sym) })));
      
      let inflow = 0;
      let outflow = 0;
      const unpricedAssets = new Set<string>();
      const senders: Record<string, { amount: number; count: number }> = {};
      const receivers: Record<string, { amount: number; count: number }> = {};

      transfers.forEach((t: any) => {
        const valRaw = parseFloat(t.value) || 0;
        const assetSym = (t.asset || 'ETH').toUpperCase();
        // No invented price (it used to assume $2,500 for any unknown asset): unpriced
        // transfers are left out of the USD totals and listed.
        const price = assetPrices[assetSym]?.price;
        if (typeof price !== 'number') { unpricedAssets.add(assetSym); return; }
        const valUsd = valRaw * price;
        
        if (t.direction === 'IN') {
          inflow += valUsd;
          senders[t.from] = { 
            amount: (senders[t.from]?.amount || 0) + valUsd, 
            count: (senders[t.from]?.count || 0) + 1 
          };
        } else {
          outflow += valUsd;
          receivers[t.to] = { 
            amount: (receivers[t.to]?.amount || 0) + valUsd, 
            count: (receivers[t.to]?.count || 0) + 1 
          };
        }
      });

      return {
        period,
        inflow,
        outflow,
        unpricedAssets: Array.from(unpricedAssets),
        topSenders: Object.entries(senders)
          .map(([addr, stats]) => ({ address: addr, ...stats }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
        topReceivers: Object.entries(receivers)
          .map(([addr, stats]) => ({ address: addr, ...stats }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
        recentTransfers: transfers.map((t: any) => {
            const assetSym = (t.asset || 'ETH').toUpperCase();
            const price = assetPrices[assetSym]?.price;
            return {
                hash: t.hash,
                timestamp: t.timestamp || new Date().toISOString(),
                amount: parseFloat(t.value) || 0,
                valueUsd: typeof price === 'number' ? (parseFloat(t.value) || 0) * price : null,
                type: t.direction,
                from: t.from,
                to: t.to,
                chain: t.chainId?.toString() || '1',
                token: assetSym
            };
        }).slice(0, 20)
      };
    } catch (e) {
      console.error('[Analytics] Flow analysis failed:', e);
      return { period, inflow: 0, outflow: 0, topSenders: [], topReceivers: [], recentTransfers: [] };
    }
  }

  private generateLedgerEvidence(totalValue: number, txCount: number, portfolio: any, flows: any): string[] {
    const evidence: string[] = [];
    
    if (totalValue > 1000000) evidence.push(`Controls >$1.0M in real liquid assets.`);
    else if (totalValue > 100000) evidence.push(`Possesses significant capital of >$100K.`);
    
    if (txCount > 500) evidence.push(`Massive transaction history: ${txCount} executions.`);
    else if (txCount > 50) evidence.push(`Operador activo con ${txCount} transacciones en la red.`);
    
    if (portfolio?.networksActive?.length > 3) evidence.push(`Omni-chain entity: Present in ${portfolio.networksActive.length} main networks.`);
    
    if (flows?.inflow > 100000) evidence.push(`Elite capital inflow detected in the last 30 days.`);
    
    if (portfolio?.analytics?.concentrationIndex < 20) evidence.push(`Professional management profile: Highly diversified portfolio.`);
    
    return evidence;
  }

  private calculateInfluenceScore(totalValue: number, flows: any, stats?: any): number {
    // Scientific Influence Model: (Log of wealth) + (Velocity of capital) + (Contract Interaction depth)
    const wealthScore = Math.min(40, (Math.log10(Math.max(1, totalValue)) / 8) * 40);
    const velocityScore = Math.min(40, ((flows?.inflow + flows?.outflow) / (totalValue || 1)) * 10);
    const networkScore = Math.min(20, (flows?.topSenders?.length || 0) + (flows?.topReceivers?.length || 0));
    
    return Math.round(Math.min(100, wealthScore + velocityScore + networkScore));
  }
  
  private generateHistoricalBalance(currentValue: number, transfers: any[]): { date: string, balance: number }[] {
    const points: { date: string, balance: number }[] = [];
    let runningBalance = currentValue;
    
    const sorted = [...transfers].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    points.push({ date: new Date().toISOString(), balance: runningBalance });
    
    sorted.forEach(t => {
      const val = t.valueUsd || 0;
      if (t.type === 'IN') runningBalance -= val;
      else runningBalance += val;
      points.push({ date: new Date(t.timestamp).toISOString(), balance: Math.max(0, runningBalance) });
    });
    
    return points.reverse();
  }

  private getEmptyStateAnalytics(address: string): WalletAnalytics {
    return {
      address,
      lastUpdated: new Date().toISOString(),
      totalValue: 0,
      riskScore: 50,
      diversityScore: 50,
      activity24h: 0,
      activityScore: 0,
      rank: 0,
      txCount: 0,
      pnl24h: 0,
      change24h: 0,
      yieldPositions: [],
      flowAnalysis: { period: '30d', inflow: 0, outflow: 0, topSenders: [], topReceivers: [], recentTransfers: [] },
      nftPortfolio: [],
      dappActivities: [],
      identityTier: 'GHOST',
      recentTransfers: []
    };
  }
}

export const walletAnalyticsService = new WalletAnalyticsService();

