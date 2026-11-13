import { walletAnalyticsService } from '../wallet/WalletAnalyticsService';
import { analyticsService } from '../blockchain/AnalyticsService';
import { moralisService } from '../blockchain/MoralisService';
import { aiService, ForensicAnalysis } from './AIService';
import { PriceService } from '../blockchain/PriceService';
import { ethers } from 'ethers';

export interface SearchResult {
    type: 'ADDRESS' | 'TRANSACTION' | 'UNKNOWN';
    query: string;
    chain: string;
    data: any;
    forensics?: ForensicAnalysis;
    analytics?: {
        riskScore: number;
        trustScore: number;
        EliteConfidence: number;
        momentum?: number;
        impact?: 'LOW' | 'MEDIUM' | 'HIGH' | 'LEGENDARY' | 'UNKNOWN';
    };
}

/**
 *  LEGENDARY SEARCH ANALYTICS SERVICE 
 * High-performance engine for real-time complex on-chain discovery.
 */
export class SearchAnalyticsService {
    
    /**
     * The Legendary Engine
     * Orchestrates deep on-chain discovery for any query.
     */
    public async getLegendaryReport(query: string): Promise<SearchResult> {
        const cleanQuery = query.trim();
        
        // 1. Detect Query Type
        const isEVMAddress = /^0x[a-fA-F0-9]{40}$/.test(cleanQuery);
        const isEVMHash = /^0x[a-fA-F0-9]{64}$/.test(cleanQuery);
        const isBTCAddress = /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(cleanQuery);
        const isBTCHash = /^[a-fA-F0-9]{64}$/.test(cleanQuery) && !cleanQuery.startsWith('0x');

        if (isEVMAddress || isBTCAddress) {
            return this.handleAddressSearch(cleanQuery, isBTCAddress ? 'bitcoin' : 'eth');
        } else if (isEVMHash) {
            return this.handleTransactionSearch(cleanQuery, 'eth');
        } else if (isBTCHash) {
             return this.handleTransactionSearch(cleanQuery, 'bitcoin');
        }

        return {
            type: 'UNKNOWN',
            query: cleanQuery,
            chain: 'unknown',
            data: null
        };
    }

    private async handleAddressSearch(address: string, chain: string): Promise<SearchResult> {
        console.log(`[ENGINE]  Deep scanning address: ${address} on ${chain}`);
        
        try {
            // Parallelized Deep Fetch
            const [portfolio, report] = await Promise.all([
                walletAnalyticsService.getFullAnalytics(address, true, true),
                analyticsService.getAnalyticsReport(address)
            ]);

            const riskScore = portfolio.riskScore || 50;
            const EliteConfidence = portfolio.influenceScore || 0;

            return {
                type: 'ADDRESS',
                query: address,
                chain,
                data: { ...portfolio, ...report },
                forensics: portfolio.forensics || report.forensics,
                analytics: {
                    riskScore,
                    trustScore: 100 - riskScore,
                    EliteConfidence,
                    impact: portfolio.totalValue > 1000000 ? 'LEGENDARY' : portfolio.totalValue > 100000 ? 'HIGH' : 'MEDIUM'
                }
            };
        } catch (error) {
            console.error('[ENGINE] Address search failure:', error);
            throw error;
        }
    }

    private async handleTransactionSearch(hash: string, chain: string): Promise<SearchResult> {
        console.log(`[ENGINE]  Forensicating transaction: ${hash} on ${chain}`);
        
        try {
            if (chain === 'eth') {
                const tx: any = await moralisService.getTransaction(hash);
                if (!tx) throw new Error('Transaction not found in indexer');

                // Value analysis
                const valueNative = parseFloat(ethers.formatEther(tx.value || '0'));
                const priceMap = await PriceService.getBulkPrices([{ symbol: 'ETH' }]);
                // No invented price: without a quote the USD value is unknown (null).
                const ethPrice = priceMap['ETH']?.price;
                const valueUsd = typeof ethPrice === 'number' ? valueNative * ethPrice : null;

                // Deep Forensic Reasoning for the Tx Initiator
                const forensics = await aiService.analyzeAddressForensics(tx.from_address, {
                    transactionCount: 1,
                    activeAgeDays: 0,
                    historySnippet: [tx],
                    defiPositions: []
                });

                return {
                    type: 'TRANSACTION',
                    query: hash,
                    chain,
                    data: {
                        ...tx,
                        valueUsd,
                        formattedValue: valueNative.toFixed(4)
                    },
                    forensics,
                    analytics: {
                        riskScore: forensics.riskScore,
                        trustScore: 100 - forensics.riskScore,
                        EliteConfidence: forensics.isElite ? 90 : 20,
                        impact: valueUsd === null ? 'UNKNOWN' : valueUsd > 100000 ? 'LEGENDARY' : valueUsd > 10000 ? 'HIGH' : 'MEDIUM'
                    }
                };
            }
        } catch (e) {
            console.error(`[ENGINE] TX search failed for ${hash}:`, e);
        }

        return {
            type: 'TRANSACTION',
            query: hash,
            chain,
            data: { hash, status: 'NOT_FOUND_OR_UNSUPPORTED_CHAIN', timestamp: new Date().toISOString() },
            analytics: {
                riskScore: 50,
                trustScore: 50,
                EliteConfidence: 0,
                impact: 'LOW'
            }
        };
    }
}

export const searchAnalyticsService = new SearchAnalyticsService();
