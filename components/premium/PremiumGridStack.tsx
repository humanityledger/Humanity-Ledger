"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useAccount, useBalance } from 'wagmi';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { Activity, Clock, Zap, ArrowUpRight, ArrowDownRight, TrendingUp, GripVertical } from 'lucide-react';
import { useDragOrder } from '@/hooks/useDragOrder';
import { useMarketStream } from '@/context/MarketStreamContext';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { useSystemFormatter } from '@/hooks/useSystemFormatter';

const PERFECTION_TOKENS = [
    "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "DOT", "LINK"
];

interface ActiveMarketState {
    momentumScore: number;
    direction: 'BEARISH' | 'BULLISH' | 'NEUTRAL';
    targetPrice: number;
    currentPrice?: number;
    volumeValue: number;
    vigorPercent: number;
    isAccumulation: boolean;
    confluenceValue: number;
    hasData: boolean;
    icebergs: any[];
    probabilityOfReversal: number;
    expectedMove: number;
}

function MacroMetricsCard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/sovereign/stats');
                const data = await res.json();
                setStats(data);
            } catch (e) {
                console.error('Failed to fetch sovereign stats');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 15000);
        return () => clearInterval(interval);
    }, []);

    const { formatLargeMoney } = useSystemFormatter();

    const volumeNum = stats?.totalVolumeUSD ? parseFloat(stats.totalVolumeUSD) : 0;
    const volumeFormatted = formatLargeMoney(volumeNum);

    return (
        <div className="bg-white border border-[#E5E5E5] text-[#050505] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] rounded-xl relative overflow-hidden group transition-all h-full">
            <div className="absolute -inset-2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#00C076]/10 via-transparent to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
            <p className="text-[9px] font-black text-[#888888] uppercase tracking-[0.2em] mb-4 flex items-center gap-2 relative z-10">
                <Activity size={12}/> Global Liquidity Grid
            </p>
            {loading ? (
                <div className="space-y-2 animate-pulse">
                    <div className="h-8 bg-[#E5E5E5] rounded w-3/4" />
                    <div className="h-4 bg-[#FFFFFF] rounded w-1/2" />
                </div>
            ) : (
                <>
                    <h2 className="text-4xl font-mono text-[#00C076] tracking-tighter drop-shadow-sm relative z-10 privacy-sensitive">
                        {volumeFormatted}
                    </h2>
                    <p className="text-[10px] font-mono text-[#888888] uppercase tracking-widest mt-2 relative z-10">
                        Sovereign Net Flow (24H)
                    </p>
                    {stats?.topPairs && (
                        <div className="mt-4 pt-4 border-t border-[#E5E5E5] relative z-10">
                            <p className="text-[8px] font-black text-[#555] uppercase tracking-[0.2em] mb-2">Alpha Targets (Top Peers)</p>
                            <div className="flex gap-2 flex-wrap">
                                {stats.topPairs.slice(0, 3).map((p: any) => (
                                    <span key={p.symbol} className="text-[9px] font-mono font-bold bg-[#FFFFFF] border border-[#E5E5E5] px-2 py-0.5 rounded text-[#050505]">
                                        {p.symbol}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}


function ProTokenRow({ symbol, index }: { symbol: string; index: number }) {
    const { markets } = useMarketStream();
    const [isHovered, setIsHovered] = useState(false);
    const { formatMoney, formatLargeMoney } = useSystemFormatter();
    
    // Consume from the global internal stream (bypasses ALL client rate limits)
    const marketData = markets.get(`${symbol}USDT`);

    if (!marketData) {
        return (
            <tr className="border-b border-[#E5E5E5] bg-white opacity-60">
                <td className="py-5 px-6">
                    <div className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E5E5E5] animate-pulse" />
                        <span className="text-sm font-black text-[#888888] tracking-tight animate-pulse">{symbol}</span>
                    </div>
                </td>
                <td className="py-5 px-6 font-mono text-sm text-[#888888] animate-pulse">Syncing...</td>
                <td className="py-5 px-6 font-mono text-xs text-[#888888] animate-pulse">--</td>
                <td className="py-5 px-6 font-mono text-xs text-[#888888] animate-pulse">--</td>
                <td className="py-5 px-6 font-mono text-xs text-[#888888] animate-pulse">--</td>
                <td className="py-5 px-6 font-mono text-xs text-[#888888] animate-pulse">--</td>
                <td className="py-5 px-6 text-right">--</td>
            </tr>
        );
    }

    const currentPrice = parseFloat(marketData.lastPrice || '0');
    const priceChange24h = parseFloat(marketData.priceChangePercent || '0');
    const volumeValue = parseFloat(marketData.quoteVolume || '0');
    
    const isBull = priceChange24h >= 0;
    const vigorPercent = 50 + Math.min(50, Math.max(-50, priceChange24h * 3));
    const momentumScore = Math.min(100, Math.max(0, 50 + (priceChange24h * 5)));
    const direction = isBull ? 'BULLISH' : 'BEARISH';

    return (
        <tr 
            className={`border-b border-[#E5E5E5] bg-white hover:bg-[#FFFFFF] cursor-pointer transition-colors group relative`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <td className="py-5 px-6">
                <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: isBull ? '#00C076' : '#FF3B30' }} />
                    <span className="text-sm font-black text-[#050505] tracking-tight group-hover:text-[#888888] transition-colors">{symbol}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#E5E5E5] text-[#888888] font-bold uppercase tracking-[0.2em]">PERP</span>
                </div>
            </td>
            <td className="py-5 px-6 font-mono text-sm text-[#050505] font-bold privacy-sensitive">
                {formatMoney(currentPrice, 4)}
            </td>
            <td className={`py-5 px-6 font-mono text-xs font-bold ${isBull ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>
                <div className="flex items-center gap-1">
                    {isBull ? <ArrowUpRight size={13} strokeWidth={3}/> : <ArrowDownRight size={13} strokeWidth={3}/>}
                    {Math.abs(priceChange24h).toFixed(2)}%
                </div>
            </td>
            <td className="py-5 px-6">
                <div className="flex flex-col">
                    <span className="text-xs text-[#050505] font-mono privacy-sensitive">{formatLargeMoney(volumeValue)}</span>
                    <span className="text-[9px] text-[#888888] uppercase tracking-[0.2em] mt-0.5">24h Vol</span>
                </div>
            </td>
            <td className="py-5 px-6">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E5E5E5] ${isBull ? 'text-[#00C076]' : 'text-[#FF3B30]'}`}>
                        {vigorPercent.toFixed(0)}%
                    </span>
                    <span className="text-[9px] text-[#888888] uppercase tracking-[0.2em]">
                        {isBull ? 'Buyers' : 'Sellers'}
                    </span>
                </div>
            </td>
            <td className="py-5 px-6">
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 bg-[#E5E5E5] overflow-hidden w-24 rounded-full">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.max(0, momentumScore))}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full ${direction === 'BULLISH' ? 'bg-[#00C076]' : 'bg-[#FF3B30]'}`}
                        />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#050505] w-8">{momentumScore.toFixed(0)}</span>
                </div>
            </td>
            <td className="py-5 px-6 text-right">
                <button className="opacity-0 group-hover:opacity-100 px-5 py-2 rounded-lg bg-white text-[#FFFFFF] text-[9px] font-black uppercase tracking-[0.2em] transition-all">
                    Execute
                </button>
            </td>
        </tr>
    );
}

//  Draggable stat card definitions 
const INITIAL_CARDS = [
    { id: 'live-portfolio' },
    { id: 'macro-metrics' },
    { id: 'system-status' },
];

export function PremiumGridStack() {
    const { address, isConnected } = useSystemAccount();
    const { data: balance } = useBalance({ address });
    const [selectedCategory, setSelectedCategory] = useState<'MAJOR' | 'ALT'>('MAJOR');
    const [isRearranging, setIsRearranging] = useState(false);
    const [cards, setCards, resetCards] = useDragOrder(INITIAL_CARDS, 'dashboard-widget-order');
    const { settings } = useSettingsStore();

    const displayTokens = selectedCategory === 'MAJOR' 
        ? PERFECTION_TOKENS.slice(0, 5) 
        : PERFECTION_TOKENS.slice(5, 10);

    return (
        <div className="w-full h-full min-h-0 flex flex-col gap-6 p-6 animate-in fade-in duration-700 font-sans overflow-hidden">

            {/*  DRAGGABLE STAT CARDS  */}
            <div className="shrink-0 h-[170px]">
            <Reorder.Group
                axis="x"
                values={cards}
                onReorder={setCards}
                className="flex md:grid md:grid-cols-3 gap-4 md:gap-6 overflow-x-auto overflow-y-hidden md:overflow-visible no-scrollbar w-full h-full pb-2 md:pb-0 scroll-smooth snap-x"
                style={{ listStyle: 'none', padding: 0, margin: 0 }}
                as="div"
            >
                {cards.map((card) => (
                    <Reorder.Item
                        key={card.id}
                        value={card}
                        drag={isRearranging}
                        dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
                        whileDrag={{ scale: 1.03, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.4)', zIndex: 50 }}
                        style={{ position: 'relative', cursor: isRearranging ? 'grab' : 'default' }}
                        as="div"
                        className="relative shrink-0 w-[85vw] sm:w-[320px] md:w-auto h-[150px] md:h-auto snap-center"
                    >
                        {/* Drag handle overlay */}
                        {isRearranging && (
                            <div className="absolute top-2 right-2 z-10 text-[#D4AF37] opacity-60">
                                <GripVertical size={14} />
                            </div>
                        )}

                        {/*  Card: Active Portfolio  */}
                        {card.id === 'live-portfolio' && (
                            <div className="bg-white border border-[#E5E5E5] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all rounded-xl relative overflow-hidden group h-full">
                                <div className="absolute inset-0 bg-gradient-to-tr from-[#FFFFFF] to-transparent pointer-events-none opacity-50" />
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <p className="text-[9px] font-black text-[#555] uppercase tracking-[0.2em]">Active Portfolio</p>
                                    {isConnected ? (
                                        <div className="w-2 h-2 rounded-full bg-[#00C076]" title="Connected to Native Wallet"/>
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-[#FF3B30]" title="Disconnected"/>
                                    )}
                                </div>
                                <div className="relative z-10">
                                    <h2 className="text-4xl font-mono text-[#050505] tracking-tighter drop-shadow-sm privacy-sensitive">
                                        {settings?.showBalances === false ? '****' : (isConnected && balance ? `${Number(balance.formatted).toFixed(4)} ${balance.symbol}` : '---')}
                                    </h2>
                                    <p className="text-[10px] font-mono text-[#888888] uppercase tracking-widest mt-2 flex items-center gap-2">
                                        Wallet: <span className="text-[#050505] bg-[#FFFFFF] border border-[#E5E5E5] px-2 py-0.5 rounded font-black privacy-sensitive">{isConnected && address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'Not Connected'}</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/*  Card: Macro Metrics  */}
                        {card.id === 'macro-metrics' && (
                            <MacroMetricsCard />
                        )}

                        {/*  Card: System Status  */}
                        {card.id === 'system-status' && (
                            <div className="bg-white border border-[#E5E5E5] p-6 flex flex-col justify-center rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-shadow h-full">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-2">
                                        <span className="text-[10px] font-black text-[#888888] uppercase tracking-[0.2em]">Node Sync</span>
                                        <span className="text-[10px] font-mono font-black text-[#00C076] flex items-center gap-1.5"><Clock size={11}/> 12ms</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-2">
                                        <span className="text-[10px] font-black text-[#888888] uppercase tracking-[0.2em]">AI Predictors</span>
                                        <span className="text-[10px] text-[#050505] font-black uppercase tracking-[0.2em]">Online</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-[#888888] uppercase tracking-[0.2em]">Execution</span>
                                        <span className="text-[10px] text-[#050505] font-black uppercase tracking-[0.2em]">Neural Routing</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Reorder.Item>
                ))}
            </Reorder.Group>
            </div>

            {/*  TERMINAL CONTROLS & TABLE SPLIT  */}
            <div className="flex-1 min-h-0 flex flex-col bg-white border border-[#E5E5E5] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
                <div className="shrink-0 flex items-center justify-between border-b-2 border-[#E5E5E5] p-4 bg-[#FFFFFF]">
                <div className="flex items-center gap-6">
                    <h3 className="text-2xl font-serif font-black tracking-tight text-[#050505] uppercase drop-shadow-sm">
                        Terminal Feed
                    </h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setSelectedCategory('MAJOR')}
                            className={`px-5 py-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all rounded-lg ${selectedCategory === 'MAJOR' ? 'bg-white text-[#FFFFFF] shadow-md' : 'text-[#888888] hover:text-[#050505] hover:bg-black/5'}`}
                        >
                            Majors
                        </button>
                        <button 
                            onClick={() => setSelectedCategory('ALT')}
                            className={`px-5 py-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all rounded-lg ${selectedCategory === 'ALT' ? 'bg-white text-[#FFFFFF] shadow-md' : 'text-[#888888] hover:text-[#050505] hover:bg-black/5'}`}
                        >
                            Altcoins
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Rearrange toggle */}
                    <button
                        onClick={() => {
                            if (isRearranging) setIsRearranging(false);
                            else setIsRearranging(true);
                        }}
                        className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border transition-all flex items-center gap-1.5 ${
                            isRearranging
                                ? 'bg-white border-[#050505] text-white'
                                : 'border-[#E5E5E5] text-[#888888] hover:border-[#050505] hover:text-[#050505]'
                        }`}
                    >
                        <GripVertical size={11} /> {isRearranging ? 'Done' : 'Rearrange'}
                    </button>
                    {isRearranging && (
                        <button
                            onClick={resetCards}
                            className="px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border border-[#E5E5E5] text-[#888888] hover:text-[#FF3B30] hover:border-[#FF3B30] transition-all bg-white"
                        >
                            Reset
                        </button>
                    )}
                    <div className="hidden lg:flex items-center gap-3 bg-white border border-[#E5E5E5] px-4 py-2 rounded-full shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-[#00C076] animate-pulse"/>
                        <span className="text-[9px] font-black text-[#555] uppercase tracking-[0.2em]">Sovereign Mesh Active</span>
                    </div>

                </div>
            </div>



                {/*  MASTER TABLE  */}
                <div className="flex-1 min-h-0 overflow-y-auto msv-hide-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#FFFFFF] border-b-2 border-[#E5E5E5] sticky top-0 z-20">
                            <tr>
                                <th className="py-4 px-6 text-[9px] font-black text-[#888888] uppercase tracking-[0.2em]">Asset Index</th>
                                <th className="py-4 px-6 text-[9px] font-black text-[#888888] uppercase tracking-[0.2em]">Last Market Price</th>
                                <th className="py-4 px-6 text-[9px] font-black text-[#888888] uppercase tracking-[0.2em]">Realized 24h Move</th>
                                <th className="py-4 px-6 text-[9px] font-black text-[#888888] uppercase tracking-[0.2em]">Total 24h Vol</th>
                                <th className="py-4 px-6 text-[9px] font-black text-[#888888] uppercase tracking-[0.2em]">Spread Edge</th>
                                <th className="py-4 px-6 text-[9px] font-black text-[#888888] uppercase tracking-[0.2em]">Momentum RSI</th>
                                <th className="py-4 px-6 text-right text-[9px] font-black text-[#888888] uppercase tracking-[0.2em]">Ops</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {displayTokens.map((token, idx) => (
                                    <ProTokenRow key={token} symbol={token} index={idx} />
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
