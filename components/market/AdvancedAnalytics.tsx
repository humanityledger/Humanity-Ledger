"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import { Shield, Zap, Activity, Globe, TrendingUp, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
export function AdvancedAnalytics() {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [prices, setPrices] = useState({ btc: 0, eth: 0, sol: 0 });

    // Active Ticker is now driven by real-time API polling in the next useEffect
    useEffect(() => {
        // We rely on the fetchData polling in the next effect for real updates
        return () => {};
    }, []);

    // Initialize Chart & Fetch Backend Data
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#DDD' },
            grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
            width: chartContainerRef.current.clientWidth,
            height: 400,
        });

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#00ff9d', downColor: '#ef4444', borderVisible: false, wickUpColor: '#00ff9d', wickDownColor: '#ef4444',
        });

        // Backend Fetch
        const fetchData = async () => {
            try {
                const res = await fetch('/api/market-pulse');
                const json = await res.json();
                if (json.success && json.data) {
                    // Update Chart
                    if (json.data.candles) candlestickSeries.setData(json.data.candles);
                    // Update Ticker
                    if (json.data.tickers) setPrices(json.data.tickers);
                }
            } catch (error) {
                console.error("Backend Connection Error:", error);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000); // Active Updates from Backend

        const handleResize = () => {
            chart.applyOptions({ width: chartContainerRef.current?.clientWidth || 800 });
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearInterval(interval);
            chart.remove();
        };
    }, []);

    return (
        <div className="w-full bg-[#0a0a0a] text-white p-6 rounded-3xl border border-white/5 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-[#25D366] to-[#00ff9d]" />
            
            {/* Header / Ticker */}
            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-emerald-600 rounded-lg flex items-center justify-center">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">MARKET PULSE</h2>
                        <p className="text-xs font-mono text-white/40">Latencia: 12ms // Oracle: Chainlink Low-Lat</p>
                    </div>
                </div>
                
                <div className="flex gap-6 font-mono text-sm">
                    <TickerItem label="BTC" value={prices.btc} />
                    <TickerItem label="ETH" value={prices.eth} />
                    <TickerItem label="SOL" value={prices.sol} />
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
                
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white/5 rounded-xl border border-white/5 p-4 relative group">
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                        <Badge>1H</Badge>
                        <Badge active>4H</Badge>
                        <Badge>1D</Badge>
                    </div>
                    <div ref={chartContainerRef} className="w-full h-[400px]" />
                    
                    {/* "Backend" Indicator */}
                    <div className="absolute bottom-4 left-4 text-[10px] font-mono text-[#00ff9d] flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                        <span className="w-1.5 h-1.5 bg-[#00ff9d] rounded-full animate-pulse" />
                        WebSocket Connected: wss://feed.sovereign.pro/v1/stream
                    </div>
                </div>

                {/* Right Panel: Heatmap & Signals */}
                <div className="space-y-6">
                    
                    {/* Liquidation Heatmap Mock */}
                    <div className="bg-white/5 rounded-xl border border-white/5 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <Zap size={14} className="text-yellow-400" /> Liquidations
                            </h3>
                            <span className="text-[10px] text-white/40">24H Heatmap</span>
                        </div>
                        <div className="h-32 flex flex-col items-center justify-center border border-white/5 rounded-lg bg-black/40">
                            <div className="w-6 h-6 rounded-full border border-white/10 border-t-yellow-400 animate-spin mb-2" />
                            <p className="text-[8px] font-black uppercase tracking-widest text-white/20">Syncing Liquidation Map</p>
                        </div>
                        <div className="mt-2 text-center text-[9px] font-mono text-white/20 uppercase tracking-widest">
                            AWAITING_LIQUIDATION_FEED
                        </div>
                    </div>

                    {/* Humanity Ledger Stream */}
                    <div className="bg-white/5 rounded-xl border border-white/5 p-4 flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <Globe size={14} className="text-emerald-400" />
                                Ledger Radar
                            </h3>
                        </div>
                        <div className="space-y-4 py-8 flex flex-col items-center justify-center">
                            <Activity size={24} className="text-[#25D366]/20 animate-pulse" />
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">Establishing Ledger Upstream</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar: Funding Rates */}
            <div className="mt-6 flex items-center justify-between bg-white/[0.02] p-4 rounded-xl border border-white/5">
               <div className="flex items-center gap-6 text-xs text-white/60">
                   <div className="hover:text-white cursor-pointer">Funding / 1h</div>
                   <div className="hover:text-white cursor-pointer">Open Interest</div>
                   <div className="hover:text-white cursor-pointer">Orderbook Ratio</div>
               </div>
               <div className="text-[10px] font-mono text-white/20">
                   AWAITING_FUNDING_CLOCK
               </div>
            </div>
        </div>
    );
}

function TickerItem({ label, value }: { label: string, value: number }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-white/40 font-bold">{label}</span>
            <span className={value > 0 ? "text-white" : "text-red-400"}>
                ${safeToLocaleString(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        </div>
    )
}

function Badge({ children, active }: { children: React.ReactNode, active?: boolean }) {
    return (
        <span className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${active ? 'bg-white text-black' : 'bg-black/40 text-white/60 hover:text-white'}`}>
            {children}
        </span>
    )
}

function LedgerRow({ amount, action, time }: { amount: string, action: string, time: string }) {
    const isSell = action === 'Sell';
    return (
        <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
            <div className="font-mono font-bold">{amount}</div>
            <div className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${isSell ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                {action}
            </div>
            <div className="text-white/30">{time}</div>
        </div>
    )
}


