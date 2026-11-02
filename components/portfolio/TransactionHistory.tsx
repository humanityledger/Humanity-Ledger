"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, ExternalLink, Activity, Cpu, ShieldAlert } from 'lucide-react';
import { useWalletStore } from '@/lib/store/wallet-store';
import { TransactionManager } from '@/lib/tx-manager';
import { ethers } from 'ethers';
import { toast } from 'sonner';

type TxStatus = 'SUCCESS' | 'FAILED';
type TxDirection = 'SEND' | 'RECEIVE';

interface ParsedTx {
    hash: string;
    direction: TxDirection;
    status: TxStatus;
    value: string;
    fromToken: string;
    timeStamp: string;
    from: string;
    to: string;
    gasUsed: string;
    gasPrice: string;
    nonce: string;
    blockNumber: string;
    dateLabel: string;
}

function parseTxList(raw: any[], walletAddress: string): ParsedTx[] {
    return raw.map((tx: any) => {
        const d = new Date(Number(tx.timeStamp) * 1000);
        // Format date strictly for grouping (e.g. "May 5, 2026")
        const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        return {
            hash: tx.hash || '',
            direction: (tx.from || '').toLowerCase() === walletAddress.toLowerCase() ? 'SEND' : 'RECEIVE',
            status: tx.txreceipt_status === '1' || tx.isError === '0' ? 'SUCCESS' : 'FAILED',
            value: tx.value ? (Number(tx.value) / 1e18).toFixed(5).replace(/\.?0+$/, '') : '0',
            fromToken: 'ETH',
            timeStamp: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            from: tx.from || '',
            to: tx.to || '',
            gasUsed: tx.gasUsed || '0',
            gasPrice: tx.gasPrice ? (Number(tx.gasPrice) / 1e9).toFixed(2) : '0', // Gwei
            nonce: tx.nonce || '0',
            blockNumber: tx.blockNumber || '0',
            dateLabel
        };
    });
}

