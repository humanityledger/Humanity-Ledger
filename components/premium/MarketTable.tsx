"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ShoppingCart, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface CoinData {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    total_volume: number;
    price_change_1h: number;
    price_change_24h: number;
    price_change_7d: number;
    price_change_30d: number;
    price_change_1y: number;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
}

export default function MarketTable() {
    const { t } = useLanguage();
    const [coins, setCoins] = useState<CoinData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
    const [flashStates, setFlashStates] = useState<Record<string, 'up' | 'down' | null>>({});

    const fetchData = async () => {
        try {
            const res = await fetch('/api/bubbles');
            const json = await res.json();
            if (json.bubbles) {
                const newCoins: CoinData[] = json.bubbles;
                
                // Determine flashes
                const newFlashes: Record<string, 'up' | 'down' | null> = {};
                newCoins.forEach(coin => {
                    const prev = prevPrices[coin.id];
                    if (prev !== undefined && prev !== coin.current_price) {
                        newFlashes[coin.id] = coin.current_price > prev ? 'up' : 'down';
                    }
                });

                if (Object.keys(newFlashes).length > 0) {
                    setFlashStates(newFlashes);
                    setTimeout(() => setFlashStates({}), 2000); // Clear flashes after 2s
                }

                const newPrices: Record<string, number> = {};
                newCoins.forEach(c => newPrices[c.id] = c.current_price);
                
                setCoins(newCoins);
                setPrevPrices(newPrices);
                setError(null);
            } else if (json.error) {
                console.warn('Market API Error:', json.error);
                if (coins.length === 0) setError(json.error);
            }
        } catch (err) {
            console.error('Failed to fetch market data:', err);
            if (coins.length === 0) setError('Connection failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // REAL-TIME UPDATE: 3 seconds is optimal (fast enough for real-time feel, won't overload server)
        const interval = setInterval(fetchData, 3000); 
        return () => clearInterval(interval);
    }, [prevPrices]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: val < 1 ? 4 : 2,
            maximumFractionDigits: val < 1 ? 6 : 2
        }).format(val);
    };

    const formatCompact = (val: number) => {
        if (val >= 1e12) return safeToFixed(val / 1e12, 2) + ' T$';
        if (val >= 1e9) return safeToFixed(val / 1e9, 2) + ' B$';
        if (val >= 1e6) return safeToFixed(val / 1e6, 2) + ' M$';
        return safeToLocaleString(val) + ' $';
    };

    const ActivePriceTicker = ({ value, flash }: { value: number, flash: 'up' | 'down' | null }) => {
        const displayValue = value;

        return (
            <div className={`transition-all duration-700 px-3 py-1 rounded-xl ${
                flash === 'up' ? 'bg-emerald-500/20' : 
                flash === 'down' ? 'bg-rose-500/20' : 
                'bg-transparent'
            }`}>
                <span className={`font-black tabular-nums transition-colors duration-300 ${
                    flash === 'up' ? 'text-emerald-500' :
                    flash === 'down' ? 'text-rose-500' :
                    'text-white'
                }`}>
                    {formatCurrency(displayValue)}
                </span>
            </div>
        );
    };

    const PercentBadge = ({ val, coinId, timeframe }: { val: number, coinId: string, timeframe: string }) => {
        const [displayValue, setDisplayValue] = useState(val);
        
        useEffect(() => {
            setDisplayValue(val);
        }, [val]);

        const isPos = displayValue >= 0;

        return (
            <div className={`px-2 py-1 rounded-lg text-[10px] font-black tabular-nums transition-all duration-500 ${
                isPos ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
            }`}>
                {isPos ? '+' : ''}{safeToFixed(displayValue, 2)}%
            </div>
        );
    };

    const ActiveVolumeTicker = ({ value }: { value: number }) => {
        return (
            <span className="text-sm font-black text-white tabular-nums transition-all duration-1000">
                {formatCompact(value)}
            </span>
        );
    };

    if (loading && coins.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-black/20" size={32} />
            </div>
        );
    }

    if (error && coins.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-rose-500 font-bold mb-4 uppercase tracking-widest text-xs">{error}</p>
                <button 
                  onClick={fetchData}
                  className="px-6 py-2 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em]"
                >
                  {t('market.retry')}
                </button>
            </div>
        );
    }

    // Pagination calculations
    const totalPages = Math.ceil(coins.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentCoins = coins.slice(startIndex, endIndex);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    return (
        <div className="w-full bg-black/80  backdrop-blur-xl rounded-[2.5rem] border border-white/20 overflow-hidden shadow-2xl">
            {/* Pagination Header */}
            <div className="p-6 bg-black/20 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs font-black text-white/60 uppercase tracking-widest">
                        Showing {startIndex + 1}-{Math.min(endIndex, coins.length)} of {coins.length} Cryptos
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
                    >
                         Previous
                    </button>
                    
                    <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_idx, i) => i + 1).map((page) => {
                            // Show first page, last page, current page, and adjacent pages
                            if (
                                page === 1 ||
                                page === totalPages ||
                                (page >= currentPage - 1 && page <= currentPage + 1)
                            ) {
                                return (
                                    <button
                                        key={page}
                                        onClick={() => goToPage(page)}
                                        className={`w-10 h-10 rounded-xl text-[11px] font-black transition-all ${
                                            currentPage === page
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                );
                            } else if (page === currentPage - 2 || page === currentPage + 2) {
                                return <span key={page} className="text-white/30 px-1">...</span>;
                            }
                            return null;
                        })}
                    </div>
                    
                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
                    >
                        Next 
                    </button>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-black/5">
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-white/30">#</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-white/30">{t('market.name')}</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-white/30">{t('market.price')}</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-white/30">{t('market.market_cap')}</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-white/30">{t('market.volume_24h')}</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-white/30">{t('market.hour')}</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-white/30">{t('market.day')}</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-white/30">{t('market.week')}</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-white/30">{t('market.month')}</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-white/30">{t('market.year')}</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-white/30">Analytics</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-white/30">{t('market.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentCoins.map((coin, i) => (
                            <motion.tr 
                                key={coin.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.01 }}
                                className="group hover:bg-white/40 border-b border-black/5 transition-colors"
                            >
                                <td className="px-6 py-4 text-sm font-black text-white/40 tabular-nums">
                                    {startIndex + i + 1}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <CoinIcon src={coin.image} alt={coin.name} />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-white">{coin.name}</span>
                                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">{coin.symbol}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end">
                                        <ActivePriceTicker 
                                            value={coin.current_price} 
                                            flash={flashStates[coin.id] || null} 
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-black text-white tabular-nums">
                                    {formatCompact(coin.market_cap)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <ActiveVolumeTicker value={coin.total_volume} />
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <PercentBadge val={coin.price_change_1h} coinId={coin.id} timeframe="1h" />
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <PercentBadge val={coin.price_change_24h} coinId={coin.id} timeframe="24h" />
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <PercentBadge val={coin.price_change_7d} coinId={coin.id} timeframe="7d" />
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <PercentBadge val={coin.price_change_30d} coinId={coin.id} timeframe="30d" />
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <PercentBadge val={coin.price_change_1y} coinId={coin.id} timeframe="1y" />
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {coin.riskLevel ? (
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border ${
                                            coin.riskLevel === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                            coin.riskLevel === 'HIGH' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                            coin.riskLevel === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                            'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                coin.riskLevel === 'CRITICAL' ? 'bg-rose-500' :
                                                coin.riskLevel === 'HIGH' ? 'bg-orange-500' :
                                                coin.riskLevel === 'MEDIUM' ? 'bg-yellow-500' :
                                                'bg-emerald-500'
                                            }`} />
                                            {coin.riskLevel}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] font-black text-white/10 italic">UNRATED</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <a 
                                            href={`https://www.coingecko.com/es/monedas/${coin.id}`} 
                                            target="_blank" 
                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white/40 hover:text-blue-400"
                                            title="View on CoinGecko"
                                        >
                                            <ExternalLink size={14} />
                                        </a>

                                        <button 
                                            onClick={() => window.location.href = `/token-attest?symbol=${coin.symbol}&id=${coin.id}`}
                                            className="px-4 py-2 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-lg"
                                        >
                                            <ShoppingCart size={12} />
                                            {t('common.attest')}
                                        </button>

                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination Footer */}
            <div className="p-6 bg-black/5 border-t border-black/5 flex items-center justify-between">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Real-time updates (every 3 seconds)
                </p>
                
                <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Page {currentPage} of {totalPages}
                </div>
            </div>
        </div>
    );
}

function CoinIcon({ src, alt }: { src: string, alt: string }) {
    const [error, setError] = useState(false);

    if (error) {
        return (
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-[8px] font-bold text-white/50">
                {alt.slice(0, 2)}
            </div>
        );
    }
    
    return (
        <img 
            src={src} 
            alt={alt} 
            className="w-8 h-8 rounded-full group-hover:scale-110 transition-transform"
            onError={() => setError(true)}
        />
    );
}