export function TransactionHistory({ address, scannerBase, activeNetwork }: { address: string, scannerBase: string, activeNetwork: string }) {
    const [transactions, setTransactions] = useState<ParsedTx[]>([]);
    const [loading, setLoading] = useState(true);
    const [nativePrice, setNativePrice] = useState(0);
    const [isRescuing, setIsRescuing] = useState(false);
    
    const store = useWalletStore();

    const getNativeSymbolForNetwork = (net: string) => {
        switch(net) {
            case 'bsc': return 'BNB';
            case 'polygon': return 'POL';
            case 'avalanche': return 'AVAX';
            default: return 'ETH';
        }
    };
    const nativeSymbol = getNativeSymbolForNetwork(activeNetwork);

    // Fetch live native token price for fiat display
    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const res = await fetch(`/api/prices?symbols=${nativeSymbol}`);
                const data = await res.json();
                const p = data?.[nativeSymbol]?.price || data?.[nativeSymbol] || 0;
                if (p > 0) setNativePrice(p);
            } catch {}
        };
        fetchPrice();
    }, [nativeSymbol]);

    const fetchHistory = useCallback(async () => {
        if (!address) { setLoading(false); return; }
        setLoading(true);
        try {
            const getApiEndpoint = (net: string) => {
                switch(net) {
                    case 'polygon': return 'https://api.polygonscan.com/api';
                    case 'arbitrum': return 'https://api.arbiscan.io/api';
                    case 'optimism': return 'https://api-optimistic.etherscan.io/api';
                    case 'base': return 'https://api.basescan.org/api';
                    case 'bsc': return 'https://api.bscscan.com/api';
                    case 'worldchain': return 'https://api.worldscan.org/api';
                    default: return 'https://api.etherscan.io/api';
                }
            };
            const url = `/api/internal/etherscan?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=25&sort=desc`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.status === '1' && Array.isArray(json.result)) {
                setTransactions(parseTxList(json.result, address));
            } else {
                setTransactions([]);
            }
        } catch (e: any) {
            console.warn('[TransactionHistory] fetch failed:', e.message);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, [address, activeNetwork]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleRescue = async () => {
        if (!store.privateKey) return;
        setIsRescuing(true);
        try {
            const rpcUrl = activeNetwork === 'polygon' ? "https://polygon-rpc.com" : activeNetwork === 'arbitrum' ? "https://arb1.arbitrum.io/rpc" : activeNetwork === 'optimism' ? "https://mainnet.optimism.io" : "https://cloudflare-eth.com";
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const wallet = new ethers.Wallet(store.privateKey, provider);
            const txManager = new TransactionManager(wallet);
            
            const { pending, latest } = await txManager.getNonceStatus();
            if (pending === latest) {
                toast("Mempool is clear. No stuck transactions found.");
                setIsRescuing(false);
                return;
            }
            
            toast.loading("Broadcasting aggressive cancellation payload...");
            await txManager.cancelTransaction(pending);
            toast.dismiss();
            toast.success("Transaction cancelled successfully.");
            fetchHistory();
        } catch (e: any) {
            toast.dismiss();
            toast.error("Failed to rescue: " + e.message);
        } finally {
            setIsRescuing(false);
        }
    };

    if (loading) {
        return (
            <div className="border border-black/10 bg-white min-h-[300px] flex flex-col items-center justify-center gap-4">
                <Cpu size={24} className="animate-pulse text-black/20" />
                <p className="text-[11px] font-black uppercase tracking-widest text-black/50">Synchronizing Ledger...</p>
            </div>
        );
    }

    // Group transactions by date
    const grouped = transactions.reduce((acc, tx) => {
        if (!acc[tx.dateLabel]) acc[tx.dateLabel] = [];
        acc[tx.dateLabel].push(tx);
        return acc;
    }, {} as Record<string, ParsedTx[]>);

    return (
        <div className="border border-black/10 bg-white min-h-[300px] flex flex-col relative font-sans">
            <div className="absolute top-3 right-3 z-10">
                <button
                    onClick={fetchHistory}
                    className="w-7 h-7 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
                >
                    <RefreshCw size={12} className="text-black/60" />
                </button>
            </div>

            <div className="divide-y divide-black/5 flex-1 overflow-y-auto">
                {store.privateKey && (
                    <div className="p-4 bg-yellow-400/10 border-b border-yellow-400/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ShieldAlert size={16} className="text-yellow-600" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-700">Mempool Rescue</span>
                                <span className="text-xs text-yellow-700/70">Cancel stuck pending transactions safely.</span>
                            </div>
                        </div>
                        <button onClick={handleRescue} disabled={isRescuing} className="px-4 py-2 bg-yellow-400 text-yellow-900 text-[10px] font-black uppercase tracking-widest hover:bg-yellow-500 transition-colors disabled:opacity-50">
                            {isRescuing ? 'Rescuing...' : 'Clear Stuck Tx'}
                        </button>
                    </div>
                )}
                
                {Object.keys(grouped).length > 0 ? (
                    Object.entries(grouped).map(([date, txs]) => (
                        <div key={date}>
                            {/* MetaMask Date Header */}
                            <div className="px-4 py-2 bg-black/[0.02] text-[13px] font-bold text-black/60">
                                {date}
                            </div>
                            
                            {txs.map((tx, idx) => (
                                <a
                                    key={tx.hash || idx}
                                    href={`${scannerBase}/tx/${tx.hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] transition-colors group border-b border-black/5 last:border-0"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center border border-black/10">
                                            {tx.direction === 'SEND' 
                                                ? <ArrowUpRight size={20} className="text-[#0376c9]" /> // MetaMask blue
                                                : <ArrowDownLeft size={20} className="text-green-600" />
                                            }
                                        </div>
                                        <div>
                                            <span className="text-[15px] font-bold text-black block leading-tight mb-0.5">
                                                {tx.direction === 'SEND' ? 'Sent' : 'Received'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[13px] font-medium ${tx.status === 'SUCCESS' ? 'text-green-600' : 'text-red-500'}`}>
                                                    {tx.status === 'SUCCESS' ? 'Confirmed' : 'Failed'}
                                                </span>
                                                {tx.direction === 'SEND' && (
                                                    <span className="text-[9px] font-mono text-black/40 bg-black/5 px-1 rounded uppercase">Nonce: {tx.nonce}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-[15px] font-bold text-black block mb-0.5">
                                            {Number(tx.value) === 0 ? 'Contract Call' : `${tx.direction === 'SEND' ? '-' : '+'}${tx.value} ${nativeSymbol}`}
                                        </span>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[12px] text-black/50">
                                                {Number(tx.value) === 0 ? 'Smart Contract' : nativePrice > 0 ? `$${(Number(tx.value) * nativePrice).toFixed(2)} USD` : `${nativeSymbol}`}
                                            </span>
                                            <span className="text-[9px] text-black/30 font-mono mt-0.5">Gas: {tx.gasUsed} @ {tx.gasPrice} gwei</span>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    ))
                ) : (
                    <div className="p-16 text-center flex flex-col items-center justify-center flex-1">
                        <Activity size={28} className="text-black/10 mb-4" />
                        <p className="text-[14px] text-black/50 font-bold mb-2">No transactions yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}


